// ============================================================
// SFMS LITE — Edge Function: midtrans-charge
// Dipanggil dari halaman invoice publik (tanpa login) untuk
// membuat transaksi Midtrans Snap (QRIS/VA/E-Wallet otomatis).
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MIDTRANS_SERVER_KEY = Deno.env.get("MIDTRANS_SERVER_KEY")!;
const MIDTRANS_ENV = Deno.env.get("MIDTRANS_ENV") ?? "sandbox"; // "sandbox" atau "production"

const MIDTRANS_BASE = MIDTRANS_ENV === "production"
  ? "https://app.midtrans.com"
  : "https://app.sandbox.midtrans.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body request tidak valid" }, 400);
  }

  const { token } = body;
  if (!token) return json({ error: "token wajib diisi" }, 400);

  const { data: bill, error } = await supabase
    .from("bills")
    .select("id, school_id, amount, amount_paid, status, students(name, parent_whatsapp)")
    .eq("invoice_token", token)
    .single();

  if (error || !bill) return json({ error: "Invoice tidak ditemukan" }, 404);
  if (bill.status === "lunas") return json({ error: "Tagihan ini sudah lunas" }, 400);

  const remaining = Math.round(Number(bill.amount) - Number(bill.amount_paid || 0));
  if (remaining <= 0) return json({ error: "Tidak ada sisa tagihan untuk dibayar" }, 400);

  const orderId = `SFMS-${bill.id}-${Date.now()}`;
  const student: any = bill.students;

  const chargeRes = await fetch(`${MIDTRANS_BASE}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: "Basic " + btoa(MIDTRANS_SERVER_KEY + ":"),
    },
    body: JSON.stringify({
      transaction_details: { order_id: orderId, gross_amount: remaining },
      customer_details: {
        first_name: student?.name ?? "Orang Tua/Wali",
        phone: student?.parent_whatsapp ?? "",
      },
      credit_card: { secure: true },
    }),
  });

  const chargeData = await chargeRes.json();
  if (!chargeRes.ok) {
    return json({ error: chargeData.error_messages?.join(", ") ?? "Gagal membuat transaksi Midtrans" }, 400);
  }

  const { error: insertErr } = await supabase.from("payments").insert({
    school_id: bill.school_id,
    bill_id: bill.id,
    amount: remaining,
    method: "qris",
    status: "menunggu_verifikasi",
    gateway_order_id: orderId,
  });

  if (insertErr) return json({ error: "Gagal mencatat transaksi: " + insertErr.message }, 500);

  return json({ snap_token: chargeData.token, redirect_url: chargeData.redirect_url });
});
