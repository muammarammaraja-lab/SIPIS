// ============================================================
// SFMS LITE — Pengaturan Sekolah v1.0
// Akses: kepala_sekolah + operator_sekolah
// Kolom schools: id, name, npsn, address, phone,
//                app_name, logo_url, theme_color, is_active
// ============================================================
import { supabase } from "./supabaseClient.js";
import { requireAuth, applyRoleVisibility } from "./auth.js";
import { showToast, qs } from "./utils.js";

const auth = await requireAuth();
if (!auth) throw new Error("Unauthenticated");
const { profile } = auth;
applyRoleVisibility(profile);

// Guard: hanya kepala_sekolah + operator_sekolah
const ALLOWED = ["kepala_sekolah", "operator_sekolah", "super_admin"];
if (!ALLOWED.includes(profile.role)) {
  document.getElementById("pageContent").innerHTML = `
    <div class="panel"><div class="panel-body padded">
      <div class="empty-state">
        <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
        <div class="empty-title">Akses Ditolak</div>
        <div class="empty-desc">Hanya Kepala Sekolah dan Operator Sekolah yang dapat mengakses pengaturan ini.</div>
      </div>
    </div></div>`;
  throw new Error("Access denied");
}

const schoolId = profile.school_id;
let schoolData = {};

// ── Preset warna ──────────────────────────────────────────
const COLOR_PRESETS = [
  { color: "#1e3a5f", label: "Navy (default)" },
  { color: "#1d4ed8", label: "Biru" },
  { color: "#0f6e56", label: "Hijau teal" },
  { color: "#7c3aed", label: "Ungu" },
  { color: "#9f1239", label: "Merah" },
  { color: "#92400e", label: "Coklat" },
  { color: "#374151", label: "Abu-abu" },
];

// ── Load data sekolah ─────────────────────────────────────
async function loadSchool() {
  const { data, error } = await supabase
    .from("schools")
    .select("*")
    .eq("id", schoolId)
    .single();

  if (error || !data) {
    showToast("Gagal memuat data sekolah.", "error");
    return;
  }

  schoolData = data;
  renderPage();
}

