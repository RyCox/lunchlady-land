-- Lunchlady Land schema. Runs once against an empty database.
-- Works on Postgres 15+ (Supabase) and on PGlite for local development.

create table schools (
  id serial primary key,
  name text not null unique,
  code text not null unique
);

create table users (
  id serial primary key,
  name text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'manager')),
  school_id int references schools(id),
  check (role = 'admin' or school_id is not null)
);

-- District catalog. Creditable amounts are per serving, in the units the
-- Production Record uses (oz eq for MMA and Grain, cups for veg, fruit, milk).
create table food_items (
  id serial primary key,
  item_no text not null unique,
  description text not null,
  haccp text not null default '',
  portion_size text not null default '',
  category text not null check (category in ('general', 'fruit', 'milk', 'condiment')),
  unit text not null default 'case' check (unit in ('case', 'can', 'lb', 'bag', 'each', 'recipe')),
  cr_mma numeric not null default 0,
  cr_grain numeric not null default 0,
  cr_vbp numeric not null default 0,
  cr_vdg numeric not null default 0,
  cr_vot numeric not null default 0,
  cr_vro numeric not null default 0,
  cr_vst numeric not null default 0,
  cr_vad numeric not null default 0,
  cr_fruit numeric not null default 0,
  cr_milk numeric not null default 0,
  source text not null default '',
  active boolean not null default true
);

create table menus (
  id serial primary key,
  menu_no int not null unique,
  name text not null,
  meal text not null check (meal in ('breakfast', 'lunch')),
  active boolean not null default true
);

create table menu_items (
  id serial primary key,
  menu_id int not null references menus(id) on delete cascade,
  food_item_id int not null references food_items(id),
  planned_pk int not null default 0,
  planned_k5 int not null default 0,
  planned_k8 int not null default 0,
  planned_912 int not null default 0,
  planned_other int not null default 0,
  sort int not null default 0,
  unique (menu_id, food_item_id)
);

-- One record per school, date and meal. Menu and food item details are
-- copied onto the record so later catalog edits never change a filed record.
create table production_records (
  id serial primary key,
  school_id int not null references schools(id),
  record_date date not null,
  meal text not null check (meal in ('breakfast', 'lunch')),
  menu_id int references menus(id),
  menu_no int,
  menu_name text not null default '',
  prepared_by text not null default '',
  offer_vs_serve boolean not null default true,
  ovs_reason text not null default '',
  count_pk int not null default 0,
  count_k5 int not null default 0,
  count_k8 int not null default 0,
  count_912 int not null default 0,
  count_adults int not null default 0,
  count_staff int not null default 0,
  count_notes text not null default '',
  status text not null default 'draft' check (status in ('draft', 'finalized')),
  version int not null default 1,
  finalized_at timestamptz,
  finalized_by int references users(id),
  created_at timestamptz not null default now(),
  unique (school_id, record_date, meal)
);

create table production_record_lines (
  id serial primary key,
  record_id int not null references production_records(id),
  food_item_id int references food_items(id),
  item_no text not null,
  description text not null,
  haccp text not null default '',
  portion_size text not null default '',
  category text not null,
  unit text not null default 'case',
  cr_mma numeric not null default 0,
  cr_grain numeric not null default 0,
  cr_vbp numeric not null default 0,
  cr_vdg numeric not null default 0,
  cr_vot numeric not null default 0,
  cr_vro numeric not null default 0,
  cr_vst numeric not null default 0,
  cr_vad numeric not null default 0,
  cr_fruit numeric not null default 0,
  cr_milk numeric not null default 0,
  source text not null default '',
  planned_pk int not null default 0,
  planned_k5 int not null default 0,
  planned_k8 int not null default 0,
  planned_912 int not null default 0,
  planned_other int not null default 0,
  amt_prepared text not null default '',
  num_prepared int,
  num_served int,
  num_sold_alc int,
  amt_leftover int,
  code text not null default '',
  sort int not null default 0
);

-- Counts copied by the manager from the paper Pull Sheet, one per record line.
create table pull_sheet_lines (
  id serial primary key,
  record_line_id int not null unique references production_record_lines(id),
  prepared_by_initials text not null default '',
  qty_pulled text not null default '',
  temp1 numeric,
  temp2 numeric,
  amount_prepared int,
  amount_used int,
  amount_leftover int,
  leftover_code text not null default '' check (leftover_code in ('', 'F', 'R', 'SND', 'D'))
);

