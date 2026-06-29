// ============================================================
// SFMS LITE — Manajemen User v3.1
// Hanya kepala_sekolah — buat akun via Supabase Admin API
// ============================================================
import { supabase, SUPABASE_URL } from "./supabaseClient.js";
import { requireAuth, applyRoleVisibility } from "./auth.js";
import { showToast, formatDatetime, qs } from "./utils.js";

const auth = await requireAuth();
if (!auth) throw new Error("Unauthenticated");
const { session, profile } = auth;
applyRoleVisibility(profile);

// Guard: hanya kepala_sekolah
if (profile.role !== "kepala_sekolah") {
  document.querySelector(".content").innerHTML = `
    <div class="empty-state">
      <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
      <div class="empty-title">Akses Ditolak</div>
      <div class="empty-desc">Hanya Kepala Sekolah yang dapat mengakses halaman ini.</div>
    </div>`;
  throw new Error("Access denied");
}

// ── Elements ──────────────────────────────────────────────
const tableWrap = document.getElementById("userTableWrap");
const cardList  = document.getElementById("userCardList");
const btnAdd    = document.getElementById("btnAdd");
const modalOv   = document.getElementById("modalOverlay");
const form      = document.getElementById("userForm");

const ROLE_LABEL = {
  kepala_sekolah:   "Kepala Sekolah",
  bendahara:        "Bendahara",
  admin_keuangan:   "Admin Keuangan",
  wali_kelas:       "Wali Kelas",
  operator_sekolah: "Operator Sekolah",
};

let allUsers = [];

// ── Load users ────────────────────────────────────────────
async function loadUsers() {
  tableWrap.innerHTML = `
    <div class="skeleton skeleton-row"></div>
    <div class="skeleton skeleton-row"></div>
    <div class="skeleton skeleton-row"></div>`;
  cardList.innerHTML = "";

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at, schools(name)")
    .order("full_name");

  if (error) {
    tableWrap.innerHTML = `<div class="empty-state"><div class="empty-title">Gagal memuat</div><div class="empty-desc">${error.message}</div></div>`;
    return;
  }

  allUsers = data ?? [];
  renderUsers(allUsers);
}

function renderUsers(data) {
  if (!data.length) {
    const empty = `<div class="empty-state">
      <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
      <div class="empty-title">Belum ada pengguna</div>
    </div>`;
    tableWrap.innerHTML = cardList.innerHTML = empty;
    return;
  }

  const roleBadge = (role) => {
    const colors = {
      kepala_sekolah:   "badge-lunas",
      bendahara:        "badge-diterima",
      admin_keuangan:   "badge-aktif",
      wali_kelas:       "badge-menunggu_verifikasi",
      operator_sekolah: "badge-sebagian_bayar",
    };
    return `<span class="badge ${colors[role] ?? "badge-aktif"}">${ROLE_LABEL[role] ?? role}</span>`;
  };

  const isSelf = (id) => id === session.user.id;

  // Desktop table
  tableWrap.innerHTML = `
    <table>
      <thead><tr>
        <th>Nama</th><th>Role</th><th>Dibuat</th><th></th>
      </tr></thead>
      <tbody>
        ${data.map(u => `<tr>
          <td>
            <strong>${u.full_name ?? "-"}</strong>
            ${isSelf(u.id) ? ` <span style="font-size:11px;color:var(--grey-400)">(Anda)</span>` : ""}
          </td>
          <td>${roleBadge(u.role)}</td>
          <td style="color:var(--grey-500)">${formatDatetime(u.created_at)}</td>
          <td>
            ${!isSelf(u.id) ? `
              <button class="btn btn-ghost btn-sm" data-edit-role="${u.id}" data-current-role="${u.role}" data-name="${u.full_name ?? ""}">Ubah Role</button>
            ` : ""}
          </td>
        </tr>`).join("")}
      </tbody>
    </table>`;

  // Mobile card list
  cardList.innerHTML = data.map(u => `
    <div class="card-list-item">
      <div class="cli-name">
        ${u.full_name ?? "-"}
        ${isSelf(u.id) ? ` <span style="font-size:11px;color:var(--grey-400)">(Anda)</span>` : ""}
      </div>
      <div class="cli-meta">
        <span>${formatDatetime(u.created_at)}</span>
      </div>
      <div class="cli-footer">
        ${roleBadge(u.role)}
        ${!isSelf(u.id) ? `
          <button class="btn btn-ghost btn-sm" data-edit-role="${u.id}" data-current-role="${u.role}" data-name="${u.full_name ?? ""}">Ubah Role</button>
        ` : ""}
      </div>
    </div>`).join("");

  // Ubah role listeners
  document.querySelectorAll("[data-edit-role]").forEach(btn => {
    btn.addEventListener("click", () => openChangeRole(btn.dataset.editRole, btn.dataset.currentRole, btn.dataset.name));
  });
}

