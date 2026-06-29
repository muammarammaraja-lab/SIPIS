// ============================================================
// SFMS LITE — Dashboard v2.0
// Summary cards + recent bills + recent payments
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
  loadSummaryCards();
  loadRecentBills();
  loadRecentPayments();
}

async function loadSummaryCards() {
  const wrap = document.getElementById("summaryCards");

  // Fetch data parallel
  const [siswRes, tagihanRes, pembayaranRes] = await Promise.all([
    supabase.from("students").select("id, status"),
    supabase.from("bills").select("id, amount, amount_paid, status"),
    supabase.from("payments").select("id, amount, status, created_at"),
  ]);

  const siswa = siswRes.data ?? [];
  const tagihan = tagihanRes.data ?? [];
  const pembayaran = pembayaranRes.data ?? [];

  const totalSiswa = siswa.filter(s => s.status === "aktif").length;
  const totalTagihan = tagihan.length;
  const tagihanBelumLunas = tagihan.filter(b => b.status === "aktif").length;
  const totalPendapatan = pembayaran
    .filter(p => p.status === "diterima")
    .reduce((s, p) => s + Number(p.amount), 0);
  const tagihanLunas = tagihan.filter(b => b.status === "lunas").length;

  wrap.innerHTML = `
    <div class="card">
      <div class="card-icon">👨‍🎓</div>
      <div class="label">Siswa Aktif</div>
      <div class="value">${totalSiswa}</div>
      <div class="sub">terdaftar di sistem</div>
    </div>
    <div class="card green">
      <div class="card-icon">✅</div>
      <div class="label">Tagihan Lunas</div>
      <div class="value">${tagihanLunas}</div>
      <div class="sub">dari ${totalTagihan} tagihan</div>
    </div>
    <div class="card amber">
      <div class="card-icon">⏳</div>
      <div class="label">Belum Lunas</div>
      <div class="value">${tagihanBelumLunas}</div>
      <div class="sub">perlu ditindaklanjuti</div>
    </div>
    <div class="card">
      <div class="card-icon">💰</div>
      <div class="label">Total Terkumpul</div>
      <div class="value" style="font-size:16px">${formatRupiah(totalPendapatan)}</div>
      <div class="sub">dari pembayaran terverifikasi</div>
    </div>
  `;
}

async function loadRecentBills() {
  const wrap = document.getElementById("recentBillsWrap");
  showSkeleton(wrap, 5);

  const { data, error } = await supabase
    .from("bills")
    .select("*, students(name), billing_types(name)")
    .not("status", "in", "(lunas,dibatalkan,dispensasi)")
    .order("due_date", { ascending: true })
    .limit(8);

  if (error || !data?.length) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎉</div>
        <div class="empty-title">Semua tagihan lunas!</div>
        <div class="empty-desc">Tidak ada tagihan yang perlu ditagih saat ini.</div>
      </div>`;
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead><tr><th>Siswa</th><th>Jenis Tagihan</th><th>Nominal</th><th>Jatuh Tempo</th><th>Status</th></tr></thead>
      <tbody>
        ${data.map(b => `
          <tr>
            <td><strong>${b.students?.name ?? "-"}</strong></td>
            <td>${b.billing_types?.name ?? "-"}</td>
            <td>${formatRupiah(Number(b.amount) - Number(b.amount_paid))}</td>
            <td>${formatDate(b.due_date)}</td>
            <td>${statusBadge(b.status)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
}

async function loadRecentPayments() {
  const wrap = document.getElementById("recentPaymentsWrap");
  showSkeleton(wrap, 5);

  const { data, error } = await supabase
    .from("payments")
    .select("*, bills(students(name), billing_types(name))")
    .order("created_at", { ascending: false })
    .limit(8);

  if (error || !data?.length) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-title">Belum ada pembayaran</div>
        <div class="empty-desc">Pembayaran yang masuk akan muncul di sini.</div>
      </div>`;
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead><tr><th>Siswa</th><th>Jumlah</th><th>Metode</th><th>Tanggal</th><th>Status</th></tr></thead>
      <tbody>
        ${data.map(p => `
          <tr>
            <td><strong>${p.bills?.students?.name ?? "-"}</strong></td>
            <td>${formatRupiah(p.amount)}</td>
            <td style="text-transform:capitalize">${p.method?.replace("_", " ") ?? "-"}</td>
            <td>${formatDate(p.created_at)}</td>
            <td>${statusBadge(p.status)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
}
