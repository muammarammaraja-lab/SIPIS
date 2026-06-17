// ============================================================
// SFMS LITE — Pembayaran: input manual, upload bukti, verifikasi
// ============================================================

import { supabase } from "./supabaseClient.js";
import { requireAuth, applyRoleVisibility } from "./auth.js";
import { showToast, formatRupiah, formatDate, statusBadge, exportCSV, qs } from "./utils.js";

const auth = await requireAuth();
let mySchoolId = null;
let myUserId = null;
let currentHistoryData = [];

if (auth) {
  applyRoleVisibility(auth.profile);
  mySchoolId = auth.profile.school_id;
  myUserId = auth.profile.id;
  loadOpenBills();
  loadPending();
  loadHistory();
}

document.getElementById("btnExport").addEventListener("click", () => {
  if (currentHistoryData.length === 0) {
    showToast("Tidak ada data untuk diexport.", "error");
    return;
  }
  exportCSV(
    `pembayaran_${new Date().toISOString().slice(0, 10)}.csv`,
    ["Siswa", "Nominal", "Metode", "Status", "Tanggal"],
    currentHistoryData.map(p => [
      p.bills?.students?.name ?? "-", p.amount, p.method, p.status, p.created_at,
    ])
  );
});

document.getElementById("btnAdd").addEventListener("click", () => {
  document.getElementById("modalOverlay").style.display = "flex";
});
document.getElementById("btnCancel").addEventListener("click", () => {
  document.getElementById("modalOverlay").style.display = "none";
});

async function loadOpenBills() {
  const { data } = await supabase
    .from("bills")
    .select("id, amount, amount_paid, students(name)")
    .not("status", "in", "(lunas,dibatalkan)");
  const sel = document.getElementById("p_bill");
  sel.innerHTML = (data || []).map(b => {
    const sisa = Number(b.amount) - Number(b.amount_paid || 0);
    return `<option value="${b.id}">${b.students?.name ?? "-"} — sisa ${formatRupiah(sisa)}</option>`;
  }).join("");
}

async function loadPending() {
  const wrap = document.getElementById("pendingWrap");
  const { data, error } = await supabase
    .from("payments")
    .select("*, bills(students(name), amount, amount_paid)")
    .eq("status", "menunggu_verifikasi")
    .order("created_at", { ascending: false });

  if (error) { wrap.innerHTML = `<div class="empty-state">${error.message}</div>`; return; }
  if (!data || data.length === 0) { wrap.innerHTML = `<div class="empty-state">Tidak ada pembayaran menunggu verifikasi.</div>`; return; }

  wrap.innerHTML = `
    <table>
      <thead><tr><th>Siswa</th><th>Nominal</th><th>Metode</th><th>Bukti</th><th>Tanggal</th><th>Aksi</th></tr></thead>
      <tbody>
        ${data.map(p => `
          <tr>
            <td>${p.bills?.students?.name ?? "-"}</td>
            <td>${formatRupiah(p.amount)}</td>
            <td>${p.method}</td>
            <td>${p.proof_url ? `<a href="${p.proof_url}" target="_blank">Lihat</a>` : "-"}</td>
            <td>${formatDate(p.created_at)}</td>
            <td>
              <button class="btn btn-success btn-sm" data-verify="${p.id}">Terima</button>
              <button class="btn btn-danger btn-sm" data-reject="${p.id}">Tolak</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;

  wrap.querySelectorAll("[data-verify]").forEach(btn =>
    btn.addEventListener("click", () => verifyPayment(btn.dataset.verify, "diterima")));
  wrap.querySelectorAll("[data-reject]").forEach(btn =>
    btn.addEventListener("click", () => verifyPayment(btn.dataset.reject, "ditolak")));
}

async function verifyPayment(paymentId, decision) {
  const { data: payment } = await supabase.from("payments").select("*, bills(*)").eq("id", paymentId).single();
  if (!payment) return;

  await supabase.from("payments").update({
    status: decision, verified_by: myUserId, verified_at: new Date().toISOString(),
  }).eq("id", paymentId);

  if (decision === "diterima") {
    const bill = payment.bills;
    const newPaid = Number(bill.amount_paid || 0) + Number(payment.amount);
    const newStatus = newPaid >= Number(bill.amount) ? "lunas" : "sebagian_bayar";
    await supabase.from("bills").update({ amount_paid: newPaid, status: newStatus }).eq("id", bill.id);
  }

  showToast(decision === "diterima" ? "Pembayaran diterima." : "Pembayaran ditolak.", "success");
  loadPending();
  loadHistory();
  loadOpenBills();
}

async function loadHistory() {
  const wrap = document.getElementById("historyWrap");
  const { data, error } = await supabase
    .from("payments")
    .select("*, bills(students(name))")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) { wrap.innerHTML = `<div class="empty-state">${error.message}</div>`; return; }
  if (!data || data.length === 0) { wrap.innerHTML = `<div class="empty-state">Belum ada riwayat pembayaran.</div>`; currentHistoryData = []; return; }
  currentHistoryData = data;

  wrap.innerHTML = `
    <table>
      <thead><tr><th>Siswa</th><th>Nominal</th><th>Metode</th><th>Status</th><th>Tanggal</th></tr></thead>
      <tbody>
        ${data.map(p => `
          <tr>
            <td>${p.bills?.students?.name ?? "-"}</td>
            <td>${formatRupiah(p.amount)}</td>
            <td>${p.method}</td>
            <td>${statusBadge(p.status)}</td>
            <td>${formatDate(p.created_at)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
}

document.getElementById("paymentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const billId = qs("#p_bill").value;
  const amount = Number(qs("#p_amount").value);
  const method = qs("#p_method").value;
  const file = qs("#p_proof").files[0];

  let proofUrl = null;
  if (file) {
    const path = `${mySchoolId}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("payment-proofs").upload(path, file);
    if (uploadErr) {
      showToast("Gagal upload bukti: " + uploadErr.message, "error");
      return;
    }
    const { data: urlData } = supabase.storage.from("payment-proofs").getPublicUrl(path);
    proofUrl = urlData.publicUrl;
  }

  const { error } = await supabase.from("payments").insert({
    school_id: mySchoolId,
    bill_id: billId,
    amount,
    method,
    proof_url: proofUrl,
    status: "menunggu_verifikasi",
  });

  if (error) {
    showToast("Gagal menyimpan pembayaran: " + error.message, "error");
    return;
  }

  showToast("Pembayaran tercatat, menunggu verifikasi.", "success");
  document.getElementById("modalOverlay").style.display = "none";
  loadPending();
  loadHistory();
});
