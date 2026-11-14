begin;

create schema studyspot;
revoke all on schema studyspot from public, anon, authenticated;

create table studyspot.spots (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  zone text not null check (zone in ('lib', 'cafe', 'a', 'b')),
  type text not null check (type in ('Library Corner', 'Cafe', 'Classroom')),
  opens smallint not null check (opens >= 0),
  closes smallint not null check (closes <= 24 and closes > opens),
  x double precision,
  y double precision,
  check ((x is null and y is null) or
         (x is not null and y is not null and x between 0 and 360 and y between 0 and 440))
);

create table studyspot.ratings (
  id bigint generated always as identity primary key,
  spot_id bigint not null references studyspot.spots(id) on delete cascade,
  scores smallint[] not null check (
    array_ndims(scores) = 1 and cardinality(scores) = 6
    and scores <@ array[1,2,3,4,5]::smallint[]
  ),
  review text not null default '' check (char_length(review) <= 1000),
  created_at timestamptz not null default now()
);
create index on studyspot.ratings (spot_id, id desc);

create table studyspot.reports (
  id bigint generated always as identity primary key,
  spot_id bigint not null references studyspot.spots(id) on delete cascade,
  category text not null check (category in (
    'Broken outlet', 'No / slow Wi-Fi', 'Too noisy', 'Dirty', 'Overcrowded', 'Other'
  )),
  details text not null check (char_length(btrim(details)) between 1 and 1000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);
create index on studyspot.reports (spot_id, id desc);

alter table studyspot.spots enable row level security;
alter table studyspot.ratings enable row level security;
alter table studyspot.reports enable row level security;

-- Give the Java server a dedicated login. Set its password separately.
create role studyspot_api login;
grant usage on schema studyspot to studyspot_api;
grant select, insert on all tables in schema studyspot to studyspot_api;
grant usage on all sequences in schema studyspot to studyspot_api;
create policy api_read on studyspot.spots for select to studyspot_api using (true);
create policy api_add on studyspot.spots for insert to studyspot_api with check (true);
create policy api_read on studyspot.ratings for select to studyspot_api using (true);
create policy api_add on studyspot.ratings for insert to studyspot_api with check (true);
create policy api_read on studyspot.reports for select to studyspot_api using (true);
create policy api_add on studyspot.reports for insert to studyspot_api with check (status = 'open');

commit;
