-- =========================================================
-- KANTOONG ERP — DOKUMEN, QR KEASLIAN, KOTAK MASUK & WADAH AGEN AI
-- File: db/erp-docs.sql — jalankan SETELAH db/erp-pro.sql, lalu security-hardening.sql
-- Aman dijalankan berulang (idempoten).
--
-- 1. erp_doc_settings  : kop surat & tanda tangan brand (1 baris)
-- 2. erp_documents     : register dokumen terbit (nomor, sidik SHA-256, status)
--    Isi dokumen disimpan sebagai TEKS JSON (model), bukan file.
-- 3. erp_verify_document(id, kode): fungsi PUBLIK untuk halaman verify.html —
--    hanya mengembalikan judul/nomor/tanggal/penerbit/status, TANPA isi dokumen
--    & tanpa data pribadi penerima.
-- 4. Persetujuan jenis "dokumen" (tanda tangan berjenjang) → dokumen terbit otomatis.
-- 5. ai_agent_settings & ai_agent_tasks: wadah Agen AI per anggota + kuota add-on.
-- =========================================================

-- ---------- 1. Kop surat & tanda tangan ----------
create table if not exists public.erp_doc_settings (
    id           int primary key default 1 check (id = 1),
    signer_name  text check (char_length(signer_name) <= 80),
    signer_title text check (char_length(signer_title) <= 80),
    city         text check (char_length(city) <= 40),
    address      text check (char_length(address) <= 200),
    phone        text check (char_length(phone) <= 40),
    email        text check (char_length(email) <= 80),
    signature    text check (signature is null or (signature like 'data:image/png;base64,%' and char_length(signature) <= 300000)),
    updated_at   timestamptz not null default now()
);
insert into public.erp_doc_settings (id) values (1) on conflict (id) do nothing;

alter table public.erp_doc_settings enable row level security;
drop policy if exists "erp baca kop" on public.erp_doc_settings;
create policy "erp baca kop" on public.erp_doc_settings for select using (public.erp_me() is not null);
drop policy if exists "erp ubah kop" on public.erp_doc_settings;
create policy "erp ubah kop" on public.erp_doc_settings for update using (public.erp_my_level() >= 4) with check (public.erp_my_level() >= 4);

-- ---------- 2. Register dokumen ----------
create table if not exists public.erp_documents (
    id           uuid primary key default gen_random_uuid(),
    kind         text not null check (kind in ('slip', 'invoice', 'po', 'penawaran', 'keterangan', 'peringatan', 'laporan')),
    number       text not null check (char_length(number) between 3 and 40),
    title        text not null check (char_length(title) between 2 and 120),
    party        text check (char_length(party) <= 120),
    amount       numeric(14, 0),
    issued_on    date not null,
    hash         text not null check (hash ~ '^[0-9a-f]{64}$'),
    model        jsonb not null,
    status       text not null default 'terbit' check (status in ('menunggu', 'terbit', 'ditolak', 'dicabut')),
    created_by   uuid not null references public.members(id),
    recipient_id uuid references public.members(id) on delete set null,
    approval_id  uuid,
    revoked_reason text check (char_length(revoked_reason) <= 200),
    signed_at    timestamptz,
    created_at   timestamptz not null default now(),
    unique (kind, number)
);
create index if not exists erp_documents_created_idx on public.erp_documents (created_at desc);

alter table public.erp_documents enable row level security;
drop policy if exists "erp baca dokumen" on public.erp_documents;
create policy "erp baca dokumen" on public.erp_documents for select using (
    public.erp_my_level() >= 4
    or created_by = public.erp_me() or recipient_id = public.erp_me()
    or (kind in ('invoice', 'po', 'laporan', 'penawaran') and public.erp_has_role(array['keuangan']))
    or (kind in ('slip', 'keterangan', 'peringatan') and public.erp_has_role(array['hr']))
    or exists (select 1 from public.approvals a, jsonb_array_elements(a.chain) s
                where a.id = erp_documents.approval_id and s ->> 'approver_id' = public.erp_me()::text)
);
-- Tulis HANYA lewat fungsi (nomor & status tidak bisa diakali dari browser).

