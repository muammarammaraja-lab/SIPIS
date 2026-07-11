// ============================================================
// SFMS LITE — Data Orang Tua v3.2
// Kolom: whatsapp_number (bukan whatsapp)
// Relasi siswa via tabel student_parent (junction table)
// ============================================================
import { supabase } from "./supabaseClient.js";
import { requireAuth, applyRoleVisibility } from "./auth.js";
import { showToast, confirmDialog, qs } from "./utils.js";

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

let allParents = [];

// ── Load orang tua ────────────────────────────────────────
async function loadParents() {
  tableWrap.innerHTML = `
    <div class="skeleton skeleton-row"></div>
    <div class="skeleton skeleton-row"></div>
    <div class="skeleton skeleton-row"></div>`;
  cardList.innerHTML = "";

  // Load parents + relasi siswa via student_parent
  const [{ data: parents, error }, { data: spLinks }] = await Promise.all([
    supabase.from("parents").select("*").order("name"),
    supabase.from("student_parent").select("parent_id, students(id, name, classes(name))"),
  ]);

  if (error) {
    tableWrap.innerHTML = `<div class="empty-state"><div class="empty-title">Gagal memuat</div><div class="empty-desc">${error.message}</div></div>`;
    return;
  }

  // Buat map: parent_id → [siswa]
  const studentsByParent = {};
  (spLinks ?? []).forEach(link => {
    if (!link.parent_id) return;
    if (!studentsByParent[link.parent_id]) studentsByParent[link.parent_id] = [];
    if (link.students) studentsByParent[link.parent_id].push(link.students);
  });

  allParents = (parents ?? []).map(p => ({
    ...p,
    students: studentsByParent[p.id] ?? [],
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
          <td>${p.whatsapp_number ?? "-"}</td>
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
        ${p.whatsapp_number
          ? `<span style="color:var(--grey-700);font-weight:500">${p.whatsapp_number}</span>`
          : `<span style="color:var(--grey-400)">Belum ada no. WA</span>`}
        ${p.email ? `<span>${p.email}</span>` : ""}
      </div>
      ${p.students.length
        ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin:8px 0 4px">${siswaBadge(p.students)}</div>`
        : `<div style="font-size:12px;color:var(--grey-400);margin:4px 0 6px">Belum ada siswa terhubung</div>`}
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
      (p.whatsapp_number ?? "").includes(q) ||
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
  qs("#modalTitle").textContent = "Edit Orang Tua";
  qs("#parentId").value         = p.id;
  qs("#f_name").value           = p.name ?? "";
  qs("#f_whatsapp").value       = p.whatsapp_number ?? "";
  qs("#f_email").value          = p.email ?? "";
  modalOv.style.display = "flex";
}

// ── Submit ────────────────────────────────────────────────
form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id              = qs("#parentId").value;
  const name            = qs("#f_name").value.trim();
  const whatsapp_number = qs("#f_whatsapp").value.trim() || null;
  const email           = qs("#f_email").value.trim() || null;

  if (!name) { showToast("Nama wajib diisi.", "error"); return; }

  const payload = { name, whatsapp_number, email };

  let error;
  if (id) {
    ({ error } = await supabase.from("parents").update(payload).eq("id", id));

    // Sinkronisasi balik ke students yang punya WA sama
    if (!error && whatsapp_number) {
      await supabase.from("students")
        .update({ parent_name: name, parent_whatsapp: whatsapp_number, parent_email: email })
        .eq("parent_whatsapp", whatsapp_number);
    }
  } else {
    ({ error } = await supabase.from("parents").insert({ ...payload, school_id: profile.school_id }));
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

  // Hapus link di student_parent dulu
  await supabase.from("student_parent").delete().eq("parent_id", id);
  const { error } = await supabase.from("parents").delete().eq("id", id);
  if (error) { showToast("Gagal menghapus: " + error.message, "error"); return; }
  showToast("Data orang tua dihapus.", "success");
  loadParents();
}

// ── Close modal ───────────────────────────────────────────
function closeModal() { modalOv.style.display = "none"; }
document.getElementById("btnCancel")?.addEventListener("click",  closeModal);
document.getElementById("btnCancel2")?.addEventListener("click", closeModal);

// ============================================================
// IMPORT CSV — bulk tambah orang tua
// ============================================================
const btnImport         = document.getElementById("btnImport");
const importOv          = document.getElementById("importModalOverlay");
const importStep1       = document.getElementById("importStep1");
const importStep2       = document.getElementById("importStep2");
const csvFileInput      = document.getElementById("csvFileInput");
const csvFileName       = document.getElementById("csvFileName");
const btnDownloadTpl    = document.getElementById("btnDownloadTemplate");
const importPreviewBody = document.getElementById("importPreviewBody");
const importRowCount    = document.getElementById("importRowCount");
const importErrors      = document.getElementById("importErrors");
const btnImportConfirm  = document.getElementById("btnImportConfirm");
const btnImportCancel   = document.getElementById("btnImportCancel");
const btnImportClose    = document.getElementById("btnImportClose");

let parsedRows = [];

btnImport?.addEventListener("click", () => {
  resetImportModal();
  importOv.style.display = "flex";
});

function resetImportModal() {
  importStep1.style.display = "block";
  importStep2.style.display = "none";
  btnImportConfirm.style.display = "none";
  csvFileInput.value = "";
  csvFileName.textContent = "";
  importErrors.style.display = "none";
  importErrors.innerHTML = "";
  parsedRows = [];
}

function closeImportModal() { importOv.style.display = "none"; }
btnImportCancel?.addEventListener("click", closeImportModal);
btnImportClose?.addEventListener("click",  closeImportModal);

// Download template
btnDownloadTpl?.addEventListener("click", () => {
  const headers = ["nama", "whatsapp_number", "email"];
  const sample  = ["Bapak Ahmad", "+6281234567890", "ahmad@email.com"];
  const csv = headers.join(",") + "\n" + sample.map(v => `"${v}"`).join(",");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "template_import_orangtua.csv";
  a.click();
  URL.revokeObjectURL(a.href);
});

// Parse CSV
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
  if (!lines.length) return [];
  const parseLine = (line) => {
    const result = []; let cur = "", inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQuotes && line[i+1] === '"') { cur += '"'; i++; } else inQuotes = !inQuotes; }
      else if (ch === "," && !inQuotes) { result.push(cur); cur = ""; }
      else cur += ch;
    }
    result.push(cur);
    return result.map(v => v.trim());
  };
  const headers = parseLine(lines[0]).map(h => h.toLowerCase());
  return lines.slice(1).map(line => {
    const vals = parseLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });
    return row;
  });
}

