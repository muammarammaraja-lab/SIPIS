// ============================================================
// SFMS LITE — Tagihan v3.0
// Mobile card list + desktop table dual render
// ============================================================
import { supabase } from "./supabaseClient.js";
import { requireAuth, applyRoleVisibility } from "./auth.js";
import { showToast, formatRupiah, formatDate, statusBadge, exportCSV, qs } from "./utils.js";

const auth = await requireAuth();
let mySchoolId = null;
let currentBillsData = [];

if (auth) {
  applyRoleVisibility(auth.profile);
  mySchoolId = auth.profile.school_id;
  loadBillingTypes();
  loadClasses();
  loadBills();
}

// ── Topbar actions ──────────────────────────────────────────
const topbarActions = document.getElementById("topbarActions");
if (topbarActions) {
  topbarActions.innerHTML = `
    <select id="filterStatus" style="margin:0;width:150px">
      <option value="">Semua Status</option>
      <option value="aktif">Aktif</option>
      <option value="lunas">Lunas</option>
      <option value="sebagian_bayar">Sebagian Bayar</option>
      <option value="dispensasi">Dispensasi</option>
      <option value="dibatalkan">Dibatalkan</option>
    </select>
    <button class="btn btn-ghost btn-sm" id="btnExport">Export CSV</button>
    <button class="btn btn-primary btn-sm" id="btnGenerate" data-roles="kepala_sekolah,bendahara,admin_keuangan">+ Generate</button>
  `;
  applyRoleVisibility(auth.profile);
  document.getElementById("btnExport").addEventListener("click", doExport);
  document.getElementById("btnGenerate").addEventListener("click", () => {
    document.getElementById("modalOverlay").style.display = "flex";
  });
  document.getElementById("filterStatus").addEventListener("change", (e) => loadBills(e.target.value));
}

function doExport() {
  if (!currentBillsData.length) { showToast("Tidak ada data untuk diexport.", "error"); return; }
  exportCSV(
    `tagihan_${new Date().toISOString().slice(0, 10)}.csv`,
    ["Siswa", "Jenis Tagihan", "Periode", "Nominal", "Terbayar", "Jatuh Tempo", "Status"],
    currentBillsData.map(b => [
      b.students?.name ?? "-", b.billing_types?.name ?? "-", b.period ?? "-",
      b.amount, b.amount_paid, b.due_date ?? "-", b.status,
    ])
  );
}

// ── Modal generate ──────────────────────────────────────────
document.getElementById("btnCancel").addEventListener("click", closeGenModal);
document.getElementById("btnCancel2").addEventListener("click", closeGenModal);
function closeGenModal() { document.getElementById("modalOverlay").style.display = "none"; }

document.getElementById("g_target").addEventListener("change", (e) => {
  document.getElementById("classPicker").style.display = e.target.value === "class" ? "block" : "none";
});

// ── Modal edit ──────────────────────────────────────────────
document.getElementById("btnCancelEdit").addEventListener("click", closeEditModal);
document.getElementById("btnCancelEdit2").addEventListener("click", closeEditModal);
function closeEditModal() { document.getElementById("editModalOverlay").style.display = "none"; }

document.getElementById("editBillForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id       = qs("#editBillId").value;
  const period   = qs("#e_period").value.trim();
  const due_date = qs("#e_due_date").value;
  const { error } = await supabase.from("bills").update({ period, due_date }).eq("id", id);
  if (error) { showToast("Gagal menyimpan: " + error.message, "error"); return; }
  showToast("Tagihan berhasil diupdate.", "success");
  closeEditModal();
  loadBills(qs("#filterStatus")?.value ?? "");
});

function openEditModal(bill) {
  qs("#editBillId").value  = bill.id;
  qs("#e_siswa").value     = bill.students?.name ?? "-";
  qs("#e_period").value    = bill.period ?? "";
  qs("#e_due_date").value  = bill.due_date ?? "";
  document.getElementById("editModalOverlay").style.display = "flex";
}

// ── Load data ───────────────────────────────────────────────
async function loadBillingTypes() {
  const { data } = await supabase.from("billing_types").select("*").eq("is_active", true);
  const sel = qs("#g_billing_type");
  if (!sel) return;
  sel.innerHTML = (data || []).map(b => `<option value="${b.id}" data-amount="${b.default_amount}">${b.name}</option>`).join("");
  sel.addEventListener("change", () => {
    const opt = sel.selectedOptions[0];
    if (opt) qs("#g_amount").value = opt.dataset.amount;
  });
  if (sel.selectedOptions[0]) qs("#g_amount").value = sel.selectedOptions[0].dataset.amount;
}

