-- Travels: tables live in the Supabase project "Style" (shared with Capsule; free plan allows only 2 projects).
-- All tables are "own rows only". Photos go to the private bucket `travel`, path <user_id>/<uuid>.webp (+ _t.webp thumb).

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null default 'trip' check (kind in ('trip', 'dream')),
  title text not null,
  destination text,
  start_date date,
  end_date date,
  cover_path text,
  hotel_url text,
  notes text,
  why text,
  rating smallint check (rating between 1 and 5),
  impression text,
  photos text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists trip_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  trip_id uuid not null references trips on delete cascade,
  name text not null,
  category text not null default 'see' check (category in ('see', 'do', 'eat')),
  url text,
  note text,
  status text not null default 'want' check (status in ('want', 'been')),
  day smallint,
  sort double precision not null default extract(epoch from now()),
  rating smallint check (rating between 1 and 5),
  impression text,
  photos text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists trip_places_trip on trip_places (trip_id);

alter table trips enable row level security;
alter table trip_places enable row level security;
drop policy if exists "own trips" on trips;
create policy "own trips" on trips for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own trip places" on trip_places;
create policy "own trip places" on trip_places for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function trips_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists trips_touch on trips;
create trigger trips_touch before update on trips for each row execute function trips_touch();

insert into storage.buckets (id, name, public) values ('travel', 'travel', false) on conflict (id) do nothing;
drop policy if exists "travel own folder" on storage.objects;
create policy "travel own folder" on storage.objects for all to authenticated
  using (bucket_id = 'travel' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'travel' and (storage.foldername(name))[1] = auth.uid()::text);

-- 2026-11-21: city or region inside a trip/dream (dreams are kept per country, places narrowed down to cities)
alter table trip_places add column if not exists city text;

-- 2026-11-21: when a dream should happen (free text: "end of October, Halloween")
alter table trips add column if not exists best_time text;
