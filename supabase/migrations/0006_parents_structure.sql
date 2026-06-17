-- ============================================================
-- RAPIKAN STRUKTUR DATA ORANG TUA
-- Menambahkan tabel parents + student_parent (many-to-many),
-- dengan trigger dua arah agar kolom parent_name/parent_whatsapp/
-- parent_email yang sudah ada di tabel students TETAP berfungsi
-- seperti biasa (tidak perlu ubah UI Data Siswa), sambil di
-- belakang layar membangun struktur relasional yang lebih rapi.
-- ============================================================

create table if not exists parents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  name text,
  whatsapp_number text,
  email text,
  created_at timestamptz default now(),
  unique (school_id, whatsapp_number)
);

create table if not exists student_parent (
  student_id uuid not null references students(id) on delete cascade,
  parent_id uuid not null references parents(id) on delete cascade,
  school_id uuid not null references schools(id),
  relationship text, -- ayah, ibu, wali
  is_primary_contact boolean default true,
  primary key (student_id, parent_id)
);

alter table parents enable row level security;
alter table student_parent enable row level security;

create policy parents_all on parents for all
  using (school_id = my_school_id() or my_role() = 'super_admin')
  with check (school_id = my_school_id() or my_role() = 'super_admin');

create policy student_parent_all on student_parent for all
  using (school_id = my_school_id() or my_role() = 'super_admin')
  with check (school_id = my_school_id() or my_role() = 'super_admin');

-- ---------- TRIGGER 1: students -> parents (arah lama, tetap jalan) ----------
create or replace function sync_student_to_parent()
returns trigger
language plpgsql security definer as $$
declare
  v_parent_id uuid;
begin
  if new.parent_whatsapp is null or new.parent_whatsapp = '' then
    return new;
  end if;

  insert into parents (school_id, whatsapp_number, name, email)
  values (new.school_id, new.parent_whatsapp, new.parent_name, new.parent_email)
  on conflict (school_id, whatsapp_number)
  do update set
    name = coalesce(excluded.name, parents.name),
    email = coalesce(excluded.email, parents.email)
  returning id into v_parent_id;

  insert into student_parent (student_id, parent_id, school_id, is_primary_contact)
  values (new.id, v_parent_id, new.school_id, true)
  on conflict (student_id, parent_id) do nothing;

  return new;
end;
$$;

create trigger trg_sync_student_to_parent
  after insert or update of parent_name, parent_whatsapp, parent_email on students
  for each row execute function sync_student_to_parent();

-- ---------- TRIGGER 2: parents -> students (arah baru, untuk Data Orang Tua) ----------
create or replace function sync_parent_to_students()
returns trigger
language plpgsql security definer as $$
begin
  update students s
  set parent_name = new.name, parent_whatsapp = new.whatsapp_number, parent_email = new.email
  from student_parent sp
  where sp.parent_id = new.id and sp.student_id = s.id and sp.is_primary_contact = true
    and (s.parent_name is distinct from new.name
      or s.parent_whatsapp is distinct from new.whatsapp_number
      or s.parent_email is distinct from new.email);
  return new;
end;
$$;

create trigger trg_sync_parent_to_students
  after update of name, whatsapp_number, email on parents
  for each row execute function sync_parent_to_students();

-- ---------- BACKFILL: bangun data parents dari students yang sudah ada ----------
insert into parents (school_id, whatsapp_number, name, email)
select distinct school_id, parent_whatsapp, parent_name, parent_email
from students
where parent_whatsapp is not null and parent_whatsapp <> ''
on conflict (school_id, whatsapp_number) do nothing;

insert into student_parent (student_id, parent_id, school_id, is_primary_contact)
select s.id, p.id, s.school_id, true
from students s
join parents p on p.school_id = s.school_id and p.whatsapp_number = s.parent_whatsapp
where s.parent_whatsapp is not null and s.parent_whatsapp <> ''
on conflict (student_id, parent_id) do nothing;
