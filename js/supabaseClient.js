// ============================================================
// SFMS LITE — Konfigurasi koneksi Supabase
// GANTI dua nilai di bawah dengan punya project Supabase kamu:
// Dashboard Supabase > Project Settings > API
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
