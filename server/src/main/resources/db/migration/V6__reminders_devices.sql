-- Devices that receive push notifications and the log of what was sent (SPEC section 6).
-- Additions only. fcm_token is unique: a phone that changes user passes to the last one.
create table device (
    id           uuid primary key,
    person_id    uuid        not null references person (id),
    fcm_token    text        not null unique,
    platform     text        not null check (platform in ('ANDROID')),
    last_seen_at timestamptz not null
);
create index device_person_idx on device (person_id);

-- One row per device token tried, or one row if none is tried. AUTO is for the periodic job.
create table reminder (
    id                  uuid primary key,
    task_id             uuid        not null references task (id),
    recipient_person_id uuid        not null references person (id),
    kind                text        not null check (kind in ('AUTO', 'NUDGE')),
    due_at              timestamptz not null,
    sent_at             timestamptz,
    result              text        not null
);
create index reminder_task_idx on reminder (task_id, due_at);
