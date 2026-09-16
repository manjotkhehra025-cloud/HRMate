// WIRING ONLY — the single function that reads the webapp's leave types. All code logic lives in
// leaveCodes.ts (assignCodes / matchLeaveType / publicType); routes call `assignCodes(await listLeaveTypes())`.
import db from '@/lib/db';
import type { LeaveType } from './leaveCodes';

export async function listLeaveTypes(): Promise<LeaveType[]> {
  const rows = db.prepare('SELECT id, name FROM leave_types ORDER BY sort').all() as { id: string; name: string }[];
  return rows.map((r) => ({
    key: r.id,
    name: r.name,
  }));
}
