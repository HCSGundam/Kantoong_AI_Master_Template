-- =========================================================
-- KANTOONG ERP PRO MAX (jalankan SETELAH erp-foundation, phase2, phase3, phase4, pos-pro)
-- File: db/erp-pro.sql   — aman dijalankan berulang (idempoten)
--
-- 1. Persetujuan berjenjang: aturan per jenis+nominal, rantai penyetuju, delegasi
-- 2. Keuangan pro: tagihan piutang/hutang (+jurnal saat dibayar), anggaran, arus rutin
-- 3. Gudang pro: batch + tanggal kedaluwarsa
-- 4. SDM pro: cuti (ikut rantai persetujuan), kontrak, penilaian kinerja
-- 5. CRM pro: pipeline calon pelanggan
-- Rumus rantai SAMA dengan frontend/erp/core/approval-chain.js.
-- Setelah file ini, jalankan ulang db/security-hardening.sql (paling akhir).
-- =========================================================

-- ---------------------------------------------------------
-- 1. PERSETUJUAN BERJENJANG
-- ---------------------------------------------------------
alter table public.approvals add column if not exists chain jsonb not null default '[]'::jsonb;
alter table public.approvals add column if not exists rule_id text;
alter table public.approvals add column if not exists leave_id uuid;

alter table public.approvals drop constraint if exists approvals_kind_check;
alter table public.approvals add constraint approvals_kind_check
    check (kind in ('diskon', 'cuti', 'pengeluaran', 'retur', 'po', 'lainnya'));

create table if not exists public.approval_rules (
    id          text primary key,
    kind        text not null check (kind in ('diskon', 'cuti', 'pengeluaran', 'retur', 'po', 'lainnya')),
    min_amount  numeric(14, 0) not null default 0 check (min_amount >= 0),
    steps       text[] not null check (array_length(steps, 1) between 1 and 5),
    updated_at  timestamptz not null default now()
);

insert into public.approval_rules (id, kind, min_amount, steps) values
    ('r-exp-0', 'pengeluaran', 0, array['atasan']),
    ('r-exp-1', 'pengeluaran', 1000000, array['atasan', 'role:keuangan']),
    ('r-exp-5', 'pengeluaran', 5000000, array['atasan', 'role:keuangan', 'owner']),
    ('r-disc-0', 'diskon', 0, array['atasan']),
    ('r-disc-1', 'diskon', 1000000, array['atasan', 'owner']),
    ('r-leave', 'cuti', 0, array['atasan', 'role:hr']),
    ('r-ret', 'retur', 0, array['atasan']),
    ('r-po-0', 'po', 0, array['atasan']),
    ('r-po-5', 'po', 5000000, array['atasan', 'role:keuangan', 'owner']),
    ('r-other', 'lainnya', 0, array['atasan'])
on conflict (id) do nothing;

alter table public.approval_rules enable row level security;
drop policy if exists "erp baca aturan persetujuan" on public.approval_rules;
create policy "erp baca aturan persetujuan" on public.approval_rules
    for select using (public.erp_me() is not null);
drop policy if exists "erp owner atur aturan persetujuan" on public.approval_rules;
create policy "erp owner atur aturan persetujuan" on public.approval_rules
    for all using (public.erp_my_level() >= 5) with check (
        public.erp_my_level() >= 5
        and (select bool_and(s ~ '^(atasan|owner|level:[1-5]|role:[a-z_]{2,20})$') from unnest(steps) s)
    );

create table if not exists public.approval_delegations (
    id         uuid primary key default gen_random_uuid(),
    from_id    uuid not null references public.members(id) on delete cascade,
    to_id      uuid not null references public.members(id) on delete cascade,
    starts     date not null,
    ends       date not null,
    is_active  boolean not null default true,
    created_at timestamptz not null default now(),
    check (ends >= starts),
    check (from_id <> to_id)
);

