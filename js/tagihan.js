// ============================================================
// SFMS LITE — Tagihan v3.1
// Semua elemen sudah ada di HTML — tidak ada inject topbar
// ============================================================
import { supabase } from "./supabaseClient.js";
import { requireAuth, applyRoleVisibility } from "./auth.js";
import { showToast, formatRupiah, formatDate, statusBadge, exportCSV, qs } from "./utils.js";

const auth = await requireAuth();
if (!auth) throw new Error("Unauthenticated");
const { profile } = auth;
applyRoleVisibility(profile);

let currentBillsData = [];

// ── Elements — semuanya sudah ada di HTML ─────────────────
const tableWrap    = document.getElementById("billsTableWrap");
const cardList     = document.getElementById("billsCardList");
const filterStatus = document.getElementById("filterStatus");
const btnExport    = document.getElementById("btnExport");
const btnGenerate  = document.getElementById("btnGenerate");
const modalOv      = document.getElementById("modalOverlay");
const editModalOv  = document.getElementById("editModalOverlay");

// ── Filter & export ───────────────────────────────────────
filterStatus?.addEventListener("change", () => loadBills(filterStatus.value));

btnExport?.addEventListener("click", () => {
  if (!currentBillsData.length) { showToast("Tidak ada data untuk diexport.", "error"); return; }
  exportCSV(
    `tagihan_${new Date().toISOString().slice(0,10)}.csv`,
    ["Siswa","Jenis Tagihan","Periode","Nominal","Terbayar","Jatuh Tempo","Status"],
    currentBillsData.map(b => [
      b.students?.name ?? "-",
      b.billing_types?.name ?? "-",
      b.period ?? "-",
      b.amount,
      b.amount_paid ?? 0,
      b.due_date ?? "-",
      b.status,
    ])
  );
});

// ── Modal generate ────────────────────────────────────────
btnGenerate?.addEventListener("click", () => {
  modalOv.style.display = "flex";
});

function closeGenModal() { modalOv.style.display = "none"; }
document.getElementById("btnCancel")?.addEventListener("click",  closeGenModal);
document.getElementById("btnCancel2")?.addEventListener("click", closeGenModal);

document.getElementById("g_target")?.addEventListener("change", (e) => {
  document.getElementById("classPicker").style.display =
    e.target.value === "class" ? "block" : "none";
});

// ── Modal edit ────────────────────────────────────────────
function closeEditModal() { editModalOv.style.display = "none"; }
document.getElementById("btnCancelEdit")?.addEventListener("click",  closeEditModal);
document.getElementById("btnCancelEdit2")?.addEventListener("click", closeEditModal);

function openEditModal(bill) {
  qs("#editBillId").value = bill.id;
  qs("#e_siswa").value    = bill.students?.name ?? "-";
  qs("#e_period").value   = bill.period ?? "";
  qs("#e_due_date").value = bill.due_date ?? "";
  editModalOv.style.display = "flex";
}

document.getElementById("editBillForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id       = qs("#editBillId").value;
  const period   = qs("#e_period").value.trim();
  const due_date = qs("#e_due_date").value;

  const { error } = await supabase.from("bills").update({ period, due_date }).eq("id", id);
  if (error) { showToast("Gagal menyimpan: " + error.message, "error"); return; }

  showToast("Tagihan berhasil diupdate.", "success");
  closeEditModal();
  loadBills(filterStatus?.value ?? "");
});

// ── Load data ─────────────────────────────────────────────
async function loadBills(statusFilter = "") {
  tableWrap.innerHTML = `
    <div class="skeleton skeleton-row"></div>
    <div class="skeleton skeleton-row"></div>
    <div class="skeleton skeleton-row"></div>`;
  cardList.innerHTML = "";

  let query = supabase
    .from("bills")
    .select("*, students(name), billing_types(name)")
    .order("due_date", { ascending: false })
    .limit(300);

  if (statusFilter) query = query.eq("status", statusFilter);

  const { data, error } = await query;

  if (error) {
    const msg = `<div class="empty-state"><div class="empty-title">Gagal memuat data</div><div class="empty-desc">${error.message}</div></div>`;
    tableWrap.innerHTML = cardList.innerHTML = msg;
    return;
  }

  if (!data?.length) {
    const empty = `<div class="empty-state">
      <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
      <div class="empty-title">Belum ada tagihan</div>
      <div class="empty-desc">Klik "+ Generate Massal" untuk membuat tagihan.</div>
    </div>`;
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
          <td>${formatRupiah(b.amount_paid ?? 0)}</td>
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
          <div style="font-size:11px;color:var(--grey-400)">Terbayar: ${formatRupiah(b.amount_paid ?? 0)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${statusBadge(b.status)}
          <button class="btn btn-ghost btn-sm" data-edit-bill="${b.id}">Edit</button>
        </div>
      </div>
    </div>`).join("");

  // Attach edit listeners
  document.querySelectorAll("[data-edit-bill]").forEach(btn => {
    btn.addEventListener("click", () => {
      const bill = data.find(b => b.id === btn.dataset.editBill);
      if (bill) openEditModal(bill);
    });
  });
}

// ── Load billing types & classes untuk form generate ──────
async function loadFormData() {
  const [{ data: types }, { data: classes }] = await Promise.all([
    supabase.from("billing_types").select("id, name, default_amount").eq("is_active", true),
    supabase.from("classes").select("id, name").order("name"),
  ]);

  const selType = qs("#g_billing_type");
  if (selType && types?.length) {
    selType.innerHTML = types.map(t =>
      `<option value="${t.id}" data-amount="${t.default_amount ?? 0}">${t.name}</option>`
    ).join("");
    // Auto-fill nominal saat jenis dipilih
    const setAmount = () => {
      const opt = selType.selectedOptions[0];
      if (opt) qs("#g_amount").value = opt.dataset.amount;
    };
    selType.addEventListener("change", setAmount);
    setAmount();
  }

  const selClass = qs("#g_class");
  if (selClass && classes?.length) {
    selClass.innerHTML = classes.map(c =>
      `<option value="${c.id}">${c.name}</option>`
    ).join("");
  }
}

// ── Generate submit ───────────────────────────────────────
document.getElementById("generateForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const billing_type_id = qs("#g_billing_type").value;
  const target          = qs("#g_target").value;
  const class_id        = qs("#g_class").value;
  const period          = qs("#g_period").value.trim();
  const amount          = Number(qs("#g_amount").value);
  const due_date        = qs("#g_due_date").value;

  if (!billing_type_id || !amount || !due_date) {
    showToast("Jenis tagihan, nominal, dan jatuh tempo wajib diisi.", "error");
    return;
  }

  let studentQuery = supabase.from("students").select("id").eq("status","aktif");
  if (target === "class" && class_id) studentQuery = studentQuery.eq("class_id", class_id);

  const { data: students, error: studentErr } = await studentQuery;
  if (studentErr) { showToast("Gagal ambil data siswa: " + studentErr.message, "error"); return; }
  if (!students?.length) { showToast("Tidak ada siswa aktif pada target yang dipilih.", "error"); return; }

  const rows = students.map(s => ({
    student_id: s.id,
    billing_type_id,
    period,
    amount,
    due_date,
    status: "aktif",
    amount_paid: 0,
  }));

  const { error } = await supabase.from("bills").insert(rows);
  if (error) { showToast("Gagal generate: " + error.message, "error"); return; }

  showToast(`${rows.length} tagihan berhasil dibuat.`, "success");
  closeGenModal();
  loadBills();
});

// ── Init ──────────────────────────────────────────────────
loadFormData();
loadBills();