create table amendments (
  id serial primary key,
  record_id int not null references production_records(id),
  version int not null,
  reason text not null check (length(trim(reason)) > 0),
  changes jsonb not null,
  amended_by int not null references users(id),
  amended_at timestamptz not null default now()
);

-- Printed copy of each finalized version, with a checksum.
create table record_archives (
  id serial primary key,
  record_id int not null references production_records(id),
  version int not null,
  html text not null,
  sha256 text not null,
  created_by int not null references users(id),
  created_at timestamptz not null default now(),
  unique (record_id, version)
);

create table audit_events (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id int,
  table_name text not null,
  row_id int,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  reason text
);

-- The app sets app.user_id (and app.reason / app.amending when amending)
-- for each transaction with set_config(..., true).
create function audit_row() returns trigger language plpgsql as $$
declare
  uid int := nullif(current_setting('app.user_id', true), '')::int;
  why text := nullif(current_setting('app.reason', true), '');
begin
  if tg_op = 'DELETE' then
    insert into audit_events (user_id, table_name, row_id, action, old_value, reason)
    values (uid, tg_table_name, old.id, tg_op, to_jsonb(old), why);
    return old;
  elsif tg_op = 'UPDATE' then
    if to_jsonb(old) = to_jsonb(new) then return new; end if;
    insert into audit_events (user_id, table_name, row_id, action, old_value, new_value, reason)
    values (uid, tg_table_name, new.id, tg_op, to_jsonb(old), to_jsonb(new), why);
    return new;
  else
    insert into audit_events (user_id, table_name, row_id, action, new_value, reason)
    values (uid, tg_table_name, new.id, tg_op, to_jsonb(new), why);
    return new;
  end if;
end $$;

create trigger audit_schools after insert or update or delete on schools for each row execute function audit_row();
create trigger audit_users after insert or update or delete on users for each row execute function audit_row();
create trigger audit_food_items after insert or update or delete on food_items for each row execute function audit_row();
create trigger audit_menus after insert or update or delete on menus for each row execute function audit_row();
create trigger audit_menu_items after insert or update or delete on menu_items for each row execute function audit_row();
create trigger audit_records after insert or update or delete on production_records for each row execute function audit_row();
create trigger audit_record_lines after insert or update or delete on production_record_lines for each row execute function audit_row();
create trigger audit_pull_sheet after insert or update or delete on pull_sheet_lines for each row execute function audit_row();
create trigger audit_amendments after insert or update or delete on amendments for each row execute function audit_row();

-- Finalized records are locked. The only way to change one is an amendment,
-- which runs with app.amending = 'on' and a reason. Records are never deleted.
create function record_is_locked(rid int) returns boolean language sql as $$
  select status = 'finalized' from production_records where id = rid
$$;

create function enforce_record_lock() returns trigger language plpgsql as $$
declare
  rid int;
  amending boolean := coalesce(current_setting('app.amending', true), '') = 'on';
begin
  if tg_table_name = 'production_records' then
    if tg_op = 'DELETE' then
      raise exception 'Production Records cannot be deleted';
    end if;
    if old.status = 'finalized' and not amending then
      raise exception 'Production Record % is finalized; changes need an amendment', old.id;
    end if;
    return new;
  end if;

  if tg_table_name = 'production_record_lines' then
    rid := case when tg_op = 'INSERT' then new.record_id else old.record_id end;
  else
    select record_id into rid from production_record_lines
    where id = case when tg_op = 'INSERT' then new.record_line_id else old.record_line_id end;
  end if;

  if record_is_locked(rid) and not amending then
    raise exception 'Production Record % is finalized; changes need an amendment', rid;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger lock_records before update or delete on production_records for each row execute function enforce_record_lock();
create trigger lock_record_lines before insert or update or delete on production_record_lines for each row execute function enforce_record_lock();
create trigger lock_pull_sheet before insert or update or delete on pull_sheet_lines for each row execute function enforce_record_lock();

create function forbid_change() returns trigger language plpgsql as $$
begin
  raise exception '% rows cannot be changed or deleted', tg_table_name;
end $$;

create trigger archives_append_only before update or delete on record_archives for each row execute function forbid_change();
create trigger amendments_append_only before update or delete on amendments for each row execute function forbid_change();
create trigger audit_append_only before update or delete on audit_events for each row execute function forbid_change();
