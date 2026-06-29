// ============================================================
// SFMS LITE — Laporan Keuangan Handler
// ============================================================
import { supabase } from "./supabaseClient.js";
import { requireAuth, applyRoleVisibility } from "./auth.js";

const { session, profile } = await requireAuth();
applyRoleVisibility(profile.role);

// School name & user info
const { data: schoolData } = await supabase.from("settings").select("value").eq("key","school_name").single();
document.querySelectorAll("[data-school-name]").forEach(el => el.textContent = schoolData?.value ?? "SFMS Lite");
document.querySelectorAll("[data-user-name]").forEach(el => el.textContent = profile.full_name ?? profile.email);
document.querySelectorAll("[data-user-role]").forEach(el => el.textContent = profile.role ?? "");
document.querySelectorAll("[data-logout]").forEach(btn => btn.addEventListener("click", async () => {
  await supabase.auth.signOut(); window.location.href = "index.html";
}));

// ── Elements ──────────────────────────────────────────────
const cardsEl      = document.getElementById("laporanCards");
const tableWrap    = document.getElementById("laporanTableWrap");
const cardList     = document.getElementById("laporanCardList");
const filterMonth  = document.getElementById("filterMonth");
const btnExport    = document.getElementById("btnExport");

// ── Helpers ───────────────────────────────────────────────
const rp      = v => "Rp" + Number(v||0).toLocaleString("id-ID");
const fmtDate = s => s ? new Date(s).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}) : "-";

// Set default bulan ke bulan ini
const now = new Date();
filterMonth.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

