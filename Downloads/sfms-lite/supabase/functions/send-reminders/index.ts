// ============================================================
// SFMS LITE — Edge Function: send-reminders
// Dijalankan setiap hari jam 08:00 oleh cron eksternal (cron-job.org)
// atau pg_cron. Logic: tanggal 1 = Friendly, 5 = Medium, 10 = Final.
// Provider WA: Fonnte (pay-per-message, tanpa biaya bulanan).
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FONNTE_TOKEN = Deno.env.get("FONNTE_TOKEN")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ---- 1. Tentukan tipe reminder berdasarkan tanggal hari ini ----
function getReminderType(date: Date): "friendly" | "medium" | "final" | null {
  const day = date.getDate();
  if (day === 1) return "friendly";
  if (day === 5) return "medium";
  if (day === 10) return "final";
  return null;
}

// ---- 2. Template pesan sederhana (bisa dipindah ke tabel wa_templates nanti) ----
function renderTemplate(type: string, items: { nama_siswa: string; kelas: string; bulan: string; nominal: number }[]) {
  const total = items.reduce((s, i) => s + i.nominal, 0);
  const rincian = items
    .map((i) => `- ${i.nama_siswa} (${i.kelas}): Rp${i.nominal.toLocaleString("id-ID")} (${i.bulan})`)
    .join("\n");

  const greeting =
    type === "friendly"
      ? "Mengingatkan dengan baik"
      : type === "medium"
      ? "Mohon perhatian"
      : "Pemberitahuan penting (terakhir)";

  return (
    `${greeting}, Bapak/Ibu Orang Tua/Wali.\n\n` +
    `Berikut tagihan yang belum lunas:\n${rincian}\n\n` +
    `Total: Rp${total.toLocaleString("id-ID")}\n\n` +
    `Silakan lakukan pembayaran sesegera mungkin. Terima kasih.`
  );
}

// ---- 3. Kirim via Fonnte ----
async function sendWhatsApp(to: string, message: string) {
  const res = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: FONNTE_TOKEN,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ target: to, message }),
  });
  return { ok: res.ok, body: await res.json().catch(() => ({})) };
}

Deno.serve(async (_req) => {
  const today = new Date();
  const reminderType = getReminderType(today);

  if (!reminderType) {
    return new Response(JSON.stringify({ skipped: true, reason: "Bukan tanggal 1/5/10" }), { status: 200 });
  }

  // Ambil seluruh tagihan yang belum lunas, belum dibatalkan, belum dispensasi
  const { data: bills, error } = await supabase
    .from("bills")
    .select(`
      id, school_id, amount, amount_paid, period, status,
      students ( name, parent_whatsapp ),
      classes:students(class_id), 
      billing_types ( name )
    `)
    .not("status", "in", "(lunas,dibatalkan,dispensasi)");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // Group per nomor WA orang tua (Split Billing sederhana)
  const grouped: Record<string, { school_id: string; bill_ids: string[]; items: any[] }> = {};

  for (const b of bills ?? []) {
    const student: any = b.students;
    if (!student?.parent_whatsapp) continue;
    const key = student.parent_whatsapp;
    if (!grouped[key]) grouped[key] = { school_id: b.school_id, bill_ids: [], items: [] };
    grouped[key].bill_ids.push(b.id);
    grouped[key].items.push({
      nama_siswa: student.name,
      kelas: "-", // catatan: join nama kelas bisa ditambahkan dgn query terpisah jika perlu
      bulan: b.period ?? "-",
      nominal: Number(b.amount) - Number(b.amount_paid ?? 0),
    });
  }

  const results: any[] = [];

  for (const [phone, group] of Object.entries(grouped)) {
    const message = renderTemplate(reminderType, group.items);
    const sendResult = await sendWhatsApp(phone, message);

    // Catat log
    await supabase.from("wa_logs").insert(
      group.bill_ids.map((billId) => ({
        school_id: group.school_id,
        bill_id: billId,
        recipient_number: phone,
        reminder_type: reminderType,
        status: sendResult.ok ? "sent" : "failed",
        provider_response: sendResult.body,
      }))
    );

    // Update last_reminder_type pada setiap bill agar idempotent
    await supabase
      .from("bills")
      .update({ last_reminder_type: reminderType, last_reminder_sent_at: new Date().toISOString() })
      .in("id", group.bill_ids);

    results.push({ phone, sent: sendResult.ok, billCount: group.bill_ids.length });
  }

  return new Response(JSON.stringify({ reminderType, totalRecipients: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