// ── Ubah role inline (prompt sederhana) ──────────────────
async function openChangeRole(userId, currentRole, name) {
  const roles = Object.entries(ROLE_LABEL).filter(([k]) => k !== "kepala_sekolah");
  const options = roles.map(([k, v]) =>
    `<option value="${k}" ${k === currentRole ? "selected" : ""}>${v}</option>`
  ).join("");

  // Buat mini dialog
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(10,20,40,.5);display:flex;align-items:center;justify-content:center;z-index:200;padding:20px;backdrop-filter:blur(3px)";
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:360px">
      <div class="modal-header">
        <h2>Ubah Role</h2>
        <button class="modal-close" id="_roleClose">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <p style="font-size:13.5px;color:var(--grey-600);margin-bottom:12px">Ubah role untuk <strong>${name}</strong></p>
      <select id="_roleSelect" style="width:100%;margin-bottom:4px">${options}</select>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="_roleCancel">Batal</button>
        <button class="btn btn-primary" id="_roleSave">Simpan</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector("#_roleClose").onclick = close;
  overlay.querySelector("#_roleCancel").onclick = close;
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

  overlay.querySelector("#_roleSave").onclick = async () => {
    const newRole = overlay.querySelector("#_roleSelect").value;
    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
    if (error) { showToast("Gagal ubah role: " + error.message, "error"); return; }
    showToast("Role berhasil diubah.", "success");
    close();
    loadUsers();
  };
}

// ── Tambah user baru via Supabase Admin ───────────────────
btnAdd?.addEventListener("click", () => {
  form?.reset();
  modalOv.style.display = "flex";
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const full_name = qs("#f_name").value.trim();
  const email     = qs("#f_email").value.trim();
  const password  = qs("#f_password").value;
  const role      = qs("#f_role").value;

  if (!full_name || !email || !password || !role) {
    showToast("Semua field wajib diisi.", "error"); return;
  }
  if (password.length < 8) {
    showToast("Password minimal 8 karakter.", "error"); return;
  }

  // Buat user via Supabase Admin API menggunakan service role key
  // Karena kita hanya punya anon key, gunakan signUp + update profile
  const { data: signUpData, error: signUpErr } = await supabase.auth.admin?.createUser
    ? await supabase.auth.admin.createUser({ email, password, email_confirm: true })
    : await supabase.auth.signUp({ email, password });

  if (signUpErr) { showToast("Gagal membuat akun: " + signUpErr.message, "error"); return; }

  const newUserId = signUpData?.user?.id;
  if (newUserId) {
    const { error: profErr } = await supabase
      .from("profiles")
      .upsert({ id: newUserId, full_name, role }, { onConflict: "id" });
    if (profErr) showToast("Akun dibuat tapi profil gagal disimpan: " + profErr.message, "error");
  }

  showToast(`Akun ${full_name} berhasil dibuat. User dapat login dengan email & password yang ditentukan.`, "success");
  closeModal();
  loadUsers();
});

// ── Close modal ───────────────────────────────────────────
function closeModal() { modalOv.style.display = "none"; }
document.getElementById("btnCancel")?.addEventListener("click",  closeModal);
document.getElementById("btnCancel2")?.addEventListener("click", closeModal);

// ── Init ──────────────────────────────────────────────────
loadUsers();
