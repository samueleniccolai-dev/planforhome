-- Who added an item and who removed it (decision 018-a). Additions only.
alter table shopping_item add column created_by uuid references person (id);
update shopping_item s set created_by = t.created_by from task t where t.id = s.task_id;
alter table shopping_item alter column created_by set not null;
alter table shopping_item add column removed_by uuid references person (id);
