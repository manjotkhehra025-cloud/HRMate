import { NextRequest } from 'next/server';
import { handle, ok, requireMobileUser } from '../_lib/mobileAuth';
import db from '@/lib/db';
import { getFactoryConfig } from '@/lib/geo';
import { getApprover } from '@/lib/workflow';

export const dynamic = 'force-dynamic';

function calculateShiftEnd(startTime: string, hours: number): string {
  const [h, m] = (startTime || '08:00').split(':').map(Number);
  const totalMins = (h * 60 + (m || 0)) + Math.round((hours || 8) * 60);
  const endH = Math.floor((totalMins / 60) % 24);
  const endM = Math.floor(totalMins % 60);
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

async function loadProfile(userId: string) {
  const row = db
    .prepare('SELECT designation, doj, phone, shift_id FROM users WHERE id = ?')
    .get(userId) as any;

  if (!row) return null;

  // Reporting Manager / Approver
  let manager: { id: string; name: string } | null = null;
  const app = getApprover('', userId);
  if (app && app.id !== userId) {
    manager = { id: app.id, name: app.name };
  }

  // ASSIGNED Shift ONLY (users.shift_id -> shifts row)
  let shift: { name: string; start: string; end: string } | null = null;
  if (row.shift_id && row.shift_id !== 'auto' && row.shift_id !== 'none') {
    const s = db.prepare('SELECT name, start_time, hours FROM shifts WHERE id = ?').get(row.shift_id) as any;
    if (s) {
      shift = {
        name: s.name || 'General Day Shift',
        start: s.start_time || '08:00',
        end: calculateShiftEnd(s.start_time || '08:00', s.hours || 9),
      };
    }
  }

  const cfg = getFactoryConfig();
  const site = cfg.name || 'GD Foods Mfg. (I) Pvt. Ltd.';

  const joinedOn = row.doj && /^\d{4}-\d{2}-\d{2}$/.test(row.doj) ? row.doj : null;

  return {
    designation: row.designation || null,
    joinedOn,
    phone: row.phone || null,
    manager,
    shift,
    site,
  };
}

// GET /api/v1/mobile/me  (Bearer)
export const GET = handle(async (req: NextRequest) => {
  const { user } = await requireMobileUser(req);
  const profile = await loadProfile(user.id);
  return ok({ user, profile });
});
