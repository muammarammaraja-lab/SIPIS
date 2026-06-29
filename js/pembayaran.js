// ============================================================
// SFMS LITE — Pembayaran v3.1
// Mobile card list + desktop table dual render
// ============================================================
import { supabase } from "./supabaseClient.js";
import { requireAuth, applyRoleVisibility } from "./auth.js";
import { showToast, formatRupiah, formatDate, statusBadge, exportCSV, confirmDialog } from "./utils.js";

const auth = await requireAuth();
if (!auth) throw new Error("Unauthenticated");
const { session, profile } = auth;
applyRoleVisibility(profile);

// ── Elements ──────────────────────────────────────────────
const tableWrap  = document.getElementById("paymentTableWrap");
const cardList   = document.getElementById("paymentCardList");
const filterEl   = document.getElementById("filterStatus");
const btnExport  = document.getElementById("btnExport");
const btnAdd     = document.getElementById("btnAdd");
const modalOv    = document.getElementById("modalOverlay");
const detailOv   = document.getElementById("detailModalOverlay");
const detailCont = document.getElementById("detailContent");
const detailAct  = document.getElementById("detailActions");
const form       = document.getElementById("paymentForm");

// ── Load daftar pembayaran ────────────────────────────────
async function loadPayments() {
  tableWrap.innerHTML = `<div class="skeleton skeleton-row"></div>
    <div class="skeleton skeleton-row"></div>
    <div class="skeleton skeleton-row"></div>`;
  cardList.innerHTML = "";

  let q = supabase
    .from("payments")
    .select("*, bills(*, students(name), billing_types(name))")
    .order("created_at", { ascending: false })
    .limit(200);

  const fv = filterEl?.value;
  if (fv) q = q.eq("status", fv);

  const { data, error } = await q;

  if (error) {
    tableWrap.innerHTML = `<div class="empty-state"><div class="empty-title">Gagal memuat</div><div class="empty-desc">${error.message}</div></div>`;
    return;
  }
  if (!data?.length) {
    const empty = `<div class="empty-state">
      <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
      <div class="empty-title">Belum ada pembayaran</div>
      <div class="empty-desc">Pembayaran yang masuk akan muncul di sini.</div>
    </div>`;
    tableWrap.innerHTML = cardList.innerHTML = empty;
    return;
  }

  // Desktop table
  tableWrap.innerHTML = `
    <table>
      <thead><tr>
        <th>Tanggal</th><th>Siswa</th><th>Tagihan</th>
        <th>Jumlah</th><th>Metode</th><th>Status</th><th></th>
      </tr></thead>
      <tbody>
        ${data.map(p => {
          const b = p.bills ?? {};
          return `<tr>
            <td>${formatDate(p.created_at)}</td>
            <td><strong>${b.students?.name ?? "-"}</strong></td>
            <td>${b.billing_types?.name ?? "-"}${b.period ? ` — ${b.period}` : ""}</td>
            <td>${formatRupiah(p.amount)}</td>
            <td style="text-transform:capitalize">${(p.method ?? "-").replace(/_/g," ")}</td>
            <td>${statusBadge(p.status)}</td>
            <td><button class="btn btn-ghost btn-sm" data-detail="${p.id}">Detail</button></td>
          </tr>`;
        }).join("")}
      </tbody>
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
        <div style="display:flex;align-items:center;gap:8px">
          ${statusBadge(p.status)}
          <button class="btn btn-ghost btn-sm" data-detail="${p.id}">Detail</button>
        </div>
      </div>
    </div>`;
  }).join("");

  // Attach detail listeners
  document.querySelectorAll("[data-detail]").forEach(btn => {
    btn.addEventListener("click", () => openDetail(btn.dataset.detail));
  });
}