async function loadClasses() {
  const { data } = await supabase.from("classes").select("*").order("name");
  const sel = qs("#g_class");
  if (sel) sel.innerHTML = (data || []).map(c => `<option value="${c.id}">${c.name}</option>`).join("");
}

async function loadBills(statusFilter = "") {
  const tableWrap = document.getElementById("billsTableWrap");
  const cardList  = document.getElementById("billsCardList");

  let query = supabase
    .from("bills")
    .select("*, students(name), billing_types(name)")
    .order("due_date", { ascending: false });
  if (statusFilter) query = query.eq("status", statusFilter);
  const { data, error } = await query.limit(200);

  if (error) {
    tableWrap.innerHTML = cardList.innerHTML = `<div class="empty-state"><div class="empty-title">Gagal memuat data</div><div class="empty-desc">${error.message}</div></div>`;
    return;
  }
  if (!data?.length) {
    const empty = `<div class="empty-state"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div class="empty-title">Belum ada tagihan</div><div class="empty-desc">Klik "+ Generate Massal" untuk membuat tagihan.</div></div>`;
    tableWrap.innerHTML = cardList.innerHTML = empty;
    currentBillsData = [];
    return;
  }
  currentBillsData = data;

  // Desktop table
  tableWrap.innerHTML = `
    <table>
      <thead><tr>
        <th>Siswa</th><th>Jenis</th><th>Periode</th>
        <th>Nominal</th><th>Terbayar</th><th>Jatuh Tempo</th><th>Status</th><th></th>
      </tr></thead>
      <tbody>
        ${data.map(b => `<tr>
          <td><strong>${b.students?.name ?? "-"}</strong></td>
          <td>${b.billing_types?.name ?? "-"}</td>
          <td>${b.period ?? "-"}</td>
          <td>${formatRupiah(b.amount)}</td>
          <td>${formatRupiah(b.amount_paid)}</td>
          <td>${formatDate(b.due_date)}</td>
          <td>${statusBadge(b.status)}</td>
          <td><button class="btn btn-ghost btn-sm" data-edit-bill="${b.id}">Edit</button></td>
        </tr>`).join("")}
      </tbody>
    </table>`;

  // Mobile card list
  cardList.innerHTML = data.map(b => `
    <div class="card-list-item">
      <div class="cli-name">${b.students?.name ?? "-"}</div>
      <div class="cli-meta">
        <span>${b.billing_types?.name ?? "-"}</span>
        ${b.period ? `<span>${b.period}</span>` : ""}
        <span>Jatuh tempo: ${formatDate(b.due_date)}</span>
      </div>
      <div class="cli-footer">
        <div>
          <div class="cli-amount">${formatRupiah(b.amount)}</div>
          <div style="font-size:11px;color:var(--grey-400)">Terbayar: ${formatRupiah(b.amount_paid)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${statusBadge(b.status)}
          <button class="btn btn-ghost btn-sm" data-edit-bill="${b.id}">Edit</button>
        </div>
      </div>
    </div>`).join("");

  // Attach edit listeners
  document.querySelectorAll("[data-edit-bill]").forEach(btn => {
    btn.addEventListener("click", () => openEditModal(data.find(b => b.id === btn.dataset.editBill)));
  });
}

// ── Generate submit ─────────────────────────────────────────
document.getElementById("generateForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const billingTypeId = qs("#g_billing_type").value;
  const target        = qs("#g_target").value;
  const classId       = qs("#g_class").value;
  const period        = qs("#g_period").value.trim();
  const amount        = Number(qs("#g_amount").value);
  const dueDate       = qs("#g_due_date").value;

  let studentQuery = supabase.from("students").select("id").eq("status", "aktif");
  if (target === "class") studentQuery = studentQuery.eq("class_id", classId);
  const { data: students, error: studentErr } = await studentQuery;

  if (studentErr) { showToast("Gagal mengambil daftar siswa: " + studentErr.message, "error"); return; }
  if (!students?.length) { showToast("Tidak ada siswa aktif pada target yang dipilih.", "error"); return; }

  const rows = students.map(s => ({
    school_id: mySchoolId, student_id: s.id,
    billing_type_id: billingTypeId, period, amount, due_date: dueDate, status: "aktif",
  }));

  const { error } = await supabase.from("bills").insert(rows);
  if (error) { showToast("Gagal generate tagihan: " + error.message, "error"); return; }

  showToast(`${rows.length} tagihan berhasil dibuat.`, "success");
  closeGenModal();
  loadBills();
});
