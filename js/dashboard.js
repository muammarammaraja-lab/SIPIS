// ============================================================
// SFMS LITE — Dashboard logic
// ============================================================

import { supabase } from "./supabaseClient.js";
import { requireAuth } from "./auth.js";
import { formatRupiah } from "./utils.js";

const auth = await requireAuth();
if (auth) {
  loadStats();
  loadTopDebtors();
}

async function loadStats() {
  const { data: bills, error } = await supabase
    .from("bills")
    .select("amount, amount_paid, status");

  if (error) {
    console.error(error);
    return;
  }

  const totalTagihan = bills.reduce((s, b) => s + Number(b.amount), 0);
  const totalPembayaran = bills.reduce((s, b) => s + Number(b.amount_paid || 0), 0);
  const totalTunggakan = totalTagihan - totalPembayaran;
  const persentase = totalTagihan > 0 ? Math.round((totalPembayaran / totalTagihan) * 100) : 0;

  const cards = document.querySelectorAll("#statCards .card .value");
  cards[0].textContent = formatRupiah(totalTagihan);
  cards[1].textContent = formatRupiah(totalPembayaran);
  cards[2].textContent = formatRupiah(totalTunggakan);
  cards[3].textContent = persentase + "%";
}

async function loadTopDebtors() {
  const { data: bills, error } = await supabase
    .from("bills")
    .select("amount, amount_paid, students(name)")
    .neq("status", "lunas")
    .order("amount", { ascending: false })
    .limit(8);

  const container = document.getElementById("topDebtors");
  if (error || !bills || bills.length === 0) {
    container.innerHTML = `<div class="empty-state">Belum ada data tunggakan.</div>`;
    return;
  }

  const rows = bills.map(b => {
    const sisa = Number(b.amount) - Number(b.amount_paid || 0);
    return `<tr><td>${b.students?.name ?? "-"}</td><td>${formatRupiah(sisa)}</td></tr>`;
  }).join("");

  container.innerHTML = `
    <table>
      <thead><tr><th>Nama Siswa</th><th>Sisa Tagihan</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}
