-- ============================================================
-- PAYMENT GATEWAY (Midtrans): tambah kolom untuk melacak
-- order_id Midtrans pada record payments, supaya webhook bisa
-- mencocokkan notifikasi dengan transaksi yang benar.
-- ============================================================

alter table payments add column if not exists gateway_order_id text unique;
