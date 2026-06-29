// ============================================================
// SFMS LITE — Dashboard v3.0
// Summary cards, recent bills, recent payments
// Mobile card list + desktop table dual render
// ============================================================
import { supabase } from "./supabaseClient.js";
import { requireAuth, applyRoleVisibility } from "./auth.js";
import { formatRupiah, formatDate, statusBadge, showSkeleton } from "./utils.js";

const auth = await requireAuth();
if (auth) {
  applyRoleVisibility(auth.profile);
  loadDashboard();
}

async function loadDashboard() {
  await Promise.all([
    loadSummaryCards(),
    loadRecentBills(),
    loadRecentPayments(),
  ]);
}

async function loadSummaryCards() {
  const wrap = document.getElementById("summaryCards");

  const [siswRes, tagihanRes, pembayaranRes] = await Promise.all([
    supabase.from("students").select("id, status"),
    supabase.from("bills").select("id, amount, amount_paid, status"),
    supabase.from("payments").select("id, amount, status"),
  ]);

  const siswa     = siswRes.data ?? [];
  const tagihan   = tagihanRes.data ?? [];
  const pembayaran = pembayaranRes.data ?? [];

  const totalSiswa        = siswa.filter(s => s.status === "aktif").length;
  const totalTagihan      = tagihan.length;
  const tagihanLunas      = tagihan.filter(b => b.status === "lunas").length;
  const tagihanBelumLunas = tagihan.filter(b => b.status === "aktif").length;
  const totalPendapatan   = pembayaran
    .filter(p => p.status === "diterima")
    .reduce((s, p) => s + Number(p.amount), 0);

  wrap.innerHTML = `
    <div class="card">
      <div class="card-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      </div>
      <div class="label">Siswa Aktif</div>
      <div class="value">${totalSiswa}</div>
      <div class="sub">terdaftar di sistem</div>
    </div>

    <div class="card green">
      <div class="card-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div class="label">Tagihan Lunas</div>
      <div class="value">${tagihanLunas}</div>
      <div class="sub">dari ${totalTagihan} tagihan</div>
    </div>

    <div class="card amber">
      <div class="card-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <div class="label">Belum Lunas</div>
      <div class="value">${tagihanBelumLunas}</div>
      <div class="sub">perlu ditindaklanjuti</div>
    </div>

    <div class="card">
      <div class="card-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      </div>
      <div class="label">Total Terkumpul</div>
      <div class="value value-sm">${formatRupiah(totalPendapatan)}</div>
      <div class="sub">pembayaran terverifikasi</div>
    </div>
  `;
}

async function loadRecentBills() {
  const tableWrap = document.getElementById("recentBillsTable");
  const listWrap  = document.getElementById("recentBillsList");

  const { data, error } = await supabase
    .from("bills")
    .select("*, students(name), billing_types(name)")
    .not("status", "in", "(lunas,dibatalkan,dispensasi)")
    .order("due_date", { ascending: true })
    .limit(8);

  if (error || !data?.length) {
    const emptyHtml = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div class="empty-title">Semua tagihan lunas!</div>
        <div class="empty-desc">Tidak ada tagihan yang perlu ditagih saat ini.</div>
      </div>`;
    tableWrap.innerHTML = emptyHtml;
    listWrap.innerHTML  = emptyHtml;
    return;
  }

  // Desktop table
  tableWrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Siswa</th><th>Jenis Tagihan</th>
          <th>Sisa Tagihan</th><th>Jatuh Tempo</th><th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(b => {
          const sisa = Number(b.amount) - Number(b.amount_paid ?? 0);
          return `<tr>
            <td><strong>${b.students?.name ?? "-"}</strong></td>
            <td>${b.billing_types?.name ?? "-"}</td>
            <td>${formatRupiah(sisa)}</td>
            <td>${formatDate(b.due_date)}</td>
            <td>${statusBadge(b.status)}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;

  // Mobile card list
  listWrap.innerHTML = data.map(b => {
    const sisa = Number(b.amount) - Number(b.amount_paid ?? 0);
    return `
      <div class="card-list-item">
        <div class="cli-name">${b.students?.name ?? "-"}</div>
        <div class="cli-meta">
          <span>${b.billing_types?.name ?? "-"}</span>
          <span>Jatuh tempo: ${formatDate(b.due_date)}</span>
        </div>
        <div class="cli-footer">
          <span class="cli-amount">${formatRupiah(sisa)}</span>
          ${statusBadge(b.status)}
        </div>
      </div>`;
  }).join("");
}

async function loadRecentPayments() {
  const tableWrap = document.getElementById("recentPaymentsTable");
  const listWrap  = document.getElementById("recentPaymentsList");

  const { data, error } = await supabase
    .from("payments")
    .select("*, bills(students(name), billing_types(name))")
    .order("created_at", { ascending: false })
    .limit(8);

  if (error || !data?.length) {
    const emptyHtml = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
        </div>
        <div class="empty-title">Belum ada pembayaran</div>
        <div class="empty-desc">Pembayaran yang masuk akan muncul di sini.</div>
      </div>`;
    tableWrap.innerHTML = emptyHtml;
    listWrap.innerHTML  = emptyHtml;
    return;
  }

  const methodLabel = (m) => (m ?? "-").replace(/_/g, " ");

  // Desktop table
  tableWrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Siswa</th><th>Jumlah</th>
          <th>Metode</th><th>Tanggal</th><th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(p => `<tr>
          <td><strong>${p.bills?.students?.name ?? "-"}</strong></td>
          <td>${formatRupiah(p.amount)}</td>
          <td style="text-transform:capitalize">${methodLabel(p.method)}</td>
          <td>${formatDate(p.created_at)}</td>
          <td>${statusBadge(p.status)}</td>
        </tr>`).join("")}
      </tbody>
    </table>`;

  // Mobile card list
  listWrap.innerHTML = data.map(p => `
    <div class="card-list-item">
      <div class="cli-name">${p.bills?.students?.name ?? "-"}</div>
      <div class="cli-meta">
        <span style="text-transform:capitalize">${methodLabel(p.method)}</span>
        <span>${formatDate(p.created_at)}</span>
      </div>
      <div class="cli-footer">
        <span class="cli-amount">${formatRupiah(p.amount)}</span>
        ${statusBadge(p.status)}
      </div>
    </div>`).join("");
}
