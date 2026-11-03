-- =========================================================
-- KANTOONG ERP — FASE 1: FONDASI
-- File: frontend/db/erp-foundation.sql
--
-- Jalankan SEKALI di Supabase > SQL Editor > New query > Run.
-- Aman dijalankan ulang (if not exists / create or replace / drop if exists).
-- Butuh: owner-and-pin.sql dan cart/order.sql sudah dijalankan.
--
-- ISI:
--  1. Struktur organisasi (pohon tanpa batas kedalaman)
--  2. Anggota (karyawan) + jabatan + atasan langsung
--  3. Data pribadi terpisah & dikunci:
--       member_targets : target & % komisi  -> diri sendiri + atasan + owner
--       member_salary  : gaji pokok         -> diri sendiri + HR + owner
--  4. Toko per sales (nama-sales) yang menunjuk ke katalog master
--  5. Katalog master: kode barang (SKU) & barcode di tabel products
--  6. Atribusi pesanan ke sales + fungsi create_order_v2
--  7. Persetujuan (approval) & jejak audit
--  8. Papan peringkat sales (per hari / per bulan) yang menjaga privasi
--
-- PRINSIP: penguncian data dilakukan DI DATABASE (RLS), bukan hanya
-- disembunyikan di tampilan. Sesama sales tidak bisa saling intip
-- omzet, target, komisi, atau gaji.
--
-- LEVEL JABATAN: 5 Owner, 4 Direktur, 3 Manager, 2 Supervisor/Kepala, 1 Staf
-- =========================================================


-- ---------------------------------------------------------
-- 1. STRUKTUR ORGANISASI
-- ---------------------------------------------------------
create table if not exists public.org_units (
    id         uuid primary key default gen_random_uuid(),
    parent_id  uuid references public.org_units(id) on delete cascade,
    name       text not null check (char_length(name) between 1 and 80),
    kind       text not null default 'divisi'
               check (kind in ('perusahaan', 'divisi', 'departemen', 'tim', 'unit')),
    sort       int not null default 0,
    created_at timestamptz not null default now()
);

create index if not exists org_units_parent_idx on public.org_units (parent_id);


-- ---------------------------------------------------------
-- 2. ANGGOTA / KARYAWAN
-- Owner menambahkan anggota lewat email. Saat orang itu login pertama
-- kali (akun dibuat di Authentication > Users), akunnya otomatis
-- tersambung lewat fungsi erp_link_me().
-- ---------------------------------------------------------
create table if not exists public.members (
    id             uuid primary key default gen_random_uuid(),
    user_id        uuid unique references auth.users(id) on delete set null,
    email          text not null unique check (position('@' in email) > 1),
    full_name      text not null check (char_length(full_name) between 1 and 80),
    org_unit_id    uuid references public.org_units(id) on delete set null,
    position_title text not null default 'Staf',
    level          smallint not null default 1 check (level between 1 and 5),
    job_role       text not null default 'umum'
                   check (job_role in ('umum', 'sales', 'produk', 'gudang', 'keuangan', 'hr', 'marketing', 'cs')),
    manager_id     uuid references public.members(id) on delete set null,
    modules        text[],                    -- null = modul bawaan sesuai jabatan
    sales_slug     text unique check (sales_slug is null or sales_slug ~ '^[a-z0-9]([a-z0-9-]{1,30})[a-z0-9]$'),
    is_active      boolean not null default true,
    created_at     timestamptz not null default now()
);

create index if not exists members_manager_idx on public.members (manager_id);
create index if not exists members_unit_idx on public.members (org_unit_id);

-- Target & komisi (dilihat diri sendiri, atasan berantai, owner/direktur).
create table if not exists public.member_targets (
    member_id       uuid primary key references public.members(id) on delete cascade,
    commission_rate numeric(5, 2) not null default 0 check (commission_rate between 0 and 100),
    monthly_target  numeric(14, 0) not null default 0 check (monthly_target >= 0),
    daily_target    numeric(14, 0) not null default 0 check (daily_target >= 0),
    updated_at      timestamptz not null default now()
);

-- Gaji (paling ketat: diri sendiri, HR, owner).
create table if not exists public.member_salary (
    member_id   uuid primary key references public.members(id) on delete cascade,
    base_salary numeric(14, 0) not null default 0 check (base_salary >= 0),
    updated_at  timestamptz not null default now()
);


