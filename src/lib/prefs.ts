import db from "./db";

export type Language = "en" | "pa";
export type Appearance = "light" | "dark" | "system";
export type TextSize = "small" | "medium" | "large";

export interface UserPrefs {
  language: Language;
  appearance: Appearance;
  text_size: TextSize;
  notify_enabled: number;
}

const DEFAULTS: UserPrefs = {
  language: "en",
  appearance: "system",
  text_size: "medium",
  notify_enabled: 1,
};

function asLanguage(v: unknown): Language {
  return v === "pa" ? "pa" : "en";
}
function asAppearance(v: unknown): Appearance {
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}
function asTextSize(v: unknown): TextSize {
  return v === "small" || v === "large" || v === "medium" ? v : "medium";
}

export function getUserPrefs(userId: string): UserPrefs {
  const row = db.prepare("SELECT * FROM user_prefs WHERE user_id = ?").get(userId) as
    | (UserPrefs & { user_id: string })
    | undefined;
  if (!row) return { ...DEFAULTS };
  return {
    language: asLanguage(row.language),
    appearance: asAppearance(row.appearance),
    text_size: asTextSize(row.text_size),
    notify_enabled: row.notify_enabled ? 1 : 0,
  };
}

export function setUserPrefs(userId: string, patch: Partial<UserPrefs>): UserPrefs {
  const current = getUserPrefs(userId);
  const next: UserPrefs = {
    language: patch.language !== undefined ? asLanguage(patch.language) : current.language,
    appearance: patch.appearance !== undefined ? asAppearance(patch.appearance) : current.appearance,
    text_size: patch.text_size !== undefined ? asTextSize(patch.text_size) : current.text_size,
    notify_enabled:
      patch.notify_enabled !== undefined ? (patch.notify_enabled ? 1 : 0) : current.notify_enabled,
  };
  db.prepare(
    `INSERT INTO user_prefs (user_id, language, appearance, text_size, notify_enabled, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       language = excluded.language,
       appearance = excluded.appearance,
       text_size = excluded.text_size,
       notify_enabled = excluded.notify_enabled,
       updated_at = excluded.updated_at`
  ).run(userId, next.language, next.appearance, next.text_size, next.notify_enabled, Date.now());
  return next;
}

export function isNotifyEnabled(userId: string): boolean {
  const row = db
    .prepare("SELECT notify_enabled FROM user_prefs WHERE user_id = ?")
    .get(userId) as { notify_enabled: number } | undefined;
  if (!row) return true;
  return row.notify_enabled !== 0;
}
