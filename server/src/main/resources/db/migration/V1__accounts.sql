-- Accounts and access (SPEC section 6). Every instant is written by the application from its Clock.
create table person (
    id           uuid primary key,
    display_name text        not null,
    locale       text        not null,
    created_at   timestamptz not null
);

create table user_account (
    person_id     uuid primary key references person (id),
    email         text        not null unique,
    password_hash text        not null,
    created_at    timestamptz not null,
    disabled_at   timestamptz
);

create table family (
    id         uuid primary key,
    name       text        not null,
    time_zone  text        not null default 'Europe/Rome',
    created_at timestamptz not null
);

create table membership (
    family_id           uuid not null references family (id),
    person_id           uuid not null references person (id),
    role                text not null check (role in ('MANAGER', 'MEMBER')),
    referent_person_id  uuid,
    primary key (family_id, person_id),
    foreign key (family_id, referent_person_id) references membership (family_id, person_id)
);
create index membership_person_idx on membership (person_id);

create table invite (
    code       text primary key,
    family_id  uuid        not null references family (id),
    created_by uuid        not null references person (id),
    created_at timestamptz not null,
    expires_at timestamptz not null,
    used_by    uuid references person (id),
    used_at    timestamptz
);
create index invite_family_idx on invite (family_id);

create table auth_session (
    id         uuid primary key,
    token_hash text        not null unique,
    person_id  uuid        not null references person (id),
    created_at timestamptz not null,
    expires_at timestamptz not null,
    revoked_at timestamptz
);
create index auth_session_person_idx on auth_session (person_id);