// ── Load summary cards ────────────────────────────────────
async function loadCards(monthVal) {
  cardsEl.innerHTML = `
    <div class="skeleton skeleton-card"></div>
    <div class="skeleton skeleton-card"></div>
    <div class="skeleton skeleton-card"></div>`;

  let q = supabase.from("payments").select("amount, status, created_at").eq("status","diterima");
  if (monthVal) {
    const [y, m] = monthVal.split("-");
    const from = `${y}-${m}-01`;
    const toDate = new Date(y, m, 0);
    const to = `${y}-${m}-${String(toDate.getDate()).padStart(2,"0")}T23:59:59`;
    q = q.gte("created_at", from).lte("created_at", to);
  }
  const { data: paid } = await q;

  const totalMasuk = (paid ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const jmlTransaksi = (paid ?? []).length;

  // Tagihan belum lunas (tidak filter bulan — global)
  const { count: belumLunas } = await supabase
    .from("bills").select("id", { count: "exact", head: true }).neq("status","lunas");

  cardsEl.innerHTML = `
    <div class="card-stat">
      <div class="card-stat-icon" style="color:var(--green)">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      </div>
      <div class="card-stat-label">Total Terkumpul${monthVal ? " (bulan ini)" : ""}</div>
      <div class="card-stat-value">${rp(totalMasuk)}</div>
    </div>
    <div class="card-stat">
      <div class="card-stat-icon" style="color:var(--blue)">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
      </div>
      <div class="card-stat-label">Transaksi Diterima${monthVal ? " (bulan ini)" : ""}</div>
      <div class="card-stat-value">${jmlTransaksi}</div>
    </div>
    <div class="card-stat">
      <div class="card-stat-icon" style="color:var(--orange)">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <div class="card-stat-label">Tagihan Belum Lunas</div>
      <div class="card-stat-value">${belumLunas ?? 0}</div>
    </div>`;
}

// ── Load tabel laporan ────────────────────────────────────
async function loadTable(monthVal) {
  tableWrap.innerHTML = '<div class="skeleton" style="height:200px"></div>';
  cardList.innerHTML  = "";

  let q = supabase
    .from("payments")
    .select(`id, amount, method, status, created_at,
             bills(period, students(full_name, kelas), fee_types(name))`)
    .eq("status","diterima")
    .order("created_at", { ascending: false });

  if (monthVal) {
    const [y, m] = monthVal.split("-");
    const from = `${y}-${m}-01`;
    const toDate = new Date(y, m, 0);
    const to = `${y}-${m}-${String(toDate.getDate()).padStart(2,"0")}T23:59:59`;
    q = q.gte("created_at", from).lte("created_at", to);
  }

  const { data, error } = await q;
  if (error) {
    tableWrap.innerHTML = `<p style="color:var(--red)">Error: ${error.message}</p>`;
    return;
  }

  if (!data?.length) {
    tableWrap.innerHTML = '<p style="padding:24px;color:var(--neutral-500)">Tidak ada data untuk periode ini.</p>';
    cardList.innerHTML  = '<p style="padding:24px;color:var(--neutral-500)">Tidak ada data untuk periode ini.</p>';
    return;
  }

  // Table (desktop)
  const rows = data.map(p => {
    const b = p.bills ?? {};
    return `<tr>
      <td>${fmtDate(p.created_at)}</td>
      <td>${b.students?.full_name ?? "-"}</td>
      <td>${b.students?.kelas ?? "-"}</td>
      <td>${b.fee_types?.name ?? "-"}</td>
      <td>${b.period ?? "-"}</td>
      <td>${rp(p.amount)}</td>
      <td>${p.method ?? "-"}</td>
    </tr>`;
  }).join("");

  const total = data.reduce((s, p) => s + Number(p.amount), 0);

  tableWrap.innerHTML = `
    <table>
      <thead><tr>
        <th>Tanggal</th><th>Siswa</th><th>Kelas</th>
        <th>Jenis</th><th>Periode</th><th>Jumlah</th><th>Metode</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr>
        <td colspan="5" style="text-align:right;font-weight:600;padding:10px 12px">Total</td>
        <td style="font-weight:700;padding:10px 12px">${rp(total)}</td>
        <td></td>
      </tr></tfoot>
    </table>`;

  // Cards (mobile)
  cardList.innerHTML = data.map(p => {
    const b = p.bills ?? {};
    return `<div class="card-item">
      <div class="card-item-header">
        <strong>${b.students?.full_name ?? "-"}</strong>
        <span class="badge badge-success">Diterima</span>
      </div>
      <div class="card-item-meta">${b.fee_types?.name ?? "-"} — ${b.period ?? "-"} · ${b.students?.kelas ?? "-"}</div>
      <div class="card-item-footer">
        <span class="card-item-amount">${rp(p.amount)}</span>
        <span style="color:var(--neutral-500);font-size:13px">${fmtDate(p.created_at)}</span>
      </div>
    </div>`;
  }).join("");
}

// ── Export CSV ────────────────────────────────────────────
btnExport?.addEventListener("click", async () => {
  const monthVal = filterMonth.value;
  let q = supabase
    .from("payments")
    .select(`amount, method, created_at,
             bills(period, students(full_name, kelas), fee_types(name))`)
    .eq("status","diterima")
    .order("created_at", { ascending: false });

  if (monthVal) {
    const [y, m] = monthVal.split("-");
    const from = `${y}-${m}-01`;
    const toDate = new Date(y, m, 0);
    const to = `${y}-${m}-${String(toDate.getDate()).padStart(2,"0")}T23:59:59`;
    q = q.gte("created_at", from).lte("created_at", to);
  }

  const { data } = await q;
  const rows = [["Tanggal","Siswa","Kelas","Jenis Tagihan","Periode","Jumlah","Metode"]];
  (data ?? []).forEach(p => {
    const b = p.bills ?? {};
    rows.push([
      fmtDate(p.created_at),
      b.students?.full_name ?? "",
      b.students?.kelas ?? "",
      b.fee_types?.name ?? "",
      b.period ?? "",
      p.amount,
      p.method ?? ""
    ]);
  });

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `laporan_${monthVal || "semua"}.csv`;
  a.click();
});

// ── Filter bulan ──────────────────────────────────────────
filterMonth?.addEventListener("change", () => {
  const v = filterMonth.value;
  loadCards(v);
  loadTable(v);
});

// ── Init ──────────────────────────────────────────────────
const initMonth = filterMonth.value;
loadCards(initMonth);
loadTable(initMonth);
