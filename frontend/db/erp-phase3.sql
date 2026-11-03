-- =========================================================
-- KANTOONG ERP — FASE 3: PEMBELIAN, LOGISTIK, CUSTOMER SERVICE,
--                        MARKETING (VOUCHER), CRM PELANGGAN
-- File: frontend/db/erp-phase3.sql
--
-- Jalankan SEKALI di Supabase > SQL Editor > New query > Run,
-- SETELAH erp-foundation.sql, erp-phase2.sql, erp-security.sql.
-- Aman dijalankan ulang.
--
-- ALUR YANG SALING TERSAMBUNG:
--  PO diterima      -> stok gudang +, harga modal tercatat, jurnal Persediaan/Utang
--  PO dibayar       -> jurnal pelunasan utang
--  Pesanan dikirim  -> stok gudang -, nomor resi tersimpan
--  Retur diterima   -> stok kembali +, jurnal pengembalian dana
--  Voucher          -> diperiksa & dipotong di server saat checkout
-- =========================================================


-- ---------------------------------------------------------
-- 0. PENYESUAIAN
-- ---------------------------------------------------------
alter table public.products add column if not exists cost_price numeric(14, 0);

alter table public.journal_entries drop constraint if exists journal_entries_source_check;
alter table public.journal_entries add constraint journal_entries_source_check
    check (source in ('manual', 'pos', 'order', 'payroll', 'pengeluaran', 'pembelian', 'retur'));

alter table public.orders add column if not exists tracking_number   text;
alter table public.orders add column if not exists shipped_at        timestamptz;
alter table public.orders add column if not exists delivered_at      timestamptz;
alter table public.orders add column if not exists ship_warehouse_id uuid references public.warehouses(id) on delete set null;
alter table public.orders add column if not exists voucher_code      text;
alter table public.orders add column if not exists voucher_discount  numeric(14, 0) not null default 0;


-- =========================================================
-- 1. PEMBELIAN (SUPPLIER & PURCHASE ORDER)
-- =========================================================
create table if not exists public.suppliers (
    id           uuid primary key default gen_random_uuid(),
    name         text not null check (char_length(name) between 1 and 80),
    contact_name text check (contact_name is null or char_length(contact_name) <= 80),
    phone        text check (phone is null or char_length(phone) <= 20),
    email        text check (email is null or char_length(email) <= 120),
    address      text check (address is null or char_length(address) <= 200),
    note         text check (note is null or char_length(note) <= 300),
    is_active    boolean not null default true,
    created_at   timestamptz not null default now()
);

create sequence if not exists public.po_seq;

create table if not exists public.purchase_orders (
    id           uuid primary key default gen_random_uuid(),
    po_number    text not null unique,
    supplier_id  uuid not null references public.suppliers(id),
    warehouse_id uuid not null references public.warehouses(id),
    status       text not null default 'draft'
                 check (status in ('draft', 'dipesan', 'diterima', 'dibayar', 'dibatalkan')),
    note         text check (note is null or char_length(note) <= 300),
    total        numeric(14, 0) not null default 0,
    paid_method  text check (paid_method is null or paid_method in ('tunai', 'transfer')),
    created_by   uuid references public.members(id) on delete set null,
    created_at   timestamptz not null default now(),
    ordered_at   timestamptz,
    received_at  timestamptz,
    paid_at      timestamptz
);

create table if not exists public.purchase_order_lines (
    id         bigserial primary key,
    po_id      uuid not null references public.purchase_orders(id) on delete cascade,
    product_id text not null,
    qty        integer not null check (qty between 1 and 100000),
    unit_cost  numeric(14, 0) not null check (unit_cost >= 0)
);

create index if not exists po_lines_po_idx on public.purchase_order_lines (po_id);

