-- ============================================================
-- PERBAIKAN & FITUR TAMBAHAN:
-- 1. wa_templates ternyata belum dilindungi RLS di migration awal
--    (lubang keamanan kecil) — diperbaiki di sini.
-- 2. Audit trail otomatis: trigger generik yang mencatat setiap
--    insert/update/delete pada tabel-tabel penting ke audit_logs,
--    menyimpan data sebelum & sesudah perubahan.
-- ============================================================

-- ---------- 1. FIX: aktifkan RLS untuk wa_templates ----------
alter table wa_templates enable row level security;

create policy wa_templates_all on wa_templates for all
  using (school_id = my_school_id() or my_role() = 'super_admin')
  with check (school_id = my_school_id() or my_role() = 'super_admin');

-- ---------- 2. AUDIT TRAIL: trigger generik ----------
create or replace function log_audit_event()
returns trigger
language plpgsql security definer as $$
declare
  v_school_id uuid;
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if (tg_op = 'DELETE') then
    v_school_id := old.school_id;
  else
    v_school_id := new.school_id;
  end if;

  insert into audit_logs (school_id, user_id, action, entity_type, entity_id, before_data, after_data)
  values (
    v_school_id,
    v_user_id,
    lower(tg_op),  -- 'insert', 'update', atau 'delete'
    tg_table_name,
    case when tg_op = 'DELETE' then old.id else new.id end,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );

  if (tg_op = 'DELETE') then
    return old;
  else
    return new;
  end if;
end;
$$;

-- Pasang trigger di tabel-tabel paling penting untuk diaudit
create trigger trg_audit_students
  after insert or update or delete on students
  for each row execute function log_audit_event();

create trigger trg_audit_bills
  after insert or update or delete on bills
  for each row execute function log_audit_event();

create trigger trg_audit_payments
  after insert or update or delete on payments
  for each row execute function log_audit_event();

create trigger trg_audit_billing_types
  after insert or update or delete on billing_types
  for each row execute function log_audit_event();

-- Catatan: trigger tidak dipasang di tabel audit_logs itu sendiri
-- (supaya tidak infinite loop), dan tidak dipasang untuk login/logout
-- karena itu event dari auth.users, bukan tabel aplikasi biasa.
