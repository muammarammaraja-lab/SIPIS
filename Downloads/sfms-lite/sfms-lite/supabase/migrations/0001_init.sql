-- ============================================================
-- SFMS LITE — Database Schema (Supabase / PostgreSQL)
-- Stack: Free/cheap tier. Multi-tenant via school_id + RLS.
-- Jalankan file ini di Supabase Dashboard > SQL Editor.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. SCHOOLS (tenant)
-- ------------------------------------------------------------
create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  npsn text,
  address text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 2. PROFILES (extends auth.users, menyimpan role & school_id)
-- ------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid references schools(id),
  full_name text,
  role text not null check (role in
    ('super_admin','kepala_sekolah','bendahara','admin_keuangan','wali_kelas','operator_sekolah')),
  class_id uuid, -- diisi khusus role wali_kelas, scope ke 1 kelas
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Helper functions (security definer agar tidak recursive saat dipakai di RLS)
create or replace function my_school_id() returns uuid
language sql security definer stable as $$
  select school_id from profiles where id = auth.uid();
$$;

create or replace function my_role() returns text
language sql security definer stable as $$
  select role from profiles where id = auth.uid();
$$;

-- ------------------------------------------------------------
-- 3. MASTER DATA: academic_years, classes
-- ------------------------------------------------------------
create table academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  name text not null,         -- contoh: 2026/2027
  start_date date,
  end_date date,
  is_active boolean default true
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  academic_year_id uuid references academic_years(id),
  name text not null,         -- contoh: 6A, VII-B
  grade_level text,
  homeroom_teacher_id uuid references profiles(id)
);

-- ------------------------------------------------------------
-- 4. STUDENTS (data orang tua disimpan langsung di sini untuk MVP —
--    cukup untuk Split Billing sederhana via group by parent_whatsapp)
-- ------------------------------------------------------------
create table students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  class_id uuid references classes(id),
  nis text,
  nisn text,
  name text not null,
  status text default 'aktif' check (status in ('aktif','lulus','pindah','keluar','non_aktif')),
  parent_name text,
  parent_whatsapp text,       -- format E.164: +62xxxxxxxxxx
  parent_email text,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 5. BILLING TYPES & BILLS
-- ------------------------------------------------------------
create table billing_types (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  name text not null,          -- SPP, Uang Gedung, Seragam, dst
  billing_mode text default 'berkala' check (billing_mode in ('berkala','sekali_bayar','cicilan')),
  default_amount numeric(12,2) default 0,
  is_active boolean default true
);

create table bills (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  student_id uuid not null references students(id),
  billing_type_id uuid not null references billing_types(id),
  period text,                  -- contoh: 2026-07
  amount numeric(12,2) not null,
  amount_paid numeric(12,2) default 0,
  due_date date,
  status text default 'draft' check (status in
    ('draft','aktif','ditagihkan','sebagian_bayar','lunas','menunggak','dispensasi','dibatalkan')),
  last_reminder_type text check (last_reminder_type in ('friendly','medium','final') or last_reminder_type is null),
  last_reminder_sent_at timestamptz,
  invoice_token text unique default encode(gen_random_bytes(12), 'hex'),
  created_at timestamptz default now()
);

create index idx_bills_school_status on bills(school_id, status);
create index idx_bills_student on bills(student_id);

-- ------------------------------------------------------------
-- 6. PAYMENTS
-- ------------------------------------------------------------
create table payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  bill_id uuid not null references bills(id),
  amount numeric(12,2) not null,
  method text default 'manual_transfer' check (method in ('manual_transfer','tunai','qris','virtual_account','e_wallet')),
  status text default 'menunggu_verifikasi' check (status in ('menunggu_verifikasi','diterima','ditolak')),
  proof_url text,               -- path di Supabase Storage
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  rejection_note text,
  created_at timestamptz default now()
);

create index idx_payments_school_status on payments(school_id, status);

-- ------------------------------------------------------------
-- 7. WA LOGS (riwayat pengiriman reminder)
-- ------------------------------------------------------------
create table wa_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  bill_id uuid references bills(id),
  recipient_number text,
  reminder_type text,           -- friendly, medium, final, manual
  status text,                  -- sent, failed
  provider_response jsonb,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 8. AUDIT LOGS
-- ------------------------------------------------------------
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid,
  user_id uuid,
  action text not null,
  entity_type text,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY — isolasi antar sekolah (tenant)
-- ============================================================
alter table schools enable row level security;
alter table profiles enable row level security;
alter table academic_years enable row level security;
alter table classes enable row level security;
alter table students enable row level security;
alter table billing_types enable row level security;
alter table bills enable row level security;
alter table payments enable row level security;
alter table wa_logs enable row level security;
alter table audit_logs enable row level security;

-- schools: hanya bisa lihat sekolah sendiri (kecuali super_admin)
create policy schools_select on schools for select
  using (id = my_school_id() or my_role() = 'super_admin');

-- profiles: lihat profil di sekolah sendiri
create policy profiles_select on profiles for select
  using (school_id = my_school_id() or my_role() = 'super_admin' or id = auth.uid());

-- Generic policy pattern untuk tabel ber-school_id: select/insert/update/delete
-- hanya jika school_id cocok dengan sekolah user yang login.
create policy academic_years_all on academic_years for all
  using (school_id = my_school_id() or my_role() = 'super_admin')
  with check (school_id = my_school_id() or my_role() = 'super_admin');

create policy classes_all on classes for all
  using (school_id = my_school_id() or my_role() = 'super_admin')
  with check (school_id = my_school_id() or my_role() = 'super_admin');

create policy students_all on students for all
  using (school_id = my_school_id() or my_role() = 'super_admin')
  with check (school_id = my_school_id() or my_role() = 'super_admin');

create policy billing_types_all on billing_types for all
  using (school_id = my_school_id() or my_role() = 'super_admin')
  with check (school_id = my_school_id() or my_role() = 'super_admin');

create policy bills_all on bills for all
  using (school_id = my_school_id() or my_role() = 'super_admin')
  with check (school_id = my_school_id() or my_role() = 'super_admin');

create policy payments_all on payments for all
  using (school_id = my_school_id() or my_role() = 'super_admin')
  with check (school_id = my_school_id() or my_role() = 'super_admin');

create policy wa_logs_all on wa_logs for all
  using (school_id = my_school_id() or my_role() = 'super_admin')
  with check (school_id = my_school_id() or my_role() = 'super_admin');

create policy audit_logs_select on audit_logs for select
  using (school_id = my_school_id() or my_role() = 'super_admin');

-- Catatan keamanan:
-- 1. Halaman invoice publik (invoice.html) TIDAK memakai akun login —
--    ia mengakses data via Edge Function khusus (service role di server),
--    bukan langsung query dari browser, agar token invoice tidak bisa
--    dipakai membaca data sekolah lain.
-- 2. Wali Kelas dibatasi lebih lanjut di level aplikasi (query filter
--    class_id = profiles.class_id) selain RLS school_id di atas.
