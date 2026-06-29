// ============================================================
// SFMS LITE — Data Siswa v3.1
// CRUD siswa + sinkronisasi orang tua dua arah
// Mobile card list + desktop table dual render
// ============================================================
import { supabase } from "./supabaseClient.js";
import { requireAuth, applyRoleVisibility } from "./auth.js";
import { showToast, formatDate, statusBadge, exportCSV, confirmDialog, qs } from "./utils.js";

const auth = await requireAuth();
if (!auth) throw new Error("Unauthenticated");
const { profile } = auth;
applyRoleVisibility(profile);

// ── Elements ──────────────────────────────────────────────
const tableWrap = document.getElementById("studentTableWrap");
const cardList  = document.getElementById("studentCardList");
const searchBox = document.getElementById("searchBox");
const btnAdd    = document.getElementById("btnAdd");
const modalOv   = document.getElementById("modalOverlay");
const form      = document.getElementById("studentForm");

// ── Mobile panel-head fix ─────────────────────────────────
(function injectMobileStyle() {
  if (document.getElementById("_siswa_style")) return;
  const s = document.createElement("style");
  s.id = "_siswa_style";
  s.textContent = `
    @media (max-width: 540px) {
      .panel-head { flex-wrap: wrap !important; gap: 10px !important; }
      .panel-head > div { width: 100% !important; display: flex !important; gap: 8px !important; align-items: center !important; }
      .panel-head > div input[type="text"] { flex: 1 !important; min-width: 0 !important; margin: 0 !important; }
      .panel-head > div .btn { flex-shrink: 0 !important; white-space: nowrap !important; }
    }
  `;
  document.head.appendChild(s);
})();

let allStudents = [];
let classesMap  = {};   // id → name

// ── Load kelas untuk dropdown ─────────────────────────────
async function loadClasses() {
  const { data } = await supabase.from("classes").select("id, name").order("name");
  const sel = document.getElementById("f_class_id");
  if (!sel || !data?.length) return;
  classesMap = Object.fromEntries(data.map(c => [c.id, c.name]));
  sel.innerHTML = `<option value="">-- Pilih Kelas --</option>` +
    data.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
}

// ── Load siswa ────────────────────────────────────────────
async function loadStudents() {
  tableWrap.innerHTML = `
    <div class="skeleton skeleton-row"></div>
    <div class="skeleton skeleton-row"></div>
    <div class="skeleton skeleton-row"></div>`;
  cardList.innerHTML = "";

  const { data, error } = await supabase
    .from("students")
    .select("*, classes(name)")
    .order("name");

  if (error) {
    tableWrap.innerHTML = `<div class="empty-state"><div class="empty-title">Gagal memuat</div><div class="empty-desc">${error.message}</div></div>`;
    return;
  }

  allStudents = data ?? [];
  renderStudents(allStudents);
}

function renderStudents(data) {
  if (!data.length) {
    const empty = `<div class="empty-state">
      <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
      <div class="empty-title">Belum ada siswa</div>
      <div class="empty-desc">Klik "+ Tambah Siswa" untuk menambahkan data siswa.</div>
    </div>`;
    tableWrap.innerHTML = cardList.innerHTML = empty;
    return;
  }

  // Desktop table
  tableWrap.innerHTML = `
    <table>
      <thead><tr>
        <th>Nama</th><th>NIS</th><th>Kelas</th>
        <th>No. WA Ortu</th><th>Status</th><th></th>
      </tr></thead>
      <tbody>
        ${data.map(s => `<tr>
          <td><strong>${s.name}</strong></td>
          <td>${s.nis ?? "-"}</td>
          <td>${s.classes?.name ?? "-"}</td>
          <td>${s.parent_whatsapp ?? "-"}</td>
          <td>${statusBadge(s.status ?? "aktif")}</td>
          <td style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" data-edit="${s.id}">Edit</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--red)" data-delete="${s.id}">Hapus</button>
          </td>
        </tr>`).join("")}
      </tbody>
    </table>`;

  // Mobile card list
  cardList.innerHTML = data.map(s => `
    <div class="card-list-item">
      <div class="cli-name">${s.name}</div>
      <div class="cli-meta" style="flex-direction:column;gap:3px">
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          ${s.nis ? `<span>NIS: ${s.nis}</span>` : ""}
          <span>${s.classes?.name ?? "Belum ada kelas"}</span>
        </div>
        ${s.parent_whatsapp ? `<span style="color:var(--grey-600)">WA: ${s.parent_whatsapp}</span>` : ""}
      </div>
      <div class="cli-footer">
        ${statusBadge(s.status ?? "aktif")}
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" data-edit="${s.id}">Edit</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red)" data-delete="${s.id}">Hapus</button>
        </div>
      </div>
    </div>`).join("");

  // Listeners
  document.querySelectorAll("[data-edit]").forEach(btn =>
    btn.addEventListener("click", () => openEdit(btn.dataset.edit))
  );
  document.querySelectorAll("[data-delete]").forEach(btn =>
    btn.addEventListener("click", () => deleteStudent(btn.dataset.delete))
  );
}

