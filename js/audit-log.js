// ============================================================
// SFMS LITE — Audit Log v3.1
// Read-only log aktivitas sistem dari tabel audit_logs
// Filter: tabel + aksi, mobile card list + desktop table
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
  INSERT: `<span class="badge badge-lunas">Tambah</span>`,
  UPDATE: `<span class="badge badge-aktif">Ubah</span>`,
  DELETE: `<span class="badge badge-ditolak">Hapus</span>`,
};

const TABLE_LABEL = {
  bills:    "Tagihan",
  payments: "Pembayaran",
  students: "Siswa",
  profiles: "User",
  parents:  "Orang Tua",
  billing_types: "Jenis Tagihan",
  wa_templates:  "Template WA",
};

function actionBadge(action) {
  return ACTION_BADGE[action] ?? `<span class="badge">${action}</span>`;
}

function tableLabel(tbl) {
  return TABLE_LABEL[tbl] ?? tbl;
}

function changesPreview(old_data, new_data, action) {
  if (action === "DELETE") {
    return `<span style="color:var(--red);font-size:12px">Dihapus</span>`;
  }
  if (action === "INSERT") {
    const keys = Object.keys(new_data ?? {}).filter(k => !["id","created_at","updated_at"].includes(k));
    const preview = keys.slice(0,3).map(k => `<span style="font-size:11px;color:var(--grey-500)">${k}: <em>${String(new_data[k] ?? "").slice(0,30)}</em></span>`).join(" · ");
    return preview || "-";
  }
  // UPDATE — tampilkan field yang berubah
  if (!old_data || !new_data) return "-";
  const changed = Object.keys(new_data).filter(k =>
    !["updated_at"].includes(k) && JSON.stringify(old_data[k]) !== JSON.stringify(new_data[k])
  );
  if (!changed.length) return `<span style="color:var(--grey-400);font-size:12px">Tidak ada perubahan</span>`;
  return changed.slice(0,3).map(k =>
    `<span style="font-size:11px;color:var(--grey-500)">${k}: <em>${String(old_data[k] ?? "").slice(0,20)}</em> → <em>${String(new_data[k] ?? "").slice(0,20)}</em></span>`
  ).join("<br>");
}

// ── Load audit log ────────────────────────────────────────
async function loadLogs() {
  tableWrap.innerHTML = `
    <div class="skeleton skeleton-row"></div>
    <div class="skeleton skeleton-row"></div>
    <div class="skeleton skeleton-row"></div>`;
  cardList.innerHTML = "";

  let q = supabase
    .from("audit_logs")
    .select("*, profiles(full_name, role)")
    .order("created_at", { ascending: false })
    .limit(200);

  const tv = filterTable?.value;
  const av = filterAction?.value;
  if (tv) q = q.eq("table_name", tv);
  if (av) q = q.eq("action", av);

  const { data, error } = await q;

  if (error) {
    tableWrap.innerHTML = `<div class="empty-state"><div class="empty-title">Gagal memuat</div><div class="empty-desc">${error.message}</div></div>`;
    return;
  }

  if (!data?.length) {
    const empty = `<div class="empty-state">
      <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
      <div class="empty-title">Tidak ada log</div>
      <div class="empty-desc">Belum ada aktivitas yang tercatat untuk filter ini.</div>
    </div>`;
    tableWrap.innerHTML = cardList.innerHTML = empty;
    return;
  }

  // Desktop table
  tableWrap.innerHTML = `
    <table>
      <thead><tr>
        <th>Waktu</th><th>User</th><th>Tabel</th><th>Aksi</th><th>Perubahan</th>
      </tr></thead>
      <tbody>
        ${data.map(log => `<tr>
          <td style="white-space:nowrap;font-size:12px;color:var(--grey-500)">${formatDatetime(log.created_at)}</td>
          <td>
            <div style="font-size:13px">${log.profiles?.full_name ?? "—"}</div>
            <div style="font-size:11px;color:var(--grey-400)">${log.profiles?.role ?? ""}</div>
          </td>
          <td><span style="font-size:12px;font-family:var(--font-mono);color:var(--grey-600)">${tableLabel(log.table_name)}</span></td>
          <td>${actionBadge(log.action)}</td>
          <td style="max-width:240px;font-size:12px;line-height:1.6">${changesPreview(log.old_data, log.new_data, log.action)}</td>
        </tr>`).join("")}
      </tbody>
    </table>`;

  // Mobile card list
  cardList.innerHTML = data.map(log => `
    <div class="card-list-item">
      <div class="cli-name" style="font-size:13px">${log.profiles?.full_name ?? "—"}</div>
      <div class="cli-meta">
        <span>${formatDatetime(log.created_at)}</span>
        <span>${tableLabel(log.table_name)}</span>
      </div>
      <div class="cli-footer" style="align-items:flex-start;flex-direction:column;gap:6px">
        ${actionBadge(log.action)}
        <div style="font-size:11px;line-height:1.6;color:var(--grey-500)">${changesPreview(log.old_data, log.new_data, log.action)}</div>
      </div>
    </div>`).join("");
}

// ── Filter ────────────────────────────────────────────────
filterTable?.addEventListener("change", loadLogs);
filterAction?.addEventListener("change", loadLogs);

// ── Init ──────────────────────────────────────────────────
loadLogs();
