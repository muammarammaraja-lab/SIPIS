// ============================================================
// SFMS LITE — Invoice publik (diakses orang tua via link unik,
// tanpa perlu login). Token diambil dari ?t=... di URL.
// ============================================================

import { supabase } from "./supabaseClient.js";
import { formatRupiah, formatDate, statusBadge, showToast } from "./utils.js";

const params = new URLSearchParams(window.location.search);
const token = params.get("t");

let currentBill = null;

if (!token) {
  showNotFound();
} else {
  loadInvoice(token);
}

async function loadInvoice(t) {
  const { data, error } = await supabase.rpc("get_invoice_by_token", { p_token: t });
  if (error || !data || data.length === 0) {
    showNotFound();
    return;
  }
  currentBill = data[0];
  renderInvoice(currentBill);
}

function renderInvoice(b) {
  document.getElementById("loadingState").style.display = "none";
  document.getElementById("invoiceContent").style.display = "block";

  document.getElementById("schoolName").textContent = b.school_name;
  document.getElementById("studentInfo").textContent = `Atas nama: ${b.student_name}`;
  document.getElementById("billingTypeName").textContent = b.billing_type_name;
  document.getElementById("period").textContent = b.period ?? "-";
  document.getElementById("dueDate").textContent = formatDate(b.due_date);
  document.getElementById("statusBadge").innerHTML = statusBadge(b.status);

  const remaining = Number(b.amount) - Number(b.amount_paid || 0);
  document.getElementById("remainingAmount").textContent = formatRupiah(remaining);
  document.getElementById("amountPaid").value = remaining > 0 ? remaining : "";

  if (b.status === "lunas") {
    document.getElementById("paymentSection").style.display = "none";
  }
}

function showNotFound() {
  document.getElementById("loadingState").style.display = "none";
  document.getElementById("notFoundState").style.display = "block";
}

document.getElementById("paymentForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentBill) return;

  const amount = Number(document.getElementById("amountPaid").value);
  const file = document.getElementById("proofFile").files[0];
  const submitBtn = e.target.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  submitBtn.textContent = "Mengirim...";

  try {
    let proofUrl = null;
    if (file) {
      const path = `public/${currentBill.bill_id}_${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("payment-proofs").upload(path, file);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("payment-proofs").getPublicUrl(path);
      proofUrl = urlData.publicUrl;
    }

    const { error } = await supabase.rpc("submit_invoice_payment", {
      p_token: token, p_amount: amount, p_proof_url: proofUrl,
    });
    if (error) throw error;

    showToast("Konfirmasi pembayaran terkirim. Terima kasih!", "success");
    document.getElementById("paymentSection").innerHTML =
      `<div class="panel-body"><div class="empty-state">Terima kasih, konfirmasi pembayaran sudah kami terima dan akan diverifikasi oleh bendahara.</div></div>`;
  } catch (err) {
    showToast("Gagal mengirim konfirmasi: " + err.message, "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "Kirim Konfirmasi";
  }
});
