-- The session that registered each device (hunt 040): the logout and a password change forget the
-- devices of the sessions they end, and a push goes only to devices of a session not revoked.
-- Additions only. Rows from before stay null, and get nothing, until the app registers its token
-- again, which it does at every start.
alter table device add column session_id uuid references auth_session (id) on delete cascade;
create index device_session_idx on device (session_id);
