// Helpers for computing "billing months" that don't necessarily start on day 1.
// All dates are treated as local-time `Date` instances.

function parseDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    // Anchor YYYY-MM-DD strings to local midnight to avoid TZ drift.
    const [y, m, d] = value.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

function clampStartDay(day) {
  const n = Math.round(Number(day));
  if (!Number.isFinite(n)) return 1;
  return Math.min(28, Math.max(1, n));
}

// Returns the start Date (inclusive) of the billing month containing `date`.
export function startOfBillingMonth(date, startDay = 1) {
  const d = parseDate(date);
  const sd = clampStartDay(startDay);
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  const start = new Date(y, m, sd);
  if (day < sd) start.setMonth(start.getMonth() - 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

// Returns end Date (exclusive: first millisecond of the next billing month).
export function endOfBillingMonth(date, startDay = 1) {
  const start = startOfBillingMonth(date, startDay);
  const next = new Date(start);
  next.setMonth(next.getMonth() + 1);
  return next;
}

// Shifts the billing month containing `date` by `delta` months and returns
// the new start Date (e.g. delta=-1 → previous month, delta=+1 → next month).
export function shiftBillingMonth(date, startDay, delta) {
  const start = startOfBillingMonth(date, startDay);
  start.setMonth(start.getMonth() + Number(delta || 0));
  return start;
}

// Returns true iff `value` (date string or Date) falls inside the billing
// month containing `anchor` for the given startDay.
export function isInBillingMonth(value, anchor, startDay = 1) {
  if (!value) return false;
  const v = parseDate(value);
  const start = startOfBillingMonth(anchor, startDay);
  const end = endOfBillingMonth(anchor, startDay);
  return v >= start && v < end;
}

// Stable key for a billing month (used for grouping / chart axes).
export function billingMonthKey(date, startDay = 1) {
  const start = startOfBillingMonth(date, startDay);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
}

// Human-readable label for a billing month, with an optional range suffix
// when the start day is not the 1st.
export function billingMonthLabel(date, startDay = 1, opts = {}) {
  const start = startOfBillingMonth(date, startDay);
  const end = endOfBillingMonth(date, startDay);
  const endInclusive = new Date(end);
  endInclusive.setDate(endInclusive.getDate() - 1);

  const monthName = start.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
  const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  if (opts.short) return capitalized;
  if (clampStartDay(startDay) === 1) return capitalized;
  const fmt = (d) => `${d.getDate()} ${d.toLocaleDateString('ro-RO', { month: 'short' })}`;
  return `${capitalized} · ${fmt(start)} – ${fmt(endInclusive)}`;
}

// Returns an array of the last N billing-month start Dates ending with the
// current one (oldest first).
export function lastNBillingMonths(n, startDay = 1, anchor = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(shiftBillingMonth(anchor, startDay, -i));
  }
  return out;
}
