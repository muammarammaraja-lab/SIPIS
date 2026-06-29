// ============================================================
// SFMS LITE — Pembayaran Handler
// ============================================================
import { supabase } from "./supabaseClient.js";
import { requireAuth, applyRoleVisibility } from "./auth.js";

const { session, profile } = await requireAuth();
applyRoleVisibility(profile.role);

// Populate school name
const { data: schoolData } = await supabase.from("settings").select("value").eq("key","school_name").single();
document.querySelectorAll("[data-school-name]").forEach(el => el.textContent = schoolData?.value ?? "SFMS Lite");
document.querySelectorAll("[data-user-name]").forEach(el => el.textContent = profile.full_name ?? profile.email);
document.querySelectorAll("[data-user-role]").forEach(el => el.textContent = profile.role ?? "");
document.querySelectorAll("[data-logout]").forEach(btn => btn.addEventListener("click", async () => {
  await supabase.auth.signOut(); window.location.href = "index.html";
}));

// ── Elements ──────────────────────────────────────────────
const tableWrap   = document.getElementById("paymentTableWrap");
const cardList    = document.getElementById("paymentCardList");
const filterEl    = document.getElementById("filterStatus");
const btnExport   = document.getElementById("btnExport");
const btnAdd      = document.getElementById("btnAdd");
const modalOv     = document.getElementById("modalOverlay");
const detailOv    = document.getElementById("detailModalOverlay");
const detailCont  = document.getElementById("detailContent");
const detailAct   = document.getElementById("detailActions");
const form        = document.getElementById("paymentForm");

// ── Format helpers ────────────────────────────────────────
const rp  = v => "Rp" + Number(v||0).toLocaleString("id-ID");
const fmtDate = s => s ? new Date(s).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}) : "-";
const statusLabel = s => ({
  menunggu_verifikasi: '<span class="badge badge-warning">Menunggu</span>',
  diterima:            '<span class="badge badge-success">Diterima</span>',
  ditolak:             '<span class="badge badge-danger">Ditolak</span>',
}[s] ?? `<span class="badge">${s}</span>`);

