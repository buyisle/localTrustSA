const MINUTE = 60000;
const DURATION = 60 * MINUTE;
function parseBookingDate(value, now = new Date()) {
  // Require an explicit offset: never interpret a client date in the server timezone.
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const date = new Date(value);
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day || Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59) return null;
  if (!Number.isFinite(date.getTime()) || date <= now || date.getUTCSeconds() !== 0 || date.getUTCMilliseconds() !== 0) return null;
  return date;
}
function availableAt(provider, date) {
  if (!provider || provider.role !== 'provider' || provider.active === false || provider.suspended) return false;
  const local = new Date(date.getTime() + 120 * MINUTE);
  const schedule = provider.availability;
  // Existing accounts retain unrestricted scheduling until they configure hours.
  if (!schedule || !schedule.days?.length) return true;
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
  return schedule.days.includes(local.getUTCDay()) && minute >= schedule.startHour * 60 && minute + 60 <= schedule.endHour * 60;
}
function occupiedMinutes(date) { return Array.from({ length: 60 }, (_, index) => date.getTime() / MINUTE + index); }
module.exports = { parseBookingDate, availableAt, occupiedMinutes, DURATION };
