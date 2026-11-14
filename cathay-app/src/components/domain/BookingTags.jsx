import { COPY } from '../../data/copy';
import Chip from '../ui/Chip';
import './BookingTags.css';

const LABEL = { booked: 'booked', not_booked: 'notBooked', no_booking_needed: 'noBookingNeeded', time_changed: 'timeChanged' };
const TONE = { booked: 'primary', not_booked: 'neutral', no_booking_needed: 'neutral', time_changed: 'sand' };

// "Not booked" / "Booked" / "No booking needed" for the viewer, plus "1 of 2 booked" on bookable stops.
export default function BookingTags({ summary }) {
  const copy = COPY.booking;
  return (
    <div className="booking-tags">
      <Chip tone={TONE[summary.status]}>{copy[LABEL[summary.status]]}</Chip>
      {summary.bookable && <span className="booking-tags__group">{copy.groupLine(summary.bookedCount, summary.total)}</span>}
    </div>
  );
}
