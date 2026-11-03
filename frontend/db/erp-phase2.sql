-- =========================================================
-- KANTOONG ERP — FASE 2: GUDANG, KASIR POS, KEUANGAN, HR, PAYROLL
-- File: frontend/db/erp-phase2.sql
--
-- Jalankan SEKALI di Supabase > SQL Editor > New query > Run,
-- SETELAH db/erp-foundation.sql. Aman dijalankan ulang.
--
-- ALUR YANG SALING TERSAMBUNG:
--  Kasir POS  -> stok outlet berkurang -> jurnal "Penjualan kasir"
--  Pesanan online dibayar -> jurnal "Penjualan online"
--  Absensi (alpa) -> potongan di slip gaji
--  Payroll dibayar -> jurnal "Beban gaji" & "Beban komisi"
--
-- Semua perubahan stok & jurnal HANYA lewat fungsi database
-- (security definer) agar angka tidak bisa diakali dari browser.
-- =========================================================


-- ---------------------------------------------------------
-- 0. PENYESUAIAN FASE 1
-- ---------------------------------------------------------
alter table public.members drop constraint if exists members_job_role_check;
alter table public.members add constraint members_job_role_check
    check (job_role in ('umum', 'sales', 'produk', 'gudang', 'keuangan', 'hr', 'marketing', 'cs', 'kasir'));

alter table public.members add column if not exists joined_at date default current_date;

-- Jejak audit: angka gaji/slip tidak pernah ditampilkan di audit.
create or replace function public.erp_audit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
    v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
    v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
    v_changes jsonb;
begin
    if tg_op = 'UPDATE' then
        select jsonb_object_agg(key, jsonb_build_object('dari', v_old -> key, 'jadi', value))
          into v_changes
          from jsonb_each(v_new)
         where v_new -> key is distinct from v_old -> key;
        if v_changes is null then
            return new;
        end if;
    else
        v_changes := coalesce(v_new, v_old);
    end if;

    if tg_table_name in ('member_salary', 'payslips') then
        v_changes := jsonb_build_object('_', 'dirahasiakan');
    end if;

    insert into public.audit_log (actor_id, actor_user, table_name, record_id, action, changes)
    values (
        public.erp_me(), auth.uid(), tg_table_name,
        coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'member_id', v_old ->> 'member_id'),
        tg_op, v_changes
    );

    return coalesce(new, old);
end;
$$;

create or replace function public.erp_has_role(roles text[])
returns boolean
language sql stable security definer set search_path = public
as $$
    select public.erp_my_level() >= 4 or public.erp_my_role() = any(roles);
$$;


