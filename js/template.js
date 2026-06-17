// ============================================================
// SFMS LITE — Template Pesan WA (friendly/medium/final)
// ============================================================

import { supabase } from "./supabaseClient.js";
import { requireAuth, applyRoleVisibility } from "./auth.js";
import { showToast } from "./utils.js";

const auth = await requireAuth();
let mySchoolId = null;

const TYPES = [
  { key: "friendly", label: "Friendly Reminder (Tanggal 1)", defaultBody:
    "Mengingatkan dengan baik, Bapak/Ibu Orang Tua/Wali.\n\nBerikut tagihan {{nama_siswa}} ({{kelas}}) bulan {{bulan}}:\nNominal: {{nominal}}\nJatuh tempo: {{jatuh_tempo}}\n\nSilakan lakukan pembayaran melalui: {{link_pembayaran}}\n\nTerima kasih." },
  { key: "medium", label: "Medium Reminder (Tanggal 5)", defaultBody:
    "Mohon perhatian, Bapak/Ibu Orang Tua/Wali.\n\nTagihan {{nama_siswa}} ({{kelas}}) bulan {{bulan}} sebesar {{nominal}} belum kami terima, sudah melewati jatuh tempo {{jatuh_tempo}}.\n\nSilakan lakukan pembayaran melalui: {{link_pembayaran}}\n\nTerima kasih." },
  { key: "final", label: "Final Reminder (Tanggal 10)", defaultBody:
    "Pemberitahuan penting (terakhir), Bapak/Ibu Orang Tua/Wali.\n\nTagihan {{nama_siswa}} ({{kelas}}) bulan {{bulan}} sebesar {{nominal}} masih belum terbayar. Mohon segera diselesaikan untuk menghindari tindak lanjut dari pihak sekolah.\n\nBayar melalui: {{link_pembayaran}}\n\nTerima kasih." },
];

if (auth) {
  applyRoleVisibility(auth.profile);
  mySchoolId = auth.profile.school_id;
  render();
}

async function render() {
  const { data } = await supabase.from("wa_templates").select("*").eq("school_id", mySchoolId);
  const byType = {};
  (data || []).forEach(t => byType[t.reminder_type] = t);

  const container = document.getElementById("templateCards");
  container.innerHTML = TYPES.map(t => {
    const existing = byType[t.key];
    return `
      <div class="panel" style="margin-bottom:18px">
        <div class="panel-head"><h2>${t.label}</h2></div>
        <div class="panel-body">
          <textarea data-type="${t.key}" rows="6" style="font-family:inherit">${existing ? existing.body : t.defaultBody}</textarea>
          <div style="display:flex;justify-content:flex-end">
            <button class="btn btn-primary btn-sm" data-save="${t.key}">Simpan Template</button>
          </div>
        </div>
      </div>`;
  }).join("");

  container.querySelectorAll("[data-save]").forEach(btn => {
    btn.addEventListener("click", () => saveTemplate(btn.dataset.save, byType[btn.dataset.save]?.id));
  });
}

async function saveTemplate(type, existingId) {
  const body = document.querySelector(`textarea[data-type="${type}"]`).value;
  const payload = { school_id: mySchoolId, reminder_type: type, body, is_active: true };

  const { error } = existingId
    ? await supabase.from("wa_templates").update(payload).eq("id", existingId)
    : await supabase.from("wa_templates").insert(payload);

  if (error) {
    showToast("Gagal menyimpan template: " + error.message, "error");
    return;
  }
  showToast("Template tersimpan.", "success");
  render();
}
