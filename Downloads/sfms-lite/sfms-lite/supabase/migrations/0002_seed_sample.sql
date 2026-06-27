-- ============================================================
-- SEED DATA (opsional) — untuk testing awal.
-- Jalankan SETELAH 0001_init.sql dan setelah membuat user pertama
-- lewat Supabase Auth (Dashboard > Authentication > Add User).
-- Ganti :first_user_id dengan UUID user yang baru dibuat.
-- ============================================================

-- 1. Buat 1 sekolah contoh
insert into schools (id, name, npsn) values
  ('11111111-1111-1111-1111-111111111111', 'SDIT Contoh Sinjai', '12345678');

-- 2. Hubungkan user pertama sebagai Kepala Sekolah di sekolah ini
-- update profiles set school_id = '11111111-1111-1111-1111-111111111111',
--   full_name = 'Kepala Sekolah Contoh', role = 'kepala_sekolah'
--   where id = ':first_user_id';

-- 3. Tahun ajaran & kelas
insert into academic_years (id, school_id, name, is_active) values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '2026/2027', true);

insert into classes (id, school_id, academic_year_id, name, grade_level) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', '6A', '6');

-- 4. Contoh siswa
insert into students (school_id, class_id, nis, nisn, name, parent_name, parent_whatsapp) values
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
   '2026001', '0012345678', 'Ahmad Fauzi', 'Budi Santoso', '+6281234567890');

-- 5. Jenis tagihan
insert into billing_types (school_id, name, billing_mode, default_amount) values
  ('11111111-1111-1111-1111-111111111111', 'SPP Bulanan', 'berkala', 150000);
