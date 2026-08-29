import db from "./db";
import { istParts } from "./utils";

export interface Shift {
  id: string;
  name: string;
  start_time: string;
  hours: number;
  auto_pick: "none" | "morning" | "evening";
  sort: number;
}

export function listShifts(): Shift[] {
  return db.prepare("SELECT * FROM shifts ORDER BY sort, start_time").all() as Shift[];
}

/** Morning punch → day shift; evening punch → night. */
export function pickShiftForNow(at = Date.now()): Shift | null {
  const hour = istParts(new Date(at)).hour;
  const auto = hour < 16 ? "morning" : "evening";
  const row = db
    .prepare("SELECT * FROM shifts WHERE auto_pick = ? ORDER BY sort LIMIT 1")
    .get(auto) as Shift | undefined;
  return row || null;
}