// ── Render halaman ────────────────────────────────────────
function renderPage() {
  const s = schoolData;
  const themeColor = s.theme_color ?? "#1e3a5f";

  const colorSwatches = COLOR_PRESETS.map(p => `
    <div class="color-swatch ${p.color === themeColor ? "active" : ""}"
         style="background:${p.color}"
         data-color="${p.color}"
         title="${p.label}"></div>
  `).join("");

  document.getElementById("pageContent").innerHTML = `

    <!-- Identitas Sekolah -->
    <div class="panel" style="margin-bottom:16px">
      <div class="panel-head">
        <h2><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> Identitas sekolah</h2>
      </div>
      <div class="panel-body padded" style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label>Nama Sekolah <span style="color:var(--red)">*</span></label>
          <input type="text" id="f_name" value="${esc(s.name)}" placeholder="cth: SDIT Sinjai" />
        </div>
        <div>
          <label>Nama Aplikasi</label>
          <input type="text" id="f_app_name" value="${esc(s.app_name ?? "SFMS Lite")}" placeholder="SFMS Lite" />
          <div class="form-hint">Tampil di judul browser dan brand sidebar</div>
        </div>
        <div>
          <label>NPSN</label>
          <input type="text" id="f_npsn" value="${esc(s.npsn)}" placeholder="Nomor Pokok Sekolah Nasional" />
        </div>
        <div>
          <label>Alamat</label>
          <input type="text" id="f_address" value="${esc(s.address)}" placeholder="Jl. Contoh No. 1, Sinjai" />
        </div>
        <div>
          <label>No. Telepon</label>
          <input type="text" id="f_phone" value="${esc(s.phone)}" placeholder="+62411xxxxxx" />
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;padding:12px 20px;border-top:var(--border);background:var(--grey-50)">
        <button class="btn btn-primary" id="btnSaveIdentity">Simpan identitas</button>
      </div>
    </div>

    <!-- Logo Sekolah -->
    <div class="panel" style="margin-bottom:16px">
      <div class="panel-head">
        <h2><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Logo sekolah</h2>
      </div>
      <div class="panel-body padded">
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
          <div id="logoPreview" style="width:72px;height:72px;border-radius:12px;border:2px dashed var(--grey-300);display:flex;align-items:center;justify-content:center;background:var(--grey-50);flex-shrink:0;overflow:hidden;cursor:pointer" onclick="document.getElementById('logoInput').click()">
            ${s.logo_url
              ? `<img src="${s.logo_url}" style="width:100%;height:100%;object-fit:cover" />`
              : `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--grey-300)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`}
          </div>
          <div style="flex:1;min-width:180px">
            <p style="font-size:13px;font-weight:600;color:var(--grey-700);margin-bottom:4px">Logo sekolah</p>
            <p style="font-size:12px;color:var(--grey-400);margin-bottom:10px">PNG atau JPG · Maks. 1 MB · Tampil di sudut sidebar</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <label class="btn btn-ghost btn-sm" for="logoInput" style="cursor:pointer">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Pilih file
              </label>
              ${s.logo_url ? `<button class="btn btn-ghost btn-sm" id="btnRemoveLogo" style="color:var(--red)">Hapus logo</button>` : ""}
            </div>
            <input type="file" id="logoInput" accept="image/png,image/jpeg,image/webp" style="display:none" />
          </div>
        </div>
        <div id="logoFileName" style="font-size:12px;color:var(--grey-500);margin-top:8px"></div>
      </div>
      <div style="display:flex;justify-content:flex-end;padding:12px 20px;border-top:var(--border);background:var(--grey-50)">
        <button class="btn btn-primary" id="btnSaveLogo">Simpan logo</button>
      </div>
    </div>

    <!-- Warna Tema -->
    <div class="panel" style="margin-bottom:16px">
      <div class="panel-head">
        <h2><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="0.5"/><circle cx="17.5" cy="10.5" r="0.5"/><circle cx="8.5" cy="7.5" r="0.5"/><circle cx="6.5" cy="12.5" r="0.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg> Warna tema sidebar</h2>
      </div>
      <div class="panel-body padded">
        <p style="font-size:12.5px;color:var(--grey-500);margin-bottom:14px">Pilih warna utama sidebar. Berlaku langsung setelah disimpan.</p>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px">
          ${colorSwatches}
          <div style="display:flex;align-items:center;gap:6px;margin-left:4px">
            <input type="color" id="customColor" value="${themeColor}" title="Warna kustom"
              style="width:32px;height:32px;border:none;padding:0;background:none;cursor:pointer;border-radius:6px" />
            <span style="font-size:12px;color:var(--grey-500)">Kustom</span>
          </div>
        </div>
        <!-- Preview sidebar -->
        <div style="border:1px solid var(--grey-200);border-radius:10px;overflow:hidden">
          <div id="previewSidebar" style="padding:12px 16px;display:flex;align-items:center;gap:10px;background:${themeColor};transition:background .25s">
            <div style="width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,.13);display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <div>
              <div style="font-size:13px;font-weight:700;color:#fff" id="prevAppLabel">${esc(s.app_name ?? "SFMS Lite")}</div>
              <div style="font-size:11px;color:rgba(255,255,255,.5)" id="prevSchoolLabel">${esc(s.name)}</div>
            </div>
          </div>
          <div style="padding:10px 12px;background:var(--grey-50);display:flex;gap:6px">
            <div id="previewNavActive" style="display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:5px;font-size:12px;font-weight:600;color:#fff;background:${themeColor};transition:background .25s">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              Dashboard
            </div>
            <div style="display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:5px;font-size:12px;color:var(--grey-500)">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
              Tagihan
            </div>
          </div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px 20px;border-top:var(--border);background:var(--grey-50)">
        <button class="btn btn-ghost btn-sm" id="btnResetColor">Reset default</button>
        <button class="btn btn-primary" id="btnSaveColor">Simpan tema</button>
      </div>
    </div>

  `;

  attachEvents();
}

