-- The items of a shopping list (SPEC section 6). Additions only.
create table shopping_item (
    id         uuid primary key,
    task_id    uuid        not null references task (id),
    text       text        not null,
    checked    boolean     not null default false,
    position   int         not null,
    version    bigint      not null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    deleted_at timestamptz
);
create index shopping_item_task_idx on shopping_item (task_id, position);
