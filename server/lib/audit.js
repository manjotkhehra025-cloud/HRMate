import { all, get, insert, one } from './db.js';
import { nowIso } from './http.js';

export function audit(ctx, action, entity, entityId, summary, extra = {}) {
  insert('audit_logs', {
    company_id: ctx?.actor?.company_id || null,
    actor_id: ctx?.actor?.id || null,
    actor_name: ctx?.actor ? `${ctx.actor.first_name} ${ctx.actor.last_name || ''}`.trim() : 'System',
    action,
    entity,
    entity_id: entityId || null,
    summary,
    meta: extra.meta ? JSON.stringify(extra.meta) : null,
    ip: ctx?.ip || null,
    severity: extra.severity || 'info',
    created_at: nowIso()
  });
}

export function listAudit({ companyId, limit = 100, offset = 0, action, entity, actorId, from, to, q } = {}) {
  const where = [];
  const args = [];
  if (companyId) {
    where.push('company_id = ?');
    args.push(companyId);
  }
  if (action) {
    where.push('action = ?');
    args.push(action);
  }
  if (entity) {
    where.push('entity = ?');
    args.push(entity);
  }
  if (actorId) {
    where.push('actor_id = ?');
    args.push(actorId);
  }
  if (from) {
    where.push('created_at >= ?');
    args.push(from);
  }
  if (to) {
    where.push('created_at <= ?');
    args.push(to + 'T23:59:59');
  }
  if (q) {
    where.push('(summary LIKE ? OR actor_name LIKE ? OR entity LIKE ?)');
    args.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = one(`SELECT COUNT(*) FROM audit_logs ${clause}`, ...args);
  const rows = all(
    `SELECT * FROM audit_logs ${clause} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    ...args,
    limit,
    offset
  );
  return { total, rows: rows.map((r) => ({ ...r, meta: parse(r.meta) })) };
}

function parse(v) {
  if (!v) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

export function auditStats(companyId) {
  return {
    byEntity: all(
      'SELECT entity, COUNT(*) AS count FROM audit_logs WHERE company_id = ? GROUP BY entity ORDER BY count DESC LIMIT 12',
      companyId
    ),
    bySeverity: all(
      'SELECT severity, COUNT(*) AS count FROM audit_logs WHERE company_id = ? GROUP BY severity',
      companyId
    ),
    recent: all(
      'SELECT action, COUNT(*) AS count FROM audit_logs WHERE company_id = ? GROUP BY action ORDER BY count DESC LIMIT 10',
      companyId
    )
  };
}
