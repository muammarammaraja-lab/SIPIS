// ============================================================
// SIPIS — Konfigurasi Koneksi Supabase
// ============================================================
//
// UNTUK SEKOLAH BARU — ganti dua nilai di bawah ini:
//
// Langkah:
// 1. Buka https://supabase.com → buat project baru
// 2. Masuk ke: Project Settings → API
// 3. Salin "Project URL" → ganti nilai SUPABASE_URL
// 4. Salin "anon public" key → ganti nilai SUPABASE_ANON_KEY
//
// ⚠️  Jangan bagikan SUPABASE_ANON_KEY ke publik jika RLS
//     belum dikonfigurasi dengan benar di project Supabase.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 👇 GANTI DUA BARIS INI DENGAN MILIK PROJECT SUPABASE ANDA

const SUPABASE_URL     = "https://indjyxvhyjuzybmxxhqm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImluZGp5eHZoeWp1enlibXh4aHFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NzA0MTgsImV4cCI6MjA5NzI0NjQxOH0.b8eWPCg_rTVrs9Uc1rDoqT0TRez4RGbFWdoTo2VwhTA";

// ✋ JANGAN UBAH DI BAWAH INI

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export { SUPABASE_URL };
