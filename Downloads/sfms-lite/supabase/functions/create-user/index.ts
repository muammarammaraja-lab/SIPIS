import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ROLES = ["bendahara", "admin_keuangan", "wali_kelas", "operator_sekolah"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization header" }, 401);

  const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !callerData?.user) return json({ error: "Unauthorized" }, 401);

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: callerProfile, error: profileErr } = await adminClient
    .from("profiles")
    .select("role, school_id")
    .eq("id", callerData.user.id)
    .single();

  if (profileErr || !callerProfile) return json({ error: "Profil pemanggil tidak ditemukan" }, 403);
  if (callerProfile.role !== "kepala_sekolah" && callerProfile.role !== "super_admin") {
    return json({ error: "Hanya Kepala Sekolah yang dapat menambah user" }, 403);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body request tidak valid" }, 400);
  }

  const { email, password, full_name, role, class_id } = body;

  if (!email || !password || !full_name || !role) {
    return json({ error: "email, password, full_name, dan role wajib diisi" }, 400);
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return json({ error: "Role tidak valid. Pilih: " + ALLOWED_ROLES.join(", ") }, 400);
  }
  if (String(password).length < 6) {
    return json({ error: "Password minimal 6 karakter" }, 400);
  }

  const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createErr) return json({ error: "Gagal membuat akun: " + createErr.message }, 400);

  const { error: insertErr } = await adminClient.from("profiles").insert({
    id: newUser.user!.id,
    school_id: callerProfile.school_id,
    full_name,
    email,
    role,
    class_id: role === "wali_kelas" ? (class_id || null) : null,
    is_active: true,
  });

  if (insertErr) {
    await adminClient.auth.admin.deleteUser(newUser.user!.id);
    return json({ error: "Gagal menyimpan profil: " + insertErr.message }, 400);
  }

  return json({ success: true, user_id: newUser.user!.id });
});