-- ---------------------------------------------------------
-- 3. FUNGSI PEMBANTU HAK AKSES (security definer = bebas rekursi RLS)
-- ---------------------------------------------------------
create or replace function public.erp_me()
returns uuid
language sql stable security definer set search_path = public
as $$
    select m.id from public.members m
    where m.user_id = auth.uid() and m.is_active
    limit 1;
$$;

create or replace function public.erp_my_level()
returns int
language sql stable security definer set search_path = public
as $$
    select greatest(
        coalesce((select m.level from public.members m
                  where m.user_id = auth.uid() and m.is_active limit 1), 0),
        -- Owner lama (tabel owners) otomatis dianggap level 5.
        case when exists (select 1 from public.owners o where o.user_id = auth.uid()) then 5 else 0 end
    );
$$;

create or replace function public.erp_my_role()
returns text
language sql stable security definer set search_path = public
as $$
    select coalesce((select m.job_role from public.members m
                     where m.user_id = auth.uid() and m.is_active limit 1), '');
$$;

-- Semua bawahan (langsung maupun tidak langsung) dari seorang anggota.
create or replace function public.erp_subtree(root uuid)
returns setof uuid
language sql stable security definer set search_path = public
as $$
    with recursive tree as (
        select m.id from public.members m where m.manager_id = root
        union
        select m.id from public.members m join tree t on m.manager_id = t.id
    )
    select id from tree;
$$;

