// ============================================================
// SFMS LITE — Data Siswa (CRUD)
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

async function loadClasses() {
  const { data } = await supabase.from("classes").select("id, name").order("name");
  classes = data ?? [];
}

document.getElementById("btnAdd").addEventListener("click", () => openModal());
document.getElementById("btnCancel").addEventListener("click", closeModal);
document.getElementById("searchBox").addEventListener("input", (e) => loadStudents(e.target.value));

async function loadStudents(search = "") {
  const wrap = document.getElementById("studentTableWrap");
  let query = supabase.from("students").select("*, classes(name)").order("name");
  if (search) query = query.or(`name.ilike.%${search}%,nis.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) {
    wrap.innerHTML = `<div class="empty-state">Gagal memuat data: ${error.message}</div>`;
    return;
  }
  if (!data || data.length === 0) {
    wrap.innerHTML = `<div class="empty-state">Belum ada data siswa. Klik "+ Tambah Siswa" untuk mulai.</div>`;
    return;
  }
  wrap.innerHTML = `
    <table>
      <thead><tr><th>Nama</th><th>NIS</th><th>Kelas</th><th>Orang Tua</th><th>No. WA</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${data.map(s => `
          <tr>
            <td>${s.name}</td>
            <td>${s.nis ?? "-"}</td>
            <td>${s.classes?.name ?? "-"}</td>
            <td>${s.parent_name ?? "-"}</td>
            <td>${s.parent_whatsapp ?? "-"}</td>
            <td>${s.status}</td>
            <td><button class="btn btn-ghost btn-sm" data-edit="${s.id}">Edit</button></td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
  wrap.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => openModal(data.find(s => s.id === btn.dataset.edit)));
  });
}

function openModal(student = null) {
  document.getElementById("modalTitle").textContent = student ? "Edit Siswa" : "Tambah Siswa";
  document.getElementById("studentId").value = student?.id ?? "";
  document.getElementById("f_name").value = student?.name ?? "";
  document.getElementById("f_nis").value = student?.nis ?? "";
  document.getElementById("f_nisn").value = student?.nisn ?? "";
  document.getElementById("f_parent_name").value = student?.parent_name ?? "";
  document.getElementById("f_parent_whatsapp").value = student?.parent_whatsapp ?? "";
  document.getElementById("f_parent_email").value = student?.parent_email ?? "";

  // Render dropdown kelas
  const classSelect = document.getElementById("f_class_id");
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
    school_id: mySchoolId,
    name: qs("#f_name").value.trim(),
    nis: qs("#f_nis").value.trim(),
    nisn: qs("#f_nisn").value.trim(),
    class_id: qs("#f_class_id").value || null,
    parent_name: qs("#f_parent_name").value.trim(),
    parent_whatsapp: qs("#f_parent_whatsapp").value.trim(),
    parent_email: qs("#f_parent_email").value.trim(),
  };
  const { error } = id
    ? await supabase.from("students").update(payload).eq("id", id)
    : await supabase.from("students").insert(payload);
  if (error) {
    showToast("Gagal menyimpan: " + error.message, "error");
    return;
  }
  showToast("Data siswa tersimpan.", "success");
  closeModal();
  loadStudents();
});
