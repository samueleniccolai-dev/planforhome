-- The history of a task (SPEC section 6). Additions only. Only FORWARDED is written for now.
create table task_event (
    id              uuid primary key,
    task_id         uuid        not null references task (id),
    type            text        not null
                    check (type in ('CREATED', 'ASSIGNED', 'TAKEN', 'DONE', 'CANCELLED', 'FORWARDED', 'NUDGED')),
    actor_person_id uuid        not null references person (id),
    data            jsonb       not null default '{}',
    at              timestamptz not null
);
create index task_event_task_idx on task_event (task_id, at);
