import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiError, getStop } from '../../api';
import BookingSheet from '../../components/domain/BookingSheet';
import BottomNav from '../../components/layout/BottomNav';
import PageHeader from '../../components/layout/PageHeader';
import Screen from '../../components/layout/Screen';
import StatusBar from '../../components/layout/StatusBar';
import Button from '../../components/ui/Button';
import Sheet from '../../components/ui/Sheet';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import StateMessage from '../../components/ui/StateMessage';
import IconHeading, { avatarTone } from '../../components/ui/IconHeading';
import StatTile from '../../components/ui/StatTile';
import { bookingSummary, isRestaurantStop, longDate } from '../../algorithms/bookings';
import { COPY } from '../../data/copy';
import { fallbackTo } from '../../data/photos';
import { withoutSourceTags } from '../../data/sourceTags';
import { useAsync } from '../../hooks/useAsync';
import { useBookingRefresh } from '../../hooks/useBookingRefresh';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import './PlaceDetailPage.css';

// One stop in detail: photo, text, budget and duration, a tip, and (for a voted place) every member's vote.
export default function PlaceDetailPage() {
  const { groupId, stopId } = useParams();
  const navigate = useNavigate();
  const copy = COPY.itin;
  const { status, data, error, reload } = useAsync(() => getStop(groupId, stopId), [groupId, stopId]);
  useDocumentTitle(data ? data.stop.name : copy.title);
  useBookingRefresh();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [params] = useSearchParams();
  const dayParam = params.get('day');
  const back = `/groups/${groupId}/itinerary${dayParam ? `?day=${encodeURIComponent(dayParam)}` : ''}`;

  const frame = (title, body) => (
    <Screen>
      <StatusBar />
      <PageHeader title={title} onBack={() => navigate(back)} />
      {body}
      <BottomNav variant="groups" />
    </Screen>
  );

  if (status === 'loading') return frame(copy.title, <LoadingState variant="detail" />);
  if (status === 'error') {
    if (error instanceof ApiError && error.code === 'stop_not_found') {
      return frame(
        copy.title,
        <StateMessage mark="!" tone="sand" title="Stop not found" text={error.message}>
          <Button to={back}>{copy.backToItinerary}</Button>
        </StateMessage>,
      );
    }
    return frame(copy.title, <ErrorState error={error} onRetry={reload} />);
  }

  const { stop, votes, day } = data;
  const book = COPY.booking;
  const summary = bookingSummary(stop, data.date, data.bookings ?? [], data.travellers ?? [], (data.travellers ?? []).find((p) => p.isViewer)?.id);
  const closeSheet = () => setSheetOpen(false);
  const liked = votes ? votes.filter((v) => v.choice === 'like').length : 0;
  return frame(
    copy.stopTitle(day.index, stop.slot),
    <>
    <main className="place">
      <img className="place__photo" src={stop.photo} alt={stop.alt} referrerPolicy="no-referrer" onError={fallbackTo(stop.category_key)} />
      <div className="place__head">
        <h2 className="place__name">{stop.name}</h2>
        {stop.myChange && <p className="place__text">{copy.myChange}</p>}
        <p className="place__area">
          <img src="/assets/ui-pin-teal.svg" alt="" />
          {stop.area}
        </p>
      </div>
      <p className="place__text">{withoutSourceTags(stop.description)}</p>
      <div className="place__tiles">
        <StatTile icon="/assets/ui-yen-sand.svg" tone="sand" value={stop.budget} label={copy.budget} />
        <StatTile icon="/assets/ui-clock-steel.svg" tone="steel" value={stop.durationBest} label={copy.durationBest} />
      </div>
      {stop.tip && (
        <section className="place__card" aria-labelledby="tip-heading">
          <IconHeading as="h3" icon="/assets/ui-sparkle.svg" tone="sand" id="tip-heading">
            {copy.goodToKnow}
          </IconHeading>
          <p className="place__text">{withoutSourceTags(stop.tip)}</p>
        </section>
      )}
      <section className="place__card" aria-labelledby="votes-heading">
        <IconHeading as="h3" icon={votes ? '/assets/4714d.svg' : '/assets/ui-sparkle.svg'} tone={votes ? 'teal' : 'sand'} id="votes-heading">
          {votes ? copy.votesTitle(liked, votes.length) : copy.suggested}
        </IconHeading>
        {votes ? (
          <ul className="place__votes">
            {votes.map((vote) => (
              <li key={vote.userId}>
                <span className={`place__avatar avatar-tone--${avatarTone(vote.userId)}`} aria-hidden="true">
                  {vote.initial}
                </span>
                <span className="place__voter">
                  {vote.name}
                  {vote.isViewer ? ' (you)' : ''}
                </span>
                <span className={`place__vote place__vote--${vote.choice ?? 'none'}`}>
                  <img src={vote.choice === 'like' ? '/assets/4714d.svg' : vote.choice === 'pass' ? '/assets/ui-x-grey.svg' : '/assets/ui-clock.svg'} alt="" />
                  {vote.choice === 'like' ? copy.liked : vote.choice === 'pass' ? copy.passed : copy.notVoted}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="place__text">{copy.suggestedNote}</p>
        )}
      </section>
      {(summary.bookable || isRestaurantStop(stop)) && (
        <section className="place__card" aria-labelledby="booking-heading">
          <IconHeading as="h3" icon="/assets/ui-ticket.svg" tone="teal" id="booking-heading">
            {book.sectionTitle}
          </IconHeading>
          {summary.bookable ? (
            <>
              <p className="place__text">{book.sectionNote}</p>
              <ul className="place__votes">
                {summary.members.map((member) => (
                  <li key={member.userId}>
                    <span className="place__voter">
                      {member.name}
                      {member.isViewer ? book.you : ''}
                    </span>
                    <span className="place__vote">
                      {member.state === 'booked' ? book.memberBooked : member.state === 'time_changed' ? book.memberTimeChanged : book.memberNotBooked}
                    </span>
                  </li>
                ))}
              </ul>
              {summary.status === 'time_changed' && <p className="place__text" role="status">{book.timeChanged}</p>}
            </>
          ) : (
            <p className="place__text">{book.reserveDirectly}</p>
          )}
        </section>
      )}
      <Button size="lg" variant="secondary" to={back}>
        {copy.backToItinerary}
      </Button>
    </main>
    {summary.bookable && (
      <div className="place__bar">
        {summary.status === 'booked' ? (
          <>
            <p className="place__bar-booked">{book.bookedBar(summary.reference)}</p>
            <Button size="lg" variant="secondary" onClick={() => setDetailsOpen(true)}>{book.viewDetails}</Button>
          </>
        ) : (
          <Button size="lg" onClick={() => setSheetOpen(true)}>{book.bookForMe(Math.round(stop.cost))}</Button>
        )}
      </div>
    )}
    {summary.status === 'booked' && (
      <Sheet open={detailsOpen} onClose={() => setDetailsOpen(false)} title={book.detailsTitle} titleId="booking-details-title">
        <p className="place__name">{stop.name}</p>
        <p className="place__text">{longDate(data.date)} · {stop.startTime ?? stop.slot}</p>
        <p className="place__text">{book.doneReference(summary.reference)}</p>
        <Button size="lg" data-autofocus variant="secondary" onClick={() => setDetailsOpen(false)}>{book.cancel}</Button>
      </Sheet>
    )}
    {summary.bookable && summary.status !== 'booked' && (
      <BookingSheet
        open={sheetOpen}
        onClose={closeSheet}
        groupId={groupId}
        stop={stop}
        date={data.date}
        userId={(data.travellers ?? []).find((p) => p.isViewer)?.id}
        onChooseTime={() => navigate(back)}
        onDone={() => navigate(back)}
      />
    )}
    </>,
  );
}
