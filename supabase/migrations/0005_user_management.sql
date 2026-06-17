-- ============================================================
-- USER MANAGEMENT: tambah kolom email ke profiles (untuk tampilan
-- daftar user di UI, supaya tidak perlu akses admin auth.users
-- dari sisi client).
-- ============================================================

alter table profiles add column if not exists email text;

-- Backfill email untuk user yang sudah ada sebelumnya (dijalankan sekali)
update profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

-- Izinkan Kepala Sekolah mengubah profil staf di sekolahnya sendiri
-- (dipakai untuk nonaktifkan/aktifkan user dari UI)
create policy profiles_update_by_kepsek on profiles for update
  using (school_id = my_school_id() and my_role() in ('kepala_sekolah','super_admin'))
  with check (school_id = my_school_id() and my_role() in ('kepala_sekolah','super_admin'));
