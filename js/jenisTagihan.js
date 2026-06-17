// ============================================================
// SFMS LITE — Jenis Tagihan (CRUD)
// ============================================================

import { supabase } from "./supabaseClient.js";
import { requireAuth, applyRoleVisibility } from "./auth.js";
import { showToast, formatRupiah, qs } from "./utils.js";

const auth = await requireAuth();
let mySchoolId = null;

if (auth) {
  applyRoleVisibility(auth.profile);
  mySchoolId = auth.profile.school_id;
  loadList();
}

document.getElementById("btnAdd").addEventListener("click", () => openModal());
document.getElementById("btnCancel").addEventListener("click", closeModal);

const MODE_LABEL = { berkala: "Berkala", sekali_bayar: "Sekali Bayar", cicilan: "Cicilan" };

async function loadList() {
  const wrap = document.getElementById("tableWrap");
  const { data, error } = await supabase.from("billing_types").select("*").order("name");

  if (error) { wrap.innerHTML = `<div class="empty-state">${error.message}</div>`; return; }
  if (!data || data.length === 0) {
    wrap.innerHTML = `<div class="empty-state">Belum ada jenis tagihan. Klik "+ Tambah Jenis Tagihan" untuk mulai.</div>`;
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead><tr><th>Nama</th><th>Mode</th><th>Nominal Default</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${data.map(b => `
          <tr>
            <td>${b.name}</td>
            <td>${MODE_LABEL[b.billing_mode] ?? b.billing_mode}</td>
            <td>${formatRupiah(b.default_amount)}</td>
            <td>${b.is_active ? '<span class="badge badge-lunas">Aktif</span>' : '<span class="badge badge-dibatalkan">Non-Aktif</span>'}</td>
            <td><button class="btn btn-ghost btn-sm" data-edit="${b.id}">Edit</button></td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;

  wrap.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => openModal(data.find(b => b.id === btn.dataset.edit)));
  });
}

function openModal(item = null) {
  document.getElementById("modalTitle").textContent = item ? "Edit Jenis Tagihan" : "Tambah Jenis Tagihan";
  qs("#f_id").value = item?.id ?? "";
  qs("#f_name").value = item?.name ?? "";
  qs("#f_mode").value = item?.billing_mode ?? "berkala";
  qs("#f_amount").value = item?.default_amount ?? "";
  qs("#f_active").checked = item ? item.is_active : true;
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
    billing_mode: qs("#f_mode").value,
    default_amount: Number(qs("#f_amount").value),
    is_active: qs("#f_active").checked,
  };

  const { error } = id
    ? await supabase.from("billing_types").update(payload).eq("id", id)
    : await supabase.from("billing_types").insert(payload);

  if (error) {
    showToast("Gagal menyimpan: " + error.message, "error");
    return;
  }
  showToast("Jenis tagihan tersimpan.", "success");
  closeModal();
  loadList();
});