alter table public.approval_delegations enable row level security;
drop policy if exists "erp baca delegasi" on public.approval_delegations;
create policy "erp baca delegasi" on public.approval_delegations
    for select using (from_id = public.erp_me() or to_id = public.erp_me() or public.erp_my_level() >= 5);
drop policy if exists "erp buat delegasi" on public.approval_delegations;
create policy "erp buat delegasi" on public.approval_delegations
    for insert with check (from_id = public.erp_me() and public.erp_my_level() >= 2);
drop policy if exists "erp hapus delegasi" on public.approval_delegations;
create policy "erp hapus delegasi" on public.approval_delegations
    for delete using (from_id = public.erp_me() or public.erp_my_level() >= 5);

-- Owner pertama yang aktif.
create or replace function public.erp_pro_owner()
returns uuid language sql stable security definer set search_path = public as $$
    select id from public.members where level >= 5 and is_active order by created_at limit 1;
$$;

-- Satu langkah → orang.
create or replace function public.erp_pro_resolve_step(p_step text, p_requester uuid)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
    v_cursor uuid;
    v_level  int;
    v_need   int;
    v_guard  int := 0;
    v_found  uuid;
begin
    if p_step = 'owner' then
        return public.erp_pro_owner();
    elsif p_step = 'atasan' then
        select m2.id into v_found from public.members m
          join public.members m2 on m2.id = m.manager_id and m2.is_active
         where m.id = p_requester;
        return coalesce(v_found, public.erp_pro_owner());
    elsif p_step like 'level:%' then
        v_need := substr(p_step, 7)::int;
        select manager_id into v_cursor from public.members where id = p_requester;
        while v_cursor is not null and v_guard < 20 loop
            select level, manager_id into v_level, v_found from public.members where id = v_cursor and is_active;
            if v_level >= v_need then return v_cursor; end if;
            v_cursor := v_found;
            v_guard := v_guard + 1;
        end loop;
        return public.erp_pro_owner();
    elsif p_step like 'role:%' then
        select id into v_found from public.members
         where job_role = substr(p_step, 6) and is_active and id <> p_requester
         order by level desc, created_at limit 1;
        return coalesce(v_found, public.erp_pro_owner());
    end if;
    return null;
end;
$$;

-- Rantai lengkap (aturan + delegasi + tanpa pemohon + tanpa dobel). Pemohon owner = rantai kosong.
create or replace function public.erp_pro_build_chain(p_requester uuid, p_kind text, p_amount numeric)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
    v_rule   public.approval_rules;
    v_step   text;
    v_orig   uuid;
    v_appr   uuid;
    v_chain  jsonb := '[]'::jsonb;
    v_today  date := (now() at time zone 'Asia/Jakarta')::date;
begin
    if (select level from public.members where id = p_requester) >= 5 then
        return jsonb_build_object('rule_id', null, 'chain', v_chain);
    end if;

    select * into v_rule from public.approval_rules
     where kind = p_kind and min_amount <= coalesce(p_amount, 0)
     order by min_amount desc limit 1;

    foreach v_step in array coalesce(v_rule.steps, array['atasan']) loop
        v_orig := public.erp_pro_resolve_step(v_step, p_requester);
        continue when v_orig is null;
        select coalesce((select to_id from public.approval_delegations d
                          where d.from_id = v_orig and d.is_active and v_today between d.starts and d.ends
                          order by d.created_at desc limit 1), v_orig)
          into v_appr;
        continue when v_appr = p_requester;
        -- Orang yang sama cukup sekali, di posisi terakhirnya (owner selalu paling akhir).
        if v_chain @> jsonb_build_array(jsonb_build_object('approver_id', v_appr)) then
            select coalesce(jsonb_agg(e order by i), '[]'::jsonb) into v_chain
              from jsonb_array_elements(v_chain) with ordinality as t(e, i)
             where e ->> 'approver_id' <> v_appr::text;
        end if;
        v_chain := v_chain || jsonb_build_array(jsonb_build_object(
            'step', v_step, 'approver_id', v_appr, 'original_id', v_orig,
            'decision', null, 'note', null, 'at', null));
    end loop;

    return jsonb_build_object('rule_id', v_rule.id, 'chain', v_chain);
