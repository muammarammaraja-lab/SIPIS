# SFMS Lite — School Financial Management & Smart Collection System
### Versi murah/gratis (Vanilla JS + Supabase + Fonnte)

Ini adalah scaffold awal (MVP) dari sistem yang dibahas di dokumen SRS/TDD, tapi
dengan stack yang jauh lebih murah: tanpa VPS, tanpa Laravel, tanpa Docker.
Biaya untuk mulai: hampir Rp0 (kecuali biaya kirim WA per pesan ke Fonnte).

## Yang Sudah Dibuat

- Skema database lengkap + Row Level Security (multi-tenant per sekolah) — `supabase/migrations/0001_init.sql`
- Fungsi untuk halaman invoice publik (tanpa login) — `supabase/migrations/0003_public_invoice.sql`
- Audit trail otomatis (trigger DB) + perbaikan RLS untuk `wa_templates` — `supabase/migrations/0004_audit_and_fixes.sql`
- Edge Function reminder WA otomatis (tanggal 1/5/10), kini membaca template dari database — `supabase/functions/send-reminders/`
- Halaman: Login, Dashboard, Data Siswa (CRUD), **Jenis Tagihan (CRUD)**, Tagihan (generate massal + list status + export CSV), Pembayaran (manual + verifikasi + export CSV), **Template Pesan WA (editable per jenis reminder)**, **Audit Log (riwayat aktivitas, khusus Kepala Sekolah)**, dan Invoice publik untuk orang tua

## Yang Belum Dibuat (Next Steps)

- Manajemen User/Role oleh Kepala Sekolah (saat ini user dibuat manual via Dashboard Supabase)
- Export laporan dalam format PDF (saat ini baru CSV, yang sebenarnya sudah bisa langsung dibuka di Excel)
- Integrasi payment gateway otomatis (QRIS/VA) — saat ini hanya manual transfer + upload bukti
- Tabel `parents` terpisah untuk dukungan 1 orang tua banyak anak yang lebih rapi (saat ini disederhanakan: kontak orang tua disimpan langsung di tabel `students`)

---

## Setup — Langkah demi Langkah

