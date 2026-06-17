// ============================================================
// SFMS LITE — Laporan PDF (ringkasan per kelas, detail, tunggakan)
// Menggunakan jsPDF + jspdf-autotable yang di-load dari CDN,
// dirender sepenuhnya di browser (tidak butuh server tambahan).
// ============================================================

import { supabase } from "./supabaseClient.js";
import { requireAuth, applyRoleVisibility } from "./auth.js";
import { showToast, formatRupiah, formatDate } from "./utils.js";

const auth = await requireAuth();
let schoolName = "Sekolah";

if (auth) {
  applyRoleVisibility(auth.profile);
  schoolName = auth.profile.schools?.name ?? "Sekolah";
  loadPreview();
}

document.getElementById("btnGenerate").addEventListener("click", generatePdf);

async function fetchBills(period) {
  let query = supabase
    .from("bills")
    .select("amount, amount_paid, period, due_date, status, students(name, classes(name)), billing_types(name)");
  if (period) query = query.eq("period", period);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

function aggregateByClass(bills) {
  const map = {};
  bills.forEach(b => {
    const kelas = b.students?.classes?.name ?? "Tanpa Kelas";
    if (!map[kelas]) map[kelas] = { kelas, jumlahSiswa: new Set(), totalTagihan: 0, totalTerbayar: 0 };
    map[kelas].jumlahSiswa.add(b.students?.name);
    map[kelas].totalTagihan += Number(b.amount);
    map[kelas].totalTerbayar += Number(b.amount_paid || 0);
  });
  return Object.values(map).map(r => ({
    kelas: r.kelas,
    jumlahSiswa: r.jumlahSiswa.size,
    totalTagihan: r.totalTagihan,
    totalTerbayar: r.totalTerbayar,
    totalTunggakan: r.totalTagihan - r.totalTerbayar,
  }));
}

async function loadPreview() {
  const wrap = document.getElementById("previewWrap");
  try {
    const bills = await fetchBills(null);
    const rows = aggregateByClass(bills);
    if (rows.length === 0) {
      wrap.innerHTML = `<div class="empty-state">Belum ada data tagihan.</div>`;
      return;
    }
    wrap.innerHTML = `
      <table>
        <thead><tr><th>Kelas</th><th>Jumlah Siswa</th><th>Total Tagihan</th><th>Total Terbayar</th><th>Total Tunggakan</th></tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${r.kelas}</td><td>${r.jumlahSiswa}</td>
              <td>${formatRupiah(r.totalTagihan)}</td><td>${formatRupiah(r.totalTerbayar)}</td><td>${formatRupiah(r.totalTunggakan)}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

async function generatePdf() {
  const statusText = document.getElementById("statusText");
  const reportType = document.getElementById("reportType").value;
  const period = document.getElementById("reportPeriod").value.trim() || null;

  statusText.textContent = "Menyiapkan PDF...";

  try {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import("https://esm.sh/jspdf@2.5.2"),
      import("https://esm.sh/jspdf-autotable@3.8.4?deps=jspdf@2.5.2"),
    ]);

    const bills = await fetchBills(period);
    const doc = new jsPDF();
    const today = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });

    doc.setFontSize(14);
    doc.text(schoolName, 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);

    let head, body, title;

    if (reportType === "ringkasan") {
      title = "Laporan Ringkasan Keuangan per Kelas";
      const rows = aggregateByClass(bills);
      head = [["Kelas", "Jumlah Siswa", "Total Tagihan", "Total Terbayar", "Total Tunggakan"]];
      body = rows.map(r => [r.kelas, r.jumlahSiswa, formatRupiah(r.totalTagihan), formatRupiah(r.totalTerbayar), formatRupiah(r.totalTunggakan)]);
    } else if (reportType === "tunggakan") {
      title = "Laporan Daftar Tunggakan";
      const filtered = bills.filter(b => !["lunas", "dibatalkan"].includes(b.status));
      head = [["Siswa", "Kelas", "Sisa Tagihan", "Jatuh Tempo", "Status"]];
      body = filtered.map(b => [
        b.students?.name ?? "-", b.students?.classes?.name ?? "-",
        formatRupiah(Number(b.amount) - Number(b.amount_paid || 0)), formatDate(b.due_date), b.status,
      ]);
    } else {
      title = "Laporan Detail Seluruh Tagihan";
      head = [["Siswa", "Kelas", "Jenis", "Periode", "Nominal", "Terbayar", "Status"]];
      body = bills.map(b => [
        b.students?.name ?? "-", b.students?.classes?.name ?? "-", b.billing_types?.name ?? "-",
        b.period ?? "-", formatRupiah(b.amount), formatRupiah(b.amount_paid), b.status,
      ]);
    }

    doc.text(`${title}${period ? " — Periode " + period : ""}`, 14, 25);
    doc.text(`Dicetak: ${today}`, 14, 30);

    autoTable(doc, {
      head, body, startY: 36,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [31, 56, 100] },
      alternateRowStyles: { fillColor: [244, 246, 248] },
    });

    doc.save(`laporan_${reportType}_${new Date().toISOString().slice(0, 10)}.pdf`);
    statusText.textContent = "PDF berhasil dibuat dan diunduh.";
  } catch (err) {
    console.error(err);
    statusText.textContent = "Gagal membuat PDF: " + err.message;
    showToast("Gagal membuat PDF: " + err.message, "error");
  }
}
