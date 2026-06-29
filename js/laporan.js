// ============================================================
// SFMS LITE — Laporan Keuangan v3.1
// Mobile card list + desktop table dual render
// ============================================================
import { supabase } from "./supabaseClient.js";
import { requireAuth, applyRoleVisibility } from "./auth.js";
import { formatRupiah, formatDate, exportCSV } from "./utils.js";

const auth = await requireAuth();
if (!auth) throw new Error("Unauthenticated");
const { profile } = auth;
applyRoleVisibility(profile);

// ── Elements ──────────────────────────────────────────────
const cardsEl     = document.getElementById("laporanCards");
const tableWrap   = document.getElementById("laporanTableWrap");
const cardList    = document.getElementById("laporanCardList");
const filterMonth = document.getElementById("filterMonth");
const btnExport   = document.getElementById("btnExport");

// Default ke bulan ini
const now = new Date();
filterMonth.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

// ── Bangun range tanggal dari input[type=month] ───────────
function monthRange(monthVal) {
  if (!monthVal) return null;
  const [y, m] = monthVal.split("-").map(Number);
  const from = new Date(y, m-1, 1).toISOString();
  const to   = new Date(y, m, 1).toISOString();   // awal bulan berikutnya (exclusive)
  return { from, to };
}

// ── Summary cards ─────────────────────────────────────────
async function loadCards(monthVal) {
  cardsEl.innerHTML = `
    <div class="skeleton skeleton-card"></div>
    <div class="skeleton skeleton-card"></div>
    <div class="skeleton skeleton-card"></div>`;

  const range = monthRange(monthVal);

  let q = supabase.from("payments").select("amount").eq("status","diterima");
  if (range) q = q.gte("created_at", range.from).lt("created_at", range.to);
  const { data: paid } = await q;

  const totalMasuk   = (paid ?? []).reduce((s,p) => s + Number(p.amount), 0);
  const jmlTransaksi = (paid ?? []).length;

  const { count: belumLunas } = await supabase
    .from("bills")
    .select("id", { count: "exact", head: true })
    .neq("status","lunas");

  const label = monthVal ? " (bulan ini)" : "";

  cardsEl.innerHTML = `
    <div class="card">
      <div class="card-icon" style="color:var(--green)">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      </div>
      <div class="label">Total Terkumpul${label}</div>
      <div class="value value-sm">${formatRupiah(totalMasuk)}</div>
      <div class="sub">pembayaran diterima</div>
    </div>
    <div class="card">
      <div class="card-icon" style="color:var(--blue)">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
      </div>
      <div class="label">Transaksi${label}</div>
      <div class="value">${jmlTransaksi}</div>
      <div class="sub">pembayaran diterima</div>
    </div>
    <div class="card amber">
      <div class="card-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <div class="label">Tagihan Belum Lunas</div>
      <div class="value">${belumLunas ?? 0}</div>
      <div class="sub">perlu ditindaklanjuti</div>
    </div>`;
}

// ── Tabel laporan ─────────────────────────────────────────
async function loadTable(monthVal) {
  tableWrap.innerHTML = `<div class="skeleton skeleton-row"></div>
    <div class="skeleton skeleton-row"></div>
    <div class="skeleton skeleton-row"></div>`;
  cardList.innerHTML = "";

  const range = monthRange(monthVal);

  let q = supabase
    .from("payments")
    .select("*, bills(period, amount, students(name), billing_types(name))")
    .eq("status","diterima")
    .order("created_at", { ascending: false })
    .limit(500);

  if (range) q = q.gte("created_at", range.from).lt("created_at", range.to);

  const { data, error } = await q;

  if (error) {
    tableWrap.innerHTML = `<div class="empty-state"><div class="empty-title">Gagal memuat</div><div class="empty-desc">${error.message}</div></div>`;
    return;
  }
  if (!data?.length) {
    const empty = `<div class="empty-state">
      <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
      <div class="empty-title">Tidak ada data</div>
      <div class="empty-desc">Tidak ada pembayaran untuk periode ini.</div>
    </div>`;
    tableWrap.innerHTML = cardList.innerHTML = empty;
    return;
  }

  const total = data.reduce((s,p) => s + Number(p.amount), 0);

  // Desktop table
  tableWrap.innerHTML = `
    <table>
      <thead><tr>
        <th>Tanggal</th><th>Siswa</th><th>Jenis Tagihan</th>
        <th>Periode</th><th>Jumlah</th><th>Metode</th>
      </tr></thead>
      <tbody>
        ${data.map(p => {
          const b = p.bills ?? {};
          return `<tr>
            <td>${formatDate(p.created_at)}</td>
            <td><strong>${b.students?.name ?? "-"}</strong></td>
            <td>${b.billing_types?.name ?? "-"}</td>
            <td>${b.period ?? "-"}</td>
            <td>${formatRupiah(p.amount)}</td>
            <td style="text-transform:capitalize">${(p.method ?? "-").replace(/_/g," ")}</td>
          </tr>`;
        }).join("")}
      </tbody>
      <tfoot><tr>
        <td colspan="4" style="text-align:right;font-weight:600;padding:10px 12px">Total</td>
        <td style="font-weight:700;padding:10px 12px">${formatRupiah(total)}</td>
        <td></td>
      </tr></tfoot>
    </table>`;

  // Mobile card list
  cardList.innerHTML = data.map(p => {
    const b = p.bills ?? {};
    return `<div class="card-list-item">
      <div class="cli-name">${b.students?.name ?? "-"}</div>
      <div class="cli-meta">
        <span>${b.billing_types?.name ?? "-"}${b.period ? ` — ${b.period}` : ""}</span>
        <span>${formatDate(p.created_at)}</span>
        <span style="text-transform:capitalize">${(p.method ?? "-").replace(/_/g," ")}</span>
      </div>
      <div class="cli-footer">
        <span class="cli-amount">${formatRupiah(p.amount)}</span>
        <span class="badge badge-diterima">Diterima</span>
      </div>
    </div>`;
  }).join("");
}

// ── Export CSV ────────────────────────────────────────────
btnExport?.addEventListener("click", async () => {
  const monthVal = filterMonth.value;
  const range = monthRange(monthVal);

  let q = supabase
    .from("payments")
    .select("*, bills(period, students(name), billing_types(name))")
    .eq("status","diterima")
    .order("created_at", { ascending: false });

  if (range) q = q.gte("created_at", range.from).lt("created_at", range.to);

  const { data } = await q;

  exportCSV(
    `laporan_${monthVal || "semua"}.csv`,
    ["Tanggal","Siswa","Jenis Tagihan","Periode","Jumlah","Metode"],
    (data ?? []).map(p => {
      const b = p.bills ?? {};
      return [
        formatDate(p.created_at),
        b.students?.name ?? "",
        b.billing_types?.name ?? "",
        b.period ?? "",
        p.amount,
        p.method ?? "",
      ];
    })
  );
});

// ── Filter ────────────────────────────────────────────────
filterMonth?.addEventListener("change", () => {
  const v = filterMonth.value;
  loadCards(v);
  loadTable(v);
});

// ── Init ──────────────────────────────────────────────────
const initMonth = filterMonth.value;
loadCards(initMonth);
loadTable(initMonth);
