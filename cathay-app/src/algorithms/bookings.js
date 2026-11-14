// Who has booked which stop. Pure functions: no browser, storage or network.
//
// Each traveller books and pays for themselves. A booking row says "this person booked this place on this
// date at this start time". It is kept apart from the plan, so a rebuilt or edited plan never rewrites it.
// When the plan later moves a stop, a booked member is told "Time changed", not silently re-booked.

// Not bookable: a meal (reserve with the restaurant), free time, food and shopping places, and free places.
const NOT_BOOKABLE_CATEGORIES = new Set(['food', 'shopping']);

export const BOOKING_STATUS = {
  booked: 'booked',
  notBooked: 'not_booked',
  noBookingNeeded: 'no_booking_needed',
  timeChanged: 'time_changed',
};

const isMeal = (stop) => stop.suggestedId === 'lunch' || stop.suggestedId === 'dinner' || stop.suggestedId === 'breakfast';

// A stop that needs a ticket or reservation made through the provider.
export function isBookable(stop) {
  if (!stop || stop.kind !== 'place') return false;
  if (isMeal(stop) || stop.suggestedId === 'free') return false;
  if (NOT_BOOKABLE_CATEGORIES.has(stop.category_key)) return false;
  return Number(stop.cost) > 0;
}

// "Reserve directly with the restaurant" applies to meals and to food places.
export const isRestaurantStop = (stop) => Boolean(stop) && stop.kind === 'place' && (isMeal(stop) || stop.category_key === 'food');

export const placeKeyOf = (stop) => stop.placeId ?? stop.id;
export const startOf = (stop) => stop.startTime ?? stop.slot ?? 'any time';

// What identifies a booking: the place, the date and the start time as the traveller sees it.
export const stopKeyOf = (stop, date) => `${placeKeyOf(stop)}|${date}|${startOf(stop)}`;

// One stop as one viewer sees it. `bookings` are rows { stop_key, user_id, place_key }; `travellers` are
// { id, name, isViewer }. The viewer's own row decides their status; the other members only count.
export function bookingSummary(stop, date, bookings, travellers, viewerId) {
  const bookable = isBookable(stop);
  const key = stopKeyOf(stop, date);
  const place = placeKeyOf(stop);
  const forPlace = bookings.filter((row) => row.place_key === place && row.slot_date === date);
  const members = travellers.map((person) => {
    const own = forPlace.filter((row) => row.user_id === person.id);
    const current = own.find((row) => row.stop_key === key);
    const state = current ? BOOKING_STATUS.booked : own.length ? BOOKING_STATUS.timeChanged : BOOKING_STATUS.notBooked;
    return { userId: person.id, name: person.name, isViewer: person.id === viewerId, state, reference: current?.reference ?? null };
  });
  const mine = members.find((member) => member.isViewer);
  const status = !bookable ? BOOKING_STATUS.noBookingNeeded : mine?.state ?? BOOKING_STATUS.notBooked;
  return {
    bookable,
    key,
    status,
    reference: mine?.reference ?? null,
    bookedCount: members.filter((member) => member.state === BOOKING_STATUS.booked).length,
    total: travellers.length,
    members,
  };
}

// The viewer's own bookings whose place is no longer on any day of the plan they see.
export function orphanBookings(bookings, days, viewerId) {
  const present = new Set(days.flatMap((day) => day.items.filter((item) => item.kind === 'place').map((item) => `${placeKeyOf(item)}|${day.date}`)));
  return bookings.filter((row) => row.user_id === viewerId && !present.has(`${row.place_key}|${row.slot_date}`));
}

export const groupLine = (summary) => `${summary.bookedCount} of ${summary.total} booked`;

// "Sun 22 Nov" from "2026-11-22", in UTC so the weekday never shifts with the viewer's time zone.
export const longDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
