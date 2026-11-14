// The provider behind Cathay Holidays is Expedia. Cathay's access to it is NOT verified, so every
// function here is a SIMULATION returning fixed, made-up answers. Nothing is booked or charged.
//
// A real integration would replace only this file, keeping the same three functions. The screens call
// these functions and never invent availability, prices or references themselves.
export const PROVIDER_LABEL = 'Powered by Expedia';

const PAUSE_MS = 350;
const pause = () => new Promise((resolve) => setTimeout(resolve, PAUSE_MS));

// A small stable number from text, so the same booking always gets the same reference.
function hash(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = (h * 33 + text.charCodeAt(i)) % 1_000_000_007;
  return h;
}

// Price and rules for ONE traveller at this stop and date.
export async function checkAvailability(stop, date) {
  await pause();
  return {
    available: true,
    stopName: stop.name,
    date,
    time: stop.startTime ?? stop.slot,
    pricePerPerson: Math.round(Number(stop.cost) || 0),
    currency: 'JPY',
    cancellation: 'Free cancellation until the day before.',
  };
}

// Reserves the place for ONE traveller for a short while.
export async function holdBooking({ stopKey, userId, price }) {
  await pause();
  return { holdId: `hold-${hash(`${stopKey}|${userId}`)}`, stopKey, userId, price };
}

// Completes the booking. The reference is the same for the same traveller and stop, so a retry is safe.
export async function confirmBooking(hold) {
  await pause();
  const digits = String(hash(`${hold.stopKey}|${hold.userId}`) % 1_000_000).padStart(6, '0');
  return { reference: `CX-${digits}`, price: hold.price };
}
