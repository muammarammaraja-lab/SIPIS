// ============================================================
// SFMS LITE — Template WA v3.1
// Edit template pesan reminder otomatis Fonnte
// ============================================================
import { supabase } from "./supabaseClient.js";
import { requireAuth, applyRoleVisibility } from "./auth.js";
import { showToast, qs } from "./utils.js";

const auth = await requireAuth();
if (!auth) throw new Error("Unauthenticated");
const { profile } = auth;
applyRoleVisibility(profile);

// ── Elements ──────────────────────────────────────────────
const panelsEl = document.getElementById("templatePanels");
const modalOv  = document.getElementById("modalOverlay");
const form     = document.getElementById("templateForm");

// Tipe-tipe reminder yang ada
const REMINDER_TYPES = [
  { key: "friendly", label: "Reminder Tanggal 1" },
  { key: "medium",   label: "Reminder Tanggal 5" },
  { key: "final",    label: "Reminder Tanggal 10" },
];

const DEFAULT_BODY = `Assalamu'alaikum Bapak/Ibu {{nama_siswa}},

Kami menginformasikan bahwa terdapat tagihan yang belum diselesaikan:

{{rincian}}

*Total: {{total}}*

Silakan lakukan pembayaran melalui:
{{link_pembayaran}}

Terima kasih atas perhatiannya.
_Tim Keuangan Sekolah_`;

let allTemplates = {};

// ── Load templates ────────────────────────────────────────
async function loadTemplates() {
  panelsEl.innerHTML = `<div class="panel-body"><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div></div>`;

  const { data, error } = await supabase
    .from("wa_templates")
    .select("*");

  if (error && error.code !== "PGRST116") {
    panelsEl.innerHTML = `<div class="panel-body"><div class="empty-state"><div class="empty-title">Gagal memuat template</div><div class="empty-desc">${error.message}</div></div></div>`;
    return;
  }

  // Map by type
  allTemplates = {};
  (data ?? []).forEach(t => { allTemplates[t.reminder_type] = t; });

  renderPanels();
}

function renderPanels() {
  panelsEl.innerHTML = `
    <div class="panel-head"><h2>Template Pesan</h2></div>
    <div class="panel-body" style="display:flex;flex-direction:column;gap:16px;padding:16px">
      ${REMINDER_TYPES.map(rt => {
        const t = allTemplates[rt.key];
        const body = t?.body ?? DEFAULT_BODY;
        const preview = body.replace(/\n/g, "<br>").replace(/\*(.+?)\*/g, "<strong>$1</strong>");
        return `
          <div style="border:1px solid var(--grey-200);border-radius:12px;overflow:hidden">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--grey-50);border-bottom:1px solid var(--grey-200)">
              <div>
                <div style="font-weight:500;font-size:14px">${rt.label}</div>
                <div style="font-size:12px;color:var(--grey-500)">Dikirim otomatis setiap tanggal ${{ friendly:"1", medium:"5", final:"10" }[rt.key]} tiap bulan</div>
              </div>
              <button class="btn btn-ghost btn-sm" data-edit-type="${rt.key}" data-edit-label="${rt.label}">Edit</button>
            </div>
            <div style="padding:14px 16px;font-size:13px;line-height:1.7;color:var(--grey-700);white-space:pre-line;background:var(--white)">
              ${preview}
            </div>
            ${t ? "" : `<div style="padding:6px 16px 10px;font-size:12px;color:var(--orange)">⚠ Menggunakan template default — belum disimpan ke database</div>`}
          </div>`;
      }).join("")}
    </div>`;

  // Edit listeners
  document.querySelectorAll("[data-edit-type]").forEach(btn => {
    btn.addEventListener("click", () => openEdit(btn.dataset.editType, btn.dataset.editLabel));
  });
}

// ── Modal edit ────────────────────────────────────────────
function openEdit(type, label) {
  const t = allTemplates[type];
  qs("#templateId").value      = t?.id ?? "";
  qs("#templateType").value    = type;
  qs("#f_type_label").value    = label;
  qs("#f_body").value          = t?.body ?? DEFAULT_BODY;
  modalOv.style.display = "flex";
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id   = qs("#templateId").value;
  const type = qs("#templateType").value;
  const body = qs("#f_body").value.trim();

  if (!body) { showToast("Isi pesan tidak boleh kosong.", "error"); return; }

  let error;
  if (id) {
    ({ error } = await supabase.from("wa_templates").update({ body }).eq("id", id));
  } else {
    ({ error } = await supabase.from("wa_templates").insert({ reminder_type: type, body, school_id: profile.school_id, is_active: true }));
  }

  if (error) { showToast("Gagal menyimpan: " + error.message, "error"); return; }

  showToast("Template berhasil disimpan.", "success");
  closeModal();
  loadTemplates();
});

// ── Close modal ───────────────────────────────────────────
function closeModal() { modalOv.style.display = "none"; }
document.getElementById("btnCancel")?.addEventListener("click",  closeModal);
document.getElementById("btnCancel2")?.addEventListener("click", closeModal);

// ── Init ──────────────────────────────────────────────────
loadTemplates();
