// ============================================================
// SFMS LITE — Auth & session guard v3.1
// Tambah: app_name dari schools, update document.title & data-app-name
// ============================================================

import { supabase } from "./supabaseClient.js";
import { showToast } from "./utils.js";

const ROLE_LABEL = {
  super_admin:      "Super Admin",
  kepala_sekolah:   "Kepala Sekolah",
  bendahara:        "Bendahara",
  admin_keuangan:   "Admin Keuangan",
  wali_kelas:       "Wali Kelas",
  operator_sekolah: "Operator Sekolah",
};

export async function loginWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function logout() {
  await supabase.auth.signOut();
  window.location.href = "index.html";
}

export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
    return null;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*, schools(name, app_name, logo_url, theme_color)")
    .eq("id", session.user.id)
    .single();

  if (error || !profile) {
    showToast("Profil belum lengkap. Hubungi Super Admin.", "error");
    return null;
  }

  const school    = profile.schools ?? {};
  const appName   = school.app_name  || "SFMS Lite";
  const schoolName = school.name     || "-";

  // Isi elemen sidebar
  document.querySelectorAll("[data-user-name]").forEach(el => el.textContent = profile.full_name || session.user.email);
  document.querySelectorAll("[data-user-role]").forEach(el => el.textContent = ROLE_LABEL[profile.role] || profile.role);
  document.querySelectorAll("[data-school-name]").forEach(el => el.textContent = schoolName);
  document.querySelectorAll("[data-app-name]").forEach(el => el.textContent = appName);

  // Update judul browser — ambil nama halaman dari <title> yang ada
  const pageTitle = document.title.split("—")[0].trim();
  document.title = `${pageTitle} — ${appName}`;

  // Apply logo di sidebar jika ada
  if (school.logo_url) {
    document.querySelectorAll(".brand-icon").forEach(el => {
      el.innerHTML = `<img src="${school.logo_url}" alt="logo"
        style="width:100%;height:100%;object-fit:cover;border-radius:6px" />`;
    });
  }

  // Apply warna tema sidebar jika ada
  if (school.theme_color) {
    applyThemeColor(school.theme_color);
  }

  // Logout handler
  document.querySelectorAll("[data-logout]").forEach(btn =>
    btn.addEventListener("click", logout)
  );

  return { session, profile };
}

// Apply warna tema ke sidebar via CSS variable
function applyThemeColor(color) {
  let style = document.getElementById("_authThemeStyle");
  if (!style) {
    style = document.createElement("style");
    style.id = "_authThemeStyle";
    document.head.appendChild(style);
  }
  style.textContent = `
    .sidebar { background: ${color} !important; }
    .sidebar .nav-section { color: rgba(255,255,255,0.35) !important; }
    .sidebar nav a { color: rgba(255,255,255,0.75) !important; }
    .sidebar nav a:hover { background: rgba(255,255,255,0.08) !important; color: #fff !important; }
    .sidebar nav a.active { background: rgba(255,255,255,0.14) !important; color: #fff !important; }
    .sidebar .user-box { border-top-color: rgba(255,255,255,0.1) !important; }
  `;
}

export function applyRoleVisibility(profile) {
  document.querySelectorAll("[data-roles]").forEach(el => {
    const allowed = el.getAttribute("data-roles").split(",").map(r => r.trim());
    if (!allowed.includes(profile.role)) el.style.display = "none";
  });
}