// ── Escape helper ─────────────────────────────────────────
function esc(v) { return (v ?? "").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }

// ── Attach semua event listener ───────────────────────────
function attachEvents() {

  // Live preview nama saat mengetik
  document.getElementById("f_name")?.addEventListener("input", e => {
    document.getElementById("prevSchoolLabel").textContent = e.target.value || "Nama Sekolah";
    document.querySelectorAll("[data-school-name]").forEach(el => el.textContent = e.target.value);
  });
  document.getElementById("f_app_name")?.addEventListener("input", e => {
    document.getElementById("prevAppLabel").textContent = e.target.value || "SFMS Lite";
    document.querySelectorAll("[data-app-name]").forEach(el => el.textContent = e.target.value);
  });

  // Simpan identitas
  document.getElementById("btnSaveIdentity")?.addEventListener("click", saveIdentity);

  // Warna — swatches
  document.querySelectorAll(".color-swatch").forEach(el => {
    el.style.cssText += `width:32px;height:32px;border-radius:8px;cursor:pointer;border:2.5px solid transparent;transition:transform .12s,border-color .12s;flex-shrink:0`;
    el.addEventListener("click", () => {
      document.querySelectorAll(".color-swatch").forEach(s => s.style.borderColor = "transparent");
      el.style.borderColor = "#1e293b";
      const c = el.dataset.color;
      document.getElementById("customColor").value = c;
      applyColorPreview(c);
    });
    // Tandai active
    if (el.classList.contains("active")) el.style.borderColor = "#1e293b";
  });

  // Warna — color picker kustom
  document.getElementById("customColor")?.addEventListener("input", e => {
    document.querySelectorAll(".color-swatch").forEach(s => s.style.borderColor = "transparent");
    applyColorPreview(e.target.value);
  });

  // Reset warna
  document.getElementById("btnResetColor")?.addEventListener("click", () => {
    document.getElementById("customColor").value = "#1e3a5f";
    document.querySelectorAll(".color-swatch").forEach(s => s.style.borderColor = "transparent");
    document.querySelector('.color-swatch[data-color="#1e3a5f"]').style.borderColor = "#1e293b";
    applyColorPreview("#1e3a5f");
  });

  // Simpan warna
  document.getElementById("btnSaveColor")?.addEventListener("click", saveColor);

  // Logo — preview sebelum upload
  document.getElementById("logoInput")?.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) { showToast("Ukuran file maks. 1 MB.", "error"); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      document.getElementById("logoPreview").innerHTML =
        `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover" />`;
    };
    reader.readAsDataURL(file);
    document.getElementById("logoFileName").textContent = `File dipilih: ${file.name}`;
  });

  // Simpan logo
  document.getElementById("btnSaveLogo")?.addEventListener("click", saveLogo);

  // Hapus logo
  document.getElementById("btnRemoveLogo")?.addEventListener("click", removeLogo);
}

// ── Simpan identitas ──────────────────────────────────────
async function saveIdentity() {
  const name     = document.getElementById("f_name").value.trim();
  const app_name = document.getElementById("f_app_name").value.trim() || "SFMS Lite";
  const npsn     = document.getElementById("f_npsn").value.trim() || null;
  const address  = document.getElementById("f_address").value.trim() || null;
  const phone    = document.getElementById("f_phone").value.trim() || null;

  if (!name) { showToast("Nama sekolah wajib diisi.", "error"); return; }

  const btn = document.getElementById("btnSaveIdentity");
  btn.disabled = true; btn.textContent = "Menyimpan...";

  const { error } = await supabase
    .from("schools")
    .update({ name, app_name, npsn, address, phone })
    .eq("id", schoolId);

  btn.disabled = false; btn.textContent = "Simpan identitas";

  if (error) { showToast("Gagal menyimpan: " + error.message, "error"); return; }

  schoolData = { ...schoolData, name, app_name, npsn, address, phone };

  // Update sidebar live
  document.querySelectorAll("[data-school-name]").forEach(el => el.textContent = name);
  document.querySelectorAll("[data-app-name]").forEach(el => el.textContent = app_name);
  document.title = `Pengaturan Sekolah — ${app_name}`;

  showToast("Identitas sekolah disimpan.", "success");
}

