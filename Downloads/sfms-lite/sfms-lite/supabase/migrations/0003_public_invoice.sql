-- ============================================================
-- PUBLIC INVOICE ACCESS — fungsi khusus agar orang tua bisa
-- melihat & membayar tagihan TANPA perlu akun login, namun tetap
-- aman: hanya bisa akses 1 bill spesifik via invoice_token (UUID
-- acak), tidak bisa melihat data sekolah/siswa lain.
-- ============================================================

-- 1. Ambil detail 1 tagihan berdasarkan token (read-only, terbatas)
create or replace function get_invoice_by_token(p_token text)
returns table (
  bill_id uuid, school_name text, student_name text,
  billing_type_name text, period text, amount numeric,
  amount_paid numeric, due_date date, status text
)
language sql security definer stable as $$
  select b.id, sc.name, st.name, bt.name, b.period, b.amount, b.amount_paid, b.due_date, b.status
  from bills b
  join schools sc on sc.id = b.school_id
  join students st on st.id = b.student_id
  join billing_types bt on bt.id = b.billing_type_id
  where b.invoice_token = p_token;
$$;

grant execute on function get_invoice_by_token(text) to anon, authenticated;

-- 2. Submit pembayaran manual dari halaman invoice publik (orang tua)
create or replace function submit_invoice_payment(
  p_token text, p_amount numeric, p_proof_url text
) returns uuid
language plpgsql security definer as $$
declare
  v_bill_id uuid;
  v_school_id uuid;
  v_payment_id uuid;
begin
  select id, school_id into v_bill_id, v_school_id from bills where invoice_token = p_token;
  if v_bill_id is null then
    raise exception 'Invoice tidak ditemukan';
  end if;

  insert into payments (school_id, bill_id, amount, method, status, proof_url)
  values (v_school_id, v_bill_id, p_amount, 'manual_transfer', 'menunggu_verifikasi', p_proof_url)
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

grant execute on function submit_invoice_payment(text, numeric, text) to anon, authenticated;

-- ============================================================
-- STORAGE: bucket untuk bukti transfer
-- Jalankan ini, ATAU buat manual via Dashboard > Storage > New Bucket
-- nama bucket: payment-proofs, set Public = true (read public,
-- supaya bendahara bisa langsung lihat link bukti).
-- ============================================================

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', true)
on conflict (id) do nothing;

-- Izinkan siapa pun (termasuk orang tua tanpa login) mengupload bukti.
-- Risiko diterima untuk MVP: file yang diupload tetap harus diverifikasi
-- manual oleh bendahara sebelum status tagihan berubah.
create policy "Public upload bukti transfer"
on storage.objects for insert
with check (bucket_id = 'payment-proofs');

create policy "Public read bukti transfer"
on storage.objects for select
using (bucket_id = 'payment-proofs');
