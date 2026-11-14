alter table studyspot.spots
  add column latitude double precision,
  add column longitude double precision,
  add constraint valid_map_coordinates check (
    (latitude is null and longitude is null) or
    (latitude is not null and longitude is not null
     and latitude between -85.05112878 and 85.05112878
     and longitude between -180 and 180)
  );
grant update (latitude, longitude) on studyspot.spots to studyspot_api;
create policy api_location on studyspot.spots for update to studyspot_api
  using (true) with check (true);
