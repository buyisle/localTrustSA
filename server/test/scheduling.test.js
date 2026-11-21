const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseBookingDate, availableAt, occupiedMinutes } = require('../lib/scheduling');
const now = new Date('2026-11-04T08:00:00Z');
test('past dates, current-day past times, and ambiguous inputs are rejected', () => {
  for (const value of ['2020-01-01T10:00:00Z', '2026-11-04T09:59:00+02:00', '2026-11-04T10:00:00+02:00', '2026-11-05T10:00', null, 'invalid']) assert.equal(parseBookingDate(value, now), null);
});
test('Johannesburg midnight boundaries represent the same instant', () => {
  assert.equal(parseBookingDate('2026-11-05T00:00:00+02:00', now).toISOString(), '2026-11-04T22:00:00.000Z');
  assert.equal(parseBookingDate('2026-11-04T10:01:00+02:00', now).toISOString(), '2026-11-04T08:01:00.000Z');
});
test('provider hours use Johannesburg timezone and require the full visit', () => {
  const provider = { role: 'provider', availability: { days: [3], startHour: 8, endHour: 17 } };
  assert.equal(availableAt(provider, new Date('2026-11-04T06:00:00Z')), true);
  assert.equal(availableAt(provider, new Date('2026-11-04T14:01:00Z')), false);
  assert.equal(availableAt({ ...provider, suspended: true }, new Date('2026-11-04T06:00:00Z')), false);
  assert.equal(availableAt(null, now), false);
});
test('overlapping appointments share unique minute reservations; adjacent visits do not', () => {
  const first = new Set(occupiedMinutes(now));
  assert.equal(occupiedMinutes(new Date(now.getTime() + 59 * 60000)).some(value => first.has(value)), true);
  assert.equal(occupiedMinutes(new Date(now.getTime() + 60 * 60000)).some(value => first.has(value)), false);
});
