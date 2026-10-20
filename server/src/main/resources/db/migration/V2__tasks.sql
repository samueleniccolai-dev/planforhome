-- Tasks, the change log and applied mutations (SPEC sections 6 and 7). Additions only.
create table task (
    id                      uuid primary key,
    family_id               uuid        not null references family (id),
    title                   text        not null,
    notes                   text,
    due_at                  timestamptz,
    due_kind                text check (due_kind in ('DATE', 'DATETIME')),
    reminder_offset_minutes int         not null default 60,
    criticality             text        not null default 'NORMAL'
                            check (criticality in ('LOW', 'NORMAL', 'HIGH')),
    status                  text        not null default 'OPEN'
                            check (status in ('OPEN', 'DONE', 'CANCELLED')),
    assignee_person_id      uuid,
    recurrence              jsonb,
    template                text        not null default 'NONE'
                            check (template in ('NONE', 'SHOPPING_LIST')),
    series_id               uuid,
    created_by              uuid        not null references person (id),
    completed_by            uuid references person (id),
    version                 bigint      not null,
    created_at              timestamptz not null,
    updated_at              timestamptz not null,
    check ((due_at is null) = (due_kind is null)),
    foreign key (family_id, assignee_person_id) references membership (family_id, person_id)
);
create index task_family_idx on task (family_id);
create index task_family_assignee_idx on task (family_id, assignee_person_id);

create table change_log (
    seq       bigint generated always as identity primary key,
    family_id uuid        not null references family (id),
    entity    text        not null,
    entity_id uuid        not null,
    op        text        not null check (op in ('UPSERT', 'DELETE')),
    at        timestamptz not null
);
create index change_log_family_idx on change_log (family_id, seq);
create index change_log_entity_idx on change_log (entity_id);

create table applied_mutation (
    mutation_id uuid primary key,
    person_id   uuid        not null references person (id),
    family_id   uuid        not null references family (id),
    entity_id   uuid        not null,
    op          text        not null,
    applied_at  timestamptz not null
);
