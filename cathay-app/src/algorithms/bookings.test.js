// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withoutSourceTags } from '../data/sourceTags.js';
import { bookingSummary, groupLine, isBookable, isRestaurantStop, orphanBookings, stopKeyOf } from './bookings.js';

const museum = { id: 'place-mori', kind: 'place', placeId: 'mori', name: 'Mori Art Museum', category_key: 'art', cost: 1800, startTime: '10:00' };
const date = '2026-11-22';
const people = [
  { id: 'c', name: 'Clara', isViewer: false },
  { id: 'g', name: 'Gaudi', isViewer: true },
];
const row = (user, stop = museum, when = date) => ({
  stop_key: stopKeyOf(stop, when), user_id: user, place_key: stop.placeId ?? stop.id, slot_date: when, start_time: stop.startTime, reference: 'CX-000001',
});

test('experiences, museums and tours are bookable; meals, free time, food, shopping and free places are not', () => {
  assert.equal(isBookable(museum), true);
  assert.equal(isBookable({ ...museum, category_key: 'culture' }), true);
  assert.equal(isBookable({ ...museum, category_key: 'entertainment' }), true);
  assert.equal(isBookable({ id: 'meal-lunch', kind: 'place', suggestedId: 'lunch', cost: 1200 }), false);
  assert.equal(isBookable({ id: 'free-1', kind: 'place', suggestedId: 'free', cost: 0 }), false);
  assert.equal(isBookable({ ...museum, category_key: 'food' }), false);
  assert.equal(isBookable({ ...museum, category_key: 'shopping' }), false);
  assert.equal(isBookable({ ...museum, cost: 0 }), false, 'a free place needs no ticket');
  assert.equal(isBookable({ kind: 'flight-arrival' }), false);
});

test('meals and food places say to reserve with the restaurant', () => {
  assert.equal(isRestaurantStop({ kind: 'place', suggestedId: 'dinner' }), true);
  assert.equal(isRestaurantStop({ kind: 'place', category_key: 'food' }), true);
  assert.equal(isRestaurantStop(museum), false);
});

test('the stop key is the place, the date and the start time, so the same booking has the same key', () => {
  assert.equal(stopKeyOf(museum, date), 'mori|2026-11-22|10:00');
  assert.equal(stopKeyOf(museum, date), stopKeyOf({ ...museum }, date));
  assert.notEqual(stopKeyOf(museum, date), stopKeyOf({ ...museum, startTime: '11:00' }, date));
  assert.equal(stopKeyOf({ id: 'meal-lunch', kind: 'place' }, date), 'meal-lunch|2026-11-22|any time');
});

test('nobody booked: not booked, 0 of 2', () => {
  const summary = bookingSummary(museum, date, [], people, 'g');
  assert.equal(summary.status, 'not_booked');
  assert.equal(groupLine(summary), '0 of 2 booked');
});

test('the viewer sees their own status; the others only count towards "N of M booked"', () => {
  const clara = bookingSummary(museum, date, [row('c')], people, 'g');
  assert.equal(clara.status, 'not_booked', "Clara's booking does not book Gaudi");
  assert.equal(groupLine(clara), '1 of 2 booked');
  const both = bookingSummary(museum, date, [row('c'), row('g')], people, 'g');
  assert.equal(both.status, 'booked');
  assert.equal(both.reference, 'CX-000001');
  assert.equal(groupLine(both), '2 of 2 booked');
  assert.deepEqual(both.members.map((m) => [m.name, m.state]), [['Clara', 'booked'], ['Gaudi', 'booked']]);
});

test('a stop that needs no booking says so, whatever the rows are', () => {
  const lunch = { id: 'meal-lunch', kind: 'place', suggestedId: 'lunch', cost: 1200 };
  assert.equal(bookingSummary(lunch, date, [], people, 'g').status, 'no_booking_needed');
});

test('when the plan moves a booked stop, the booked member sees "time changed" and the row is kept', () => {
  const rows = [row('g'), row('c')];
  const moved = { ...museum, startTime: '14:00' };
  const summary = bookingSummary(moved, date, rows, people, 'g');
  assert.equal(summary.status, 'time_changed');
  assert.equal(summary.bookedCount, 0, 'a booking for another time does not count as booked');
  assert.deepEqual(summary.members.map((m) => m.state), ['time_changed', 'time_changed']);
  assert.equal(rows.length, 2, 'nothing was rewritten');
});

test('a booking whose stop left the plan is listed as no longer in the plan, for its owner only', () => {
  const days = [{ date, items: [{ kind: 'place', id: 'place-tower', placeId: 'tower' }] }];
  const rows = [row('g'), row('c')];
  assert.deepEqual(orphanBookings(rows, days, 'g').map((r) => r.user_id), ['g']);
  const kept = [{ date, items: [museum] }];
  assert.deepEqual(orphanBookings(rows, kept, 'g'), []);
});

test('source tags like [S903] are not shown to people', () => {
  assert.equal(withoutSourceTags('Shiodome · Relaxing at Hama-rikyū Gardens. [S903]'), 'Shiodome · Relaxing at Hama-rikyū Gardens.');
  assert.equal(withoutSourceTags('Open late [S1] [S22]'), 'Open late');
  assert.equal(withoutSourceTags(null), null);
});
