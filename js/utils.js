// ============================================================
// SFMS LITE — Utils v3.0
// ============================================================

// ----------------------------------------------------------------
// TOAST — dengan Lucide-style SVG icons
// ----------------------------------------------------------------
let _toastContainer = null;

function getToastContainer() {
  if (!_toastContainer) {
    _toastContainer = document.createElement("div");
    _toastContainer.id = "toast-container";
    document.body.appendChild(_toastContainer);
  }
  return _toastContainer;
}

const TOAST_ICONS = {
  success: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  error:   `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  info:    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
};

export function showToast(message, type = "info", duration = 3500) {
  const container = getToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${TOAST_ICONS[type] ?? TOAST_ICONS.info}</div>
    <span class="toast-msg">${message}</span>
    <button class="toast-close" aria-label="Tutup">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;
  container.appendChild(toast);

  const dismiss = () => {
    toast.classList.add("out");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  };

  const timer = setTimeout(dismiss, duration);
  toast.querySelector(".toast-close").addEventListener("click", () => {
    clearTimeout(timer); dismiss();
  });
}

// ----------------------------------------------------------------
// SKELETON
// ----------------------------------------------------------------
export function showSkeleton(wrap, rows = 5) {
  wrap.innerHTML = Array.from({ length: rows })
    .map(() => `<div class="skeleton skeleton-row"></div>`)
    .join("");
}

// ----------------------------------------------------------------
// FORMAT
// ----------------------------------------------------------------
export function formatRupiah(n) {
  const num = Number(n) || 0;
  return "Rp" + Math.round(num).toLocaleString("id-ID");
}

export function formatDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function formatDatetime(d) {
  if (!d) return "-";
  return new Date(d).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ----------------------------------------------------------------
// STATUS BADGE
// ----------------------------------------------------------------
const STATUS_MAP = {
  lunas:               { label: "Lunas",     cls: "lunas" },
  aktif:               { label: "Aktif",     cls: "aktif" },
  menunggak:           { label: "Menunggak", cls: "menunggak" },
  sebagian_bayar:      { label: "Sebagian",  cls: "sebagian_bayar" },
  dibatalkan:          { label: "Batal",     cls: "dibatalkan" },
  dispensasi:          { label: "Dispensasi",cls: "dispensasi" },
  diterima:            { label: "Diterima",  cls: "diterima" },
  ditolak:             { label: "Ditolak",   cls: "ditolak" },
  menunggu_verifikasi: { label: "Menunggu",  cls: "menunggu_verifikasi" },
};

export function statusBadge(status) {
  const s = STATUS_MAP[status] ?? { label: status, cls: "aktif" };
  return `<span class="badge badge-${s.cls}">${s.label}</span>`;
}

// ----------------------------------------------------------------
// EXPORT CSV
// ----------------------------------------------------------------
export function exportCSV(filename, headers, rows) {
  const BOM = "\uFEFF";
  const escape = v => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers, ...rows].map(r => r.map(escape).join(",")).join("\r\n");
  const blob = new Blob([BOM + lines], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ----------------------------------------------------------------
// CONFIRM DIALOG (kustom, bukan window.confirm)
// ----------------------------------------------------------------
export function confirmDialog(message, dangerLabel = "Ya, Lanjutkan") {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.style.display = "flex";
    overlay.innerHTML = `
      <div class="modal-box" style="max-width:360px">
        <div class="modal-header">
          <h2>Konfirmasi</h2>
        </div>
        <p style="color:var(--grey-600);font-size:13.5px;margin-bottom:4px;line-height:1.6">${message}</p>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="_cfNo">Batal</button>
          <button class="btn btn-danger" id="_cfYes">${dangerLabel}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#_cfYes").onclick = () => { overlay.remove(); resolve(true); };
    overlay.querySelector("#_cfNo").onclick  = () => { overlay.remove(); resolve(false); };
    overlay.addEventListener("click", e => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
  });
}

// ----------------------------------------------------------------
// QUERY SELECTOR SHORTHAND
// ----------------------------------------------------------------
export const qs = (sel, ctx = document) => ctx.querySelector(sel);
export const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