alter table public.approvals add column if not exists document_id uuid;
alter table public.approvals drop constraint if exists approvals_kind_check;
alter table public.approvals add constraint approvals_kind_check
    check (kind in ('diskon', 'cuti', 'pengeluaran', 'retur', 'po', 'dokumen', 'lainnya'));
alter table public.approval_rules drop constraint if exists approval_rules_kind_check;
alter table public.approval_rules add constraint approval_rules_kind_check
    check (kind in ('diskon', 'cuti', 'pengeluaran', 'retur', 'po', 'dokumen', 'lainnya'));
insert into public.approval_rules (id, kind, min_amount, steps)
values ('r-doc', 'dokumen', 0, array['atasan', 'owner']) on conflict (id) do nothing;

create or replace function public.erp_create_document(p jsonb, p_sign boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare
    v_me    uuid := public.erp_me();
    v_kind  text := p ->> 'kind';
    v_id    uuid;
    v_appr  uuid;
    v_title text := left(coalesce(p ->> 'title', ''), 120);
begin
    if v_me is null then raise exception 'Akses ditolak.'; end if;
    if v_kind in ('slip', 'keterangan', 'peringatan') and not (public.erp_has_role(array['hr']) or public.erp_my_level() >= 3) then
        raise exception 'Dokumen SDM dibuat oleh HR atau atasan.';
    end if;
    if v_kind in ('invoice', 'po', 'laporan') and not (public.erp_has_role(array['keuangan', 'gudang']) or public.erp_my_level() >= 3) then
        raise exception 'Dokumen keuangan dibuat oleh bagian keuangan atau atasan.';
    end if;

    insert into public.erp_documents (kind, number, title, party, amount, issued_on, hash, model, status, created_by, recipient_id, signed_at)
    values (v_kind, p ->> 'number', v_title, left(p ->> 'party', 120), nullif(p ->> 'amount', '')::numeric,
            (p ->> 'issued_on')::date, p ->> 'hash', p -> 'model',
            case when p_sign then 'menunggu' else 'terbit' end, v_me, nullif(p ->> 'recipient_id', '')::uuid,
            -- Diterbitkan langsung oleh pimpinan (level 4+) = sudah ditandatangani.
            case when not p_sign and public.erp_my_level() >= 4 then now() end)
    returning id into v_id;

    if p_sign then
        v_appr := public.erp_pro_submit_approval('dokumen', 'Tanda tangani ' || lower(v_title) || ' ' || (p ->> 'number'),
                                                 nullif(p ->> 'amount', '')::numeric, nullif(p ->> 'party', ''), null);
        update public.approvals set document_id = v_id where id = v_appr;
        update public.erp_documents d set approval_id = v_appr,
            status = case when a.status = 'disetujui' then 'terbit' else 'menunggu' end,
            signed_at = case when a.status = 'disetujui' then now() end
          from public.approvals a where a.id = v_appr and d.id = v_id;
    end if;
    return v_id;
end;
$$;

create or replace function public.erp_revoke_document(p_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
    update public.erp_documents set status = 'dicabut', revoked_reason = left(p_reason, 200)
     where id = p_id and (created_by = public.erp_me() or public.erp_my_level() >= 4);
    if not found then raise exception 'Dokumen tidak ditemukan atau bukan milikmu.'; end if;
end;
$$;

-- Dokumen ikut keputusan rantai tanda tangan.
create or replace function public.erp_document_follow_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    if new.document_id is not null and new.status is distinct from old.status and new.status <> 'menunggu' then
        update public.erp_documents
           set status = case when new.status = 'disetujui' then 'terbit' else 'ditolak' end,
               signed_at = case when new.status = 'disetujui' then now() end
         where id = new.document_id and status = 'menunggu';
    end if;
    return new;
end;
$$;
drop trigger if exists approvals_document_follow on public.approvals;
create trigger approvals_document_follow after update on public.approvals
    for each row execute function public.erp_document_follow_approval();

-- ---------- 3. Verifikasi PUBLIK (QR) ----------
-- Kode = 12 huruf pertama sidik SHA-256 isi dokumen. Tanpa isi & tanpa data pribadi.
create or replace function public.erp_verify_document(p_id uuid, p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
    select case when d.id is null then jsonb_build_object('found', false)
    else jsonb_build_object(
        'found', true,
        'match', left(d.hash, 12) = lower(left(coalesce(p_code, ''), 12)),
        'status', d.status,
        'kind', d.kind,
        'title', d.title,
        'number', d.number,
        'issued_on', d.issued_on,
        'issuer', (select m.full_name from public.members m where m.id = d.created_by),
        'signed', d.signed_at is not null
    ) end
    from (select 1) one left join public.erp_documents d on d.id = p_id;
$$;

-- ---------- 4. Wadah Agen AI ----------
alter table public.brand_addons add column if not exists quota int not null default 0 check (quota between 0 and 50);

create table if not exists public.ai_agent_settings (
    member_id  uuid primary key references public.members(id) on delete cascade,
    mode       text not null default 'tampil' check (mode in ('tampil', 'belakang')),
    agents     jsonb not null default '[]'::jsonb check (jsonb_array_length(agents) <= 21),
    updated_at timestamptz not null default now()
);
create table if not exists public.ai_agent_tasks (
    id          text primary key check (char_length(id) <= 40),
    member_id   uuid not null references public.members(id) on delete cascade,
    agent_id    text,
    skill       text not null check (skill in ('dokumen', 'tagih', 'restok', 'laporan')),
    input       jsonb,
    steps       jsonb not null default '[]'::jsonb,
    status      text not null check (status in ('antre', 'berjalan', 'selesai', 'gagal', 'dihentikan')),
    result      jsonb,
    error       text check (char_length(error) <= 300),
    created_at  timestamptz not null default now(),
    started_at  timestamptz,
    finished_at timestamptz
);
create index if not exists ai_agent_tasks_member_idx on public.ai_agent_tasks (member_id, created_at desc);

alter table public.ai_agent_settings enable row level security;
alter table public.ai_agent_tasks enable row level security;
drop policy if exists "agen milik sendiri" on public.ai_agent_settings;
create policy "agen milik sendiri" on public.ai_agent_settings
    for all using (member_id = public.erp_me()) with check (member_id = public.erp_me());
drop policy if exists "tugas agen milik sendiri" on public.ai_agent_tasks;
create policy "tugas agen milik sendiri" on public.ai_agent_tasks
    for all using (member_id = public.erp_me() or public.erp_my_level() >= 5) with check (member_id = public.erp_me());

-- ---------- 5. Izin fungsi ----------
revoke all on function public.erp_create_document(jsonb, boolean) from public, anon;
revoke all on function public.erp_revoke_document(uuid, text) from public, anon;
revoke all on function public.erp_document_follow_approval() from public, anon, authenticated;
grant execute on function public.erp_create_document(jsonb, boolean) to authenticated;
grant execute on function public.erp_revoke_document(uuid, text) to authenticated;
revoke all on function public.erp_verify_document(uuid, text) from public;
grant execute on function public.erp_verify_document(uuid, text) to anon, authenticated;

do $$
declare t text;
begin
    foreach t in array array['erp_doc_settings', 'erp_documents'] loop
        execute format('drop trigger if exists %I_audit on public.%I', t, t);
        execute format('create trigger %I_audit after insert or update on public.%I for each row execute function public.erp_audit()', t, t);
    end loop;
end $$;