// ── Search ────────────────────────────────────────────────
let searchTimer;
searchBox?.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const q = searchBox.value.trim().toLowerCase();
    if (!q) { renderStudents(allStudents); return; }
    renderStudents(allStudents.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.nis ?? "").toLowerCase().includes(q) ||
      (s.nisn ?? "").toLowerCase().includes(q)
    ));
  }, 250);
});

// ── Modal tambah ──────────────────────────────────────────
btnAdd?.addEventListener("click", () => {
  form.reset();
  qs("#studentId").value = "";
  qs("#modalTitle").textContent = "Tambah Siswa";
  modalOv.style.display = "flex";
});

// ── Modal edit ────────────────────────────────────────────
async function openEdit(id) {
  const s = allStudents.find(x => x.id === id);
  if (!s) return;

  qs("#modalTitle").textContent   = "Edit Siswa";
  qs("#studentId").value          = s.id;
  qs("#f_name").value             = s.name ?? "";
  qs("#f_nis").value              = s.nis ?? "";
  qs("#f_nisn").value             = s.nisn ?? "";
  qs("#f_class_id").value         = s.class_id ?? "";
  qs("#f_parent_name").value      = s.parent_name ?? "";
  qs("#f_parent_whatsapp").value  = s.parent_whatsapp ?? "";
  qs("#f_parent_email").value     = s.parent_email ?? "";
  modalOv.style.display = "flex";
}

// ── Submit form (tambah / edit) ───────────────────────────
form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id              = qs("#studentId").value;
  const name            = qs("#f_name").value.trim();
  const nis             = qs("#f_nis").value.trim() || null;
  const nisn            = qs("#f_nisn").value.trim() || null;
  const class_id        = qs("#f_class_id").value || null;
  const parent_name     = qs("#f_parent_name").value.trim() || null;
  const parent_whatsapp = qs("#f_parent_whatsapp").value.trim() || null;
  const parent_email    = qs("#f_parent_email").value.trim() || null;

  if (!name) { showToast("Nama siswa wajib diisi.", "error"); return; }

  const payload = { name, nis, nisn, class_id, parent_name, parent_whatsapp, parent_email };

  let error;
  if (id) {
    ({ error } = await supabase.from("students").update(payload).eq("id", id));
  } else {
    ({ error } = await supabase.from("students").insert({ ...payload, status: "aktif" }));
  }

  if (error) { showToast("Gagal menyimpan: " + error.message, "error"); return; }

  // Sinkronisasi orang tua — upsert berdasarkan nomor WA
  if (parent_whatsapp) {
    await syncParent({ name, parent_name, parent_whatsapp, parent_email });
  }

  showToast(id ? "Data siswa diperbarui." : "Siswa berhasil ditambahkan.", "success");
  closeModal();
  loadStudents();
});

// ── Sinkronisasi orang tua ────────────────────────────────
async function syncParent({ parent_name, parent_whatsapp, parent_email }) {
  if (!parent_whatsapp) return;

  const { data: existing } = await supabase
    .from("parents")
    .select("id")
    .eq("whatsapp", parent_whatsapp)
    .maybeSingle();

  const parentPayload = {
    name:      parent_name || "Orang Tua",
    whatsapp:  parent_whatsapp,
    email:     parent_email || null,
  };

  if (existing) {
    await supabase.from("parents").update(parentPayload).eq("id", existing.id);
  } else {
    await supabase.from("parents").insert(parentPayload);
  }
}

// ── Hapus siswa ───────────────────────────────────────────
async function deleteStudent(id) {
  const s = allStudents.find(x => x.id === id);
  const ok = await confirmDialog(
    `Hapus siswa <strong>${s?.name ?? ""}</strong>? Data tagihan yang terkait juga akan terpengaruh.`,
    "Hapus"
  );
  if (!ok) return;

  // Soft delete — ubah status ke nonaktif, bukan hapus permanen
  const { error } = await supabase
    .from("students")
    .update({ status: "nonaktif" })
    .eq("id", id);

  if (error) { showToast("Gagal menghapus: " + error.message, "error"); return; }
  showToast("Siswa dinonaktifkan.", "success");
  loadStudents();
}

// ── Close modal ───────────────────────────────────────────
function closeModal() { modalOv.style.display = "none"; }
document.getElementById("btnCancel")?.addEventListener("click",  closeModal);
document.getElementById("btnCancel2")?.addEventListener("click", closeModal);

// ── Init ──────────────────────────────────────────────────
await loadClasses();
loadStudents();
