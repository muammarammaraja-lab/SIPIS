// ============================================================
// SFMS LITE — Data Siswa v3.0
// Mobile card list + desktop table dual render
// ============================================================
import { supabase } from "./supabaseClient.js";
import { requireAuth, applyRoleVisibility } from "./auth.js";
import { showToast, qs } from "./utils.js";

const auth = await requireAuth();
let mySchoolId = null;
let classes = [];

if (auth) {
  applyRoleVisibility(auth.profile);
  mySchoolId = auth.profile.school_id;
  await loadClasses();
  loadStudents();
}

// Topbar search + add button already in HTML
document.getElementById("btnAdd").addEventListener("click", () => openModal());
document.getElementById("btnCancel").addEventListener("click", closeModal);
document.getElementById("btnCancel2").addEventListener("click", closeModal);
document.getElementById("searchBox").addEventListener("input", (e) => loadStudents(e.target.value));

async function loadClasses() {
  const { data } = await supabase.from("classes").select("id, name").order("name");
  classes = data ?? [];
}

async function loadStudents(search = "") {
  const tableWrap = document.getElementById("studentTableWrap");
  const cardList  = document.getElementById("studentCardList");

  let query = supabase.from("students").select("*, classes(name)").order("name");
  if (search) query = query.or(`name.ilike.%${search}%,nis.ilike.%${search}%`);
  const { data, error } = await query;

  if (error) {
    tableWrap.innerHTML = cardList.innerHTML = `<div class="empty-state"><div class="empty-title">Gagal memuat data</div></div>`;
    return;
  }
  if (!data?.length) {
    const empty = `<div class="empty-state"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div><div class="empty-title">Belum ada data siswa</div><div class="empty-desc">Klik "+ Tambah Siswa" untuk mulai.</div></div>`;
    tableWrap.innerHTML = cardList.innerHTML = empty;
    return;
  }

  // Desktop table
  tableWrap.innerHTML = `
    <table>
      <thead><tr>
        <th>Nama</th><th>NIS</th><th>Kelas</th>
        <th>Orang Tua</th><th>No. WA</th><th>Status</th><th></th>
      </tr></thead>
      <tbody>
        ${data.map(s => `<tr>
          <td><strong>${s.name}</strong></td>
          <td>${s.nis ?? "-"}</td>
          <td>${s.classes?.name ?? "-"}</td>
          <td>${s.parent_name ?? "-"}</td>
          <td>${s.parent_whatsapp ?? "-"}</td>
          <td><span class="badge badge-${s.status === "aktif" ? "aktif" : "dibatalkan"}">${s.status}</span></td>
          <td><button class="btn btn-ghost btn-sm" data-edit="${s.id}">Edit</button></td>
        </tr>`).join("")}
      </tbody>
    </table>`;

  // Mobile card list
  cardList.innerHTML = data.map(s => `
    <div class="card-list-item">
      <div class="cli-name">${s.name}</div>
      <div class="cli-meta">
        <span>NIS: ${s.nis ?? "-"}</span>
        <span>${s.classes?.name ?? "Tanpa Kelas"}</span>
      </div>
      <div class="cli-meta">
        <span>${s.parent_name ?? "-"}</span>
        <span>${s.parent_whatsapp ?? "-"}</span>
      </div>
      <div class="cli-footer">
        <span class="badge badge-${s.status === "aktif" ? "aktif" : "dibatalkan"}">${s.status}</span>
        <button class="btn btn-ghost btn-sm" data-edit="${s.id}">Edit</button>
      </div>
    </div>`).join("");

  // Attach edit listeners
  document.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => openModal(data.find(s => s.id === btn.dataset.edit)));
  });
}

function openModal(student = null) {
  document.getElementById("modalTitle").textContent = student ? "Edit Siswa" : "Tambah Siswa";
  document.getElementById("studentId").value = student?.id ?? "";
  qs("#f_name").value             = student?.name ?? "";
  qs("#f_nis").value              = student?.nis ?? "";
  qs("#f_nisn").value             = student?.nisn ?? "";
  qs("#f_parent_name").value      = student?.parent_name ?? "";
  qs("#f_parent_whatsapp").value  = student?.parent_whatsapp ?? "";
  qs("#f_parent_email").value     = student?.parent_email ?? "";

  const classSelect = qs("#f_class_id");
  classSelect.innerHTML = `<option value="">-- Pilih Kelas --</option>` +
    classes.map(c => `<option value="${c.id}" ${student?.class_id === c.id ? "selected" : ""}>${c.name}</option>`).join("");

  document.getElementById("modalOverlay").style.display = "flex";
}

function closeModal() {
  document.getElementById("modalOverlay").style.display = "none";
}

document.getElementById("studentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("studentId").value;
  const payload = {
    school_id:       mySchoolId,
    name:            qs("#f_name").value.trim(),
    nis:             qs("#f_nis").value.trim() || null,
    nisn:            qs("#f_nisn").value.trim() || null,
    class_id:        qs("#f_class_id").value || null,
    parent_name:     qs("#f_parent_name").value.trim() || null,
    parent_whatsapp: qs("#f_parent_whatsapp").value.trim(),
    parent_email:    qs("#f_parent_email").value.trim() || null,
  };

  const { error } = id
    ? await supabase.from("students").update(payload).eq("id", id)
    : await supabase.from("students").insert(payload);

  if (error) { showToast("Gagal menyimpan: " + error.message, "error"); return; }
  showToast("Data siswa tersimpan.", "success");
  closeModal();
  loadStudents();
});