// Handle upload
csvFileInput?.addEventListener("change", async () => {
  const file = csvFileInput.files[0];
  if (!file) return;
  csvFileName.textContent = `File: ${file.name}`;
  const text = await file.text();
  const rows = parseCSV(text);
  if (!rows.length) { showToast("File CSV kosong.", "error"); return; }
  if (rows.length > 500) { showToast("Maksimal 500 baris.", "error"); return; }
  validateAndPreview(rows);
});

function validateAndPreview(rows) {
  const errors = [];
  parsedRows = rows.map((r, idx) => {
    const rowNum = idx + 2;
    const nama = (r.nama ?? "").trim();
    const wa   = (r.whatsapp_number ?? r.wa ?? r.whatsapp ?? "").trim();
    let status = "valid", note = "";

    if (!nama) {
      status = "error"; note = "Nama kosong";
      errors.push(`Baris ${rowNum}: nama wajib diisi`);
    } else if (!wa) {
      status = "error"; note = "No. WA kosong";
      errors.push(`Baris ${rowNum}: no. WA wajib diisi`);
    } else if (!/^\+?\d{9,15}$/.test(wa.replace(/[\s-]/g, ""))) {
      status = "warning"; note = "Format WA mungkin salah";
    }

    return {
      name: nama,
      whatsapp_number: wa.replace(/[\s-]/g, "") || null,
      email: (r.email ?? "").trim() || null,
      _status: status,
      _note: note,
    };
  });

  renderPreview(errors);
}

function renderPreview(errors) {
  importStep1.style.display = "none";
  importStep2.style.display = "block";
  importRowCount.textContent = parsedRows.length;

  if (errors.length) {
    importErrors.style.display = "block";
    importErrors.innerHTML = `<strong>${errors.length} masalah:</strong><br>` +
      errors.slice(0,10).map(e => `• ${e}`).join("<br>") +
      (errors.length > 10 ? `<br>... dan ${errors.length-10} lainnya` : "");
  }

  const sb = (s) => ({
    valid:   `<span class="badge badge-lunas">Siap</span>`,
    warning: `<span class="badge badge-aktif">Perlu cek</span>`,
    error:   `<span class="badge badge-ditolak">Error</span>`,
  }[s]);

  importPreviewBody.innerHTML = parsedRows.map(r => `
    <tr>
      <td style="padding:8px">${r.name || "-"}</td>
      <td style="padding:8px">${r.whatsapp_number || "-"}</td>
      <td style="padding:8px">${r.email || "-"}</td>
      <td style="padding:8px">${sb(r._status)}${r._note ? `<div style="font-size:10px;color:var(--grey-400)">${r._note}</div>` : ""}</td>
    </tr>`).join("");

  const validCount = parsedRows.filter(r => r._status !== "error").length;
  if (validCount > 0) {
    btnImportConfirm.style.display = "inline-flex";
    btnImportConfirm.textContent = `Simpan ${validCount} Orang Tua`;
  } else {
    btnImportConfirm.style.display = "none";
  }
}

// Simpan ke Supabase
btnImportConfirm?.addEventListener("click", async () => {
  const validRows = parsedRows.filter(r => r._status !== "error");
  if (!validRows.length) return;

  btnImportConfirm.disabled = true;
  btnImportConfirm.textContent = "Menyimpan...";

  const payload = validRows.map(r => ({
    name: r.name,
    whatsapp_number: r.whatsapp_number,
    email: r.email,
    school_id: profile.school_id,
  }));

  // Upsert by whatsapp_number — skip jika nomor sudah ada
  const { error } = await supabase.from("parents")
    .upsert(payload, { onConflict: "whatsapp_number", ignoreDuplicates: true });

  if (error) {
    showToast("Gagal import: " + error.message, "error");
    btnImportConfirm.disabled = false;
    btnImportConfirm.textContent = `Simpan ${validRows.length} Orang Tua`;
    return;
  }

  showToast(`${validRows.length} orang tua berhasil diimport.`, "success");
  closeImportModal();
  loadParents();
});

// ── Init ──────────────────────────────────────────────────
loadParents();
