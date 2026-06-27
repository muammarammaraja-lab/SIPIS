// ============================================================
// SFMS LITE — Edge Function: send-reminders
// Dijalankan setiap hari jam 08:00 oleh cron eksternal (cron-job.org)
// atau pg_cron. Logic: tanggal 1 = Friendly, 5 = Medium, 10 = Final.
// Provider WA: Fonnte (pay-per-message, tanpa biaya bulanan).
// Template diambil dari tabel wa_templates (bisa diedit dari UI),
// dengan fallback ke template default kalau sekolah belum mengatur.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FONNTE_TOKEN = Deno.env.get("FONNTE_TOKEN")!;
// URL frontend untuk membangun link invoice, contoh: https://sipis.vercel.app
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const DEFAULT_TEMPLATES: Record<string, string> = {
  friendly:
    "Mengingatkan dengan baik, Bapak/Ibu Orang Tua/Wali.\n\n{{rincian}}\n\nTotal: {{total}}\n\nSilakan lakukan pembayaran melalui: {{link_pembayaran}}\n\nTerima kasih.",
  medium:
    "Mohon perhatian, Bapak/Ibu Orang Tua/Wali.\n\n{{rincian}}\n\nTotal: {{total}}\n\nMohon segera dilunasi. Bayar melalui: {{link_pembayaran}}\n\nTerima kasih.",
  final:
    "Pemberitahuan penting (terakhir), Bapak/Ibu Orang Tua/Wali.\n\n{{rincian}}\n\nTotal: {{total}}\n\nMohon segera diselesaikan untuk menghindari tindak lanjut dari pihak sekolah. Bayar melalui: {{link_pembayaran}}\n\nTerima kasih.",
};

function getReminderType(date: Date): "friendly" | "medium" | "final" | null {
  const day = date.getDate();
  if (day === 1) return "friendly";
  if (day === 5) return "medium";
  if (day === 10) return "final";
  return null;
}

function formatRupiah(n: number) {
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}
function formatDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

// Cache template per (school_id + type) supaya tidak query berulang
const templateCache = new Map<string, string>();
async function getTemplateBody(schoolId: string, type: string): Promise<string> {
  const cacheKey = `${schoolId}:${type}`;
  if (templateCache.has(cacheKey)) return templateCache.get(cacheKey)!;

  const { data } = await supabase
    .from("wa_templates")
    .select("body")
    .eq("school_id", schoolId)
    .eq("reminder_type", type)
    .eq("is_active", true)
    .maybeSingle();

  const body = data?.body ?? DEFAULT_TEMPLATES[type];
  templateCache.set(cacheKey, body);
  return body;
}

type Item = {
  nama_siswa: string;
  kelas: string;
  bulan: string;
  nominal: number;
  jatuh_tempo: string | null;
  invoice_token: string;
};

async function renderTemplate(schoolId: string, type: string, items: Item[]) {
  const template = await getTemplateBody(schoolId, type);
  const total = items.reduce((s, i) => s + i.nominal, 0);
  const rincian = items
    .map((i) => `- ${i.nama_siswa} (${i.kelas}): ${formatRupiah(i.nominal)} (${i.bulan}, jatuh tempo ${formatDate(i.jatuh_tempo)})`)
    .join("\n");

  const first = items[0];
  const linkPembayaran = APP_BASE_URL ? `${APP_BASE_URL}/invoice.html?t=${first.invoice_token}` : "(hubungi sekolah untuk link pembayaran)";

  return template
    .replaceAll("{{rincian}}", rincian)
    .replaceAll("{{total}}", formatRupiah(total))
    .replaceAll("{{nama_siswa}}", first.nama_siswa)
    .replaceAll("{{kelas}}", first.kelas)
    .replaceAll("{{bulan}}", first.bulan)
    .replaceAll("{{nominal}}", formatRupiah(first.nominal))
    .replaceAll("{{jatuh_tempo}}", formatDate(first.jatuh_tempo))
    .replaceAll("{{link_pembayaran}}", linkPembayaran);
}

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
  const reminderType = getReminderType(today) ?? "friendly";

  if (!reminderType) {
    return new Response(JSON.stringify({ skipped: true, reason: "Bukan tanggal 1/5/10" }), { status: 200 });
  }

  const { data: bills, error } = await supabase
    .from("bills")
    .select(`
      id, school_id, amount, amount_paid, period, due_date, invoice_token, status,
      students ( name, parent_whatsapp, classes ( name ) ),
      billing_types ( name )
    `)
    .not("status", "in", "(lunas,dibatalkan,dispensasi)");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const grouped: Record<string, { school_id: string; bill_ids: string[]; items: Item[] }> = {};

  for (const b of bills ?? []) {
    const student: any = b.students;
    if (!student?.parent_whatsapp) continue;
    const key = student.parent_whatsapp;
    if (!grouped[key]) grouped[key] = { school_id: b.school_id, bill_ids: [], items: [] };
    grouped[key].bill_ids.push(b.id);
    grouped[key].items.push({
      nama_siswa: student.name,
      kelas: student.classes?.name ?? "-",
      bulan: b.period ?? "-",
      nominal: Number(b.amount) - Number(b.amount_paid ?? 0),
      jatuh_tempo: b.due_date,
      invoice_token: b.invoice_token,
    });
  }

  const results: any[] = [];

  for (const [phone, group] of Object.entries(grouped)) {
    const message = await renderTemplate(group.school_id, reminderType, group.items);
    const sendResult = await sendWhatsApp(phone, message);

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
