import { useEffect, useRef, useState } from 'react';
import { saveBooking } from '../../api';
import { confirmBooking, checkAvailability, DEMO_LABEL, holdBooking, PROVIDER_LABEL } from '../../api/providers/expedia';
import { longDate, placeKeyOf, startOf } from '../../algorithms/bookings';
import { COPY } from '../../data/copy';
import Button from '../ui/Button';
import Sheet from '../ui/Sheet';
import './BookingSheet.css';

// One bottom sheet, one decision. It checks the price for ONE traveller, asks for one tap, and turns
// into the confirmation in place. Everything is prefilled; nothing is typed. The provider is simulated.
export default function BookingSheet({ open, onClose, groupId, stop, date, userId, onChooseTime, onDone }) {
  const copy = COPY.stopBooking;
  const [phase, setPhase] = useState('checking'); // checking | review | working | done | unavailable | failed
  const [offer, setOffer] = useState(null);
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const running = useRef(false);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setPhase('checking');
    setResult(null);
    checkAvailability(stop, date).then(
      (found) => {
        if (!active) return;
        setOffer(found);
        setPhase(found.available ? 'review' : 'unavailable');
      },
      () => active && setPhase('failed'),
    );
    return () => {
      active = false;
    };
  }, [open, stop, date, attempt]);

  async function confirm() {
    if (running.current) return; // a double tap must not book twice
    running.current = true;
    setPhase('working');
    try {
      const stopKey = `${placeKeyOf(stop)}|${date}|${startOf(stop)}`;
      const hold = await holdBooking({ stopKey, userId, price: offer.pricePerPerson });
      const confirmed = await confirmBooking(hold);
      await saveBooking(groupId, {
        placeKey: placeKeyOf(stop), stopName: stop.name, date, startTime: startOf(stop),
        reference: confirmed.reference, price: confirmed.price,
      });
      setResult(confirmed);
      setPhase('done');
    } catch {
      setPhase('failed');
    } finally {
      running.current = false;
    }
  }

  const busy = phase === 'working';
  const price = offer?.pricePerPerson ?? 0;
  return (
    <Sheet open={open} onClose={busy ? () => {} : onClose} title={phase === 'done' ? copy.doneTitle : copy.sheetTitle} titleId="booking-title">
      <div className="booking-sheet" aria-busy={phase === 'checking' || busy}>
        {phase === 'checking' && <p className="booking-sheet__note">{copy.checking}</p>}
        {(phase === 'review' || phase === 'working') && (
          <>
            <div className="booking-sheet__stop">
              <p className="booking-sheet__name">{stop.name}</p>
              <p className="booking-sheet__note">{longDate(date)} · {startOf(stop)}</p>
            </div>
            <p className="booking-sheet__price">¥{price.toLocaleString('en-US')}</p>
            <p className="booking-sheet__note">{offer.cancellation}</p>
            <Button size="lg" data-autofocus disabled={busy} onClick={confirm}>{busy ? copy.working : copy.confirm(price)}</Button>
            <Button size="lg" variant="secondary" disabled={busy} onClick={onClose}>{copy.cancel}</Button>
            <p className="booking-sheet__note booking-sheet__demo">{PROVIDER_LABEL}. {DEMO_LABEL}.</p>
          </>
        )}
        {phase === 'done' && (
          <>
            <img className="booking-sheet__check" src="/assets/ui-check-teal.svg" alt="" />
            <p className="booking-sheet__name">{stop.name}</p>
            <p className="booking-sheet__note" role="status">{copy.doneReference(result.reference)}</p>
            <p className="booking-sheet__note">{copy.doneNote}</p>
            <Button size="lg" data-autofocus onClick={onDone}>{copy.backToItinerary}</Button>
          </>
        )}
        {phase === 'unavailable' && (
          <>
            <p className="booking-sheet__error" role="alert">{copy.unavailable}</p>
            <Button size="lg" data-autofocus onClick={onChooseTime}>{copy.chooseAnotherTime}</Button>
          </>
        )}
        {phase === 'failed' && (
          <>
            <p className="booking-sheet__error" role="alert">{copy.failed}</p>
            <Button size="lg" data-autofocus onClick={() => (offer ? confirm() : setAttempt((n) => n + 1))}>{copy.retry}</Button>
          </>
        )}
      </div>
    </Sheet>
  );
}
