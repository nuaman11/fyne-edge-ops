/** Business timezone for "today" and overdue checks. */
export const TZ = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Dubai";

export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function fmtDate(iso: string | null | undefined, withYear = false) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: withYear ? "numeric" : undefined, timeZone: "UTC" });
}
export function aed(n: number | null | undefined) {
  return "AED " + Math.round(n || 0).toLocaleString("en-US");
}
export function ticketCode(n: number) {
  return "FE-" + (100 + n);
}
export function initials(name: string | null | undefined) {
  return String(name || "?").split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
}
/** Date and time of an event, e.g. "Today 09:12" or "16 Nov, 09:12", in the business timezone. */
export function fmtWhen(isoDateTime: string | null | undefined) {
  if (!isoDateTime) return "";
  const d = new Date(isoDateTime);
  if (isNaN(d.getTime())) return "";
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  return day === todayISO() ? `Today ${time}` : `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ })}, ${time}`;
}
export function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