end;
$$;

-- Ajukan (rantai dihitung SERVER, bukan dari kiriman pengguna).
create or replace function public.erp_pro_submit_approval(
    p_kind text, p_title text, p_amount numeric default null, p_note text default null, p_leave uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
    v_me    uuid := public.erp_me();
    v_built jsonb;
    v_first uuid;
    v_id    uuid;
begin
    if v_me is null then raise exception 'Akses ditolak.'; end if;
    v_built := public.erp_pro_build_chain(v_me, p_kind, p_amount);
    v_first := nullif(v_built -> 'chain' -> 0 ->> 'approver_id', '')::uuid;

    insert into public.approvals (kind, title, amount, note, requester_id, approver_id, status, chain, rule_id, leave_id, decided_at)
    values (p_kind, left(trim(p_title), 120), p_amount, nullif(left(trim(coalesce(p_note, '')), 500), ''), v_me,
            coalesce(v_first, v_me),
            case when jsonb_array_length(v_built -> 'chain') = 0 then 'disetujui' else 'menunggu' end,
            v_built -> 'chain', v_built ->> 'rule_id', p_leave,
            case when jsonb_array_length(v_built -> 'chain') = 0 then now() end)
    returning id into v_id;
    return v_id;
end;
$$;

-- Putuskan langkah yang sedang berjalan. Owner boleh memutuskan langkah siapa pun.
create or replace function public.erp_pro_decide_approval(p_id uuid, p_decision text, p_note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
    v_me     uuid := public.erp_me();
    v_level  int := public.erp_my_level();
    v_row    public.approvals;
    v_idx    int;
    v_step   jsonb;
    v_chain  jsonb;
    v_status text;
    v_next   uuid;
begin
    if p_decision not in ('disetujui', 'ditolak') then raise exception 'Keputusan tidak dikenal.'; end if;
    select * into v_row from public.approvals where id = p_id for update;
    if v_row.id is null then raise exception 'Pengajuan tidak ditemukan.'; end if;
    if v_row.status <> 'menunggu' then raise exception 'Pengajuan ini sudah diputuskan.'; end if;
    if v_row.requester_id = v_me and v_level < 5 then raise exception 'Tidak boleh menyetujui pengajuan sendiri.'; end if;

    v_chain := coalesce(v_row.chain, '[]'::jsonb);
    if jsonb_array_length(v_chain) = 0 then
        -- Pengajuan lama (sebelum Pro): satu langkah = approver_id.
        if v_row.approver_id <> v_me and v_level < 5 then raise exception 'Belum giliranmu menyetujui pengajuan ini.'; end if;
        v_status := p_decision;
    else
        select (i - 1) into v_idx from jsonb_array_elements(v_chain) with ordinality as t(s, i)
         where (s ->> 'decision') is null order by i limit 1;
        if v_idx is null then raise exception 'Tidak ada langkah yang menunggu.'; end if;
        v_step := v_chain -> v_idx;
        if (v_step ->> 'approver_id')::uuid <> v_me and v_level < 5 then
            raise exception 'Belum giliranmu menyetujui pengajuan ini.';
        end if;
        v_chain := jsonb_set(v_chain, array[v_idx::text], v_step || jsonb_build_object(
            'decision', p_decision, 'note', nullif(left(coalesce(p_note, ''), 300), ''), 'at', now(), 'decided_by', v_me));
        if p_decision = 'ditolak' then
            v_status := 'ditolak';
        elsif v_idx + 1 >= jsonb_array_length(v_chain) then
            v_status := 'disetujui';
        else
            v_status := 'menunggu';
            v_next := (v_chain -> (v_idx + 1) ->> 'approver_id')::uuid;
        end if;
    end if;

    update public.approvals set
        chain = v_chain,
        status = v_status,
        approver_id = coalesce(v_next, approver_id),
        decision_note = case when v_status <> 'menunggu' then nullif(left(coalesce(p_note, ''), 300), '') else decision_note end,
        decided_at = case when v_status <> 'menunggu' then now() end
     where id = p_id;

    if v_row.leave_id is not null then
        update public.hr_leaves set status = v_status where id = v_row.leave_id;
    end if;
    return v_status;
end;
$$;

-- Penyetuju di rantai ikut bisa membaca pengajuannya.
drop policy if exists "erp baca pengajuan" on public.approvals;
create policy "erp baca pengajuan" on public.approvals
    for select using (
        requester_id = public.erp_me()
        or approver_id = public.erp_me()
        or public.erp_my_level() >= 5
        or exists (select 1 from jsonb_array_elements(chain) s
                    where s ->> 'approver_id' = public.erp_me()::text or s ->> 'original_id' = public.erp_me()::text)
    );
-- Pengajuan & keputusan HANYA lewat fungsi (rantai tidak bisa diakali dari browser).
drop policy if exists "erp buat pengajuan" on public.approvals;
drop policy if exists "erp putuskan pengajuan" on public.approvals;

-- ---------------------------------------------------------
-- 2. KEUANGAN PRO
-- ---------------------------------------------------------
alter table public.journal_entries drop constraint if exists journal_entries_source_check;
alter table public.journal_entries add constraint journal_entries_source_check
    check (source in ('manual', 'pos', 'order', 'payroll', 'pengeluaran', 'pembelian', 'retur', 'tagihan'));

create table if not exists public.finance_invoices (
    id         uuid primary key default gen_random_uuid(),
    direction  text not null check (direction in ('piutang', 'hutang')),
    party      text not null check (char_length(party) between 1 and 80),
    number     text not null check (char_length(number) between 1 and 40),
    amount     numeric(14, 0) not null check (amount > 0),
    paid       numeric(14, 0) not null default 0 check (paid >= 0),
    issued_at  date not null default (now() at time zone 'Asia/Jakarta')::date,
    due_date   date not null,
    status     text not null default 'terbuka' check (status in ('terbuka', 'sebagian', 'lunas', 'batal')),
    created_by uuid references public.members(id) on delete set null,
    created_at timestamptz not null default now(),
    check (paid <= amount)
);
create index if not exists finance_invoices_due_idx on public.finance_invoices (direction, due_date);

create table if not exists public.finance_budgets (
    id           uuid primary key default gen_random_uuid(),
    account_code text not null,
    label        text,
    period       text not null check (period ~ '^\d{4}-\d{2}$'),
    amount       numeric(14, 0) not null check (amount > 0),
    unique (account_code, period)
);

create table if not exists public.finance_recurring (
    id     uuid primary key default gen_random_uuid(),
    label  text not null check (char_length(label) between 1 and 80),
    amount numeric(14, 0) not null,     -- + masuk / - keluar
    day    int not null check (day between 1 and 28)
);

alter table public.finance_invoices enable row level security;
alter table public.finance_budgets enable row level security;
alter table public.finance_recurring enable row level security;

drop policy if exists "erp keuangan baca tagihan" on public.finance_invoices;
create policy "erp keuangan baca tagihan" on public.finance_invoices
    for select using (public.erp_has_role(array['keuangan']));
drop policy if exists "erp keuangan buat tagihan" on public.finance_invoices;
create policy "erp keuangan buat tagihan" on public.finance_invoices
    for insert with check (public.erp_has_role(array['keuangan']) and paid = 0 and status = 'terbuka');
-- Pembayaran HANYA lewat erp_pro_pay_invoice (agar jurnal selalu ikut).

drop policy if exists "erp keuangan anggaran" on public.finance_budgets;
create policy "erp keuangan anggaran" on public.finance_budgets
    for all using (public.erp_has_role(array['keuangan'])) with check (public.erp_has_role(array['keuangan']));
drop policy if exists "erp keuangan arus rutin" on public.finance_recurring;
create policy "erp keuangan arus rutin" on public.finance_recurring
    for all using (public.erp_has_role(array['keuangan'])) with check (public.erp_has_role(array['keuangan']));

create or replace function public.erp_pro_pay_invoice(p_id uuid, p_amount numeric, p_cash text default '1-1100')
returns void language plpgsql security definer set search_path = public as $$
declare
    v_inv public.finance_invoices;
    v_amt numeric := round(coalesce(p_amount, 0));
begin
    if not public.erp_has_role(array['keuangan']) then raise exception 'Hanya bagian keuangan yang boleh mencatat pembayaran.'; end if;
    if p_cash not in ('1-1000', '1-1100') then raise exception 'Akun kas tidak valid.'; end if;
    select * into v_inv from public.finance_invoices where id = p_id for update;
    if v_inv.id is null then raise exception 'Tagihan tidak ditemukan.'; end if;
    if v_amt <= 0 then raise exception 'Nominal bayar harus lebih dari 0.'; end if;
    if v_amt > v_inv.amount - v_inv.paid then raise exception 'Nominal melebihi sisa tagihan.'; end if;

    update public.finance_invoices
       set paid = paid + v_amt,
           status = case when paid + v_amt >= amount then 'lunas' else 'sebagian' end
     where id = p_id;

    perform public.erp_journal_write(
        null,
        (case when v_inv.direction = 'piutang' then 'Terima pembayaran ' else 'Bayar tagihan ' end) || v_inv.party || ' (' || v_inv.number || ')',
        'tagihan', v_inv.id::text || '-' || extract(epoch from clock_timestamp())::bigint::text,
        case when v_inv.direction = 'piutang' then jsonb_build_array(
            jsonb_build_object('account_code', p_cash, 'debit', v_amt),
            jsonb_build_object('account_code', '1-1200', 'credit', v_amt))
        else jsonb_build_array(
            jsonb_build_object('account_code', '2-1000', 'debit', v_amt),
            jsonb_build_object('account_code', p_cash, 'credit', v_amt)) end,
        public.erp_me()
    );
end;
$$;

-- ---------------------------------------------------------
-- 3. GUDANG PRO: batch & kedaluwarsa
-- ---------------------------------------------------------
create table if not exists public.stock_batches (
    id           uuid primary key default gen_random_uuid(),
    product_id   text not null,
    warehouse_id uuid,
    lot          text not null default '-' check (char_length(lot) <= 30),
    qty          numeric(12, 2) not null default 0 check (qty >= 0),
    expires_on   date not null,
    created_by   uuid references public.members(id) on delete set null,
    created_at   timestamptz not null default now()
);
create index if not exists stock_batches_expiry_idx on public.stock_batches (expires_on) where qty > 0;

alter table public.stock_batches enable row level security;
drop policy if exists "erp baca batch" on public.stock_batches;
create policy "erp baca batch" on public.stock_batches
    for select using (public.erp_my_level() >= 3 or public.erp_has_role(array['gudang', 'produk']));
drop policy if exists "erp gudang batch" on public.stock_batches;
create policy "erp gudang batch" on public.stock_batches
    for insert with check (public.erp_has_role(array['gudang']));
drop policy if exists "erp gudang ubah batch" on public.stock_batches;
create policy "erp gudang ubah batch" on public.stock_batches
    for update using (public.erp_has_role(array['gudang'])) with check (public.erp_has_role(array['gudang']));

-- ---------------------------------------------------------
-- 4. SDM PRO
-- ---------------------------------------------------------
create table if not exists public.hr_leaves (
    id          uuid primary key default gen_random_uuid(),
    member_id   uuid not null references public.members(id) on delete cascade,
    kind        text not null check (kind in ('tahunan', 'sakit', 'izin', 'melahirkan')),
    starts      date not null,
    ends        date not null,
    days        int not null check (days between 1 and 120),
    reason      text check (reason is null or char_length(reason) <= 200),
    status      text not null default 'menunggu' check (status in ('menunggu', 'disetujui', 'ditolak')),
    approval_id uuid,
    created_at  timestamptz not null default now(),
    check (ends >= starts)
);

alter table public.hr_leaves enable row level security;
drop policy if exists "erp baca cuti" on public.hr_leaves;
create policy "erp baca cuti" on public.hr_leaves
    for select using (member_id = public.erp_me() or public.erp_has_role(array['hr']) or public.erp_can_view(member_id));

create or replace function public.erp_pro_request_leave(p_kind text, p_starts date, p_ends date, p_reason text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
    v_me    uuid := public.erp_me();
    v_days  int;
    v_leave uuid;
    v_appr  uuid;
begin
    if v_me is null then raise exception 'Akses ditolak.'; end if;
    if p_ends < p_starts then raise exception 'Tanggal selesai sebelum tanggal mulai.'; end if;
    select count(*) into v_days from generate_series(p_starts, p_ends, interval '1 day') d
     where extract(isodow from d) < 6;
    if v_days = 0 then raise exception 'Rentang itu tidak berisi hari kerja.'; end if;

    insert into public.hr_leaves (member_id, kind, starts, ends, days, reason)
    values (v_me, p_kind, p_starts, p_ends, v_days, nullif(left(trim(coalesce(p_reason, '')), 200), ''))
    returning id into v_leave;

    v_appr := public.erp_pro_submit_approval('cuti', 'Cuti ' || v_days || ' hari (' || p_starts || ' s.d. ' || p_ends || ')', null, p_reason, v_leave);
    update public.hr_leaves set approval_id = v_appr,
        status = (select status from public.approvals where id = v_appr)
     where id = v_leave;
    return v_leave;
end;
$$;

create table if not exists public.hr_contracts (
    id                uuid primary key default gen_random_uuid(),
    member_id         uuid not null references public.members(id) on delete cascade,
    type              text not null check (type in ('pkwt', 'pkwtt', 'magang', 'harian')),
    starts_on         date,
    ends_on           date,
    probation_ends_on date,
    created_at        timestamptz not null default now(),
    check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

alter table public.hr_contracts enable row level security;
drop policy if exists "erp baca kontrak" on public.hr_contracts;
create policy "erp baca kontrak" on public.hr_contracts
    for select using (member_id = public.erp_me() or public.erp_has_role(array['hr']));
drop policy if exists "erp hr atur kontrak" on public.hr_contracts;
create policy "erp hr atur kontrak" on public.hr_contracts
    for all using (public.erp_has_role(array['hr'])) with check (public.erp_has_role(array['hr']));

create table if not exists public.hr_reviews (
    id          uuid primary key default gen_random_uuid(),
    member_id   uuid not null references public.members(id) on delete cascade,
    reviewer_id uuid not null references public.members(id) on delete cascade,
    period      text not null check (char_length(period) between 4 and 12),
    scores      jsonb not null,
    note        text check (note is null or char_length(note) <= 300),
    created_at  timestamptz not null default now(),
    check (member_id <> reviewer_id)
);

alter table public.hr_reviews enable row level security;
drop policy if exists "erp baca penilaian" on public.hr_reviews;
create policy "erp baca penilaian" on public.hr_reviews
    for select using (member_id = public.erp_me() or reviewer_id = public.erp_me()
                      or public.erp_has_role(array['hr']) or public.erp_can_view(member_id));
drop policy if exists "erp buat penilaian" on public.hr_reviews;
create policy "erp buat penilaian" on public.hr_reviews
    for insert with check (
        reviewer_id = public.erp_me() and member_id <> public.erp_me()
        and (public.erp_has_role(array['hr']) or public.erp_can_manage(member_id))
    );

-- ---------------------------------------------------------
-- 5. CRM PRO: pipeline
-- ---------------------------------------------------------
create table if not exists public.crm_deals (
    id             uuid primary key default gen_random_uuid(),
    title          text not null check (char_length(title) between 1 and 80),
    customer       text not null check (char_length(customer) between 1 and 80),
    value          numeric(14, 0) not null default 0 check (value >= 0),
    stage          text not null default 'prospek' check (stage in ('prospek', 'dihubungi', 'penawaran', 'negosiasi', 'menang', 'kalah')),
    owner_id       uuid not null references public.members(id) on delete cascade,
    next_action    text check (next_action is null or char_length(next_action) <= 120),
    next_action_at timestamptz,
    lost_reason    text check (lost_reason is null or char_length(lost_reason) <= 200),
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    check (stage <> 'kalah' or lost_reason is not null)
);

alter table public.crm_deals enable row level security;
drop policy if exists "erp baca deal" on public.crm_deals;
create policy "erp baca deal" on public.crm_deals
    for select using (owner_id = public.erp_me() or public.erp_my_level() >= 3 or public.erp_has_role(array['marketing']));
drop policy if exists "erp buat deal" on public.crm_deals;
create policy "erp buat deal" on public.crm_deals
    for insert with check (owner_id = public.erp_me()
        and (public.erp_my_level() >= 2 or public.erp_has_role(array['sales', 'cs', 'marketing'])));
drop policy if exists "erp ubah deal" on public.crm_deals;
create policy "erp ubah deal" on public.crm_deals
    for update using (owner_id = public.erp_me() or public.erp_my_level() >= 3)
    with check (owner_id = public.erp_me() or public.erp_my_level() >= 3);

-- ---------------------------------------------------------
-- 6. IZIN FUNGSI (Supabase memberi izin bawaan LANGSUNG → cabut dulu)
-- ---------------------------------------------------------
revoke all on function public.erp_pro_owner() from public, anon, authenticated;
revoke all on function public.erp_pro_resolve_step(text, uuid) from public, anon, authenticated;
revoke all on function public.erp_pro_build_chain(uuid, text, numeric) from public, anon, authenticated;
revoke all on function public.erp_pro_submit_approval(text, text, numeric, text, uuid) from public, anon;
revoke all on function public.erp_pro_decide_approval(uuid, text, text) from public, anon;
revoke all on function public.erp_pro_pay_invoice(uuid, numeric, text) from public, anon;
revoke all on function public.erp_pro_request_leave(text, date, date, text) from public, anon;
grant execute on function public.erp_pro_submit_approval(text, text, numeric, text, uuid) to authenticated;
grant execute on function public.erp_pro_decide_approval(uuid, text, text) to authenticated;
grant execute on function public.erp_pro_pay_invoice(uuid, numeric, text) to authenticated;
grant execute on function public.erp_pro_request_leave(text, date, date, text) to authenticated;

-- Pratinjau rantai untuk pemohon sendiri (tanpa membocorkan aturan orang lain).
create or replace function public.erp_pro_preview_chain(p_kind text, p_amount numeric)
returns jsonb language sql stable security definer set search_path = public as $$
    select public.erp_pro_build_chain(public.erp_me(), p_kind, p_amount) -> 'chain'
     where public.erp_me() is not null;
$$;
revoke all on function public.erp_pro_preview_chain(text, numeric) from public, anon;
grant execute on function public.erp_pro_preview_chain(text, numeric) to authenticated;

-- Audit perubahan tabel pro (fungsi erp_audit dari erp-foundation.sql).
do $$
declare t text;
begin
    foreach t in array array['approval_rules', 'approval_delegations', 'finance_invoices', 'finance_budgets',
                             'stock_batches', 'hr_contracts', 'hr_reviews', 'crm_deals'] loop
        execute format('drop trigger if exists %I_audit on public.%I', t, t);
        execute format('create trigger %I_audit after insert or update or delete on public.%I
                        for each row execute function public.erp_audit()', t, t);
    end loop;
end $$;
