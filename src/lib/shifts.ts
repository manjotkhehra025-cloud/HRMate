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

/**
 * Automatically detects the appropriate shift based on punch time (IST).
 * Accurately matches General Day Shift (08:00 · 9h), Season Day Shift (07:00 · 12h),
 * Night Shift (19:00 · 12h), or custom shifts configured in settings.
 */
export function pickShiftForNow(at = Date.now(), userId?: string): Shift | null {
  const shifts = listShifts();
  if (!shifts || shifts.length === 0) return null;

  const parts = istParts(new Date(at));
  const punchMins = parts.hour * 60 + parts.minute;

  // 1. If user has an explicit shift override assigned and no dynamic match needed
  if (userId) {
    const userRow = db.prepare("SELECT shift_id FROM users WHERE id = ?").get(userId) as any;
    if (userRow?.shift_id && userRow.shift_id !== "sh_general" && userRow.shift_id !== "auto") {
      const assigned = shifts.find((s) => s.id === userRow.shift_id);
      if (assigned) return assigned;
    }
  }

  // 2. Dynamic intelligent auto-detection by proximity to shift start_time
  let bestShift: Shift = shifts[0];
  let minDiff = Infinity;

  for (const s of shifts) {
    const [sHour, sMin] = (s.start_time || "09:00").split(":").map(Number);
    const shiftMins = (isNaN(sHour) ? 9 : sHour) * 60 + (isNaN(sMin) ? 0 : sMin);

    // Calculate circular distance in a 24-hour day (1440 minutes)
    const diff = Math.abs(punchMins - shiftMins);
    const circDiff = Math.min(diff, 1440 - diff);

    // Give slight bias to Season Day Shift if punched in early morning window [05:30 - 07:35]
    let weightedDiff = circDiff;
    const isSeasonDay = s.name.toLowerCase().includes("season");
    const isGeneralDay = s.name.toLowerCase().includes("general");
    const isNight = s.name.toLowerCase().includes("night");

    if (isSeasonDay && parts.hour >= 5 && (parts.hour < 7 || (parts.hour === 7 && parts.minute <= 35))) {
      weightedDiff -= 30; // Strongly prefer Season shift during early morning
    } else if (isGeneralDay && parts.hour >= 7 && parts.hour <= 15) {
      if (parts.hour === 7 && parts.minute > 35) weightedDiff -= 15;
      else if (parts.hour >= 8) weightedDiff -= 20; // Strongly prefer General shift during standard morning
    } else if (isNight && (parts.hour >= 16 || parts.hour <= 4)) {
      weightedDiff -= 30; // Strongly prefer Night shift during evening/night
    }

    if (weightedDiff < minDiff) {
      minDiff = weightedDiff;
      bestShift = s;
    }
  }

  return bestShift;
}
