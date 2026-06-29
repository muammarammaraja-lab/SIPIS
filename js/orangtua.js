// ============================================================
// SFMS LITE — Data Orang Tua v3.1
// CRUD orang tua + tampil siswa yang terhubung
// Mobile card list + desktop table dual render
// ============================================================
import { supabase } from "./supabaseClient.js";
import { requireAuth, applyRoleVisibility } from "./auth.js";
import { showToast, formatDate, confirmDialog, qs } from "./utils.js";

const auth = await requireAuth();
if (!auth) throw new Error("Unauthenticated");
const { profile } = auth;
applyRoleVisibility(profile);

// ── Elements ──────────────────────────────────────────────
const tableWrap = document.getElementById("parentTableWrap");
const cardList  = document.getElementById("parentCardList");
const searchBox = document.getElementById("searchBox");
const btnAdd    = document.getElementById("btnAdd");
const modalOv   = document.getElementById("modalOverlay");
const form      = document.getElementById("parentForm");

// ── Mobile panel-head fix ─────────────────────────────────
(function injectMobileStyle() {
  if (document.getElementById("_ot_style")) return;
  const s = document.createElement("style");
  s.id = "_ot_style";
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

let allParents = [];

// ── Load orang tua ────────────────────────────────────────
async function loadParents() {
  tableWrap.innerHTML = `
    <div class="skeleton skeleton-row"></div>
    <div class="skeleton skeleton-row"></div>
    <div class="skeleton skeleton-row"></div>`;
  cardList.innerHTML = "";

  // Ambil orang tua + siswa yang terhubung via parent_whatsapp
  const { data: parents, error } = await supabase
    .from("parents")
    .select("*")
    .order("name");

  if (error) {
    tableWrap.innerHTML = `<div class="empty-state"><div class="empty-title">Gagal memuat</div><div class="empty-desc">${error.message}</div></div>`;
    return;
  }

  // Ambil siswa aktif untuk ditampilkan relasi
  const { data: students } = await supabase
    .from("students")
    .select("id, name, parent_whatsapp, classes(name)")
    .eq("status", "aktif");

  // Buat map: whatsapp → [siswa]
  const studentsByWA = {};
  (students ?? []).forEach(s => {
    const wa = s.parent_whatsapp;
    if (!wa) return;
    if (!studentsByWA[wa]) studentsByWA[wa] = [];
    studentsByWA[wa].push(s);
  });

  // Gabungkan
  allParents = (parents ?? []).map(p => ({
    ...p,
    students: studentsByWA[p.whatsapp] ?? [],
  }));

  renderParents(allParents);
}

function renderParents(data) {
  if (!data.length) {
    const empty = `<div class="empty-state">
      <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
      <div class="empty-title">Belum ada data orang tua</div>
      <div class="empty-desc">Data orang tua akan muncul otomatis saat siswa ditambahkan, atau tambahkan manual.</div>
    </div>`;
    tableWrap.innerHTML = cardList.innerHTML = empty;
    return;
  }

  const siswaBadge = (students) => {
    if (!students.length) return `<span style="color:var(--grey-400);font-size:12px">-</span>`;
    return students.map(s =>
      `<span style="font-size:12px;background:var(--blue-mid);color:#1d4ed8;padding:2px 8px;border-radius:99px;white-space:nowrap">${s.name}${s.classes?.name ? ` · ${s.classes.name}` : ""}</span>`
    ).join(" ");
  };

  // Desktop table
  tableWrap.innerHTML = `
    <table>
      <thead><tr>
        <th>Nama</th><th>No. WhatsApp</th><th>Email</th><th>Siswa</th><th></th>
      </tr></thead>
      <tbody>
        ${data.map(p => `<tr>
          <td><strong>${p.name}</strong></td>
          <td>${p.whatsapp ?? "-"}</td>
          <td>${p.email ?? "-"}</td>
          <td style="max-width:220px"><div style="display:flex;flex-wrap:wrap;gap:4px">${siswaBadge(p.students)}</div></td>
          <td style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" data-edit="${p.id}">Edit</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--red)" data-delete="${p.id}">Hapus</button>
          </td>
        </tr>`).join("")}
      </tbody>
    </table>`;

  // Mobile card list
  cardList.innerHTML = data.map(p => `
    <div class="card-list-item">
      <div class="cli-name">${p.name}</div>
      <div class="cli-meta" style="flex-direction:column;gap:3px">
        ${p.whatsapp ? `<span style="color:var(--grey-700);font-weight:500">${p.whatsapp}</span>` : `<span style="color:var(--grey-400)">Belum ada no. WA</span>`}
        ${p.email ? `<span>${p.email}</span>` : ""}
      </div>
      ${p.students.length ? `
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin:8px 0 4px">
          ${siswaBadge(p.students)}
        </div>` : `<div style="font-size:12px;color:var(--grey-400);margin:4px 0 6px">Belum ada siswa terhubung</div>`}
      <div class="cli-footer">
        <div></div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" data-edit="${p.id}">Edit</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red)" data-delete="${p.id}">Hapus</button>
        </div>
      </div>
    </div>`).join("");

  // Listeners
  document.querySelectorAll("[data-edit]").forEach(btn =>
    btn.addEventListener("click", () => openEdit(btn.dataset.edit))
  );
  document.querySelectorAll("[data-delete]").forEach(btn =>
    btn.addEventListener("click", () => deleteParent(btn.dataset.delete))
  );
}

// ── Search ────────────────────────────────────────────────
let searchTimer;
searchBox?.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const q = searchBox.value.trim().toLowerCase();
    if (!q) { renderParents(allParents); return; }
    renderParents(allParents.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.whatsapp ?? "").includes(q) ||
      (p.email ?? "").toLowerCase().includes(q)
    ));
  }, 250);
});

