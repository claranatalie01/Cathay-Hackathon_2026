-- Each traveller books and pays for their own place on a stop. Everyone in the group can see who has
-- booked, but a member can only ever write their own row. The stop is identified by what the traveller
-- booked (place, date, start time), not by the plan, so rebuilding the plan never rewrites a booking.
-- The provider side is simulated: no real payment or reservation exists behind a row.
create table public.itinerary_bookings (
  group_id uuid not null,
  stop_key text not null check (char_length(stop_key) between 1 and 300),
  user_id uuid not null,
  place_key text not null check (char_length(place_key) between 1 and 120),
  stop_name text not null check (char_length(stop_name) between 1 and 200),
  slot_date date not null,
  start_time text not null check (char_length(start_time) between 1 and 40),
  status text not null default 'booked' check (status = 'booked'),
  reference text not null check (reference ~ '^CX-[0-9]{6}$'),
  price_jpy integer not null check (price_jpy between 0 and 1000000),
  booked_at timestamptz not null default clock_timestamp(),
  primary key (group_id, stop_key, user_id),
  foreign key (group_id, user_id) references public.group_members (group_id, user_id) on delete cascade
);

alter table public.itinerary_bookings enable row level security;
revoke all on public.itinerary_bookings from public, anon, authenticated;
-- The group sees WHO has booked WHAT, never anyone else's reference or price: those two columns are
-- left out of the grant, and each traveller reads their own through get_my_bookings below.
grant select (group_id, stop_key, user_id, place_key, stop_name, slot_date, start_time, status, booked_at)
  on public.itinerary_bookings to authenticated;
grant all on public.itinerary_bookings to service_role;
create policy "Trip members can see who has booked"
  on public.itinerary_bookings for select to authenticated
  using (private.is_member(group_id));

-- Books one stop for the caller only. The caller's id comes from their session, never from the client.
-- Repeating the same call returns the existing booking, so a retry cannot book twice.
create function public.save_booking(
  target_group uuid, target_place_key text, target_stop_name text, target_date date,
  target_start_time text, booking_reference text, booking_price_jpy integer
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  traveller uuid := private.member_id(target_group);
  key text;
  saved public.itinerary_bookings;
begin
  if traveller is null then raise exception 'group_not_found'; end if;
  if coalesce(char_length(target_place_key), 0) not between 1 and 120
     or coalesce(char_length(target_stop_name), 0) not between 1 and 200
     or coalesce(char_length(target_start_time), 0) not between 1 and 40
     or target_date is null
     or booking_reference is null or booking_reference !~ '^CX-[0-9]{6}$'
     or booking_price_jpy is null or booking_price_jpy not between 0 and 1000000 then
    raise exception 'validation_failed';
  end if;

  key := target_place_key || '|' || target_date::text || '|' || target_start_time;
  insert into public.itinerary_bookings
    (group_id, stop_key, user_id, place_key, stop_name, slot_date, start_time, reference, price_jpy)
    values (target_group, key, traveller, target_place_key, target_stop_name, target_date, target_start_time,
            booking_reference, booking_price_jpy)
    on conflict (group_id, stop_key, user_id) do nothing;

  select * into saved from public.itinerary_bookings
    where group_id = target_group and stop_key = key and user_id = traveller;
  return to_jsonb(saved);
end;
$$;

revoke all on function public.save_booking(uuid, text, text, date, text, text, integer) from public, anon;
grant execute on function public.save_booking(uuid, text, text, date, text, text, integer) to authenticated;

-- The caller's own bookings, including the reference and price.
create function public.get_my_bookings(target_group uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  traveller uuid := private.member_id(target_group);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('stop_key', stop_key, 'reference', reference, 'price_jpy', price_jpy))
    from public.itinerary_bookings
    where group_id = target_group and user_id = traveller
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_my_bookings(uuid) from public, anon;
grant execute on function public.get_my_bookings(uuid) to authenticated;
