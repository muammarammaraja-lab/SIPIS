// ============================================================
// SFMS LITE — Konfigurasi koneksi Supabase
// GANTI dua nilai di bawah dengan punya project Supabase kamu:
// Dashboard Supabase > Project Settings > API
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://indjyxvhyjuzybmxxhqm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImluZGp5eHZoeWp1enlibXh4aHFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NzA0MTgsImV4cCI6MjA5NzI0NjQxOH0.b8eWPCg_rTVrs9Uc1rDoqT0TRez4RGbFWdoTo2VwhTA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
