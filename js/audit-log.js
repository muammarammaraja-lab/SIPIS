// ============================================================
// SFMS LITE — Audit Log v3.3
// Kolom: entity_type, entity_id, before_data, after_data, user_id
// ============================================================
import { supabase } from "./supabaseClient.js";
import { requireAuth, applyRoleVisibility } from "./auth.js";
import { formatDatetime } from "./utils.js";

const auth = await requireAuth();
if (!auth) throw new Error("Unauthenticated");
const { profile } = auth;
applyRoleVisibility(profile);

// ── Elements ──────────────────────────────────────────────
const tableWrap    = document.getElementById("auditTableWrap");
const cardList     = document.getElementById("auditCardList");
const filterTable  = document.getElementById("filterTable");
const filterAction = document.getElementById("filterAction");

// ── Helpers ───────────────────────────────────────────────
const ACTION_BADGE = {
  insert: `<span class="badge badge-lunas">Tambah</span>`,
  update: `<span class="badge badge-aktif">Ubah</span>`,
  delete: `<span class="badge badge-ditolak">Hapus</span>`,
  INSERT: `<span class="badge badge-lunas">Tambah</span>`,
  UPDATE: `<span class="badge badge-aktif">Ubah</span>`,
  DELETE: `<span class="badge badge-ditolak">Hapus</span>`,
};

const TABLE_LABEL = {
  bills:         "Tagihan",
  payments:      "Pembayaran",
  students:      "Siswa",
  profiles:      "User",
  parents:       "Orang Tua",
  billing_types: "Jenis Tagihan",
  wa_templates:  "Template WA",
  schools:       "Sekolah",
};

function actionBadge(action) {
  return ACTION_BADGE[action] ?? `<span class="badge">${action}</span>`;
}

function tableLabel(tbl) {
  return TABLE_LABEL[tbl] ?? tbl;
}

function changesPreview(before, after, action) {
  const act = (action ?? "").toLowerCase();
  if (act === "delete") {
    const name = before?.name ?? before?.full_name ?? before?.id ?? "";
    return `<span style="color:var(--red);font-size:12px">Dihapus${name ? `: ${name}` : ""}</span>`;
  }
  if (act === "insert") {
    const keys = Object.keys(after ?? {})
      .filter(k => !["id","created_at","updated_at","school_id"].includes(k));
    return keys.slice(0,3)
      .map(k => `<span style="font-size:11px;color:var(--grey-500)">${k}: <em>${String(after[k] ?? "").slice(0,30)}</em></span>`)
      .join(" · ") || "-";
  }
  // update — tampilkan diff
  if (!before || !after) return "-";
  const changed = Object.keys(after)
    .filter(k => !["updated_at"].includes(k) &&
      JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  if (!changed.length) return `<span style="color:var(--grey-400);font-size:12px">—</span>`;
  return changed.slice(0,3)
    .map(k => `<span style="font-size:11px;color:var(--grey-500)">${k}: <em>${String(before[k] ?? "").slice(0,20)}</em> → <em>${String(after[k] ?? "").slice(0,20)}</em></span>`)
    .join("<br>");
}

// ── Cache profiles ────────────────────────────────────────
let profilesCache = {};
async function loadProfilesCache() {
  const { data } = await supabase.from("profiles").select("id, full_name, role");
  (data ?? []).forEach(p => { profilesCache[p.id] = p; });
}

// ── Load logs ─────────────────────────────────────────────
async function loadLogs() {
  tableWrap.innerHTML = `
    <div class="skeleton skeleton-row"></div>
    <div class="skeleton skeleton-row"></div>
    <div class="skeleton skeleton-row"></div>`;
  cardList.innerHTML = "";

  let q = supabase
    .from("audit_logs")
    .select("id, created_at, entity_type, action, before_data, after_data, user_id")
    .order("created_at", { ascending: false })
    .limit(200);

  const tv = filterTable?.value;
  const av = filterAction?.value;
  if (tv) q = q.eq("entity_type", tv);
  if (av) q = q.eq("action", av);

  const { data, error } = await q;

  if (error) {
    tableWrap.innerHTML = `<div class="empty-state">
      <div class="empty-title">Gagal memuat</div>
      <div class="empty-desc">${error.message}</div>
    </div>`;
    return;
  }

  if (!data?.length) {
    const empty = `<div class="empty-state">
      <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
      <div class="empty-title">Tidak ada log</div>
      <div class="empty-desc">Belum ada aktivitas untuk filter ini.</div>
    </div>`;
    tableWrap.innerHTML = cardList.innerHTML = empty;
    return;
  }

  const userName = (log) => {
    if (!log.user_id) return "Sistem";
    const p = profilesCache[log.user_id];
    return p?.full_name ?? log.user_id.slice(0, 8) + "…";
  };

  // Desktop table
  tableWrap.innerHTML = `
    <table>
      <thead><tr>
        <th>Waktu</th><th>User</th><th>Entitas</th><th>Aksi</th><th>Perubahan</th>
      </tr></thead>
      <tbody>
        ${data.map(log => `<tr>
          <td style="white-space:nowrap;font-size:12px;color:var(--grey-500)">${formatDatetime(log.created_at)}</td>
          <td style="font-size:13px">${userName(log)}</td>
          <td><span style="font-size:12px;font-family:var(--font-mono);color:var(--grey-600)">${tableLabel(log.entity_type)}</span></td>
          <td>${actionBadge(log.action)}</td>
          <td style="max-width:240px;line-height:1.7">${changesPreview(log.before_data, log.after_data, log.action)}</td>
        </tr>`).join("")}
      </tbody>
    </table>`;

  // Mobile card list
  cardList.innerHTML = data.map(log => `
    <div class="card-list-item">
      <div class="cli-name" style="font-size:13px">${userName(log)}</div>
      <div class="cli-meta">
        <span>${formatDatetime(log.created_at)}</span>
        <span>${tableLabel(log.entity_type)}</span>
      </div>
      <div class="cli-footer" style="align-items:flex-start;flex-direction:column;gap:4px">
        ${actionBadge(log.action)}
        <div style="font-size:11px;line-height:1.6;color:var(--grey-500)">${changesPreview(log.before_data, log.after_data, log.action)}</div>
      </div>
    </div>`).join("");
}

// ── Update filter options sesuai kolom yang benar ─────────
function initFilters() {
  // filterTable: isi dengan entity_type yang ada
  if (filterTable) {
    filterTable.innerHTML = `
      <option value="">Semua Entitas</option>
      <option value="bills">Tagihan</option>
      <option value="payments">Pembayaran</option>
      <option value="students">Siswa</option>
      <option value="parents">Orang Tua</option>
      <option value="billing_types">Jenis Tagihan</option>
      <option value="profiles">User</option>
      <option value="schools">Sekolah</option>`;
  }
  // filterAction: isi dengan action yang ada
  if (filterAction) {
    filterAction.innerHTML = `
      <option value="">Semua Aksi</option>
      <option value="insert">Tambah</option>
      <option value="update">Ubah</option>
      <option value="delete">Hapus</option>`;
  }
}

// ── Filter ────────────────────────────────────────────────
filterTable?.addEventListener("change", loadLogs);
filterAction?.addEventListener("change", loadLogs);

// ── Init ──────────────────────────────────────────────────
initFilters();
await loadProfilesCache();
loadLogs();