-- =========================================================
-- 1. GUDANG & STOK
-- =========================================================
create table if not exists public.warehouses (
    id         uuid primary key default gen_random_uuid(),
    name       text not null check (char_length(name) between 1 and 60),
    kind       text not null default 'gudang' check (kind in ('gudang', 'outlet')),
    address    text check (address is null or char_length(address) <= 200),
    is_active  boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists public.stock_levels (
    warehouse_id uuid not null references public.warehouses(id) on delete cascade,
    product_id   text not null,
    qty          integer not null default 0 check (qty >= 0),
    min_qty      integer not null default 0 check (min_qty >= 0),
    updated_at   timestamptz not null default now(),
    primary key (warehouse_id, product_id)
);

create table if not exists public.stock_moves (
    id           bigserial primary key,
    warehouse_id uuid not null references public.warehouses(id) on delete cascade,
    product_id   text not null,
    qty          integer not null check (qty <> 0),            -- + masuk, - keluar
    kind         text not null check (kind in (
                     'masuk', 'keluar', 'transfer_masuk', 'transfer_keluar',
                     'penyesuaian', 'penjualan', 'retur')),
    ref          text,
    note         text check (note is null or char_length(note) <= 300),
    actor_id     uuid references public.members(id) on delete set null,
    created_at   timestamptz not null default now()
);

create index if not exists stock_moves_wh_created_idx on public.stock_moves (warehouse_id, created_at desc);
create index if not exists stock_moves_product_idx on public.stock_moves (product_id);

-- Setiap mutasi memperbarui saldo stok & total stok di katalog. Tidak boleh minus.
create or replace function public.erp_apply_stock_move()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
    v_current integer;
    v_name    text;
begin
    select qty into v_current from public.stock_levels
     where warehouse_id = new.warehouse_id and product_id = new.product_id
     for update;

    if coalesce(v_current, 0) + new.qty < 0 then
        select name into v_name from public.products where id::text = new.product_id;
        raise exception 'Stok % tidak cukup (sisa %, diminta %).',
            coalesce(v_name, new.product_id), coalesce(v_current, 0), abs(new.qty);
    end if;

    if v_current is null then
        insert into public.stock_levels (warehouse_id, product_id, qty)
        values (new.warehouse_id, new.product_id, new.qty);
    else
        update public.stock_levels
           set qty = qty + new.qty, updated_at = now()
         where warehouse_id = new.warehouse_id and product_id = new.product_id;
    end if;

    update public.products
       set stock = (select coalesce(sum(qty), 0) from public.stock_levels where product_id = new.product_id)
     where id::text = new.product_id;

    return new;
end;
$$;

drop trigger if exists stock_moves_apply on public.stock_moves;
create trigger stock_moves_apply
    before insert on public.stock_moves
    for each row execute function public.erp_apply_stock_move();

-- Satu-satunya pintu mutasi stok dari aplikasi.
-- p: { kind: masuk|keluar|retur|transfer|opname, warehouse_id, to_warehouse_id,
--      product_id, qty, counted, note }
create or replace function public.erp_stock_move(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
    v_me      uuid := public.erp_me();
    v_kind    text := p ->> 'kind';
    v_wh      uuid := (p ->> 'warehouse_id')::uuid;
    v_to      uuid := nullif(p ->> 'to_warehouse_id', '')::uuid;
    v_product text := trim(coalesce(p ->> 'product_id', ''));
    v_qty     integer := coalesce((p ->> 'qty')::integer, 0);
    v_note    text := nullif(left(trim(coalesce(p ->> 'note', '')), 300), '');
    v_current integer;
    v_ref     text := 'MUT-' || to_char(now() at time zone 'Asia/Jakarta', 'YYMMDDHH24MISS');
begin
    if v_me is null or not public.erp_has_role(array['gudang']) then
        raise exception 'Akses ditolak: hanya bagian gudang yang boleh mengubah stok.';
    end if;

    if not exists (select 1 from public.products where id::text = v_product) then
        raise exception 'Produk tidak ditemukan di katalog master.';
    end if;

    if v_kind in ('masuk', 'retur') then
        if v_qty < 1 then raise exception 'Jumlah harus minimal 1.'; end if;
        insert into public.stock_moves (warehouse_id, product_id, qty, kind, ref, note, actor_id)
        values (v_wh, v_product, v_qty, v_kind, v_ref, v_note, v_me);

    elsif v_kind = 'keluar' then
        if v_qty < 1 then raise exception 'Jumlah harus minimal 1.'; end if;
        insert into public.stock_moves (warehouse_id, product_id, qty, kind, ref, note, actor_id)
        values (v_wh, v_product, -v_qty, 'keluar', v_ref, v_note, v_me);

    elsif v_kind = 'transfer' then
        if v_qty < 1 then raise exception 'Jumlah harus minimal 1.'; end if;
        if v_to is null or v_to = v_wh then raise exception 'Pilih gudang/outlet tujuan yang berbeda.'; end if;
        insert into public.stock_moves (warehouse_id, product_id, qty, kind, ref, note, actor_id)
        values (v_wh, v_product, -v_qty, 'transfer_keluar', v_ref, v_note, v_me);
        insert into public.stock_moves (warehouse_id, product_id, qty, kind, ref, note, actor_id)
        values (v_to, v_product, v_qty, 'transfer_masuk', v_ref, v_note, v_me);

    elsif v_kind = 'opname' then
        select coalesce(qty, 0) into v_current from public.stock_levels
         where warehouse_id = v_wh and product_id = v_product;
        v_qty := coalesce((p ->> 'counted')::integer, -1) - coalesce(v_current, 0);
        if (p ->> 'counted')::integer < 0 then raise exception 'Hasil hitung tidak boleh minus.'; end if;
        if v_qty <> 0 then
            insert into public.stock_moves (warehouse_id, product_id, qty, kind, ref, note, actor_id)
            values (v_wh, v_product, v_qty, 'penyesuaian', v_ref, coalesce(v_note, 'Stock opname'), v_me);
        end if;

    else
        raise exception 'Jenis mutasi tidak dikenal.';
    end if;

    return jsonb_build_object('ref', v_ref, 'difference', v_qty);
end;
$$;

create or replace function public.erp_set_min_qty(p_warehouse uuid, p_product text, p_min integer)
returns void
language plpgsql security definer set search_path = public
as $$
begin
    if not public.erp_has_role(array['gudang']) then
        raise exception 'Akses ditolak.';
    end if;

    insert into public.stock_levels (warehouse_id, product_id, qty, min_qty)
    values (p_warehouse, p_product, 0, greatest(p_min, 0))
    on conflict (warehouse_id, product_id) do update set min_qty = greatest(p_min, 0), updated_at = now();
end;
$$;

alter table public.warehouses enable row level security;
alter table public.stock_levels enable row level security;
alter table public.stock_moves enable row level security;

drop policy if exists "erp baca gudang" on public.warehouses;
create policy "erp baca gudang" on public.warehouses for select using (public.erp_my_level() >= 1);
drop policy if exists "erp kelola gudang" on public.warehouses;
create policy "erp kelola gudang" on public.warehouses for all
    using (public.erp_has_role(array['gudang'])) with check (public.erp_has_role(array['gudang']));

-- Saldo stok boleh dilihat semua anggota (sales perlu tahu barang tersedia).
drop policy if exists "erp baca stok" on public.stock_levels;
create policy "erp baca stok" on public.stock_levels for select using (public.erp_my_level() >= 1);

drop policy if exists "erp baca mutasi" on public.stock_moves;
create policy "erp baca mutasi" on public.stock_moves for select
    using (public.erp_my_level() >= 3 or public.erp_has_role(array['gudang', 'produk', 'kasir', 'keuangan']));
-- Tidak ada policy insert: mutasi hanya lewat erp_stock_move / kasir.


-- =========================================================
-- 2. KEUANGAN & AKUNTANSI (pembukuan berpasangan / double-entry)
-- =========================================================
create table if not exists public.accounts (
    code      text primary key,
    name      text not null,
    type      text not null check (type in ('aset', 'kewajiban', 'modal', 'pendapatan', 'beban')),
    is_active boolean not null default true
);

insert into public.accounts (code, name, type) values
    ('1-1000', 'Kas', 'aset'),
    ('1-1100', 'Bank', 'aset'),
    ('1-1200', 'Piutang usaha', 'aset'),
    ('1-1300', 'Persediaan barang', 'aset'),
    ('2-1000', 'Utang usaha', 'kewajiban'),
    ('2-1100', 'Utang gaji', 'kewajiban'),
    ('3-1000', 'Modal pemilik', 'modal'),
    ('4-1000', 'Penjualan online', 'pendapatan'),
    ('4-1100', 'Penjualan kasir', 'pendapatan'),
    ('5-1000', 'Harga pokok penjualan', 'beban'),
    ('6-1000', 'Beban gaji', 'beban'),
    ('6-1100', 'Beban komisi', 'beban'),
    ('6-1200', 'Beban operasional', 'beban'),
    ('6-1300', 'Beban pemasaran', 'beban')
on conflict (code) do nothing;

create table if not exists public.journal_entries (
    id         uuid primary key default gen_random_uuid(),
    entry_date date not null default ((now() at time zone 'Asia/Jakarta')::date),
    memo       text not null check (char_length(memo) between 1 and 200),
    source     text not null default 'manual' check (source in ('manual', 'pos', 'order', 'payroll', 'pengeluaran')),
    ref        text,
    created_by uuid references public.members(id) on delete set null,
    created_at timestamptz not null default now()
);

create unique index if not exists journal_entries_source_ref on public.journal_entries (source, ref) where ref is not null;
create index if not exists journal_entries_date_idx on public.journal_entries (entry_date desc);

create table if not exists public.journal_lines (
    id           bigserial primary key,
    entry_id     uuid not null references public.journal_entries(id) on delete cascade,
    account_code text not null references public.accounts(code),
    debit        numeric(14, 0) not null default 0 check (debit >= 0),
    credit       numeric(14, 0) not null default 0 check (credit >= 0),
    check ((debit = 0) <> (credit = 0))
);

create index if not exists journal_lines_entry_idx on public.journal_lines (entry_id);
create index if not exists journal_lines_account_idx on public.journal_lines (account_code);

-- Penulis jurnal internal: wajib seimbang (debit = kredit). Tidak dibuka ke publik.
create or replace function public.erp_journal_write(
    p_date date, p_memo text, p_source text, p_ref text, p_lines jsonb, p_actor uuid
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
    v_id     uuid;
    v_line   jsonb;
    v_debit  numeric := 0;
    v_credit numeric := 0;
begin
    if p_ref is not null and exists (select 1 from public.journal_entries where source = p_source and ref = p_ref) then
        return null; -- sudah pernah dicatat (idempoten)
    end if;

    if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 then
        raise exception 'Jurnal minimal punya 2 baris.';
    end if;

    for v_line in select * from jsonb_array_elements(p_lines) loop
        v_debit := v_debit + coalesce((v_line ->> 'debit')::numeric, 0);
        v_credit := v_credit + coalesce((v_line ->> 'credit')::numeric, 0);
    end loop;

    if v_debit <> v_credit or v_debit <= 0 then
        raise exception 'Jurnal tidak seimbang (debit % ≠ kredit %).', v_debit, v_credit;
    end if;

    insert into public.journal_entries (entry_date, memo, source, ref, created_by)
    values (coalesce(p_date, (now() at time zone 'Asia/Jakarta')::date), left(p_memo, 200), p_source, p_ref, p_actor)
    returning id into v_id;

    insert into public.journal_lines (entry_id, account_code, debit, credit)
    select v_id, l ->> 'account_code', coalesce((l ->> 'debit')::numeric, 0), coalesce((l ->> 'credit')::numeric, 0)
      from jsonb_array_elements(p_lines) l
     where coalesce((l ->> 'debit')::numeric, 0) > 0 or coalesce((l ->> 'credit')::numeric, 0) > 0;

    return v_id;
end;
$$;

revoke all on function public.erp_journal_write(date, text, text, text, jsonb, uuid) from public, anon, authenticated;

-- Pencatatan manual oleh bagian keuangan.
-- p: { entry_date, memo, source: manual|pengeluaran, lines: [{account_code, debit, credit}] }
create or replace function public.erp_post_journal(p jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
begin
    if not public.erp_has_role(array['keuangan']) then
        raise exception 'Akses ditolak: hanya bagian keuangan yang boleh mencatat jurnal.';
    end if;

    if coalesce(p ->> 'source', 'manual') not in ('manual', 'pengeluaran') then
        raise exception 'Sumber jurnal tidak valid.';
    end if;

    return public.erp_journal_write(
        nullif(p ->> 'entry_date', '')::date,
        coalesce(nullif(trim(p ->> 'memo'), ''), 'Jurnal manual'),
        coalesce(p ->> 'source', 'manual'),
        null,
        p -> 'lines',
        public.erp_me()
    );
end;
$$;

revoke all on function public.erp_post_journal(jsonb) from public;
grant execute on function public.erp_post_journal(jsonb) to authenticated;

-- Pesanan online yang dibayar otomatis masuk jurnal (dan dibalik bila dibatalkan).
create or replace function public.erp_order_journal()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
    v_was_paid boolean := tg_op = 'UPDATE' and public.erp_is_paid(old.status);
begin
    if public.erp_is_paid(new.status) and not v_was_paid then
        perform public.erp_journal_write(
            (new.updated_at at time zone 'Asia/Jakarta')::date,
            'Penjualan online ' || new.order_code, 'order', new.order_code,
            jsonb_build_array(
                jsonb_build_object('account_code', '1-1100', 'debit', new.total),
                jsonb_build_object('account_code', '4-1000', 'credit', new.total)
            ),
            null
        );
    elsif v_was_paid and new.status = 'dibatalkan' then
        perform public.erp_journal_write(
            (now() at time zone 'Asia/Jakarta')::date,
            'Pembatalan pesanan ' || new.order_code, 'order', new.order_code || '-batal',
            jsonb_build_array(
                jsonb_build_object('account_code', '4-1000', 'debit', new.total),
                jsonb_build_object('account_code', '1-1100', 'credit', new.total)
            ),
            null
        );
    end if;
    return new;
end;
$$;

drop trigger if exists orders_journal on public.orders;
create trigger orders_journal
    after insert or update of status on public.orders
    for each row execute function public.erp_order_journal();

alter table public.accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;

drop policy if exists "erp baca akun" on public.accounts;
create policy "erp baca akun" on public.accounts for select using (public.erp_has_role(array['keuangan']));
drop policy if exists "erp kelola akun" on public.accounts;
create policy "erp kelola akun" on public.accounts for all
    using (public.erp_has_role(array['keuangan'])) with check (public.erp_has_role(array['keuangan']));

drop policy if exists "erp baca jurnal" on public.journal_entries;
create policy "erp baca jurnal" on public.journal_entries for select using (public.erp_has_role(array['keuangan']));
drop policy if exists "erp baca baris jurnal" on public.journal_lines;
create policy "erp baca baris jurnal" on public.journal_lines for select using (public.erp_has_role(array['keuangan']));
-- Tidak ada policy tulis: jurnal hanya lewat fungsi agar selalu seimbang.


-- =========================================================
-- 3. KASIR POS (toko offline / F&B)
-- =========================================================
create sequence if not exists public.pos_receipt_seq;

create table if not exists public.pos_sales (
    id         uuid primary key default gen_random_uuid(),
    receipt_no text not null unique,
    outlet_id  uuid not null references public.warehouses(id),
    cashier_id uuid references public.members(id) on delete set null,
    items      jsonb not null,
    subtotal   numeric(14, 0) not null,
    discount   numeric(14, 0) not null default 0,
    total      numeric(14, 0) not null,
    paid       numeric(14, 0) not null,
    change     numeric(14, 0) not null default 0,
    method     text not null check (method in ('tunai', 'qris', 'debit', 'transfer')),
    status     text not null default 'selesai' check (status in ('selesai', 'batal')),
    created_at timestamptz not null default now()
);

create index if not exists pos_sales_created_idx on public.pos_sales (created_at desc);

-- p: { outlet_id, method, paid, discount, items: [{product_id, qty}] }
-- Harga DIAMBIL DARI KATALOG (bukan dari browser), stok outlet dikurangi,
-- jurnal penjualan kasir dicatat otomatis.
create or replace function public.erp_pos_checkout(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
    v_me       uuid := public.erp_me();
    v_outlet   uuid := (p ->> 'outlet_id')::uuid;
    v_method   text := coalesce(p ->> 'method', 'tunai');
    v_item     jsonb;
    v_items    jsonb := '[]'::jsonb;
    v_pid      text;
    v_qty      integer;
    v_name     text;
    v_price    numeric;
    v_subtotal numeric := 0;
    v_discount numeric;
    v_total    numeric;
    v_paid     numeric;
    v_receipt  text;
begin
    if v_me is null or not public.erp_has_role(array['kasir']) then
        raise exception 'Akses ditolak: hanya kasir yang boleh mencatat penjualan.';
    end if;

    if not exists (select 1 from public.warehouses where id = v_outlet and kind = 'outlet' and is_active) then
        raise exception 'Outlet tidak ditemukan.';
    end if;

    if v_method not in ('tunai', 'qris', 'debit', 'transfer') then
        raise exception 'Metode bayar tidak valid.';
    end if;

    if jsonb_typeof(p -> 'items') <> 'array' or jsonb_array_length(p -> 'items') < 1 then
        raise exception 'Keranjang kasir kosong.';
    end if;

    v_receipt := 'POS-' || to_char(now() at time zone 'Asia/Jakarta', 'YYMMDD') || '-'
                 || lpad(nextval('public.pos_receipt_seq')::text, 5, '0');

    for v_item in select * from jsonb_array_elements(p -> 'items') loop
        v_pid := trim(coalesce(v_item ->> 'product_id', ''));
        v_qty := coalesce((v_item ->> 'qty')::integer, 0);

        if v_qty < 1 or v_qty > 999 then
            raise exception 'Jumlah barang harus 1–999.';
        end if;

        select name, price into v_name, v_price from public.products where id::text = v_pid;
        if v_name is null then
            raise exception 'Produk tidak ditemukan (id: %).', v_pid;
        end if;

        v_subtotal := v_subtotal + v_price * v_qty;
        v_items := v_items || jsonb_build_object('product_id', v_pid, 'name', v_name, 'price', v_price, 'qty', v_qty);

        insert into public.stock_moves (warehouse_id, product_id, qty, kind, ref, actor_id)
        values (v_outlet, v_pid, -v_qty, 'penjualan', v_receipt, v_me);

        v_name := null;
    end loop;

    v_discount := least(greatest(coalesce((p ->> 'discount')::numeric, 0), 0), v_subtotal);
    v_total := v_subtotal - v_discount;
    v_paid := case when v_method = 'tunai' then coalesce((p ->> 'paid')::numeric, 0) else v_total end;

    if v_paid < v_total then
        raise exception 'Uang yang diterima kurang dari total belanja.';
    end if;

    insert into public.pos_sales (receipt_no, outlet_id, cashier_id, items, subtotal, discount, total, paid, change, method)
    values (v_receipt, v_outlet, v_me, v_items, v_subtotal, v_discount, v_total, v_paid, v_paid - v_total, v_method);

    if v_total > 0 then
        perform public.erp_journal_write(
            (now() at time zone 'Asia/Jakarta')::date,
            'Penjualan kasir ' || v_receipt, 'pos', v_receipt,
            jsonb_build_array(
                jsonb_build_object('account_code', case when v_method = 'tunai' then '1-1000' else '1-1100' end, 'debit', v_total),
                jsonb_build_object('account_code', '4-1100', 'credit', v_total)
            ),
            v_me
        );
    end if;

    return jsonb_build_object(
        'receipt_no', v_receipt, 'items', v_items, 'subtotal', v_subtotal,
        'discount', v_discount, 'total', v_total, 'paid', v_paid,
        'change', v_paid - v_total, 'method', v_method
    );
end;
$$;

revoke all on function public.erp_pos_checkout(jsonb) from public;
grant execute on function public.erp_pos_checkout(jsonb) to authenticated;

alter table public.pos_sales enable row level security;

drop policy if exists "erp baca penjualan kasir" on public.pos_sales;
create policy "erp baca penjualan kasir" on public.pos_sales for select
    using (cashier_id = public.erp_me() or public.erp_has_role(array['keuangan', 'gudang']));
-- Tidak ada policy tulis: penjualan kasir hanya lewat erp_pos_checkout.


-- =========================================================
-- 4. HR & ABSENSI
-- =========================================================
create table if not exists public.hr_settings (
    id             int primary key default 1 check (id = 1),
    work_start     time not null default '09:00',
    grace_minutes  int not null default 10 check (grace_minutes between 0 and 120),
    working_days   int not null default 26 check (working_days between 1 and 31)
);

insert into public.hr_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.attendance (
    id         uuid primary key default gen_random_uuid(),
    member_id  uuid not null references public.members(id) on delete cascade,
    work_date  date not null,
    check_in   timestamptz,
    check_out  timestamptz,
    status     text not null default 'hadir' check (status in ('hadir', 'telat', 'izin', 'sakit', 'cuti', 'alpa')),
    note       text check (note is null or char_length(note) <= 200),
    updated_by uuid references public.members(id) on delete set null,
    unique (member_id, work_date)
);

create index if not exists attendance_date_idx on public.attendance (work_date desc);

-- Absen masuk/pulang memakai JAM SERVER (tidak bisa diakali dari HP).
create or replace function public.erp_clock(p_action text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
    v_me     uuid := public.erp_me();
    v_today  date := (now() at time zone 'Asia/Jakarta')::date;
    v_local  time := (now() at time zone 'Asia/Jakarta')::time;
    v_set    public.hr_settings%rowtype;
    v_status text;
begin
    if v_me is null then
        raise exception 'Akunmu belum terdaftar sebagai anggota.';
    end if;

    select * into v_set from public.hr_settings where id = 1;

    if p_action = 'in' then
        if exists (select 1 from public.attendance where member_id = v_me and work_date = v_today and check_in is not null) then
            raise exception 'Kamu sudah absen masuk hari ini.';
        end if;

        v_status := case
            when v_local > v_set.work_start + make_interval(mins => v_set.grace_minutes) then 'telat'
            else 'hadir' end;

        insert into public.attendance (member_id, work_date, check_in, status, updated_by)
        values (v_me, v_today, now(), v_status, v_me)
        on conflict (member_id, work_date) do update
            set check_in = now(), status = excluded.status, updated_by = v_me;

    elsif p_action = 'out' then
        update public.attendance
           set check_out = now(), updated_by = v_me
         where member_id = v_me and work_date = v_today and check_in is not null and check_out is null;

        if not found then
            raise exception 'Belum absen masuk, atau sudah absen pulang.';
        end if;
    else
        raise exception 'Aksi absensi tidak dikenal.';
    end if;

    return (select to_jsonb(a) from public.attendance a where member_id = v_me and work_date = v_today);
end;
$$;

revoke all on function public.erp_clock(text) from public;
grant execute on function public.erp_clock(text) to authenticated;

alter table public.hr_settings enable row level security;
alter table public.attendance enable row level security;

drop policy if exists "erp baca aturan hr" on public.hr_settings;
create policy "erp baca aturan hr" on public.hr_settings for select using (public.erp_my_level() >= 1);
drop policy if exists "erp ubah aturan hr" on public.hr_settings;
create policy "erp ubah aturan hr" on public.hr_settings for update
    using (public.erp_has_role(array['hr'])) with check (public.erp_has_role(array['hr']));

drop policy if exists "erp baca absensi" on public.attendance;
create policy "erp baca absensi" on public.attendance for select
    using (public.erp_can_view(member_id) or public.erp_my_role() = 'hr');
drop policy if exists "erp koreksi absensi" on public.attendance;
create policy "erp koreksi absensi" on public.attendance for all
    using (public.erp_has_role(array['hr'])) with check (public.erp_has_role(array['hr']));


-- =========================================================
-- 5. PAYROLL (slip gaji)
-- Gaji pokok + komisi (dari omzet dibayar) + tunjangan
-- - potongan - potongan alpa. Hanya HR & owner yang membuat.
-- Karyawan hanya melihat slip miliknya setelah difinalkan.
-- =========================================================
create table if not exists public.payroll_runs (
    id           uuid primary key default gen_random_uuid(),
    period       text not null unique check (period ~ '^[0-9]{4}-[0-9]{2}$'),
    status       text not null default 'draft' check (status in ('draft', 'final', 'dibayar')),
    created_by   uuid references public.members(id) on delete set null,
    created_at   timestamptz not null default now(),
    finalized_at timestamptz,
    paid_at      timestamptz
);

create table if not exists public.payslips (
    id                   uuid primary key default gen_random_uuid(),
    run_id               uuid not null references public.payroll_runs(id) on delete cascade,
    member_id            uuid not null references public.members(id) on delete cascade,
    base_salary          numeric(14, 0) not null default 0 check (base_salary >= 0),
    commission           numeric(14, 0) not null default 0 check (commission >= 0),
    allowance            numeric(14, 0) not null default 0 check (allowance >= 0),
    deduction            numeric(14, 0) not null default 0 check (deduction >= 0),
    attendance_deduction numeric(14, 0) not null default 0 check (attendance_deduction >= 0),
    net                  numeric(14, 0) not null default 0,
    details              jsonb not null default '{}'::jsonb,
    unique (run_id, member_id)
);

create or replace function public.erp_payroll_is_draft(p_run uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
    select exists (select 1 from public.payroll_runs where id = p_run and status = 'draft');
$$;

create or replace function public.erp_is_payroll_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
    select public.erp_my_level() >= 5 or public.erp_my_role() = 'hr';
$$;

-- Tandai dibayar + catat jurnal beban gaji & komisi.
create or replace function public.erp_payroll_pay(p_run uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
    v_period text;
    v_net    numeric;
    v_comm   numeric;
    v_salary numeric;
begin
    if not public.erp_is_payroll_admin() then
        raise exception 'Akses ditolak.';
    end if;

    select period into v_period from public.payroll_runs where id = p_run and status = 'final';
    if v_period is null then
        raise exception 'Payroll harus difinalkan dulu sebelum dibayar.';
    end if;

    select coalesce(sum(net), 0), coalesce(sum(least(commission, greatest(net, 0))), 0)
      into v_net, v_comm
      from public.payslips where run_id = p_run and net > 0;

    v_salary := v_net - v_comm;

    if v_net > 0 then
        perform public.erp_journal_write(
            (now() at time zone 'Asia/Jakarta')::date,
            'Pembayaran gaji ' || v_period, 'payroll', v_period,
            jsonb_build_array(
                jsonb_build_object('account_code', '6-1000', 'debit', v_salary),
                jsonb_build_object('account_code', '6-1100', 'debit', v_comm),
                jsonb_build_object('account_code', '1-1100', 'credit', v_net)
            ),
            public.erp_me()
        );
    end if;

    update public.payroll_runs set status = 'dibayar', paid_at = now() where id = p_run;
end;
$$;

revoke all on function public.erp_payroll_pay(uuid) from public;
grant execute on function public.erp_payroll_pay(uuid) to authenticated;

-- Dasar komisi untuk HR: omzet dibayar per sales pada satu bulan + persen
-- komisi + gaji pokok. HR tidak perlu (dan tidak bisa) membuka isi pesanan.
create or replace function public.erp_payroll_base(p_period text)
returns table (member_id uuid, omzet numeric, commission_rate numeric, base_salary numeric)
language plpgsql stable security definer set search_path = public
as $$
declare
    v_from timestamptz := (p_period || '-01')::date::timestamp at time zone 'Asia/Jakarta';
    v_to   timestamptz := ((p_period || '-01')::date + interval '1 month')::timestamp at time zone 'Asia/Jakarta';
begin
    if not public.erp_is_payroll_admin() then
        raise exception 'Akses ditolak.';
    end if;

    return query
        select m.id,
               coalesce((select sum(o.total) from public.orders o
                          where o.sales_member_id = m.id and public.erp_is_paid(o.status)
                            and o.created_at >= v_from and o.created_at < v_to), 0),
               coalesce(t.commission_rate, 0),
               coalesce(s.base_salary, 0)
          from public.members m
          left join public.member_targets t on t.member_id = m.id
          left join public.member_salary s on s.member_id = m.id
         where m.is_active;
end;
$$;

revoke all on function public.erp_payroll_base(text) from public;
grant execute on function public.erp_payroll_base(text) to authenticated;

alter table public.payroll_runs enable row level security;
alter table public.payslips enable row level security;

drop policy if exists "erp baca periode gaji" on public.payroll_runs;
create policy "erp baca periode gaji" on public.payroll_runs for select using (public.erp_my_level() >= 1);
drop policy if exists "erp kelola periode gaji" on public.payroll_runs;
create policy "erp kelola periode gaji" on public.payroll_runs for all
    using (public.erp_is_payroll_admin()) with check (public.erp_is_payroll_admin());

drop policy if exists "erp baca slip gaji" on public.payslips;
create policy "erp baca slip gaji" on public.payslips for select using (
    public.erp_is_payroll_admin()
    or (member_id = public.erp_me() and not public.erp_payroll_is_draft(run_id))
);
drop policy if exists "erp tulis slip gaji" on public.payslips;
create policy "erp tulis slip gaji" on public.payslips for all
    using (public.erp_is_payroll_admin() and public.erp_payroll_is_draft(run_id))
    with check (public.erp_is_payroll_admin() and public.erp_payroll_is_draft(run_id));


-- =========================================================
-- 6. JEJAK AUDIT untuk tabel baru
-- =========================================================
do $$
declare
    t text;
begin
    foreach t in array array['warehouses', 'accounts', 'attendance', 'hr_settings',
                             'payroll_runs', 'payslips'] loop
        execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
        execute format(
            'create trigger %I after insert or update or delete on public.%I
             for each row execute function public.erp_audit()',
            t || '_audit', t
        );
    end loop;
end;
$$;

do $$
begin
    alter publication supabase_realtime add table public.pos_sales;
exception when duplicate_object or undefined_object then
    null;
end;
$$;

notify pgrst, 'reload schema';

-- =========================================================
-- SETELAH MENJALANKAN FILE INI
--  1. ERP > Gudang & Stok: buat gudang pusat & outlet, lalu catat
--     "Barang masuk" untuk stok awal.
--  2. ERP > Organisasi: beri peran kerja "kasir" untuk staf kasir.
--  3. ERP > Keuangan: catat modal awal (jurnal manual).
-- =========================================================
