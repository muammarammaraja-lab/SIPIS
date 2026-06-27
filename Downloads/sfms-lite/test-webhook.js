const crypto = require('crypto');

const SERVER_KEY = 'Mid-server-xteyKNhTK3ylhkREVKTxIPtP';
const orderId = 'SFMS1781754631587f30878683d';
const statusCode = '202';
const grossAmount = '10000.00';

const signature = crypto.createHash('sha512')
  .update(orderId + statusCode + grossAmount + SERVER_KEY)
  .digest('hex');

const payload = {
  order_id: orderId,
  status_code: statusCode,
  gross_amount: grossAmount,
  signature_key: signature,
  transaction_status: 'expire',
  payment_type: 'bank_transfer',
};

fetch('https://indjyxvhyjuzybmxxhqm.supabase.co/functions/v1/midtrans-webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
}).then(res => res.json()).then(console.log).catch(console.error);