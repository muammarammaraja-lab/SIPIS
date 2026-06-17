// ============================================================
// SFMS LITE — Utility helpers
// ============================================================

export function formatRupiah(value) {
  const num = Number(value || 0);
  return "Rp" + num.toLocaleString("id-ID");
}

export function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export function statusBadge(status) {
  const map = {
    draft: "Draft", aktif: "Aktif", ditagihkan: "Ditagihkan",
    sebagian_bayar: "Sebagian Bayar", lunas: "Lunas", menunggak: "Menunggak",
    dispensasi: "Dispensasi", dibatalkan: "Dibatalkan",
    menunggu_verifikasi: "Menunggu Verifikasi", diterima: "Diterima", ditolak: "Ditolak",
  };
  const cls = {
    draft: "draft", aktif: "aktif", ditagihkan: "ditagihkan",
    sebagian_bayar: "sebagian", lunas: "lunas", menunggak: "menunggak",
    dispensasi: "dispensasi", dibatalkan: "dibatalkan",
    menunggu_verifikasi: "sebagian", diterima: "lunas", ditolak: "menunggak",
  };
  const label = map[status] || status;
  const className = cls[status] || "draft";
  return `<span class="badge badge-${className}">${label}</span>`;
}

export function showToast(message, type = "info") {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.style.position = "fixed";
    el.style.bottom = "20px";
    el.style.right = "20px";
    el.style.padding = "12px 18px";
    el.style.borderRadius = "8px";
    el.style.fontSize = "13.5px";
    el.style.fontWeight = "600";
    el.style.zIndex = "999";
    el.style.boxShadow = "0 6px 20px rgba(0,0,0,0.15)";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.background = type === "error" ? "#b3261e" : type === "success" ? "#1e7a4d" : "#1f3864";
  el.style.color = "#fff";
  el.style.display = "block";
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.style.display = "none"), 3000);
}

export function qs(selector, parent = document) {
  return parent.querySelector(selector);
}
export function qsa(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}