### 1. Buat Project Supabase
1. Daftar gratis di [supabase.com](https://supabase.com), buat project baru.
2. Masuk ke **SQL Editor**, jalankan isi file `supabase/migrations/0001_init.sql`.
3. Jalankan juga `supabase/migrations/0003_public_invoice.sql`.
4. Jalankan juga `supabase/migrations/0004_audit_and_fixes.sql` (perbaikan keamanan + audit trail).
5. (Opsional) Jalankan `0002_seed_sample.sql` untuk data contoh — sesuaikan dulu komentarnya.

### 2. Buat User Pertama (Kepala Sekolah/Bendahara)
1. Dashboard Supabase > **Authentication > Users > Add User**, isi email & password.
2. Copy User ID (UUID) yang muncul.
3. Di **SQL Editor**, jalankan:
```sql
insert into profiles (id, school_id, full_name, role)
values ('UUID-USER-TADI', 'UUID-SCHOOL-DARI-SEED', 'Nama Anda', 'kepala_sekolah');
```
(Ganti `school_id` sesuai sekolah yang sudah dibuat, atau insert ke tabel `schools` dulu kalau belum ada.)

### 3. Ambil API Keys
1. Dashboard Supabase > **Project Settings > API**.
2. Copy `Project URL` dan `anon public key`.
3. Buka `js/supabaseClient.js`, ganti `SUPABASE_URL` dan `SUPABASE_ANON_KEY`.

### 4. Buat Bucket Storage (kalau belum otomatis dari migration)
1. Dashboard Supabase > **Storage > New Bucket** > nama `payment-proofs`, set **Public**.
2. Kalau bucket sudah otomatis dibuat dari `0003_public_invoice.sql`, lewati langkah ini.

### 5. Jalankan Lokal / Deploy
Karena ini murni HTML/CSS/JS (tidak ada build step), kamu bisa:
- Buka langsung `index.html` di browser (gunakan extension "Live Server" di VS Code agar ES Modules berjalan benar — tidak bisa dibuka via `file://` langsung), atau
- Deploy ke **Vercel** atau **GitHub Pages** seperti project kamu yang lain — push folder ini ke GitHub repo, lalu import ke Vercel (tidak perlu setting build command apa pun, ini static site).

### 6. Setup WhatsApp (Fonnte)
1. Daftar di [fonnte.com](https://fonnte.com), scan QR untuk hubungkan nomor WA.
2. Ambil **Token API** dari dashboard Fonnte.
3. Deploy Edge Function:
```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase functions deploy send-reminders
supabase secrets set FONNTE_TOKEN=token-fonnte-kamu
supabase secrets set APP_BASE_URL=https://domain-vercel-kamu.vercel.app
```
(`SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` otomatis tersedia di environment Edge Function. `APP_BASE_URL` dipakai untuk membangun link `{{link_pembayaran}}` di pesan WA — isi dengan domain Vercel kamu, tanpa garis miring di akhir.)

**Catatan kalau kamu deploy ulang Edge Function ini setelah update kode**: jalankan ulang `supabase functions deploy send-reminders` dari folder project (pastikan Docker Desktop sedang berjalan).

### 7. Setup Cron Harian (Trigger Reminder Jam 08:00)
Cara paling mudah & gratis — pakai [cron-job.org](https://cron-job.org):
1. Daftar gratis, buat cron job baru.
2. URL target: `https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-reminders`
3. Jadwal: setiap hari jam 08:00 (sesuaikan timezone WITA).
4. Tambahkan header: `Authorization: Bearer YOUR-ANON-OR-SERVICE-KEY` (sesuai setting auth Edge Function kamu).

Alternatif: aktifkan extension `pg_cron` + `pg_net` di Supabase (Database > Extensions) dan jadwalkan langsung dari SQL — lebih teknis tapi tidak butuh layanan eksternal.

### 8. Bagikan Link Invoice ke Orang Tua
Setiap tagihan punya `invoice_token` unik (lihat kolom di tabel `bills`). Link yang dibagikan ke orang tua:
```
https://domain-kamu.vercel.app/invoice.html?t=TOKEN_TAGIHAN
```
Edge Function reminder bisa diupdate nanti untuk otomatis menyertakan link ini di pesan WA (variabel `{{link_pembayaran}}` pada Bagian H di dokumen SRS).

---

## Struktur Folder
```
sfms-lite/
  index.html          Login
  dashboard.html       Dashboard ringkasan
  siswa.html             CRUD data siswa
  tagihan.html             Generate & list tagihan
  pembayaran.html             Input & verifikasi pembayaran
  invoice.html                  Halaman publik untuk orang tua
  css/style.css
  js/
    supabaseClient.js    Konfigurasi koneksi (ISI API KEY DI SINI)
    auth.js                  Login, logout, session guard
    utils.js                     Helper format & toast
    dashboard.js, siswa.js, tagihan.js, pembayaran.js, invoice.js
  supabase/
    migrations/                  Jalankan urut: 0001 -> 0002 (opsional) -> 0003
    functions/send-reminders/    Edge Function reminder WA otomatis
```

## Biaya Estimasi Bulanan (Tahap Awal)
| Komponen | Biaya |
|---|---|
| Supabase (free tier) | Rp0 |
| Vercel/GitHub Pages | Rp0 |
| Fonnte | ± Rp0,3–1k per pesan terkirim |
| cron-job.org | Rp0 |
| Domain (opsional) | ± Rp150rb/tahun |

Naik ke Supabase Pro (~Rp400rb/bulan) hanya kalau sudah kena limit free tier (database/storage/bandwidth) — biasanya setelah ada cukup banyak sekolah aktif yang membayar.