// ── Preview warna ─────────────────────────────────────────
function applyColorPreview(color) {
  document.getElementById("previewSidebar").style.background = color;
  document.getElementById("previewNavActive").style.background = color;
}

// ── Simpan warna tema ─────────────────────────────────────
async function saveColor() {
  const theme_color = document.getElementById("customColor").value;
  const btn = document.getElementById("btnSaveColor");
  btn.disabled = true; btn.textContent = "Menyimpan...";

  const { error } = await supabase
    .from("schools")
    .update({ theme_color })
    .eq("id", schoolId);

  btn.disabled = false; btn.textContent = "Simpan tema";

  if (error) { showToast("Gagal menyimpan tema: " + error.message, "error"); return; }

  schoolData.theme_color = theme_color;
  applyThemeColor(theme_color);
  showToast("Tema warna disimpan. Refresh halaman lain untuk melihat perubahan.", "success");
}

// ── Apply tema ke sidebar halaman ini ────────────────────
function applyThemeColor(color) {
  const style = document.getElementById("_themeStyle") ?? (() => {
    const s = document.createElement("style");
    s.id = "_themeStyle";
    document.head.appendChild(s);
    return s;
  })();
  style.textContent = `.sidebar { background: ${color} !important; }
    .sidebar nav a.active { background: rgba(255,255,255,0.14) !important; }`;
}

// ── Upload logo ke Supabase Storage ──────────────────────
async function saveLogo() {
  const input = document.getElementById("logoInput");
  const file  = input.files[0];
  if (!file) { showToast("Pilih file logo terlebih dahulu.", "error"); return; }

  const btn = document.getElementById("btnSaveLogo");
  btn.disabled = true; btn.textContent = "Mengupload...";

  const ext  = file.name.split(".").pop();
  const path = `logos/${schoolId}.${ext}`;

  // Upload ke bucket "school-assets" (buat bucket ini di Supabase Storage)
  const { error: upErr } = await supabase.storage
    .from("school-assets")
    .upload(path, file, { upsert: true });

  if (upErr) {
    btn.disabled = false; btn.textContent = "Simpan logo";
    showToast("Gagal upload: " + upErr.message, "error");
    return;
  }

  const { data: urlData } = supabase.storage
    .from("school-assets")
    .getPublicUrl(path);

  const logo_url = urlData.publicUrl + "?t=" + Date.now(); // cache busting

  const { error } = await supabase
    .from("schools")
    .update({ logo_url })
    .eq("id", schoolId);

  btn.disabled = false; btn.textContent = "Simpan logo";

  if (error) { showToast("Gagal simpan URL logo: " + error.message, "error"); return; }

  schoolData.logo_url = logo_url;
  document.getElementById("logoFileName").textContent = "";
  input.value = "";
  showToast("Logo berhasil disimpan.", "success");
}

// ── Hapus logo ────────────────────────────────────────────
async function removeLogo() {
  const { error } = await supabase
    .from("schools")
    .update({ logo_url: null })
    .eq("id", schoolId);

  if (error) { showToast("Gagal hapus logo: " + error.message, "error"); return; }

  schoolData.logo_url = null;
  document.getElementById("logoPreview").innerHTML =
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--grey-300)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
  document.getElementById("btnRemoveLogo")?.remove();
  showToast("Logo dihapus.", "success");
}

// ── Apply tema saat halaman load ──────────────────────────
async function applyStoredTheme() {
  if (schoolData.theme_color) applyThemeColor(schoolData.theme_color);
}

// ── Tambah menu Pengaturan ke sidebar semua halaman ───────
// (fungsi ini bisa di-import dari utils di masa depan)

// ── Init ──────────────────────────────────────────────────
await loadSchool();
applyStoredTheme();
