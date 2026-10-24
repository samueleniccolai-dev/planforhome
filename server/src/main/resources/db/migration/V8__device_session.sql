-- The session that registered each device (hunt 040): the logout and a password change forget the
-- devices of the sessions they end. Additions only. Rows from before stay null until the app
-- registers its token again, which it does at every start.
alter table device add column session_id uuid references auth_session (id);
create index device_session_idx on device (session_id);
