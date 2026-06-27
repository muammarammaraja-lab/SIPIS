// ============================================================
// SFMS LITE — Tagihan: generate massal & list status
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

document.getElementById("btnExport").addEventListener("click", () => {
  if (currentBillsData.length === 0) {
    showToast("Tidak ada data untuk diexport.", "error");
    return;
  }
  exportCSV(
    `tagihan_${new Date().toISOString().slice(0, 10)}.csv`,
    ["Siswa", "Jenis Tagihan", "Periode", "Nominal", "Terbayar", "Jatuh Tempo", "Status"],
    currentBillsData.map(b => [
      b.students?.name ?? "-", b.billing_types?.name ?? "-", b.period ?? "-",
      b.amount, b.amount_paid, b.due_date ?? "-", b.status,
    ])
  );
});

document.getElementById("btnGenerate").addEventListener("click", () => {
  document.getElementById("modalOverlay").style.display = "flex";
});
document.getElementById("btnCancel").addEventListener("click", () => {
  document.getElementById("modalOverlay").style.display = "none";
});
document.getElementById("g_target").addEventListener("change", (e) => {
  document.getElementById("classPicker").style.display = e.target.value === "class" ? "block" : "none";
});
document.getElementById("filterStatus").addEventListener("change", (e) => loadBills(e.target.value));

// Modal Edit Tagihan
document.getElementById("btnCancelEdit").addEventListener("click", () => {
  document.getElementById("editModalOverlay").style.display = "none";
});

document.getElementById("editBillForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("editBillId").value;
  const period = document.getElementById("e_period").value.trim();
  const due_date = document.getElementById("e_due_date").value;

  const { error } = await supabase.from("bills").update({ period, due_date }).eq("id", id);
  if (error) {
    showToast("Gagal menyimpan: " + error.message, "error");
    return;
  }
  showToast("Tagihan berhasil diupdate.", "success");
  document.getElementById("editModalOverlay").style.display = "none";
  loadBills(qs("#filterStatus").value);
});

function openEditModal(bill) {
  document.getElementById("editBillId").value = bill.id;
  document.getElementById("e_siswa").value = bill.students?.name ?? "-";
  document.getElementById("e_period").value = bill.period ?? "";
  document.getElementById("e_due_date").value = bill.due_date ?? "";
  document.getElementById("editModalOverlay").style.display = "flex";
}

async function loadBillingTypes() {
  const { data } = await supabase.from("billing_types").select("*").eq("is_active", true);
  const sel = document.getElementById("g_billing_type");
  sel.innerHTML = (data || []).map(b => `<option value="${b.id}" data-amount="${b.default_amount}">${b.name}</option>`).join("");
  sel.addEventListener("change", () => {
    const opt = sel.selectedOptions[0];
    if (opt) document.getElementById("g_amount").value = opt.dataset.amount;
  });
  if (sel.selectedOptions[0]) document.getElementById("g_amount").value = sel.selectedOptions[0].dataset.amount;
}

async function loadClasses() {
  const { data } = await supabase.from("classes").select("*").order("name");
  document.getElementById("g_class").innerHTML = (data || []).map(c => `<option value="${c.id}">${c.name}</option>`).join("");
}

async function loadBills(statusFilter = "") {
  const wrap = document.getElementById("billsTableWrap");
  let query = supabase
    .from("bills")
    .select("*, students(name), billing_types(name)")
    .order("due_date", { ascending: false });
  if (statusFilter) query = query.eq("status", statusFilter);

  const { data, error } = await query.limit(200);
  if (error) {
    wrap.innerHTML = `<div class="empty-state">Gagal memuat: ${error.message}</div>`;
    return;
  }
  if (!data || data.length === 0) {
    wrap.innerHTML = `<div class="empty-state">Belum ada tagihan untuk filter ini.</div>`;
    currentBillsData = [];
    return;
  }
  currentBillsData = data;

  wrap.innerHTML = `
    <table>
      <thead><tr><th>Siswa</th><th>Jenis</th><th>Periode</th><th>Nominal</th><th>Terbayar</th><th>Jatuh Tempo</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${data.map(b => `
          <tr>
            <td>${b.students?.name ?? "-"}</td>
            <td>${b.billing_types?.name ?? "-"}</td>
            <td>${b.period ?? "-"}</td>
            <td>${formatRupiah(b.amount)}</td>
            <td>${formatRupiah(b.amount_paid)}</td>
            <td>${formatDate(b.due_date)}</td>
            <td>${statusBadge(b.status)}</td>
            <td><button class="btn btn-ghost btn-sm" data-edit-bill="${b.id}">Edit</button></td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;

  wrap.querySelectorAll("[data-edit-bill]").forEach(btn => {
    btn.addEventListener("click", () => openEditModal(data.find(b => b.id === btn.dataset.editBill)));
  });
}

document.getElementById("generateForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const billingTypeId = qs("#g_billing_type").value;
  const target = qs("#g_target").value;
  const classId = qs("#g_class").value;
  const period = qs("#g_period").value.trim();
  const amount = Number(qs("#g_amount").value);
  const dueDate = qs("#g_due_date").value;

  let studentQuery = supabase.from("students").select("id").eq("status", "aktif");
  if (target === "class") studentQuery = studentQuery.eq("class_id", classId);
  const { data: students, error: studentErr } = await studentQuery;

  if (studentErr) {
    showToast("Gagal mengambil daftar siswa: " + studentErr.message, "error");
    return;
  }
  if (!students || students.length === 0) {
    showToast("Tidak ada siswa aktif pada target yang dipilih.", "error");
    return;
  }

  const rows = students.map(s => ({
    school_id: mySchoolId,
    student_id: s.id,
    billing_type_id: billingTypeId,
    period,
    amount,
    due_date: dueDate,
    status: "aktif",
  }));

  const { error } = await supabase.from("bills").insert(rows);
  if (error) {
    showToast("Gagal generate tagihan: " + error.message, "error");
    return;
  }

  showToast(`${rows.length} tagihan berhasil dibuat.`, "success");
  document.getElementById("modalOverlay").style.display = "none";
  loadBills();
});
