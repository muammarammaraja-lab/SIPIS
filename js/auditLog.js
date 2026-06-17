// ============================================================
// SFMS LITE — Audit Log viewer (read-only)
// ============================================================

import { supabase } from "./supabaseClient.js";
import { requireAuth, applyRoleVisibility } from "./auth.js";
import { formatDate } from "./utils.js";

const auth = await requireAuth();
let allLogs = [];

if (auth) {
  applyRoleVisibility(auth.profile);
  if (!["kepala_sekolah", "super_admin"].includes(auth.profile.role)) {
    document.getElementById("logWrap").innerHTML =
      `<div class="empty-state">Halaman ini hanya bisa diakses oleh Kepala Sekolah.</div>`;
  } else {
    loadLogs();
  }
}

document.getElementById("filterEntity").addEventListener("change", (e) => renderLogs(e.target.value));
document.getElementById("btnCloseDetail").addEventListener("click", () => {
  document.getElementById("detailOverlay").style.display = "none";
});

const ACTION_LABEL = { insert: "Tambah", update: "Edit", delete: "Hapus" };
const ENTITY_LABEL = { students: "Data Siswa", bills: "Tagihan", payments: "Pembayaran", billing_types: "Jenis Tagihan" };

async function loadLogs() {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    document.getElementById("logWrap").innerHTML = `<div class="empty-state">${error.message}</div>`;
    return;
  }
  allLogs = data || [];
  renderLogs("");
}

function renderLogs(entityFilter) {
  const wrap = document.getElementById("logWrap");
  const rows = entityFilter ? allLogs.filter(l => l.entity_type === entityFilter) : allLogs;

  if (rows.length === 0) {
    wrap.innerHTML = `<div class="empty-state">Belum ada aktivitas tercatat untuk filter ini.</div>`;
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead><tr><th>Waktu</th><th>Aksi</th><th>Modul</th><th>Detail</th></tr></thead>
      <tbody>
        ${rows.map((l, i) => `
          <tr>
            <td>${formatDate(l.created_at)}</td>
            <td>${ACTION_LABEL[l.action] ?? l.action}</td>
            <td>${ENTITY_LABEL[l.entity_type] ?? l.entity_type ?? "-"}</td>
            <td><button class="btn btn-ghost btn-sm" data-detail="${i}">Lihat</button></td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;

  wrap.querySelectorAll("[data-detail]").forEach(btn => {
    btn.addEventListener("click", () => showDetail(rows[Number(btn.dataset.detail)]));
  });
}

function showDetail(log) {
  document.getElementById("beforeData").textContent = log.before_data ? JSON.stringify(log.before_data, null, 2) : "(tidak ada)";
  document.getElementById("afterData").textContent = log.after_data ? JSON.stringify(log.after_data, null, 2) : "(tidak ada)";
  document.getElementById("detailOverlay").style.display = "flex";
}
