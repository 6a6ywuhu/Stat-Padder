/** Calendar-window helpers, server local time. Shared by the home leaderboards and rankings. */

/** Monday 00:00 of the current calendar week. */
export function startOfWeek(): Date {
  const now = new Date();
  const daysSinceMonday = (now.getDay() + 6) % 7; // Sun=6 … Mon=0
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
}

/** The 1st of the current calendar month, 00:00. */
export function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** "YYYY-MM-DD" in local time. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
