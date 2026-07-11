// ============================================================
// SFMS LITE — Tagihan v3.3
// + Human Assisted WA Reminder
// + notification_logs untuk histori pesan
// ============================================================
import { supabase } from "./supabaseClient.js";
import { requireAuth, applyRoleVisibility } from "./auth.js";
import { showToast, formatRupiah, formatDate, statusBadge, exportCSV, qs } from "./utils.js";

const auth = await requireAuth();
if (!auth) throw new Error("Unauthenticated");
const { session, profile } = auth;
applyRoleVisibility(profile);

const operatorEmail = session.user.email;

let currentBillsData = [];
let selectedBillIds  = new Set();
let waTemplate       = null;
let waBatchQueue     = [];
let waBatchIndex     = 0;
let notifLogsMap     = {};  // bill_id → log terbaru

// ── Elements ──────────────────────────────────────────────
const tableWrap     = document.getElementById("billsTableWrap");
const cardList      = document.getElementById("billsCardList");
const filterStatus  = document.getElementById("filterStatus");
const btnExport     = document.getElementById("btnExport");
const btnGenerate   = document.getElementById("btnGenerate");
const modalOv       = document.getElementById("modalOverlay");
const editModalOv   = document.getElementById("editModalOverlay");
const btnBulkWA     = document.getElementById("btnBulkWA");
const selectedCount = document.getElementById("selectedCount");

// ── WA Helpers ────────────────────────────────────────────
function formatPhone(raw) {
  let p = (raw ?? "").replace(/[^0-9]/g, "");
  if (p.startsWith("0")) p = "62" + p.slice(1);
  if (!p.startsWith("62")) p = "62" + p;
  return p;
}

async function getTemplate() {
  if (waTemplate) return waTemplate;
  const { data } = await supabase
    .from("wa_templates")
    .select("body")
    .eq("reminder_type", "friendly")
    .maybeSingle();
  waTemplate = data?.body ?? null;
  return waTemplate;
}

function buildMessage(template, bill) {
  const siswa   = bill.students?.name ?? "-";
  const jenis   = bill.billing_types?.name ?? "-";
  const periode = bill.period ? ` (${bill.period})` : "";
  const rincian = `${jenis}${periode}`;
  const total   = formatRupiah(bill.amount);
  const link    = `${window.location.origin}/invoice.html?id=${bill.id}`;

  if (template) {
    return template
      .replace(/\{\{nama_siswa\}\}/g, siswa)
      .replace(/\{\{rincian\}\}/g, rincian)
      .replace(/\{\{total\}\}/g, total)
      .replace(/\{\{link_pembayaran\}\}/g, link);
  }

  return `Assalamu'alaikum Warahmatullahi Wabarakatuh,

Bapak/Ibu Orang Tua/Wali dari *${siswa}* yang kami hormati,

Semoga Bapak/Ibu senantiasa dalam lindungan Allah SWT.

Kami menginformasikan bahwa terdapat tagihan yang belum diselesaikan:

📌 *Rincian:* ${rincian}
💰 *Total:* ${total}

Pembayaran dapat dilakukan melalui:
🔗 ${link}

Jazakumullahu Khairan atas perhatian dan kerjasamanya.

Wassalamu'alaikum Warahmatullahi Wabarakatuh
_Tim Keuangan SDIT Qudwatun Hasanah_`;
}

