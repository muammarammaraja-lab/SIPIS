// ============================================================
// SFMS LITE — Login Handler
// ============================================================
import { supabase } from "./supabaseClient.js";

// Kalau sudah login, langsung redirect ke dashboard
const { data: { session } } = await supabase.auth.getSession();
if (session) window.location.href = "dashboard.html";

const btnLogin = document.getElementById("btnLogin");
const errMsg   = document.getElementById("errMsg");

btnLogin.addEventListener("click", async () => {
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    showError("Email dan password wajib diisi.");
    return;
  }

  btnLogin.disabled = true;
  btnLogin.textContent = "Masuk...";
  errMsg.style.display = "none";

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    showError("Email atau password salah. Silakan coba lagi.");
    btnLogin.disabled = false;
    btnLogin.textContent = "Masuk";
    return;
  }

  window.location.href = "dashboard.html";
});

// Submit on Enter key
document.getElementById("password").addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnLogin.click();
});

function showError(msg) {
  errMsg.textContent = msg;
  errMsg.style.display = "flex";
}
