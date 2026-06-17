// ============================================================
// SFMS LITE — Data Orang Tua (CRUD + kelola anak terhubung)
// ============================================================

import { supabase } from "./supabaseClient.js";
import { requireAuth, applyRoleVisibility } from "./auth.js";
import { showToast, qs } from "./utils.js";

const auth = await requireAuth();
let mySchoolId = null;
let allStudents = [];
let currentParentId = null;

if (auth) {
  applyRoleVisibility(auth.profile);
  mySchoolId = auth.profile.school_id;
  loadStudentsCache();
  loadList();
}

document.getElementById("btnAdd").addEventListener("click", () => openModal());
document.getElementById("btnCancel").addEventListener("click", closeModal);
document.getElementById("searchBox").addEventListener("input", (e) => loadList(e.target.value));
document.getElementById("btnCancelChildren").addEventListener("click", () => {
  document.getElementById("childrenOverlay").style.display = "none";
});

async function loadStudentsCache() {
  const { data } = await supabase.from("students").select("id, name").order("name");
  allStudents = data || [];
}

async function loadList(search = "") {
  const wrap = document.getElementById("tableWrap");
  let query = supabase.from("parents").select("*, student_parent(student_id, students(name))").order("name");
  if (search) query = query.or(`name.ilike.%${search}%,whatsapp_number.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) { wrap.innerHTML = `<div class="empty-state">${error.message}</div>`; return; }
  if (!data || data.length === 0) {
    wrap.innerHTML = `<div class="empty-state">Belum ada data orang tua. Data akan otomatis terisi saat kamu menambah siswa baru, atau klik "+ Tambah Orang Tua" untuk input manual.</div>`;
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead><tr><th>Nama</th><th>No. WA</th><th>Email</th><th>Anak Terhubung</th><th></th></tr></thead>
      <tbody>
        ${data.map(p => {
          const children = (p.student_parent || []).map(sp => sp.students?.name).filter(Boolean);
          return `
            <tr>
              <td>${p.name ?? "-"}</td>
              <td>${p.whatsapp_number ?? "-"}</td>
              <td>${p.email ?? "-"}</td>
              <td>${children.length ? children.join(", ") : '<span style="color:var(--grey-400)">Belum ada</span>'}</td>
              <td style="white-space:nowrap">
                <button class="btn btn-ghost btn-sm" data-edit="${p.id}">Edit</button>
                <button class="btn btn-ghost btn-sm" data-children="${p.id}">Kelola Anak</button>
              </td>
            </tr>`;
        }).join("")}
      </tbody>
    </table>`;

  wrap.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => openModal(data.find(p => p.id === btn.dataset.edit)));
  });
  wrap.querySelectorAll("[data-children]").forEach(btn => {
    const parent = data.find(p => p.id === btn.dataset.children);
    btn.addEventListener("click", () => openChildrenModal(parent));
  });
}

function openModal(parent = null) {
  document.getElementById("modalTitle").textContent = parent ? "Edit Orang Tua" : "Tambah Orang Tua";
  qs("#f_id").value = parent?.id ?? "";
  qs("#f_name").value = parent?.name ?? "";
  qs("#f_whatsapp").value = parent?.whatsapp_number ?? "";
  qs("#f_email").value = parent?.email ?? "";
  document.getElementById("modalOverlay").style.display = "flex";
}
function closeModal() {
  document.getElementById("modalOverlay").style.display = "none";
}

document.getElementById("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = qs("#f_id").value;
  const payload = {
    school_id: mySchoolId,
    name: qs("#f_name").value.trim(),
    whatsapp_number: qs("#f_whatsapp").value.trim(),
    email: qs("#f_email").value.trim() || null,
  };

  const { error } = id
    ? await supabase.from("parents").update(payload).eq("id", id)
    : await supabase.from("parents").insert(payload);

  if (error) {
    showToast("Gagal menyimpan: " + error.message, "error");
    return;
  }
  showToast(id ? "Data orang tua diperbarui — otomatis berlaku ke semua anak terhubung." : "Orang tua baru ditambahkan.", "success");
  closeModal();
  loadList();
});

async function openChildrenModal(parent) {
  currentParentId = parent.id;
  document.getElementById("parentNameLabel").textContent = parent.name || parent.whatsapp_number;
  const linkedIds = new Set((parent.student_parent || []).map(sp => sp.student_id));

  document.getElementById("childrenList").innerHTML = allStudents.map(s => `
    <label style="display:flex;align-items:center;gap:8px;font-weight:400;margin-bottom:8px">
      <input type="checkbox" value="${s.id}" ${linkedIds.has(s.id) ? "checked" : ""} style="width:auto;margin:0" />
      ${s.name}
    </label>`).join("");

  document.getElementById("childrenOverlay").style.display = "flex";
}

document.getElementById("btnSaveChildren").addEventListener("click", async () => {
  const checked = Array.from(document.querySelectorAll('#childrenList input[type="checkbox"]:checked')).map(c => c.value);

  const { data: existing } = await supabase.from("student_parent").select("student_id").eq("parent_id", currentParentId);
  const existingIds = new Set((existing || []).map(e => e.student_id));

  const toAdd = checked.filter(id => !existingIds.has(id));
  const toRemove = Array.from(existingIds).filter(id => !checked.includes(id));

  if (toAdd.length > 0) {
    await supabase.from("student_parent").insert(
      toAdd.map(student_id => ({ student_id, parent_id: currentParentId, school_id: mySchoolId, is_primary_contact: true }))
    );
  }
  if (toRemove.length > 0) {
    await supabase.from("student_parent").delete().eq("parent_id", currentParentId).in("student_id", toRemove);
  }

  showToast("Daftar anak diperbarui.", "success");
  document.getElementById("childrenOverlay").style.display = "none";
  loadList();
});