function openWALink(phone, message) {
  const url = `https://wa.me/${formatPhone(phone)}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}

// ── Simpan log notifikasi ─────────────────────────────────
async function logNotification(bill, message) {
  await supabase.from("notification_logs").insert({
    bill_id:    bill.id,
    student_id: bill.students?.id ?? null,
    channel:    "WhatsApp Manual",
    status:     "sent",
    message:    message,
    operator:   operatorEmail,
  });
  // Update cache lokal agar badge langsung berubah tanpa reload
  notifLogsMap[bill.id] = { created_at: new Date().toISOString() };
}

// ── Badge status reminder ─────────────────────────────────
function reminderBadge(billId) {
  const log = notifLogsMap[billId];
  if (!log) return `<span style="font-size:11px;color:var(--grey-400)">⚪ Belum</span>`;
  const isToday = new Date(log.created_at).toDateString() === new Date().toDateString();
  return isToday
    ? `<span style="font-size:11px;color:#d97706">🟡 Hari ini</span>`
    : `<span style="font-size:11px;color:#16a34a">🟢 Sudah</span>`;
}

// ── Load notification logs ────────────────────────────────
async function loadNotifLogs(billIds) {
  if (!billIds.length) return;
  const { data } = await supabase
    .from("notification_logs")
    .select("bill_id, created_at")
    .in("bill_id", billIds)
    .order("created_at", { ascending: false });

  notifLogsMap = {};
  (data ?? []).forEach(log => {
    if (!notifLogsMap[log.bill_id]) notifLogsMap[log.bill_id] = log;
  });
}

// ── Filter & export ───────────────────────────────────────
filterStatus?.addEventListener("change", () => loadBills(filterStatus.value));

btnExport?.addEventListener("click", () => {
  if (!currentBillsData.length) { showToast("Tidak ada data.", "error"); return; }
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
btnGenerate?.addEventListener("click", () => { modalOv.style.display = "flex"; });
function closeGenModal() { modalOv.style.display = "none"; }
document.getElementById("btnCancel")?.addEventListener("click",  closeGenModal);
document.getElementById("btnCancel2")?.addEventListener("click", closeGenModal);
document.getElementById("g_target")?.addEventListener("change", (e) => {
  document.getElementById("classPicker").style.display = e.target.value === "class" ? "block" : "none";
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
  if (error) { showToast("Gagal: " + error.message, "error"); return; }
  showToast("Tagihan diperbarui.", "success");
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
  selectedBillIds.clear();
  updateBulkButton();

  let query = supabase
    .from("bills")
    .select("*, students(id, name, parent_whatsapp), billing_types(name)")
    .order("due_date", { ascending: false })
    .limit(300);

  if (statusFilter) query = query.eq("status", statusFilter);

  const { data, error } = await query;

  if (error) {
    tableWrap.innerHTML = `<div class="empty-state"><div class="empty-title">Gagal</div><div class="empty-desc">${error.message}</div></div>`;
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

  // Load notification logs untuk semua tagihan
  await loadNotifLogs(data.map(b => b.id));

  const waIconBtn = (b) => b.status !== "lunas" && b.students?.parent_whatsapp
    ? `<button class="btn btn-ghost btn-sm" data-wa="${b.id}" title="Kirim WA" style="color:#25D366;padding:4px 8px">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
       </button>`
    : "";

  const checkboxCol = (b) => b.status !== "lunas" && b.students?.parent_whatsapp
    ? `<input type="checkbox" class="check-bill" value="${b.id}" style="width:16px;height:16px;cursor:pointer" />`
    : `<span style="display:inline-block;width:16px"></span>`;

  // Desktop table
  tableWrap.innerHTML = `
    <table>
      <thead><tr>
        <th style="width:20px"><input type="checkbox" id="checkAll" style="width:16px;height:16px;cursor:pointer" /></th>
        <th>Siswa</th><th>Jenis</th><th>Periode</th>
        <th>Nominal</th><th>Terbayar</th><th>Jatuh Tempo</th>
        <th>Status</th><th>Reminder</th><th></th>
      </tr></thead>
      <tbody>
        ${data.map(b => `<tr>
          <td>${checkboxCol(b)}</td>
          <td><strong>${b.students?.name ?? "-"}</strong></td>
          <td>${b.billing_types?.name ?? "-"}</td>
          <td>${b.period ?? "-"}</td>
          <td>${formatRupiah(b.amount)}</td>
          <td>${formatRupiah(b.amount_paid ?? 0)}</td>
          <td>${formatDate(b.due_date)}</td>
          <td>${statusBadge(b.status)}</td>
          <td>${b.status !== "lunas" ? reminderBadge(b.id) : "-"}</td>
          <td style="display:flex;gap:4px;align-items:center">
            ${waIconBtn(b)}
            <button class="btn btn-ghost btn-sm" data-edit-bill="${b.id}">Edit</button>
          </td>
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
        ${b.status !== "lunas" ? `<span>${reminderBadge(b.id)}</span>` : ""}
      </div>
      <div class="cli-footer">
        <div>
          <div class="cli-amount">${formatRupiah(b.amount)}</div>
          <div style="font-size:11px;color:var(--grey-400)">Terbayar: ${formatRupiah(b.amount_paid ?? 0)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          ${statusBadge(b.status)}
          ${b.status !== "lunas" && b.students?.parent_whatsapp
            ? `<button class="btn btn-sm" data-wa="${b.id}" style="background:#25D366;color:#fff;border-color:#25D366;padding:5px 10px;font-size:12px">WA</button>`
            : ""}
          <button class="btn btn-ghost btn-sm" data-edit-bill="${b.id}">Edit</button>
        </div>
      </div>
    </div>`).join("");

  // Listeners
  document.querySelectorAll("[data-edit-bill]").forEach(btn =>
    btn.addEventListener("click", () => openEditModal(data.find(b => b.id === btn.dataset.editBill)))
  );
  document.querySelectorAll("[data-wa]").forEach(btn =>
    btn.addEventListener("click", () => openWAPreview(btn.dataset.wa))
  );
  document.querySelectorAll(".check-bill").forEach(cb =>
    cb.addEventListener("change", () => {
      if (cb.checked) selectedBillIds.add(cb.value);
      else selectedBillIds.delete(cb.value);
      updateBulkButton();
    })
  );
  document.getElementById("checkAll")?.addEventListener("change", (e) => {
    selectedBillIds.clear();
    document.querySelectorAll(".check-bill").forEach(cb => {
      cb.checked = e.target.checked;
      if (e.target.checked) selectedBillIds.add(cb.value);
    });
    updateBulkButton();
  });
}

function updateBulkButton() {
  const n = selectedBillIds.size;
  btnBulkWA.style.display = n > 0 ? "inline-flex" : "none";
  selectedCount.textContent = n;
}

// ── WA Preview (per tagihan) ──────────────────────────────
const waPreviewOv   = document.getElementById("waPreviewOverlay");
const waRecipient   = document.getElementById("waRecipient");
const waPreviewText = document.getElementById("waPreviewText");
let waActiveBill    = null;

async function openWAPreview(billId) {
  const bill = currentBillsData.find(b => b.id === billId);
  if (!bill) return;
  waActiveBill = bill;

  const tpl = await getTemplate();
  const msg  = buildMessage(tpl, bill);
  const phone = bill.students?.parent_whatsapp ?? "-";

  waRecipient.textContent = `${bill.students?.name ?? "-"} — ${phone}`;
  waPreviewText.value = msg;
  waPreviewOv.style.display = "flex";
}

document.getElementById("btnWAClose")?.addEventListener("click", () => waPreviewOv.style.display = "none");
document.getElementById("btnWACancel")?.addEventListener("click", () => waPreviewOv.style.display = "none");

document.getElementById("btnWAOpen")?.addEventListener("click", async () => {
  if (!waActiveBill) return;
  const msg   = waPreviewText.value;
  const phone = waActiveBill.students?.parent_whatsapp;
  openWALink(phone, msg);
  await logNotification(waActiveBill, msg);
  // Update badge langsung di DOM tanpa reload
  refreshReminderBadges();
  waPreviewOv.style.display = "none";
  showToast("WhatsApp dibuka. Badge reminder diperbarui.", "success");
});

// Refresh badge di DOM setelah kirim
function refreshReminderBadges() {
  document.querySelectorAll("[data-reminder-badge]").forEach(el => {
    el.innerHTML = reminderBadge(el.dataset.reminderBadge);
  });
}

// ── WA Batch Wizard ───────────────────────────────────────
const wizardOv = document.getElementById("wizardOverlay");

btnBulkWA?.addEventListener("click", async () => {
  const ids = [...selectedBillIds];
  if (!ids.length) return;

  const bills = currentBillsData.filter(b => ids.includes(b.id) && b.students?.parent_whatsapp);
  if (!bills.length) { showToast("Tidak ada tagihan dengan nomor WA orang tua.", "error"); return; }

  const tpl = await getTemplate();
  waBatchQueue = bills.map(b => ({
    bill:    b,
    phone:   b.students?.parent_whatsapp ?? "",
    name:    b.students?.name ?? "-",
    detail:  `${b.billing_types?.name ?? "-"}${b.period ? ` (${b.period})` : ""}`,
    amount:  b.amount,
    message: buildMessage(tpl, b),
  }));

  waBatchIndex = 0;
  wizardOv.style.display = "flex";
  renderWizardStep();
});

function renderWizardStep() {
  if (waBatchIndex >= waBatchQueue.length) {
    document.getElementById("wzProgressBar").style.width = "100%";
    document.getElementById("wzPercent").textContent = "100%";
    document.getElementById("wzProgressText").textContent = `Selesai! ${waBatchQueue.length} pesan terkirim.`;
    setTimeout(() => {
      wizardOv.style.display = "none";
      selectedBillIds.clear();
      updateBulkButton();
      showToast(`${waBatchQueue.length} reminder selesai dikirim.`, "success");
    }, 1200);
    return;
  }

  const item  = waBatchQueue[waBatchIndex];
  const total = waBatchQueue.length;
  const pct   = Math.round((waBatchIndex / total) * 100);

  document.getElementById("wzCurrent").textContent      = waBatchIndex + 1;
  document.getElementById("wzTotal").textContent        = total;
  document.getElementById("wzProgressBar").style.width  = pct + "%";
  document.getElementById("wzPercent").textContent      = pct + "%";
  document.getElementById("wzProgressText").textContent = `${waBatchIndex} dari ${total} selesai`;
  document.getElementById("wzName").textContent         = item.name;
  document.getElementById("wzPhone").textContent        = item.phone;
  document.getElementById("wzDetail").textContent       = item.detail;
  document.getElementById("wzAmount").textContent       = formatRupiah(item.amount);
  document.getElementById("wzPreviewText").value        = item.message;

  document.getElementById("btnWzOpenWA").style.display = "inline-flex";
  document.getElementById("btnWzNext").style.display   = "none";
}

document.getElementById("btnWzOpenWA")?.addEventListener("click", async () => {
  const item = waBatchQueue[waBatchIndex];
  const msg  = document.getElementById("wzPreviewText").value;
  openWALink(item.phone, msg);
  await logNotification(item.bill, msg);
  document.getElementById("btnWzOpenWA").style.display = "none";
  document.getElementById("btnWzNext").style.display   = "inline-flex";
});

document.getElementById("btnWzNext")?.addEventListener("click", () => {
  waBatchIndex++;
  renderWizardStep();
});

document.getElementById("btnWzSkip")?.addEventListener("click", () => {
  waBatchIndex++;
  renderWizardStep();
});

document.getElementById("btnWzCancel")?.addEventListener("click", () => {
  if (confirm("Hentikan antrean reminder?")) wizardOv.style.display = "none";
});

// ── Load form data ────────────────────────────────────────
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
    showToast("Jenis tagihan, nominal, dan jatuh tempo wajib diisi.", "error"); return;
  }

  let studentQuery = supabase.from("students").select("id").eq("status","aktif");
  if (target === "class" && class_id) studentQuery = studentQuery.eq("class_id", class_id);

  const { data: students, error: studentErr } = await studentQuery;
  if (studentErr) { showToast("Gagal ambil siswa: " + studentErr.message, "error"); return; }
  if (!students?.length) { showToast("Tidak ada siswa aktif.", "error"); return; }

  const rows = students.map(s => ({
    student_id: s.id, billing_type_id, period, amount, due_date, status: "aktif", amount_paid: 0,
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