-- Bolehkah aku melihat data KERJA (omzet, target, komisi) anggota ini?
create or replace function public.erp_can_view(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
    select
        public.erp_my_level() >= 4
        or target = public.erp_me()
        or target in (select public.erp_subtree(public.erp_me()));
$$;

-- Bolehkah aku MENGATUR target/komisi anggota ini? (atasannya, bukan diri sendiri)
create or replace function public.erp_can_manage(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
    select
        public.erp_my_level() >= 4
        or target in (select public.erp_subtree(public.erp_me()));
$$;

-- Bolehkah aku melihat/mengubah GAJI anggota ini?
create or replace function public.erp_can_view_salary(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
    select
        public.erp_my_level() >= 5
        or public.erp_my_role() = 'hr'
        or target = public.erp_me();
$$;

create or replace function public.erp_is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
    select public.erp_my_level() >= 4 or public.erp_my_role() = 'hr';
$$;

-- Sambungkan akun login ke data anggota berdasarkan email (dipanggil saat login).
create or replace function public.erp_link_me()
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
    v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
    v_id    uuid;
begin
    if auth.uid() is null or v_email = '' then
        return null;
    end if;

    update public.members
       set user_id = auth.uid()
     where lower(email) = v_email and user_id is null
     returning id into v_id;

    -- Owner lama otomatis punya kartu anggota level 5.
    if v_id is null
       and not exists (select 1 from public.members where user_id = auth.uid())
       and exists (select 1 from public.owners o where o.user_id = auth.uid()) then
        insert into public.members (user_id, email, full_name, position_title, level, job_role)
        values (auth.uid(), v_email, split_part(v_email, '@', 1), 'Owner', 5, 'umum')
        returning id into v_id;
    end if;

    return coalesce(v_id, public.erp_me());
end;
$$;

revoke all on function public.erp_link_me() from public;
grant execute on function public.erp_link_me() to authenticated;


-- ---------------------------------------------------------
-- 4. RLS: ORGANISASI, ANGGOTA, TARGET, GAJI
-- ---------------------------------------------------------
alter table public.org_units enable row level security;
alter table public.members enable row level security;
alter table public.member_targets enable row level security;
alter table public.member_salary enable row level security;

-- Struktur organisasi & direktori nama/jabatan boleh dilihat semua anggota aktif.
drop policy if exists "erp baca organisasi" on public.org_units;
create policy "erp baca organisasi" on public.org_units
    for select using (public.erp_my_level() >= 1);

drop policy if exists "erp kelola organisasi" on public.org_units;
create policy "erp kelola organisasi" on public.org_units
    for all using (public.erp_is_admin()) with check (public.erp_is_admin());

drop policy if exists "erp baca direktori" on public.members;
create policy "erp baca direktori" on public.members
    for select using (public.erp_my_level() >= 1);

drop policy if exists "erp kelola anggota" on public.members;
create policy "erp kelola anggota" on public.members
    for all using (public.erp_is_admin()) with check (public.erp_is_admin());

drop policy if exists "erp baca target" on public.member_targets;
create policy "erp baca target" on public.member_targets
    for select using (public.erp_can_view(member_id));

drop policy if exists "erp atur target" on public.member_targets;
create policy "erp atur target" on public.member_targets
    for all using (public.erp_can_manage(member_id)) with check (public.erp_can_manage(member_id));

drop policy if exists "erp baca gaji" on public.member_salary;
create policy "erp baca gaji" on public.member_salary
    for select using (public.erp_can_view_salary(member_id));

drop policy if exists "erp atur gaji" on public.member_salary;
create policy "erp atur gaji" on public.member_salary
    for all using (public.erp_my_level() >= 5 or public.erp_my_role() = 'hr')
    with check (public.erp_my_level() >= 5 or public.erp_my_role() = 'hr');


-- ---------------------------------------------------------
-- 5. KATALOG MASTER: KODE BARANG & BARCODE
-- Semua toko sales menunjuk ke produk yang sama -> kode barang tetap sama.
-- ---------------------------------------------------------
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists barcode text;
alter table public.products add column if not exists stock integer not null default 0;

create unique index if not exists products_sku_unique on public.products (sku) where sku is not null;
create unique index if not exists products_barcode_unique on public.products (barcode) where barcode is not null;

-- Staf katalog (job_role 'produk') & direktur boleh mengubah produk, selain owner.
drop policy if exists "erp katalog ubah produk" on public.products;
create policy "erp katalog ubah produk" on public.products
    for update using (public.erp_my_level() >= 4 or public.erp_my_role() = 'produk')
    with check (public.erp_my_level() >= 4 or public.erp_my_role() = 'produk');


-- ---------------------------------------------------------
-- 6. TOKO PER SALES  (kantoong.id/nama-sales  ->  nanti nama-sales.kantoong.id)
-- ---------------------------------------------------------
create table if not exists public.storefronts (
    member_id      uuid primary key references public.members(id) on delete cascade,
    slug           text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{1,30})[a-z0-9]$'),
    display_name   text not null check (char_length(display_name) between 1 and 60),
    tagline        text check (tagline is null or char_length(tagline) <= 120),
    hero_image_url text,
    theme          jsonb not null default '{}'::jsonb,   -- desain khusus tiap sales
    is_published   boolean not null default true,
    updated_at     timestamptz not null default now()
);

-- Produk pilihan sales di tokonya (+ foto versi sales). Kosong = semua produk.
create table if not exists public.storefront_products (
    member_id        uuid not null references public.storefronts(member_id) on delete cascade,
    product_id       text not null,
    custom_image_url text,
    sort             int not null default 0,
    primary key (member_id, product_id)
);

alter table public.storefronts enable row level security;
alter table public.storefront_products enable row level security;

drop policy if exists "toko sales dibaca publik" on public.storefronts;
create policy "toko sales dibaca publik" on public.storefronts
    for select using (is_published or member_id = public.erp_me() or public.erp_can_manage(member_id));

drop policy if exists "sales kelola tokonya" on public.storefronts;
create policy "sales kelola tokonya" on public.storefronts
    for all using (member_id = public.erp_me() or public.erp_my_level() >= 4)
    with check (member_id = public.erp_me() or public.erp_my_level() >= 4);

drop policy if exists "produk toko dibaca publik" on public.storefront_products;
create policy "produk toko dibaca publik" on public.storefront_products
    for select using (true);

drop policy if exists "sales kelola produk tokonya" on public.storefront_products;
create policy "sales kelola produk tokonya" on public.storefront_products
    for all using (member_id = public.erp_me() or public.erp_my_level() >= 4)
    with check (member_id = public.erp_me() or public.erp_my_level() >= 4);


-- ---------------------------------------------------------
-- 7. ATRIBUSI PESANAN KE SALES
-- ---------------------------------------------------------
alter table public.orders add column if not exists sales_member_id uuid references public.members(id) on delete set null;
alter table public.orders add column if not exists storefront_slug text;

create index if not exists orders_sales_created_idx on public.orders (sales_member_id, created_at desc);

-- Status yang dihitung sebagai omzet (sudah dibayar).
create or replace function public.erp_is_paid(status text)
returns boolean
language sql immutable
as $$
    select status in ('dibayar', 'diproses', 'dikirim', 'selesai');
$$;

-- Sales & atasannya membaca pesanan atribusi mereka sendiri.
drop policy if exists "erp sales baca pesanannya" on public.orders;
create policy "erp sales baca pesanannya" on public.orders
    for select using (
        sales_member_id is not null and public.erp_can_view(sales_member_id)
    );

drop policy if exists "erp sales baca isi pesanannya" on public.order_items;
create policy "erp sales baca isi pesanannya" on public.order_items
    for select using (
        exists (
            select 1 from public.orders o
            where o.id = order_items.order_id
              and o.sales_member_id is not null
              and public.erp_can_view(o.sales_member_id)
        )
    );

-- Pembuat pesanan dengan atribusi sales: memanggil create_order() lalu
-- menandai pesanan dengan sales pemilik toko (dari slug toko).
create or replace function public.create_order_v2(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
    v_result jsonb;
    v_slug   text := lower(trim(coalesce(p ->> 'sales_slug', '')));
    v_member uuid;
begin
    v_result := public.create_order(p);

    if v_slug <> '' then
        select s.member_id into v_member
          from public.storefronts s
          join public.members m on m.id = s.member_id and m.is_active
         where s.slug = v_slug and s.is_published
         limit 1;

        if v_member is not null then
            update public.orders
               set sales_member_id = v_member, storefront_slug = v_slug
             where order_code = v_result ->> 'order_code';
            v_result := v_result || jsonb_build_object('sales_slug', v_slug);
        end if;
    end if;

    return v_result;
end;
$$;

revoke all on function public.create_order_v2(jsonb) from public;
grant execute on function public.create_order_v2(jsonb) to anon, authenticated;


-- ---------------------------------------------------------
-- 8. PAPAN PERINGKAT SALES (otomatis, real-time dari pesanan)
-- Semua anggota boleh melihat URUTAN & NAMA. Angka omzet hanya terlihat
-- untuk dirinya sendiri dan bawahan (atau owner/direktur).
-- p_period: 'day' (hari ini) | 'month' (bulan ini), zona waktu Jakarta.
-- ---------------------------------------------------------
create or replace function public.erp_leaderboard(p_period text default 'day')
returns table (
    rank         int,
    member_id    uuid,
    full_name    text,
    unit_name    text,
    is_me        boolean,
    omzet        numeric,
    order_count  int
)
language sql stable security definer set search_path = public
as $$
    with bounds as (
        select case when p_period = 'month'
                    then date_trunc('month', now() at time zone 'Asia/Jakarta')
                    else date_trunc('day', now() at time zone 'Asia/Jakarta')
               end at time zone 'Asia/Jakarta' as since
    ),
    sales as (
        select m.id, m.full_name, u.name as unit_name,
               coalesce(sum(o.total) filter (where public.erp_is_paid(o.status)
                                              and o.created_at >= (select since from bounds)), 0) as omzet,
               count(o.id) filter (where public.erp_is_paid(o.status)
                                     and o.created_at >= (select since from bounds))::int as order_count
          from public.members m
          left join public.org_units u on u.id = m.org_unit_id
          left join public.orders o on o.sales_member_id = m.id
         where m.is_active and m.job_role = 'sales'
         group by m.id, m.full_name, u.name
    ),
    ranked as (
        select dense_rank() over (order by omzet desc)::int as rank, s.*
          from sales s
    )
    select r.rank, r.id, r.full_name, r.unit_name,
           r.id = public.erp_me(),
           case when public.erp_can_view(r.id) then r.omzet end,
           case when public.erp_can_view(r.id) then r.order_count end
      from ranked r
     where public.erp_my_level() >= 1
     order by r.rank, r.full_name;
$$;

revoke all on function public.erp_leaderboard(text) from public;
grant execute on function public.erp_leaderboard(text) to authenticated;


-- ---------------------------------------------------------
-- 9. PERSETUJUAN (APPROVAL)
-- Pengajuan otomatis masuk ke atasan langsung.
-- ---------------------------------------------------------
create table if not exists public.approvals (
    id           uuid primary key default gen_random_uuid(),
    kind         text not null check (kind in ('diskon', 'cuti', 'pengeluaran', 'retur', 'lainnya')),
    title        text not null check (char_length(title) between 3 and 120),
    amount       numeric(14, 0),
    note         text check (note is null or char_length(note) <= 500),
    requester_id uuid not null references public.members(id) on delete cascade,
    approver_id  uuid references public.members(id) on delete set null,
    status       text not null default 'menunggu' check (status in ('menunggu', 'disetujui', 'ditolak')),
    decision_note text check (decision_note is null or char_length(decision_note) <= 300),
    created_at   timestamptz not null default now(),
    decided_at   timestamptz
);

create index if not exists approvals_approver_idx on public.approvals (approver_id, status);
create index if not exists approvals_requester_idx on public.approvals (requester_id);

alter table public.approvals enable row level security;

drop policy if exists "erp baca pengajuan" on public.approvals;
create policy "erp baca pengajuan" on public.approvals
    for select using (
        requester_id = public.erp_me()
        or approver_id = public.erp_me()
        or public.erp_my_level() >= 5
    );

drop policy if exists "erp buat pengajuan" on public.approvals;
create policy "erp buat pengajuan" on public.approvals
    for insert with check (requester_id = public.erp_me() and status = 'menunggu');

drop policy if exists "erp putuskan pengajuan" on public.approvals;
create policy "erp putuskan pengajuan" on public.approvals
    for update using (approver_id = public.erp_me() or public.erp_my_level() >= 5)
    with check (approver_id = public.erp_me() or public.erp_my_level() >= 5);

-- Isi approver otomatis = atasan langsung (atau owner bila tidak punya atasan).
create or replace function public.erp_fill_approver()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
    if new.approver_id is null then
        select m.manager_id into new.approver_id from public.members m where m.id = new.requester_id;
    end if;

    if new.approver_id is null then
        select m.id into new.approver_id from public.members m
         where m.level = 5 and m.is_active and m.id <> new.requester_id
         order by m.created_at limit 1;
    end if;

    return new;
end;
$$;

drop trigger if exists approvals_fill_approver on public.approvals;
create trigger approvals_fill_approver
    before insert on public.approvals
    for each row execute function public.erp_fill_approver();


-- ---------------------------------------------------------
-- 10. JEJAK AUDIT (siapa mengubah apa, kapan)
-- ---------------------------------------------------------
create table if not exists public.audit_log (
    id         bigserial primary key,
    actor_id   uuid,               -- members.id (bila ada)
    actor_user uuid,               -- auth.users.id
    table_name text not null,
    record_id  text,
    action     text not null,      -- INSERT | UPDATE | DELETE
    changes    jsonb,
    at         timestamptz not null default now()
);

create index if not exists audit_log_at_idx on public.audit_log (at desc);

alter table public.audit_log enable row level security;

drop policy if exists "erp baca audit" on public.audit_log;
create policy "erp baca audit" on public.audit_log
    for select using (public.erp_my_level() >= 4);
-- Tidak ada policy insert/update/delete: hanya trigger yang menulis.

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

    insert into public.audit_log (actor_id, actor_user, table_name, record_id, action, changes)
    values (
        public.erp_me(), auth.uid(), tg_table_name,
        coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'member_id', v_old ->> 'member_id'),
        tg_op, v_changes
    );

    return coalesce(new, old);
end;
$$;

do $$
declare
    t text;
begin
    foreach t in array array['org_units', 'members', 'member_targets', 'member_salary',
                             'products', 'storefronts', 'approvals'] loop
        execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
        execute format(
            'create trigger %I after insert or update or delete on public.%I
             for each row execute function public.erp_audit()',
            t || '_audit', t
        );
    end loop;
end;
$$;


-- ---------------------------------------------------------
-- 11. REAL-TIME: dashboard ikut berubah saat ada pesanan baru
-- ---------------------------------------------------------
do $$
begin
    alter publication supabase_realtime add table public.orders;
exception when duplicate_object or undefined_object then
    null;
end;
$$;


-- Muat ulang cache skema agar tabel & fungsi baru langsung dikenali API.
notify pgrst, 'reload schema';

-- =========================================================
-- SETELAH MENJALANKAN FILE INI
--  1. Buka /erp/erp.html, login dengan akun owner-mu.
--     Kartu anggota Owner dibuat otomatis.
--  2. Di menu "Organisasi & Akses": buat divisi/tim, lalu tambah anggota
--     (email, nama, jabatan, atasan). Buat akun login mereka di
--     Supabase > Authentication > Users > Add user (email yang sama,
--     centang Auto Confirm). Saat mereka login, akun langsung tersambung.
-- =========================================================
