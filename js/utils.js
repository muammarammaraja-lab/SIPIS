// ============================================================
// SFMS LITE — Utils v2.0
// showToast, formatRupiah, formatDate, statusBadge, exportCSV,
// skeleton loader, confirm dialog
// ============================================================

// ---------- Toast ----------
let toastContainer = null;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toast-container";
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(message, type = "info", duration = 3500) {
  const container = getToastContainer();
  const icons = { success: "✓", error: "✕", info: "ℹ" };

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] ?? icons.info}</span>
    <span class="toast-msg">${message}</span>
  `;
  container.appendChild(toast);

  const remove = () => {
    toast.classList.add("toast-out");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  };

  const timer = setTimeout(remove, duration);
  toast.addEventListener("click", () => { clearTimeout(timer); remove(); });
}

// ---------- Skeleton loader ----------
export function showSkeleton(wrap, rows = 5) {
  wrap.innerHTML = Array.from({ length: rows })
    .map(() => `<div class="skeleton skeleton-row"></div>`)
    .join("");
}

// ---------- Format ----------
export function formatRupiah(n) {
  const num = Number(n) || 0;
  return "Rp" + Math.round(num).toLocaleString("id-ID");
}

export function formatDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric"
  });
}

// ---------- Status badge ----------
export function statusBadge(status) {
  const map = {
    lunas:               "lunas",
    aktif:               "aktif",
    menunggak:           "menunggak",
    sebagian_bayar:      "sebagian_bayar",
    dibatalkan:          "dibatalkan",
    dispensasi:          "dispensasi",
    diterima:            "diterima",
    ditolak:             "ditolak",
    menunggu_verifikasi: "menunggu_verifikasi",
  };
  const labels = {
    lunas:               "Lunas",
    aktif:               "Aktif",
    menunggak:           "Menunggak",
    sebagian_bayar:      "Sebagian",
    dibatalkan:          "Dibatalkan",
    dispensasi:          "Dispensasi",
    diterima:            "Diterima",
    ditolak:             "Ditolak",
    menunggu_verifikasi: "Menunggu",
  };
  const cls = map[status] ?? "aktif";
  const label = labels[status] ?? status;
  return `<span class="badge badge-${cls}">${label}</span>`;
}

// ---------- Export CSV ----------
export function exportCSV(filename, headers, rows) {
  const BOM = "\uFEFF";
  const escape = (v) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers, ...rows].map(r => r.map(escape).join(",")).join("\r\n");
  const blob = new Blob([BOM + lines], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Confirm dialog ----------
export function confirm(message) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.style.display = "flex";
    overlay.innerHTML = `
      <div class="modal-box" style="max-width:360px">
        <div class="modal-header">
          <h2>Konfirmasi</h2>
        </div>
        <p style="margin:0 0 20px;color:var(--grey-700);font-size:13.5px">${message}</p>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="confirmNo">Batal</button>
          <button class="btn btn-danger" id="confirmYes">Ya, Lanjutkan</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector("#confirmYes").onclick = () => { overlay.remove(); resolve(true); };
    overlay.querySelector("#confirmNo").onclick  = () => { overlay.remove(); resolve(false); };
  });
}

// ---------- Query selector shortcut ----------
export const qs = (sel, ctx = document) => ctx.querySelector(sel);

// ---------- Format angka singkat ----------
export function formatAngka(n) {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + " jt";
  if (num >= 1_000)     return (num / 1_000).toFixed(0) + " rb";
  return num.toString();
}