// ── Detail modal ──────────────────────────────────────────
async function openDetail(id) {
  detailCont.innerHTML = `<div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div>`;
  detailAct.innerHTML  = "";
  detailOv.style.display = "flex";

  const { data: p, error } = await supabase
    .from("payments")
    .select("*, bills(*, students(name), billing_types(name))")
    .eq("id", id)
    .single();

  if (error || !p) {
    detailCont.innerHTML = `<p style="color:var(--red)">Gagal memuat data.</p>`;
    return;
  }

  const b = p.bills ?? {};
  const proofHtml = p.proof_url
    ? `<a href="${p.proof_url}" target="_blank" style="display:block;margin-top:8px">
        <img src="${p.proof_url}" style="max-width:100%;border-radius:8px" />
       </a>`
    : `<em style="color:var(--grey-400)">Tidak ada bukti</em>`;

  detailCont.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13.5px">
      <tr><td style="padding:7px 0;color:var(--grey-500);width:130px">Siswa</td><td><strong>${b.students?.name ?? "-"}</strong></td></tr>
      <tr><td style="padding:7px 0;color:var(--grey-500)">Tagihan</td><td>${b.billing_types?.name ?? "-"}${b.period ? ` — ${b.period}` : ""}</td></tr>
      <tr><td style="padding:7px 0;color:var(--grey-500)">Jumlah</td><td>${formatRupiah(p.amount)}</td></tr>
      <tr><td style="padding:7px 0;color:var(--grey-500)">Metode</td><td style="text-transform:capitalize">${(p.method ?? "-").replace(/_/g," ")}</td></tr>
      <tr><td style="padding:7px 0;color:var(--grey-500)">Status</td><td>${statusBadge(p.status)}</td></tr>
      <tr><td style="padding:7px 0;color:var(--grey-500)">Tanggal</td><td>${formatDate(p.created_at)}</td></tr>
      <tr><td style="padding:7px 0;color:var(--grey-500)">Catatan</td><td>${p.note || "-"}</td></tr>
    </table>
    <div style="margin-top:12px"><strong style="font-size:13px">Bukti Bayar:</strong><br>${proofHtml}</div>`;

  const canVerify = ["kepala_sekolah","bendahara","admin_keuangan"].includes(profile.role);
  if (canVerify && p.status === "menunggu_verifikasi") {
    detailAct.innerHTML = `
      <button class="btn btn-ghost" id="btnTolak">Tolak</button>
      <button class="btn btn-primary" id="btnVerif">Verifikasi ✓</button>`;
    document.getElementById("btnTolak").onclick = () => verifyPayment(id, p.bill_id, p.amount, "ditolak");
    document.getElementById("btnVerif").onclick = () => verifyPayment(id, p.bill_id, p.amount, "diterima");
  }
}

async function verifyPayment(id, bill_id, amount, status) {
  const ok = await confirmDialog(
    status === "diterima" ? "Verifikasi pembayaran ini sebagai diterima?" : "Tolak pembayaran ini?",
    status === "diterima" ? "Verifikasi" : "Tolak"
  );
  if (!ok) return;

  const { error } = await supabase.from("payments").update({ status }).eq("id", id);
  if (error) { showToast("Gagal: " + error.message, "error"); return; }

  if (status === "diterima" && bill_id) {
    await supabase.from("bills")
      .update({ status: "lunas", amount_paid: amount })
      .eq("id", bill_id);
  }

  showToast(status === "diterima" ? "Pembayaran diverifikasi." : "Pembayaran ditolak.", "success");
  closeDetail();
  loadPayments();
}

// ── Catat manual ─────────────────────────────────────────
btnAdd?.addEventListener("click", async () => {
  await loadOpenBills();
  form?.reset();
  modalOv.style.display = "flex";
});

async function loadOpenBills() {
  const sel = document.getElementById("f_bill_id");
  if (!sel) return;
  sel.innerHTML = `<option value="">Memuat...</option>`;

  const { data } = await supabase
    .from("bills")
    .select("id, period, amount, students(name), billing_types(name)")
    .neq("status","lunas")
    .order("created_at", { ascending: false })
    .limit(200);

  sel.innerHTML = `<option value="">-- Pilih Tagihan --</option>`;
  (data ?? []).forEach(b => {
    const label = `${b.students?.name ?? "?"} — ${b.billing_types?.name ?? "?"} ${b.period ?? ""}`;
    sel.innerHTML += `<option value="${b.id}" data-amount="${b.amount}">${label} (${formatRupiah(b.amount)})</option>`;
  });

  // Auto-fill jumlah saat tagihan dipilih
  sel.onchange = () => {
    const opt = sel.selectedOptions[0];
    const amountEl = document.getElementById("f_amount");
    if (opt?.dataset.amount && amountEl) amountEl.value = opt.dataset.amount;
  };
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const bill_id = document.getElementById("f_bill_id")?.value;
  const amount  = Number(document.getElementById("f_amount")?.value);
  const method  = document.getElementById("f_method")?.value;
  const note    = document.getElementById("f_note")?.value;
  const file    = document.getElementById("f_proof")?.files[0];

  if (!bill_id || !amount) { showToast("Tagihan dan jumlah wajib diisi.", "error"); return; }

  let proof_url = null;
  if (file) {
    const ext  = file.name.split(".").pop();
    const path = `proofs/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("payments").upload(path, file);
    if (!upErr) {
      const { data: urlData } = supabase.storage.from("payments").getPublicUrl(path);
      proof_url = urlData.publicUrl;
    }
  }

  const { error } = await supabase.from("payments").insert({
    bill_id, amount, method, note, proof_url,
    status: "diterima",
    created_by: session.user.id,
  });
  if (error) { showToast("Gagal menyimpan: " + error.message, "error"); return; }

  await supabase.from("bills")
    .update({ status: "lunas", amount_paid: amount })
    .eq("id", bill_id);

  showToast("Pembayaran berhasil dicatat.", "success");
  closeModal();
  loadPayments();
});

// ── Export CSV ────────────────────────────────────────────
btnExport?.addEventListener("click", async () => {
  const { data } = await supabase
    .from("payments")
    .select("*, bills(period, students(name), billing_types(name))")
    .order("created_at", { ascending: false });

  exportCSV(
    `pembayaran_${new Date().toISOString().slice(0,10)}.csv`,
    ["Tanggal","Siswa","Jenis Tagihan","Periode","Jumlah","Metode","Status","Catatan"],
    (data ?? []).map(p => {
      const b = p.bills ?? {};
      return [
        formatDate(p.created_at),
        b.students?.name ?? "",
        b.billing_types?.name ?? "",
        b.period ?? "",
        p.amount,
        p.method ?? "",
        p.status,
        p.note ?? "",
      ];
    })
  );
});

// ── Close handlers ────────────────────────────────────────
function closeModal()  { modalOv.style.display  = "none"; }
function closeDetail() { detailOv.style.display = "none"; }

document.getElementById("btnCancel")?.addEventListener("click",  closeModal);
document.getElementById("btnCancel2")?.addEventListener("click", closeModal);
document.getElementById("btnCloseDetail")?.addEventListener("click", closeDetail);
filterEl?.addEventListener("change", loadPayments);

// ── Init ──────────────────────────────────────────────────
loadPayments();
