import { all, one, run, update } from '../lib/db.js';
import { badRequest, nowIso } from '../lib/http.js';
import { listNotifications, markRead, push, subscribe, unreadCount } from '../lib/notify.js';

export function register(router) {
  router.get('/api/notifications', (ctx) => ({
    rows: listNotifications(ctx.actor.id, { limit: Number(ctx.query.limit) || 60, unreadOnly: ctx.query.unread === '1' }),
    unread: unreadCount(ctx.actor.id)
  }));

  router.post('/api/notifications/read', (ctx) => {
    const { id = null } = ctx.body;
    markRead(ctx.actor.id, id);
    return { ok: true, unread: unreadCount(ctx.actor.id) };
  });

  router.post('/api/notifications/read-all', (ctx) => {
    markRead(ctx.actor.id, null);
    return { ok: true, unread: 0 };
  });

  router.delete('/api/notifications/:id', (ctx) => {
    run('DELETE FROM notifications WHERE id = ? AND employee_id = ?', Number(ctx.params.id), ctx.actor.id);
    return { ok: true };
  });

  router.get('/api/notifications/settings', (ctx) => ({
    pushEnabled: !!ctx.actor.push_token,
    channels: [
      { key: 'attendance', label: 'Attendance & punch alerts', icon: '⏰', enabled: true },
      { key: 'approval', label: 'Approvals & requests', icon: '🧾', enabled: true },
      { key: 'leave', label: 'Leave updates', icon: '🌴', enabled: true },
      { key: 'shift', label: 'Roster & shift changes', icon: '🗓️', enabled: true },
      { key: 'announcement', label: 'Company announcements', icon: '📣', enabled: true },
      { key: 'kudos', label: 'Kudos & recognition', icon: '🌟', enabled: true },
      { key: 'ticket', label: 'Helpdesk updates', icon: '🎫', enabled: true },
      { key: 'security', label: 'Security & device alerts', icon: '🔐', enabled: true },
      { key: 'performance', label: 'Performance & goals', icon: '📈', enabled: false }
    ]
  }));

  // Server-sent event stream — the transport behind "push" notifications.
  router.get('/api/notifications/stream', (ctx, { raw }) => {
    subscribe(ctx.actor.id, raw.res);
  });

  // test/broadcast helper used by the admin console
  router.post('/api/notifications/broadcast', (ctx) => {
    const { title, body, icon = '📣', link = '#/announcements', audience = 'all' } = ctx.body;
    if (!title) throw badRequest('title is required');
    const ids =
      audience === 'all'
        ? all("SELECT id FROM employees WHERE company_id = ? AND status != 'terminated'", ctx.actor.company_id).map((r) => r.id)
        : all('SELECT id FROM employees WHERE company_id = ? AND role = ?', ctx.actor.company_id, audience).map((r) => r.id);
    for (const id of ids) push(id, { type: 'announcement', title, body, icon, link });
    return { ok: true, delivered: ids.length };
  });
}
