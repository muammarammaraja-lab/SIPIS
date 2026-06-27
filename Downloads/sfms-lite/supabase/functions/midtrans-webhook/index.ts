import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MIDTRANS_SERVER_KEY = Deno.env.get("MIDTRANS_SERVER_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function sha512Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-512", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function mapMethod(paymentType: string): string {
  if (paymentType === "qris") return "qris";
  if (paymentType === "gopay" || paymentType === "shopeepay") return "e_wallet";
  if (paymentType === "bank_transfer" || paymentType === "echannel" || paymentType === "permata_va") return "virtual_account";
  return "qris";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid body" }), { status: 400 });
  }

  const { order_id, status_code, gross_amount, signature_key, transaction_status, payment_type } = body;

  if (!order_id || !signature_key) {
    return new Response(JSON.stringify({ error: "Payload tidak lengkap" }), { status: 400 });
  }

  const expectedSignature = await sha512Hex(`${order_id}${status_code}${gross_amount}${MIDTRANS_SERVER_KEY}`);
  if (expectedSignature !== signature_key) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 403 });
  }

  const { data: payment, error } = await supabase
    .from("payments")
    .select("*, bills(*)")
    .eq("gateway_order_id", order_id)
    .single();

  if (error || !payment) {
    return new Response(JSON.stringify({ error: "Payment tidak ditemukan" }), { status: 404 });
  }

  const isSuccess = transaction_status === "settlement" ||
  (transaction_status === "capture" && body.fraud_status === "accept");
  const isFailed = ["deny", "cancel", "expire"].includes(transaction_status);

  if (isSuccess && payment.status !== "diterima") {
    await supabase.from("payments").update({ status: "diterima", verified_at: new Date().toISOString() }).eq("id", payment.id);

    const bill: any = payment.bills;
    const newPaid = Number(bill.amount_paid || 0) + Number(payment.amount);
    const newStatus = newPaid >= Number(bill.amount) ? "lunas" : "sebagian_bayar";
    await supabase.from("payments").update({ status: "diterima", verified_at: new Date().toISOString(), method: mapMethod(payment_type) }).eq("id", payment.id);
  } else if (isFailed) {
    await supabase.from("payments").update({ status: "ditolak", method: mapMethod(payment_type) }).eq("id", payment.id);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});