// ── Modal tambah ──────────────────────────────────────────
btnAdd?.addEventListener("click", () => {
  form.reset();
  qs("#parentId").value = "";
  qs("#modalTitle").textContent = "Tambah Orang Tua";
  modalOv.style.display = "flex";
});

// ── Modal edit ────────────────────────────────────────────
function openEdit(id) {
  const p = allParents.find(x => x.id === id);
  if (!p) return;
  qs("#modalTitle").textContent  = "Edit Orang Tua";
  qs("#parentId").value          = p.id;
  qs("#f_name").value            = p.name ?? "";
  qs("#f_whatsapp").value        = p.whatsapp ?? "";
  qs("#f_email").value           = p.email ?? "";
  modalOv.style.display = "flex";
}

// ── Submit ────────────────────────────────────────────────
form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id       = qs("#parentId").value;
  const name     = qs("#f_name").value.trim();
  const whatsapp = qs("#f_whatsapp").value.trim() || null;
  const email    = qs("#f_email").value.trim() || null;

  if (!name) { showToast("Nama wajib diisi.", "error"); return; }

  const payload = { name, whatsapp, email };

  let error;
  if (id) {
    ({ error } = await supabase.from("parents").update(payload).eq("id", id));

    // Sinkronisasi balik ke students yang punya WA sama
    if (!error && whatsapp) {
      await supabase.from("students")
        .update({ parent_name: name, parent_whatsapp: whatsapp, parent_email: email })
        .eq("parent_whatsapp", whatsapp);
    }
  } else {
    ({ error } = await supabase.from("parents").insert(payload));
  }

  if (error) { showToast("Gagal menyimpan: " + error.message, "error"); return; }

  showToast(id ? "Data orang tua diperbarui." : "Orang tua berhasil ditambahkan.", "success");
  closeModal();
  loadParents();
});

// ── Hapus ─────────────────────────────────────────────────
async function deleteParent(id) {
  const p = allParents.find(x => x.id === id);
  const ok = await confirmDialog(
    `Hapus data orang tua <strong>${p?.name ?? ""}</strong>?`,
    "Hapus"
  );
  if (!ok) return;

  const { error } = await supabase.from("parents").delete().eq("id", id);
  if (error) { showToast("Gagal menghapus: " + error.message, "error"); return; }
  showToast("Data orang tua dihapus.", "success");
  loadParents();
}

// ── Close modal ───────────────────────────────────────────
function closeModal() { modalOv.style.display = "none"; }
document.getElementById("btnCancel")?.addEventListener("click",  closeModal);
document.getElementById("btnCancel2")?.addEventListener("click", closeModal);

// ── Init ──────────────────────────────────────────────────
loadParents();