// ── Load payments ─────────────────────────────────────────
async function loadPayments() {
  tableWrap.innerHTML = '<div class="skeleton" style="height:200px"></div>';
  cardList.innerHTML  = "";

  let q = supabase
    .from("payments")
    .select(`id, amount, method, status, proof_url, note, created_at,
             bills(id, amount, period, students(full_name), fee_types(name))`)
    .order("created_at", { ascending: false });

  const fv = filterEl.value;
  if (fv) q = q.eq("status", fv);

  const { data, error } = await q;
  if (error) { tableWrap.innerHTML = `<p style="color:var(--red)">Error: ${error.message}</p>`; return; }

  if (!data.length) {
    tableWrap.innerHTML = '<p style="padding:24px;color:var(--neutral-500)">Belum ada pembayaran.</p>';
    cardList.innerHTML  = '<p style="padding:24px;color:var(--neutral-500)">Belum ada pembayaran.</p>';
    return;
  }

  // Table (desktop)
  let rows = data.map(p => {
    const b = p.bills ?? {};
    const siswa = b.students?.full_name ?? "-";
    const jenis = b.fee_types?.name ?? "-";
    return `<tr>
      <td>${fmtDate(p.created_at)}</td>
      <td>${siswa}</td>
      <td>${jenis} — ${b.period ?? "-"}</td>
      <td>${rp(p.amount)}</td>
      <td>${p.method ?? "-"}</td>
      <td>${statusLabel(p.status)}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="openDetail('${p.id}')">Detail</button></td>
    </tr>`;
  }).join("");

  tableWrap.innerHTML = `
    <table>
      <thead><tr>
        <th>Tanggal</th><th>Siswa</th><th>Tagihan</th>
        <th>Jumlah</th><th>Metode</th><th>Status</th><th></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  // Cards (mobile)
  cardList.innerHTML = data.map(p => {
    const b = p.bills ?? {};
    const siswa = b.students?.full_name ?? "-";
    const jenis = b.fee_types?.name ?? "-";
    return `<div class="card-item">
      <div class="card-item-header">
        <strong>${siswa}</strong>
        ${statusLabel(p.status)}
      </div>
      <div class="card-item-meta">${jenis} — ${b.period ?? "-"}</div>
      <div class="card-item-meta">${fmtDate(p.created_at)} · ${p.method ?? "-"}</div>
      <div class="card-item-footer">
        <span class="card-item-amount">${rp(p.amount)}</span>
        <button class="btn btn-ghost btn-sm" onclick="openDetail('${p.id}')">Detail</button>
      </div>
    </div>`;
  }).join("");
}

// ── Detail modal ──────────────────────────────────────────
window.openDetail = async (id) => {
  detailCont.innerHTML = '<div class="skeleton" style="height:150px"></div>';
  detailAct.innerHTML  = "";
  detailOv.style.display = "flex";

  const { data: p, error } = await supabase
    .from("payments")
    .select(`*, bills(id, amount, period, students(full_name), fee_types(name))`)
    .eq("id", id)
    .single();

  if (error || !p) { detailCont.innerHTML = `<p>Gagal memuat data.</p>`; return; }

  const b = p.bills ?? {};
  const proofHtml = p.proof_url
    ? `<a href="${p.proof_url}" target="_blank"><img src="${p.proof_url}" style="max-width:100%;border-radius:8px;margin-top:8px" /></a>`
    : "<em>Tidak ada bukti</em>";

  detailCont.innerHTML = `
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:6px 0;color:var(--neutral-500);width:120px">Siswa</td><td>${b.students?.full_name ?? "-"}</td></tr>
      <tr><td style="padding:6px 0;color:var(--neutral-500)">Tagihan</td><td>${b.fee_types?.name ?? "-"} — ${b.period ?? "-"}</td></tr>
      <tr><td style="padding:6px 0;color:var(--neutral-500)">Jumlah</td><td>${rp(p.amount)}</td></tr>
      <tr><td style="padding:6px 0;color:var(--neutral-500)">Metode</td><td>${p.method ?? "-"}</td></tr>
      <tr><td style="padding:6px 0;color:var(--neutral-500)">Status</td><td>${statusLabel(p.status)}</td></tr>
      <tr><td style="padding:6px 0;color:var(--neutral-500)">Tanggal</td><td>${fmtDate(p.created_at)}</td></tr>
      <tr><td style="padding:6px 0;color:var(--neutral-500)">Catatan</td><td>${p.note || "-"}</td></tr>
    </table>
    <div style="margin-top:12px"><strong>Bukti Bayar:</strong><br>${proofHtml}</div>`;

  // Actions for verifier roles
  const canVerify = ["kepala_sekolah","bendahara","admin_keuangan"].includes(profile.role);
  if (canVerify && p.status === "menunggu_verifikasi") {
    detailAct.innerHTML = `
      <button class="btn btn-ghost" onclick="verifyPayment('${id}','ditolak')">Tolak</button>
      <button class="btn btn-primary" onclick="verifyPayment('${id}','diterima')">Verifikasi ✓</button>`;
  }
};

window.verifyPayment = async (id, status) => {
  const { error } = await supabase.from("payments").update({ status }).eq("id", id);
  if (error) { showToast("Gagal memperbarui status.", "error"); return; }

  // If accepted, mark bill as lunas
  if (status === "diterima") {
    const { data: p } = await supabase.from("payments").select("bill_id, amount").eq("id", id).single();
    if (p) {
      await supabase.from("bills").update({ status: "lunas", paid_amount: p.amount }).eq("id", p.bill_id);
    }
  }

  showToast(status === "diterima" ? "Pembayaran diverifikasi." : "Pembayaran ditolak.");
  closeDetail();
  loadPayments();
};

// ── Add manual payment ────────────────────────────────────
btnAdd?.addEventListener("click", async () => {
  await loadOpenBills();
  form.reset();
  modalOv.style.display = "flex";
});

async function loadOpenBills() {
  const sel = document.getElementById("f_bill_id");
  sel.innerHTML = '<option value="">Memuat...</option>';
  const { data } = await supabase
    .from("bills")
    .select("id, period, amount, students(full_name), fee_types(name)")
    .neq("status","lunas")
    .order("created_at", { ascending: false });

  sel.innerHTML = '<option value="">-- Pilih Tagihan --</option>';
  (data ?? []).forEach(b => {
    const label = `${b.students?.full_name ?? "?"} — ${b.fee_types?.name ?? "?"} ${b.period ?? ""}`;
    sel.innerHTML += `<option value="${b.id}">${label} (${rp(b.amount)})</option>`;
  });
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const bill_id = document.getElementById("f_bill_id").value;
  const amount  = Number(document.getElementById("f_amount").value);
  const method  = document.getElementById("f_method").value;
  const note    = document.getElementById("f_note").value;
  const file    = document.getElementById("f_proof").files[0];

  if (!bill_id || !amount) { showToast("Tagihan dan jumlah wajib diisi.", "error"); return; }

  let proof_url = null;
  if (file) {
    const path = `proofs/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from("payments").upload(path, file);
    if (!upErr) {
      const { data: urlData } = supabase.storage.from("payments").getPublicUrl(path);
      proof_url = urlData.publicUrl;
    }
  }

  const payload = { bill_id, amount, method, note, proof_url, status: "diterima", created_by: session.user.id };
  const { error } = await supabase.from("payments").insert(payload);
  if (error) { showToast("Gagal menyimpan pembayaran: " + error.message, "error"); return; }

  // Mark bill as lunas
  await supabase.from("bills").update({ status: "lunas", paid_amount: amount }).eq("id", bill_id);

  showToast("Pembayaran berhasil dicatat.");
  closeModal();
  loadPayments();
});

// ── Export CSV ────────────────────────────────────────────
btnExport?.addEventListener("click", async () => {
  const { data } = await supabase
    .from("payments")
    .select(`amount, method, status, note, created_at,
             bills(period, students(full_name), fee_types(name))`)
    .order("created_at", { ascending: false });

  const rows = [["Tanggal","Siswa","Jenis Tagihan","Periode","Jumlah","Metode","Status","Catatan"]];
  (data ?? []).forEach(p => {
    const b = p.bills ?? {};
    rows.push([
      fmtDate(p.created_at),
      b.students?.full_name ?? "",
      b.fee_types?.name ?? "",
      b.period ?? "",
      p.amount,
      p.method ?? "",
      p.status,
      p.note ?? ""
    ]);
  });

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `pembayaran_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
});

// ── Close handlers ────────────────────────────────────────
function closeModal()  { modalOv.style.display  = "none"; }
function closeDetail() { detailOv.style.display = "none"; }

document.getElementById("btnCancel")?.addEventListener("click",  closeModal);
document.getElementById("btnCancel2")?.addEventListener("click", closeModal);
document.getElementById("btnCloseDetail")?.addEventListener("click", closeDetail);
filterEl?.addEventListener("change", loadPayments);

// ── Toast ─────────────────────────────────────────────────
function showToast(msg, type = "success") {
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 3000);
}

// ── Init ──────────────────────────────────────────────────
loadPayments();