-- Simpan PO (baru / ubah selama masih draf).
-- p: { id?, supplier_id, warehouse_id, note, lines: [{product_id, qty, unit_cost}] }
create or replace function public.erp_po_save(p jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
    v_me    uuid := public.erp_me();
    v_id    uuid := nullif(p ->> 'id', '')::uuid;
    v_line  jsonb;
    v_total numeric := 0;
begin
    if v_me is null or not public.erp_has_role(array['gudang', 'keuangan']) then
        raise exception 'Akses ditolak: hanya gudang/keuangan yang boleh membuat PO.';
    end if;

    if jsonb_typeof(p -> 'lines') <> 'array' or jsonb_array_length(p -> 'lines') < 1 then
        raise exception 'PO minimal berisi 1 barang.';
    end if;

    if v_id is null then
        insert into public.purchase_orders (po_number, supplier_id, warehouse_id, note, created_by)
        values (
            'PO-' || to_char(now() at time zone 'Asia/Jakarta', 'YYMM') || '-' || lpad(nextval('public.po_seq')::text, 4, '0'),
            (p ->> 'supplier_id')::uuid, (p ->> 'warehouse_id')::uuid,
            nullif(left(trim(coalesce(p ->> 'note', '')), 300), ''), v_me
        )
        returning id into v_id;
    else
        update public.purchase_orders
           set supplier_id = (p ->> 'supplier_id')::uuid,
               warehouse_id = (p ->> 'warehouse_id')::uuid,
               note = nullif(left(trim(coalesce(p ->> 'note', '')), 300), '')
         where id = v_id and status = 'draft';
        if not found then
            raise exception 'PO hanya bisa diubah saat masih draf.';
        end if;
        delete from public.purchase_order_lines where po_id = v_id;
    end if;

    for v_line in select * from jsonb_array_elements(p -> 'lines') loop
        if not exists (select 1 from public.products where id::text = v_line ->> 'product_id') then
            raise exception 'Produk tidak ditemukan di katalog.';
        end if;
        insert into public.purchase_order_lines (po_id, product_id, qty, unit_cost)
        values (v_id, v_line ->> 'product_id', (v_line ->> 'qty')::integer, (v_line ->> 'unit_cost')::numeric);
        v_total := v_total + (v_line ->> 'qty')::integer * (v_line ->> 'unit_cost')::numeric;
    end loop;

    update public.purchase_orders set total = v_total where id = v_id;
    return v_id;
end;
$$;

-- Ubah status PO: dipesan | diterima | dibayar | dibatalkan
create or replace function public.erp_po_status(p_id uuid, p_status text, p_method text default 'transfer')
returns void
language plpgsql security definer set search_path = public
as $$
declare
    v_me   uuid := public.erp_me();
    v_po   public.purchase_orders%rowtype;
    v_line public.purchase_order_lines%rowtype;
begin
    if v_me is null or not public.erp_has_role(array['gudang', 'keuangan']) then
        raise exception 'Akses ditolak.';
    end if;

    select * into v_po from public.purchase_orders where id = p_id for update;
    if v_po.id is null then raise exception 'PO tidak ditemukan.'; end if;

    if p_status = 'dipesan' and v_po.status = 'draft' then
        update public.purchase_orders set status = 'dipesan', ordered_at = now() where id = p_id;

    elsif p_status = 'diterima' and v_po.status = 'dipesan' then
        for v_line in select * from public.purchase_order_lines where po_id = p_id loop
            insert into public.stock_moves (warehouse_id, product_id, qty, kind, ref, note, actor_id)
            values (v_po.warehouse_id, v_line.product_id, v_line.qty, 'masuk', v_po.po_number, 'Penerimaan PO', v_me);
            update public.products set cost_price = v_line.unit_cost where id::text = v_line.product_id;
        end loop;

        if v_po.total > 0 then
            perform public.erp_journal_write(
                (now() at time zone 'Asia/Jakarta')::date, 'Penerimaan barang ' || v_po.po_number,
                'pembelian', v_po.po_number,
                jsonb_build_array(
                    jsonb_build_object('account_code', '1-1300', 'debit', v_po.total),
                    jsonb_build_object('account_code', '2-1000', 'credit', v_po.total)
                ), v_me);
        end if;
        update public.purchase_orders set status = 'diterima', received_at = now() where id = p_id;

    elsif p_status = 'dibayar' and v_po.status = 'diterima' then
        if not public.erp_has_role(array['keuangan']) then
            raise exception 'Pelunasan PO hanya oleh bagian keuangan.';
        end if;
        if v_po.total > 0 then
            perform public.erp_journal_write(
                (now() at time zone 'Asia/Jakarta')::date, 'Pelunasan ' || v_po.po_number,
                'pembelian', v_po.po_number || '-bayar',
                jsonb_build_array(
                    jsonb_build_object('account_code', '2-1000', 'debit', v_po.total),
                    jsonb_build_object('account_code', case when p_method = 'tunai' then '1-1000' else '1-1100' end, 'credit', v_po.total)
                ), v_me);
        end if;
        update public.purchase_orders
           set status = 'dibayar', paid_at = now(), paid_method = case when p_method = 'tunai' then 'tunai' else 'transfer' end
         where id = p_id;

    elsif p_status = 'dibatalkan' and v_po.status in ('draft', 'dipesan') then
        update public.purchase_orders set status = 'dibatalkan' where id = p_id;

    else
        raise exception 'Perubahan status PO tidak valid (% ke %).', v_po.status, p_status;
    end if;
end;
$$;

revoke all on function public.erp_po_save(jsonb) from public;
revoke all on function public.erp_po_status(uuid, text, text) from public;
grant execute on function public.erp_po_save(jsonb) to authenticated;
grant execute on function public.erp_po_status(uuid, text, text) to authenticated;

alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;

drop policy if exists "erp baca supplier" on public.suppliers;
create policy "erp baca supplier" on public.suppliers for select
    using (public.erp_my_level() >= 3 or public.erp_has_role(array['gudang', 'keuangan']));
drop policy if exists "erp kelola supplier" on public.suppliers;
create policy "erp kelola supplier" on public.suppliers for all
    using (public.erp_has_role(array['gudang', 'keuangan'])) with check (public.erp_has_role(array['gudang', 'keuangan']));

drop policy if exists "erp baca po" on public.purchase_orders;
create policy "erp baca po" on public.purchase_orders for select
    using (public.erp_my_level() >= 3 or public.erp_has_role(array['gudang', 'keuangan']));
drop policy if exists "erp baca baris po" on public.purchase_order_lines;
create policy "erp baca baris po" on public.purchase_order_lines for select
    using (public.erp_my_level() >= 3 or public.erp_has_role(array['gudang', 'keuangan']));
-- Tulis PO hanya lewat erp_po_save / erp_po_status.


-- =========================================================
-- 2. LOGISTIK (alur pesanan online)
-- menunggu_pembayaran -> dibayar -> diproses -> dikirim -> selesai
-- =========================================================
drop policy if exists "erp logistik baca pesanan" on public.orders;
create policy "erp logistik baca pesanan" on public.orders for select
    using (public.erp_my_level() >= 3 or public.erp_has_role(array['gudang', 'cs', 'keuangan']));

drop policy if exists "erp logistik baca isi pesanan" on public.order_items;
create policy "erp logistik baca isi pesanan" on public.order_items for select
    using (public.erp_my_level() >= 3 or public.erp_has_role(array['gudang', 'cs', 'keuangan']));

-- p: { order_id, action: bayar|proses|kirim|selesai|batal, warehouse_id, courier_name, tracking_number }
create or replace function public.erp_order_advance(p jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
    v_me     uuid := public.erp_me();
    v_action text := p ->> 'action';
    v_order  public.orders%rowtype;
    v_item   public.order_items%rowtype;
    v_wh     uuid := nullif(p ->> 'warehouse_id', '')::uuid;
    v_resi   text := nullif(left(trim(coalesce(p ->> 'tracking_number', '')), 60), '');
begin
    if v_me is null then raise exception 'Akses ditolak.'; end if;

    select * into v_order from public.orders where id = (p ->> 'order_id')::uuid for update;
    if v_order.id is null then raise exception 'Pesanan tidak ditemukan.'; end if;

    if v_action = 'bayar' and v_order.status = 'menunggu_pembayaran' then
        if not public.erp_has_role(array['keuangan', 'cs']) then
            raise exception 'Konfirmasi pembayaran hanya oleh keuangan/CS.';
        end if;
        update public.orders set status = 'dibayar' where id = v_order.id;

    elsif v_action = 'proses' and v_order.status = 'dibayar' then
        if not public.erp_has_role(array['gudang']) then raise exception 'Hanya bagian gudang/logistik.'; end if;
        update public.orders set status = 'diproses' where id = v_order.id;

    elsif v_action = 'kirim' and v_order.status = 'diproses' then
        if not public.erp_has_role(array['gudang']) then raise exception 'Hanya bagian gudang/logistik.'; end if;
        if v_resi is null then raise exception 'Nomor resi wajib diisi.'; end if;
        if v_wh is null then raise exception 'Pilih gudang asal pengiriman.'; end if;

        for v_item in select * from public.order_items where order_id = v_order.id loop
            insert into public.stock_moves (warehouse_id, product_id, qty, kind, ref, note, actor_id)
            values (v_wh, v_item.product_id, -v_item.qty, 'penjualan', v_order.order_code, 'Kirim pesanan online', v_me);
        end loop;

        update public.orders
           set status = 'dikirim', tracking_number = v_resi, shipped_at = now(), ship_warehouse_id = v_wh,
               courier_name = coalesce(nullif(trim(p ->> 'courier_name'), ''), courier_name)
         where id = v_order.id;

    elsif v_action = 'selesai' and v_order.status = 'dikirim' then
        if not public.erp_has_role(array['gudang', 'cs']) then raise exception 'Akses ditolak.'; end if;
        update public.orders set status = 'selesai', delivered_at = now() where id = v_order.id;

    elsif v_action = 'batal' and v_order.status in ('menunggu_pembayaran', 'dibayar', 'diproses') then
        if not public.erp_has_role(array['cs', 'keuangan']) then raise exception 'Pembatalan oleh CS/keuangan.'; end if;
        update public.orders set status = 'dibatalkan' where id = v_order.id;

    else
        raise exception 'Langkah "%" tidak bisa dilakukan untuk pesanan berstatus %.', v_action, v_order.status;
    end if;
end;
$$;

revoke all on function public.erp_order_advance(jsonb) from public;
grant execute on function public.erp_order_advance(jsonb) to authenticated;


-- =========================================================
-- 3. CUSTOMER SERVICE (tiket keluhan, pertanyaan, retur)
-- =========================================================
create sequence if not exists public.ticket_seq;

create table if not exists public.cs_tickets (
    id               uuid primary key default gen_random_uuid(),
    ticket_no        text not null unique default ('CS-' || lpad(nextval('public.ticket_seq')::text, 5, '0')),
    kind             text not null default 'pertanyaan' check (kind in ('pertanyaan', 'keluhan', 'retur', 'lainnya')),
    subject          text not null check (char_length(subject) between 3 and 140),
    customer_name    text check (customer_name is null or char_length(customer_name) <= 80),
    customer_contact text check (customer_contact is null or char_length(customer_contact) <= 120),
    order_code       text,
    status           text not null default 'baru' check (status in ('baru', 'diproses', 'selesai', 'ditutup')),
    priority         text not null default 'normal' check (priority in ('rendah', 'normal', 'tinggi')),
    assigned_to      uuid references public.members(id) on delete set null,
    created_by       uuid references public.members(id) on delete set null,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    resolved_at      timestamptz
);

create table if not exists public.cs_ticket_notes (
    id         bigserial primary key,
    ticket_id  uuid not null references public.cs_tickets(id) on delete cascade,
    author_id  uuid references public.members(id) on delete set null,
    body       text not null check (char_length(body) between 1 and 1000),
    created_at timestamptz not null default now()
);

create index if not exists cs_tickets_status_idx on public.cs_tickets (status, created_at desc);

drop trigger if exists cs_tickets_touch on public.cs_tickets;
create trigger cs_tickets_touch before update on public.cs_tickets
    for each row execute function public.touch_updated_at();

alter table public.cs_tickets enable row level security;
alter table public.cs_ticket_notes enable row level security;

create or replace function public.erp_can_see_ticket(p_ticket uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
    select public.erp_my_level() >= 3 or public.erp_has_role(array['cs'])
        or exists (select 1 from public.cs_tickets t
                    where t.id = p_ticket and (t.created_by = public.erp_me() or t.assigned_to = public.erp_me()));
$$;

drop policy if exists "erp baca tiket" on public.cs_tickets;
create policy "erp baca tiket" on public.cs_tickets for select using (public.erp_can_see_ticket(id));
drop policy if exists "erp buat tiket" on public.cs_tickets;
create policy "erp buat tiket" on public.cs_tickets for insert
    with check (public.erp_my_level() >= 1 and created_by = public.erp_me());
drop policy if exists "erp ubah tiket" on public.cs_tickets;
create policy "erp ubah tiket" on public.cs_tickets for update
    using (public.erp_has_role(array['cs']) or public.erp_my_level() >= 3 or assigned_to = public.erp_me())
    with check (public.erp_has_role(array['cs']) or public.erp_my_level() >= 3 or assigned_to = public.erp_me());

drop policy if exists "erp baca catatan tiket" on public.cs_ticket_notes;
create policy "erp baca catatan tiket" on public.cs_ticket_notes for select using (public.erp_can_see_ticket(ticket_id));
drop policy if exists "erp tulis catatan tiket" on public.cs_ticket_notes;
create policy "erp tulis catatan tiket" on public.cs_ticket_notes for insert
    with check (author_id = public.erp_me() and public.erp_can_see_ticket(ticket_id));

-- Retur diterima: stok kembali + (opsional) pengembalian dana tercatat di jurnal.
-- p: { ticket_id, product_id, qty, warehouse_id, refund_amount, refund_method }
create or replace function public.erp_cs_return(p jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
    v_me     uuid := public.erp_me();
    v_ticket public.cs_tickets%rowtype;
    v_refund numeric := greatest(coalesce((p ->> 'refund_amount')::numeric, 0), 0);
begin
    if v_me is null or not public.erp_has_role(array['cs']) then
        raise exception 'Akses ditolak: retur diproses oleh CS.';
    end if;

    select * into v_ticket from public.cs_tickets where id = (p ->> 'ticket_id')::uuid;
    if v_ticket.id is null then raise exception 'Tiket tidak ditemukan.'; end if;

    if coalesce((p ->> 'qty')::integer, 0) > 0 then
        insert into public.stock_moves (warehouse_id, product_id, qty, kind, ref, note, actor_id)
        values ((p ->> 'warehouse_id')::uuid, p ->> 'product_id', (p ->> 'qty')::integer, 'retur', v_ticket.ticket_no, 'Retur pelanggan', v_me);
    end if;

    if v_refund > 0 then
        perform public.erp_journal_write(
            (now() at time zone 'Asia/Jakarta')::date, 'Pengembalian dana ' || v_ticket.ticket_no,
            'retur', v_ticket.ticket_no,
            jsonb_build_array(
                jsonb_build_object('account_code', '4-1000', 'debit', v_refund),
                jsonb_build_object('account_code', case when p ->> 'refund_method' = 'tunai' then '1-1000' else '1-1100' end, 'credit', v_refund)
            ), v_me);
    end if;

    insert into public.cs_ticket_notes (ticket_id, author_id, body)
    values (v_ticket.id, v_me, format('Retur diterima: %s pcs. Pengembalian dana Rp %s.', coalesce(p ->> 'qty', '0'), v_refund));

    update public.cs_tickets set status = 'selesai', resolved_at = now() where id = v_ticket.id;
end;
$$;

revoke all on function public.erp_cs_return(jsonb) from public;
grant execute on function public.erp_cs_return(jsonb) to authenticated;


-- =========================================================
-- 4. MARKETING: VOUCHER
-- =========================================================
create table if not exists public.vouchers (
    id           uuid primary key default gen_random_uuid(),
    code         text not null unique check (code ~ '^[A-Z0-9]{3,20}$'),
    title        text not null check (char_length(title) between 1 and 80),
    kind         text not null check (kind in ('persen', 'nominal')),
    value        numeric(14, 2) not null check (value > 0),
    max_discount numeric(14, 0) check (max_discount is null or max_discount > 0),
    min_purchase numeric(14, 0) not null default 0 check (min_purchase >= 0),
    quota        integer check (quota is null or quota > 0),
    used         integer not null default 0 check (used >= 0),
    starts_at    timestamptz,
    ends_at      timestamptz,
    is_active    boolean not null default true,
    created_by   uuid references public.members(id) on delete set null,
    created_at   timestamptz not null default now(),
    check (kind <> 'persen' or value <= 100)
);

create table if not exists public.voucher_redemptions (
    id         bigserial primary key,
    voucher_id uuid not null references public.vouchers(id) on delete cascade,
    order_code text not null,
    discount   numeric(14, 0) not null,
    created_at timestamptz not null default now()
);

alter table public.vouchers enable row level security;
alter table public.voucher_redemptions enable row level security;

drop policy if exists "erp baca voucher" on public.vouchers;
create policy "erp baca voucher" on public.vouchers for select
    using (public.erp_my_level() >= 3 or public.erp_has_role(array['marketing', 'keuangan']));
drop policy if exists "erp kelola voucher" on public.vouchers;
create policy "erp kelola voucher" on public.vouchers for all
    using (public.erp_has_role(array['marketing'])) with check (public.erp_has_role(array['marketing']));
drop policy if exists "erp baca pemakaian voucher" on public.voucher_redemptions;
create policy "erp baca pemakaian voucher" on public.voucher_redemptions for select
    using (public.erp_my_level() >= 3 or public.erp_has_role(array['marketing', 'keuangan']));

-- Hitung potongan voucher (dipakai checkout & create_order_v2).
create or replace function public.erp_voucher_discount(v public.vouchers, p_subtotal numeric)
returns numeric
language sql immutable
as $$
    select least(
        p_subtotal,
        case when v.kind = 'persen'
             then least(round(p_subtotal * v.value / 100), coalesce(v.max_discount, 1e15))
             else v.value end
    );
$$;

-- Cek voucher untuk pembeli (boleh dipanggil tanpa login). Hanya data seperlunya.
create or replace function public.erp_check_voucher(p_code text, p_subtotal numeric)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
    v public.vouchers%rowtype;
begin
    select * into v from public.vouchers where code = upper(trim(coalesce(p_code, '')));

    if v.id is null or not v.is_active then
        return jsonb_build_object('valid', false, 'message', 'Kode voucher tidak ditemukan.');
    end if;
    if v.starts_at is not null and now() < v.starts_at then
        return jsonb_build_object('valid', false, 'message', 'Voucher belum berlaku.');
    end if;
    if v.ends_at is not null and now() > v.ends_at then
        return jsonb_build_object('valid', false, 'message', 'Voucher sudah berakhir.');
    end if;
    if v.quota is not null and v.used >= v.quota then
        return jsonb_build_object('valid', false, 'message', 'Kuota voucher sudah habis.');
    end if;
    if coalesce(p_subtotal, 0) < v.min_purchase then
        return jsonb_build_object('valid', false, 'message', format('Minimal belanja Rp %s.', to_char(v.min_purchase, 'FM999G999G999')));
    end if;

    return jsonb_build_object(
        'valid', true, 'code', v.code, 'title', v.title, 'kind', v.kind, 'value', v.value,
        'max_discount', v.max_discount, 'min_purchase', v.min_purchase,
        'discount', public.erp_voucher_discount(v, p_subtotal)
    );
end;
$$;

revoke all on function public.erp_check_voucher(text, numeric) from public;
grant execute on function public.erp_check_voucher(text, numeric) to anon, authenticated;

-- create_order_v2: create_order + atribusi sales + VOUCHER (diperiksa ulang di server).
create or replace function public.create_order_v2(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
    v_result   jsonb;
    v_slug     text := lower(trim(coalesce(p ->> 'sales_slug', '')));
    v_code     text := upper(trim(coalesce(p ->> 'voucher_code', '')));
    v_member   uuid;
    v_voucher  public.vouchers%rowtype;
    v_discount numeric := 0;
    v_order    text;
begin
    v_result := public.create_order(p);
    v_order := v_result ->> 'order_code';

    if v_slug <> '' then
        select s.member_id into v_member
          from public.storefronts s
          join public.members m on m.id = s.member_id and m.is_active
         where s.slug = v_slug and s.is_published
         limit 1;

        if v_member is not null then
            update public.orders set sales_member_id = v_member, storefront_slug = v_slug where order_code = v_order;
            v_result := v_result || jsonb_build_object('sales_slug', v_slug);
        end if;
    end if;

    if v_code <> '' then
        select * into v_voucher from public.vouchers where code = v_code for update;

        if v_voucher.id is null or not v_voucher.is_active
           or (v_voucher.starts_at is not null and now() < v_voucher.starts_at)
           or (v_voucher.ends_at is not null and now() > v_voucher.ends_at)
           or (v_voucher.quota is not null and v_voucher.used >= v_voucher.quota)
           or (v_result ->> 'items_total')::numeric < v_voucher.min_purchase then
            raise exception 'Voucher % tidak berlaku lagi. Hapus voucher lalu coba lagi.', v_code;
        end if;

        v_discount := public.erp_voucher_discount(v_voucher, (v_result ->> 'items_total')::numeric);

        update public.orders
           set voucher_code = v_code, voucher_discount = v_discount, total = total - v_discount
         where order_code = v_order;
        update public.vouchers set used = used + 1 where id = v_voucher.id;
        insert into public.voucher_redemptions (voucher_id, order_code, discount) values (v_voucher.id, v_order, v_discount);

        v_result := v_result || jsonb_build_object(
            'voucher_code', v_code, 'voucher_discount', v_discount,
            'total', (v_result ->> 'total')::numeric - v_discount
        );
    end if;

    return v_result;
end;
$$;

revoke all on function public.create_order_v2(jsonb) from public;
grant execute on function public.create_order_v2(jsonb) to anon, authenticated;


-- =========================================================
-- 5. CRM PELANGGAN (UU PDP: izin pemasaran dicatat)
-- =========================================================
create table if not exists public.crm_profiles (
    phone             text primary key,
    tags              text[] not null default '{}',
    note              text check (note is null or char_length(note) <= 500),
    marketing_consent boolean not null default false,
    updated_by        uuid references public.members(id) on delete set null,
    updated_at        timestamptz not null default now()
);

alter table public.crm_profiles enable row level security;
-- Tidak ada policy langsung: baca & tulis hanya lewat fungsi di bawah.

-- Daftar pelanggan dari pesanan. CS/marketing/manager: semua; sales: pelanggannya sendiri.
-- Marketing (bukan manager) hanya melihat nomor lengkap pelanggan yang memberi izin.
create or replace function public.erp_customers()
returns table (
    phone text, name text, email text, city text,
    orders_count int, total_spent numeric, first_order timestamptz, last_order timestamptz,
    sales_member_id uuid, tags text[], note text, marketing_consent boolean
)
language plpgsql stable security definer set search_path = public
as $$
declare
    v_me    uuid := public.erp_me();
    v_all   boolean := public.erp_my_level() >= 3 or public.erp_has_role(array['cs', 'marketing']);
    v_mask  boolean := public.erp_my_level() < 3 and public.erp_my_role() = 'marketing';
begin
    if v_me is null then
        raise exception 'Akses ditolak.';
    end if;

    return query
        with visible as (
            select o.* from public.orders o
             where o.status <> 'dibatalkan'
               and (v_all or o.sales_member_id = v_me)
        ),
        grouped as (
            select v.customer_phone as ph,
                   (array_agg(v.customer_name order by v.created_at desc))[1] as nm,
                   (array_agg(v.customer_email order by v.created_at desc))[1] as em,
                   (array_agg(v.city order by v.created_at desc))[1] as ct,
                   count(*)::int as cnt,
                   coalesce(sum(v.total) filter (where public.erp_is_paid(v.status)), 0) as spent,
                   min(v.created_at) as first_at,
                   max(v.created_at) as last_at,
                   (array_agg(v.sales_member_id order by v.created_at desc))[1] as sm
              from visible v
             group by v.customer_phone
        )
        select case when v_mask and not coalesce(c.marketing_consent, false)
                    then left(g.ph, 4) || '****' || right(g.ph, 3) else g.ph end,
               g.nm,
               case when v_mask and not coalesce(c.marketing_consent, false) then null else g.em end,
               g.ct, g.cnt, g.spent, g.first_at, g.last_at, g.sm,
               coalesce(c.tags, '{}'), c.note, coalesce(c.marketing_consent, false)
          from grouped g
          left join public.crm_profiles c on c.phone = g.ph
         order by g.last_at desc;
end;
$$;

create or replace function public.erp_crm_save(p_phone text, p_tags text[], p_note text, p_consent boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
    v_me uuid := public.erp_me();
begin
    if v_me is null then raise exception 'Akses ditolak.'; end if;

    if not (public.erp_my_level() >= 3 or public.erp_has_role(array['cs', 'marketing'])
            or exists (select 1 from public.orders where customer_phone = p_phone and sales_member_id = v_me)) then
        raise exception 'Akses ditolak: ini bukan pelangganmu.';
    end if;

    insert into public.crm_profiles (phone, tags, note, marketing_consent, updated_by, updated_at)
    values (p_phone, coalesce(p_tags, '{}'), nullif(left(trim(coalesce(p_note, '')), 500), ''), coalesce(p_consent, false), v_me, now())
    on conflict (phone) do update
        set tags = excluded.tags, note = excluded.note, marketing_consent = excluded.marketing_consent,
            updated_by = v_me, updated_at = now();
end;
$$;

revoke all on function public.erp_customers() from public;
revoke all on function public.erp_crm_save(text, text[], text, boolean) from public;
grant execute on function public.erp_customers() to authenticated;
grant execute on function public.erp_crm_save(text, text[], text, boolean) to authenticated;


-- =========================================================
-- 6. JEJAK AUDIT untuk tabel baru
-- =========================================================
do $$
declare
    t text;
begin
    foreach t in array array['suppliers', 'purchase_orders', 'cs_tickets', 'vouchers', 'crm_profiles'] loop
        execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
        execute format(
            'create trigger %I after insert or update or delete on public.%I
             for each row execute function public.erp_audit()',
            t || '_audit', t
        );
    end loop;
end;
$$;

notify pgrst, 'reload schema';
