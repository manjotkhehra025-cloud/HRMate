import { all, get, insert, one, run, update } from '../lib/db.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { badRequest, notFound, nowIso, today } from '../lib/http.js';
import { requirePerm } from '../lib/auth.js';
import { audit } from '../lib/audit.js';
import { push } from '../lib/notify.js';
import { canSeeEmployee, visibleEmployeeIds } from '../lib/scope.js';
import { UPLOAD_DIR } from '../lib/db.js';

const CATEGORIES = ['kyc', 'employment', 'finance', 'education', 'policy', 'benefits', 'it', 'other'];

async function storeDataUrl(dataUrl, folder) {
  if (!dataUrl || !String(dataUrl).startsWith('data:')) return null;
  const match = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const ext = (match[1].split('/')[1] || 'bin').replace('jpeg', 'jpg').split('+')[0];
  const dir = path.join(UPLOAD_DIR, folder);
  fs.mkdirSync(dir, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const buffer = Buffer.from(match[2], 'base64');
  fs.writeFileSync(path.join(dir, name), buffer);
  return { url: `/uploads/${folder}/${name}`, sizeKb: Math.round(buffer.length / 1024), ext };
}

export function register(router) {
  router.get('/api/documents', (ctx) => {
    const q = ctx.query;
    const where = ['d.company_id = ?'];
    const args = [ctx.actor.company_id];
    if (q.scope === 'mine') {
      where.push('d.employee_id = ?');
      args.push(ctx.actor.id);
    } else {
      const scope = visibleEmployeeIds(ctx.actor);
      if (scope !== null) {
        if (!scope.length) where.push('1 = 0');
        else {
          where.push(`d.employee_id IN (${scope.map(() => '?').join(',')})`);
          args.push(...scope);
        }
      }
    }
    if (q.employee_id) {
      if (!canSeeEmployee(ctx.actor, Number(q.employee_id))) throw new Object.assign(new Error('Forbidden'), { status: 403 });
      where.push('d.employee_id = ?');
      args.push(Number(q.employee_id));
    }
    if (q.category) {
      where.push('d.category = ?');
      args.push(q.category);
    }
    if (q.status) {
      where.push('d.status = ?');
      args.push(q.status);
    }
    if (q.search) {
      where.push('(d.title LIKE ? OR d.file_name LIKE ?)');
      args.push(`%${q.search}%`, `%${q.search}%`);
    }
    if (q.expiring === '1') {
      where.push("d.expiry_date IS NOT NULL AND d.expiry_date < date('now','+60 day')");
    }
    const rows = all(
      `SELECT d.*, e.first_name, e.last_name, e.emp_code, e.avatar_color, e.avatar_emoji
       FROM documents d LEFT JOIN employees e ON e.id = d.employee_id
       WHERE ${where.join(' AND ')} ORDER BY d.created_at DESC LIMIT 400`,
      ...args
    );
    return {
      rows: rows.map((d) => ({ ...d, owner: d.first_name ? `${d.first_name} ${d.last_name || ''}`.trim() : 'Company' })),
      categories: CATEGORIES.map((c) => ({ key: c, count: rows.filter((r) => r.category === c).length })),
      totals: {
        all: rows.length,
        verified: rows.filter((r) => r.status === 'verified').length,
        pending: rows.filter((r) => r.status === 'pending').length,
        rejected: rows.filter((r) => r.status === 'rejected').length,
        expiring: rows.filter((r) => r.expiry_date && r.expiry_date < new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10)).length
      }
    };
  });

  router.post('/api/documents', async (ctx) => {
    const { title, category = 'other', employee_id = null, expiry_date = null, issue_date = null, dataUrl = null, doc_type = 'pdf', file_name = null, tags = [] } = ctx.body;
    const targetId = employee_id || ctx.actor.id;
    if (targetId !== ctx.actor.id) requirePerm(ctx, 'document.verify');
    if (!title) throw badRequest('Document title is required');
    const stored = await storeDataUrl(dataUrl, targetId === ctx.actor.id ? 'mine' : 'hr');
    const id = insert('documents', {
      company_id: ctx.actor.company_id,
      employee_id: targetId,
      category: CATEGORIES.includes(category) ? category : 'other',
      title,
      doc_type,
      file_name: file_name || stored?.url?.split('/').pop() || `${title.toLowerCase().replace(/\s+/g, '-')}.pdf`,
      file_url: stored?.url || `/uploads/sample/${category}.pdf`,
      size_kb: stored?.sizeKb || 240,
      uploaded_by: ctx.actor.id,
      issue_date: issue_date || today(),
      expiry_date,
      verified: 0,
      status: 'pending',
      tags,
      created_at: nowIso()
    });
    audit(ctx, 'document.upload', 'document', id, `Uploaded ${title} (${category})`);
    push(ctx.actor.id, { type: 'document', title: 'Document uploaded', body: `${title} is pending HR verification.`, icon: '📄', link: '#/documents' });
    const hrAdmin = one("SELECT id FROM employees WHERE company_id = ? AND role IN ('hr_admin','hr_manager') LIMIT 1", ctx.actor.company_id);
    if (hrAdmin && hrAdmin !== ctx.actor.id) {
      push(hrAdmin, { type: 'document', title: 'Document needs verification', body: `${title} uploaded by ${ctx.actor.first_name}.`, icon: '🔍', link: '#/documents' });
    }
    return { id, file_url: stored?.url || null };
  });

  router.patch('/api/documents/:id', (ctx) => {
    requirePerm(ctx, 'document.verify');
    const id = Number(ctx.params.id);
    const doc = get('SELECT * FROM documents WHERE id = ?', id);
    if (!doc) throw notFound('Document not found');
    const patch = { ...ctx.body };
    if (patch.status === 'verified') {
      patch.verified = 1;
      patch.verified_by = ctx.actor.id;
      patch.verified_at = nowIso();
    }
    if (patch.status === 'rejected') patch.verified = 0;
    update('documents', id, patch);
    audit(ctx, `document.${patch.status || 'update'}`, 'document', id, `Document #${id} marked ${patch.status || 'updated'}`);
    if (doc.employee_id) {
      push(doc.employee_id, {
        type: 'document',
        title: patch.status === 'verified' ? 'Document verified ✅' : patch.status === 'rejected' ? 'Document rejected' : 'Document updated',
        body: doc.title,
        icon: patch.status === 'verified' ? '✅' : '📄',
        link: '#/documents'
      });
    }
    return { ok: true };
  });

  router.delete('/api/documents/:id', (ctx) => {
    const id = Number(ctx.params.id);
    const doc = get('SELECT * FROM documents WHERE id = ?', id);
    if (!doc) throw notFound('Document not found');
    if (doc.employee_id !== ctx.actor.id) requirePerm(ctx, 'document.delete');
    run('DELETE FROM documents WHERE id = ?', id);
    audit(ctx, 'document.delete', 'document', id, `Deleted document ${doc.title}`, { severity: 'warning' });
    return { ok: true };
  });

  // --- KYC -----------------------------------------------------------------
  router.get('/api/kyc', (ctx) => {
    const where = ['k.company_id = ?'];
    const args = [ctx.actor.company_id];
    const scope = visibleEmployeeIds(ctx.actor);
    if (ctx.query.scope === 'mine') {
      where.push('k.employee_id = ?');
      args.push(ctx.actor.id);
    } else if (scope !== null) {
      if (!scope.length) where.push('1 = 0');
      else {
        where.push(`k.employee_id IN (${scope.map(() => '?').join(',')})`);
        args.push(...scope);
      }
    }
    const rows = all(
      `SELECT k.*, e.first_name, e.last_name, e.emp_code, e.avatar_color, e.avatar_emoji, d.name AS department
       FROM kyc_checks k JOIN employees e ON e.id = k.employee_id LEFT JOIN departments d ON d.id = e.department_id
       WHERE ${where.join(' AND ')} ORDER BY k.submitted_at DESC LIMIT 300`,
      ...args
    );
    return {
      rows: rows.map((r) => ({ ...r, full_name: `${r.first_name} ${r.last_name || ''}`.trim() })),
      totals: {
        verified: rows.filter((r) => r.status === 'verified').length,
        pending: rows.filter((r) => r.status === 'pending').length,
        flagged: rows.filter((r) => r.status === 'flagged').length,
        coverage: rows.length ? Math.round((rows.filter((r) => r.status === 'verified').length / rows.length) * 100) : 0
      }
    };
  });

  router.post('/api/kyc', (ctx) => {
    const { type, note = null } = ctx.body;
    if (!type) throw badRequest('type is required');
    const id = insert('kyc_checks', {
      company_id: ctx.actor.company_id,
      employee_id: ctx.actor.id,
      type,
      status: 'pending',
      submitted_at: nowIso(),
      note
    });
    audit(ctx, 'kyc.submit', 'kyc', id, `Submitted ${type}`);
    return { id };
  });

  router.patch('/api/kyc/:id', (ctx) => {
    requirePerm(ctx, 'kyc.review');
    const id = Number(ctx.params.id);
    const check = get('SELECT * FROM kyc_checks WHERE id = ?', id);
    if (!check) throw notFound('KYC check not found');
    update('kyc_checks', id, {
      status: ctx.body.status || check.status,
      score: ctx.body.score ?? check.score,
      note: ctx.body.note ?? check.note,
      reviewed_by: ctx.actor.id,
      reviewed_at: nowIso()
    });
    audit(ctx, `kyc.${ctx.body.status || 'update'}`, 'kyc', id, `KYC ${check.type} → ${ctx.body.status}`);
    push(check.employee_id, {
      type: 'kyc',
      title: `KYC ${ctx.body.status || 'updated'}`,
      body: `${check.type} ${ctx.body.status === 'verified' ? 'was verified ✅' : 'needs attention'}.`,
      icon: '🪪',
      link: '#/kyc'
    });
    return { ok: true };
  });
}
