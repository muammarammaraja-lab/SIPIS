// ============================================================
// SFMS LITE — Jenis Tagihan v3.1
// CRUD billing_types — master data untuk generate tagihan
// Mobile card list + desktop table dual render
// ============================================================
import { supabase } from "./supabaseClient.js";
import { requireAuth, applyRoleVisibility } from "./auth.js";
import { showToast, formatRupiah, confirmDialog, qs } from "./utils.js";

const auth = await requireAuth();
if (!auth) throw new Error("Unauthenticated");
const { profile } = auth;
applyRoleVisibility(profile);

// ── Elements ──────────────────────────────────────────────
const tableWrap = document.getElementById("billingTypeTableWrap");
const cardList  = document.getElementById("billingTypeCardList");
const btnAdd    = document.getElementById("btnAdd");
const modalOv   = document.getElementById("modalOverlay");
const form      = document.getElementById("billingTypeForm");

let allTypes = [];

// ── Load jenis tagihan ────────────────────────────────────
async function loadBillingTypes() {
  tableWrap.innerHTML = `
    <div class="skeleton skeleton-row"></div>
    <div class="skeleton skeleton-row"></div>
    <div class="skeleton skeleton-row"></div>`;
  cardList.innerHTML = "";

  const { data, error } = await supabase
    .from("billing_types")
    .select("*")
    .order("name");

  if (error) {
    tableWrap.innerHTML = `<div class="empty-state"><div class="empty-title">Gagal memuat</div><div class="empty-desc">${error.message}</div></div>`;
    return;
  }

  allTypes = data ?? [];
  renderTypes(allTypes);
}

function renderTypes(data) {
  if (!data.length) {
    const empty = `<div class="empty-state">
      <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/></svg></div>
      <div class="empty-title">Belum ada jenis tagihan</div>
      <div class="empty-desc">Tambahkan jenis tagihan seperti SPP Bulanan, Uang Buku, dll.</div>
    </div>`;
    tableWrap.innerHTML = cardList.innerHTML = empty;
    return;
  }

  const activeBadge = (active) => active
    ? `<span class="badge badge-lunas">Aktif</span>`
    : `<span class="badge badge-dibatalkan">Nonaktif</span>`;

  // Desktop table
  tableWrap.innerHTML = `
    <table>
      <thead><tr>
        <th>Nama</th><th>Nominal Default</th><th>Deskripsi</th><th>Status</th><th></th>
      </tr></thead>
      <tbody>
        ${data.map(t => `<tr>
          <td><strong>${t.name}</strong></td>
          <td>${t.default_amount ? formatRupiah(t.default_amount) : "-"}</td>
          <td style="color:var(--grey-500)">${t.description ?? "-"}</td>
          <td>${activeBadge(t.is_active !== false)}</td>
          <td style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" data-edit="${t.id}">Edit</button>
            <button class="btn btn-ghost btn-sm" data-toggle="${t.id}" data-active="${t.is_active !== false}">
              ${t.is_active !== false ? "Nonaktifkan" : "Aktifkan"}
            </button>
          </td>
        </tr>`).join("")}
      </tbody>
    </table>`;

  // Mobile card list
  cardList.innerHTML = data.map(t => `
    <div class="card-list-item">
      <div class="cli-name">${t.name}</div>
      <div class="cli-meta">
        ${t.default_amount ? `<span>Default: ${formatRupiah(t.default_amount)}</span>` : ""}
        ${t.description ? `<span>${t.description}</span>` : ""}
      </div>
      <div class="cli-footer">
        ${activeBadge(t.is_active !== false)}
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" data-edit="${t.id}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-toggle="${t.id}" data-active="${t.is_active !== false}">
            ${t.is_active !== false ? "Nonaktifkan" : "Aktifkan"}
          </button>
        </div>
      </div>
    </div>`).join("");

  // Listeners
  document.querySelectorAll("[data-edit]").forEach(btn =>
    btn.addEventListener("click", () => openEdit(btn.dataset.edit))
  );
  document.querySelectorAll("[data-toggle]").forEach(btn =>
    btn.addEventListener("click", () => toggleActive(btn.dataset.toggle, btn.dataset.active === "true"))
  );
}

// ── Toggle aktif/nonaktif ─────────────────────────────────
async function toggleActive(id, currentlyActive) {
  const t = allTypes.find(x => x.id === id);
  const newState = !currentlyActive;
  const label = newState ? "aktifkan" : "nonaktifkan";

  const ok = await confirmDialog(
    `${newState ? "Aktifkan" : "Nonaktifkan"} jenis tagihan <strong>${t?.name ?? ""}</strong>?`,
    newState ? "Aktifkan" : "Nonaktifkan"
  );
  if (!ok) return;

  const { error } = await supabase
    .from("billing_types")
    .update({ is_active: newState })
    .eq("id", id);

  if (error) { showToast("Gagal: " + error.message, "error"); return; }
  showToast(`Jenis tagihan berhasil di${label}.`, "success");
  loadBillingTypes();
}

// ── Modal tambah ──────────────────────────────────────────
btnAdd?.addEventListener("click", () => {
  form.reset();
  qs("#billingTypeId").value = "";
  qs("#modalTitle").textContent = "Tambah Jenis Tagihan";
  modalOv.style.display = "flex";
});

// ── Modal edit ────────────────────────────────────────────
function openEdit(id) {
  const t = allTypes.find(x => x.id === id);
  if (!t) return;
  qs("#modalTitle").textContent      = "Edit Jenis Tagihan";
  qs("#billingTypeId").value         = t.id;
  qs("#f_name").value                = t.name ?? "";
  qs("#f_default_amount").value      = t.default_amount ?? "";
  qs("#f_description").value         = t.description ?? "";
  modalOv.style.display = "flex";
}

// ── Submit ────────────────────────────────────────────────
form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id             = qs("#billingTypeId").value;
  const name           = qs("#f_name").value.trim();
  const default_amount = Number(qs("#f_default_amount").value) || null;
  const description    = qs("#f_description").value.trim() || null;

  if (!name) { showToast("Nama jenis tagihan wajib diisi.", "error"); return; }

  const payload = { name, default_amount, description };

  let error;
  if (id) {
    ({ error } = await supabase.from("billing_types").update(payload).eq("id", id));
  } else {
    ({ error } = await supabase.from("billing_types").insert({ ...payload, is_active: true }));
  }

  if (error) { showToast("Gagal menyimpan: " + error.message, "error"); return; }

  showToast(id ? "Jenis tagihan diperbarui." : "Jenis tagihan berhasil ditambahkan.", "success");
  closeModal();
  loadBillingTypes();
});

// ── Close modal ───────────────────────────────────────────
function closeModal() { modalOv.style.display = "none"; }
document.getElementById("btnCancel")?.addEventListener("click",  closeModal);
document.getElementById("btnCancel2")?.addEventListener("click", closeModal);

// ── Init ──────────────────────────────────────────────────
loadBillingTypes();
