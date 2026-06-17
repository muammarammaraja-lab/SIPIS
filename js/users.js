// ============================================================
// SFMS LITE — Manajemen User (Kepala Sekolah only)
// ============================================================

import { supabase, SUPABASE_URL } from "./supabaseClient.js";
import { requireAuth, applyRoleVisibility } from "./auth.js";
import { showToast, formatDate, qs } from "./utils.js";

const auth = await requireAuth();
let isAllowed = false;

const ROLE_LABEL = {
  kepala_sekolah: "Kepala Sekolah", bendahara: "Bendahara", admin_keuangan: "Admin Keuangan",
  wali_kelas: "Wali Kelas", operator_sekolah: "Operator Sekolah", super_admin: "Super Admin",
};

if (auth) {
  applyRoleVisibility(auth.profile);
  isAllowed = ["kepala_sekolah", "super_admin"].includes(auth.profile.role);

  if (!isAllowed) {
    document.getElementById("mainPanel").style.display = "none";
    document.getElementById("accessDenied").style.display = "block";
    document.getElementById("btnAdd").style.display = "none";
  } else {
    loadUsers();
    loadClasses();
  }
}

document.getElementById("btnAdd").addEventListener("click", () => {
  document.getElementById("form").reset();
  document.getElementById("formError").style.display = "none";
  document.getElementById("modalOverlay").style.display = "flex";
});
document.getElementById("btnCancel").addEventListener("click", () => {
  document.getElementById("modalOverlay").style.display = "none";
});
document.getElementById("f_role").addEventListener("change", (e) => {
  document.getElementById("classPicker").style.display = e.target.value === "wali_kelas" ? "block" : "none";
});

async function loadClasses() {
  const { data } = await supabase.from("classes").select("*").order("name");
  document.getElementById("f_class").innerHTML = (data || []).map(c => `<option value="${c.id}">${c.name}</option>`).join("");
}

async function loadUsers() {
  const wrap = document.getElementById("userTableWrap");
  const { data, error } = await supabase.from("profiles").select("*").order("full_name");

  if (error) { wrap.innerHTML = `<div class="empty-state">${error.message}</div>`; return; }
  if (!data || data.length === 0) { wrap.innerHTML = `<div class="empty-state">Belum ada user.</div>`; return; }

  wrap.innerHTML = `
    <table>
      <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Status</th><th>Dibuat</th><th></th></tr></thead>
      <tbody>
        ${data.map(u => `
          <tr>
            <td>${u.full_name ?? "-"}</td>
            <td>${u.email ?? "-"}</td>
            <td>${ROLE_LABEL[u.role] ?? u.role}</td>
            <td>${u.is_active ? '<span class="badge badge-lunas">Aktif</span>' : '<span class="badge badge-dibatalkan">Non-Aktif</span>'}</td>
            <td>${formatDate(u.created_at)}</td>
            <td>
              ${u.role !== "kepala_sekolah" ? `<button class="btn btn-ghost btn-sm" data-toggle="${u.id}" data-active="${u.is_active}">${u.is_active ? "Nonaktifkan" : "Aktifkan"}</button>` : ""}
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;

  wrap.querySelectorAll("[data-toggle]").forEach(btn => {
    btn.addEventListener("click", () => toggleActive(btn.dataset.toggle, btn.dataset.active === "true"));
  });
}

async function toggleActive(userId, currentlyActive) {
  const { error } = await supabase.from("profiles").update({ is_active: !currentlyActive }).eq("id", userId);
  if (error) {
    showToast("Gagal mengubah status: " + error.message, "error");
    return;
  }
  showToast("Status user diperbarui.", "success");
  loadUsers();
}

document.getElementById("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById("formError");
  const submitBtn = document.getElementById("btnSubmit");
  errorBox.style.display = "none";
  submitBtn.disabled = true;
  submitBtn.textContent = "Menyimpan...";

  const payload = {
    email: qs("#f_email").value.trim(),
    password: qs("#f_password").value,
    full_name: qs("#f_full_name").value.trim(),
    role: qs("#f_role").value,
    class_id: qs("#f_role").value === "wali_kelas" ? qs("#f_class").value : null,
  };

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await res.json();

    if (!res.ok) {
      errorBox.textContent = result.error || "Terjadi kesalahan.";
      errorBox.style.display = "block";
      return;
    }

    showToast("User baru berhasil dibuat.", "success");
    document.getElementById("modalOverlay").style.display = "none";
    loadUsers();
  } catch (err) {
    errorBox.textContent = "Gagal menghubungi server: " + err.message;
    errorBox.style.display = "block";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Simpan";
  }
});
