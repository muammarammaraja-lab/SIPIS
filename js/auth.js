// ============================================================
// SFMS LITE — Auth & session guard
// ============================================================

import { supabase } from "./supabaseClient.js";
import { showToast } from "./utils.js";

const ROLE_LABEL = {
  super_admin: "Super Admin",
  kepala_sekolah: "Kepala Sekolah",
  bendahara: "Bendahara",
  admin_keuangan: "Admin Keuangan",
  wali_kelas: "Wali Kelas",
  operator_sekolah: "Operator Sekolah",
};

// Dipanggil di index.html (halaman login)
export async function loginWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function logout() {
  await supabase.auth.signOut();
  window.location.href = "index.html";
}

// Dipanggil di setiap halaman internal (selain index.html & invoice.html)
// untuk memastikan user sudah login, lalu mengisi sidebar/topbar.
export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
    return null;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*, schools(name)")
    .eq("id", session.user.id)
    .single();

  if (error || !profile) {
    showToast("Profil belum lengkap. Hubungi Super Admin.", "error");
    return null;
  }

  document.querySelectorAll("[data-user-name]").forEach(el => el.textContent = profile.full_name || session.user.email);
  document.querySelectorAll("[data-user-role]").forEach(el => el.textContent = ROLE_LABEL[profile.role] || profile.role);
  document.querySelectorAll("[data-school-name]").forEach(el => el.textContent = profile.schools?.name || "-");

  const logoutBtn = document.querySelector("[data-logout]");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  return { session, profile };
}

// Helper: cek apakah role saat ini termasuk daftar yang diizinkan,
// kalau tidak, sembunyikan elemen (mis. tombol "Generate Tagihan" untuk Wali Kelas).
export function applyRoleVisibility(profile) {
  document.querySelectorAll("[data-roles]").forEach(el => {
    const allowed = el.getAttribute("data-roles").split(",").map(r => r.trim());
    if (!allowed.includes(profile.role)) el.style.display = "none";
  });
}
