/**
 * KANTOONG ERP — ORGANISASI & AKSES (modul 1)
 * File: frontend/erp/modules/org.js
 *
 * Pohon organisasi tanpa batas kedalaman (perusahaan > divisi >
 * departemen > tim > unit) + anggota, jabatan, atasan, peran kerja,
 * alamat toko sales, dan modul yang boleh dibuka.
 * Mengubah: owner, direktur, HR. Manager: hanya melihat.
 */

import {
    JOB_ROLES, LEVELS, UNIT_KINDS, buildUnitTree, canEditSalary, isOrgAdmin,
    isValidManager, isValidSlug, levelName, slugify, subtreeIds, unitSubtreeIds,
} from "../core/org.js";
import { MODULES } from "../core/modules.js";
import { el, emptyState, formDialog, friendlyError, icon, initials, pageHeader, toast } from "../ui.js";

let selectedUnit = null;
let search = "";

export async function render(ctx) {
    const { data, me } = ctx;
    const [units, members] = await Promise.all([data.listUnits(), data.listMembers()]);
    const admin = isOrgAdmin(me);
    const tree = buildUnitTree(units);

    if (selectedUnit && !units.some((unit) => unit.id === selectedUnit)) selectedUnit = null;

    const page = el("div", { class: "erp-page__inner" });

    page.appendChild(pageHeader(
        "Organisasi & Akses",
        admin
            ? "Susun divisi, tim, jabatan, dan atasan. Hak lihat data mengikuti garis atasan."
            : "Struktur organisasi (hanya-baca untuk jabatanmu).",
        admin ? el("button", { class: "erp-btn", type: "button", onclick: () => editUnit(ctx, units, { parent_id: selectedUnit }) }, "+ Unit") : null,
        admin ? el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => editMember(ctx, units, members, { org_unit_id: selectedUnit }) }, "+ Anggota") : null
    ));

    // ---------- Pohon unit ----------
    const countIn = (unitId) => {
        const ids = unitSubtreeIds(units, unitId);
        return members.filter((member) => ids.has(member.org_unit_id) && member.is_active !== false).length;
    };

    const renderNode = (node, depth) => el("li", {},
        el("div", { class: `erp-tree__row${selectedUnit === node.id ? " is-selected" : ""}`, style: `--depth:${depth}` },
            el("button", {
                class: "erp-tree__name",
                type: "button",
                onclick: () => {
                    selectedUnit = selectedUnit === node.id ? null : node.id;
                    ctx.rerender();
                },
            },
                el("span", { class: "erp-tag", text: UNIT_KINDS[node.kind] || node.kind }),
                el("span", { text: node.name }),
                el("small", { text: String(countIn(node.id)) })
            ),
            admin
                ? el("span", { class: "erp-tree__actions" },
                    el("button", { class: "erp-icon-btn erp-icon-btn--sm", type: "button", title: "Tambah sub-unit", "aria-label": `Tambah sub-unit di ${node.name}`, onclick: () => editUnit(ctx, units, { parent_id: node.id }) }, "+"),
                    el("button", { class: "erp-icon-btn erp-icon-btn--sm", type: "button", title: "Ubah", "aria-label": `Ubah ${node.name}`, onclick: () => editUnit(ctx, units, node) }, icon("M4 20h4L19 9l-4-4L4 16zM14 6l4 4"))
                )
                : null
        ),
        node.children.length ? el("ul", {}, node.children.map((child) => renderNode(child, depth + 1))) : null
    );

    const treeCard = el("section", { class: "erp-card erp-tree" },
        el("div", { class: "erp-card__head" },
            el("h2", { text: "Struktur" }),
            selectedUnit ? el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => { selectedUnit = null; ctx.rerender(); } }, "Semua") : null
        ),
        tree.length ? el("ul", { class: "erp-tree__list" }, tree.map((node) => renderNode(node, 0))) : emptyState("Belum ada unit. Mulai dari \"+ Unit\".")
    );

    // ---------- Daftar anggota ----------
    const scope = selectedUnit ? unitSubtreeIds(units, selectedUnit) : null;
    const query = search.trim().toLowerCase();
    const visible = members
        .filter((member) => !scope || scope.has(member.org_unit_id))
        .filter((member) => !query || `${member.full_name} ${member.email} ${member.position_title}`.toLowerCase().includes(query))
        .sort((a, b) => b.level - a.level || a.full_name.localeCompare(b.full_name, "id"));

    const nameOf = (id) => members.find((member) => member.id === id)?.full_name || "—";

    const searchInput = el("input", { type: "search", class: "erp-search", placeholder: "Cari nama, email, jabatan…", "aria-label": "Cari anggota" });
    searchInput.value = search;
    searchInput.addEventListener("input", () => {
        search = searchInput.value;
        clearTimeout(searchInput.timer);
        searchInput.timer = setTimeout(() => ctx.rerender(), 250);
    });

    const memberCard = el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" },
            el("h2", { text: selectedUnit ? units.find((unit) => unit.id === selectedUnit)?.name : "Semua anggota" }),
            searchInput
        ),
        visible.length
            ? el("ul", { class: "erp-members" }, visible.map((member) =>
                el("li", { class: `erp-member${member.is_active === false ? " is-off" : ""}` },
                    el("span", { class: "erp-avatar", text: initials(member.full_name) }),
                    el("div", { class: "erp-member__main" },
                        el("strong", { text: member.full_name }),
                        el("small", { text: `${member.position_title} · ${levelName(member.level)} · ${JOB_ROLES[member.job_role] || member.job_role}` }),
                        el("small", { class: "erp-muted", text: [member.unit_name, member.manager_id ? `Atasan: ${nameOf(member.manager_id)}` : null, member.sales_slug ? `Toko: /${member.sales_slug}` : null].filter(Boolean).join(" · ") })
                    ),
                    member.is_active === false ? el("span", { class: "erp-pill", text: "Nonaktif" }) : null,
                    admin ? el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => editMember(ctx, units, members, member) }, "Ubah") : null
                )
            ))
            : emptyState("Tidak ada anggota di sini.")
    );

    page.appendChild(el("div", { class: "erp-split" }, treeCard, memberCard));

    if (admin && data.mode === "supabase") {
        page.appendChild(el("p", { class: "erp-muted erp-note" },
            "Akun login: buat di Supabase › Authentication › Users (email sama dengan anggota, centang Auto Confirm). Saat orang itu login pertama kali, akunnya otomatis tersambung."
        ));
    }

    return page;
}

/* ---------- Unit ---------- */

async function editUnit(ctx, units, unit) {
    const isNew = !unit.id;
    const blocked = isNew ? new Set() : unitSubtreeIds(units, unit.id);

    const values = await formDialog({
        title: isNew ? "Tambah unit" : `Ubah unit — ${unit.name}`,
        fields: [
            { name: "name", label: "Nama", required: true, max: 80, value: unit.name || "" },
            { name: "kind", label: "Jenis", type: "select", value: unit.kind || "divisi", options: Object.entries(UNIT_KINDS).map(([value, label]) => ({ value, label })) },
            {
                name: "parent_id", label: "Di bawah", type: "select", value: unit.parent_id || "",
                options: [{ value: "", label: "— Paling atas —" }].concat(
                    units.filter((entry) => !blocked.has(entry.id)).map((entry) => ({ value: entry.id, label: entry.name }))
                ),
            },
        ],
        danger: isNew ? null : {
            label: "Hapus unit",
            onClick: async () => {
                if (!window.confirm(`Hapus "${unit.name}" beserta sub-unitnya? Anggota di dalamnya tetap ada (tanpa unit).`)) return;
                try {
                    await ctx.data.deleteUnit(unit.id);
                    toast("Unit dihapus.");
                    ctx.rerender();
                } catch (error) {
                    toast(friendlyError(error), "error");
                }
            },
        },
    });

    if (!values) return;

    try {
        await ctx.data.saveUnit({
            ...(isNew ? {} : { id: unit.id }),
            name: values.name.trim(),
            kind: values.kind,
            parent_id: values.parent_id || null,
        });
        toast(isNew ? "Unit ditambahkan." : "Unit disimpan.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

/* ---------- Anggota ---------- */

async function editMember(ctx, units, members, member) {
    const { me, data } = ctx;
    const isNew = !member.id;
    const blocked = isNew ? new Set() : new Set([member.id, ...subtreeIds(members, member.id)]);
    const salaryEditable = canEditSalary(me) && !isNew;
    const salary = salaryEditable ? await data.getSalary(member.id) : null;

    const levelOptions = Object.entries(LEVELS)
        .filter(([value]) => Number(value) < 5 || me.level >= 5)
        .sort((a, b) => b[0] - a[0])
        .map(([value, label]) => ({ value, label: `${value} · ${label}` }));

    const fields = [
        { name: "full_name", label: "Nama lengkap", required: true, max: 80, value: member.full_name || "" },
        { name: "email", label: "Email login", type: "email", required: true, max: 120, value: member.email || "", hint: "Dipakai untuk menyambungkan akun login." },
        { name: "position_title", label: "Nama jabatan", required: true, max: 60, value: member.position_title || "", placeholder: "contoh: Supervisor Bandung" },
        { name: "level", label: "Level akses", type: "select", value: String(member.level || 1), options: levelOptions, hint: "Menentukan seberapa luas data yang bisa dilihat." },
        { name: "job_role", label: "Peran kerja", type: "select", value: member.job_role || "umum", options: Object.entries(JOB_ROLES).map(([value, label]) => ({ value, label })) },
        {
            name: "org_unit_id", label: "Unit", type: "select", value: member.org_unit_id || "",
            options: [{ value: "", label: "— Tanpa unit —" }].concat(units.map((unit) => ({ value: unit.id, label: unit.name }))),
        },
        {
            name: "manager_id", label: "Atasan langsung", type: "select", value: member.manager_id || "",
            options: [{ value: "", label: "— Tidak ada —" }].concat(
                members.filter((entry) => !blocked.has(entry.id) && entry.is_active !== false)
                    .map((entry) => ({ value: entry.id, label: `${entry.full_name} (${entry.position_title})` }))
            ),
        },
        { name: "sales_slug", label: "Alamat toko (khusus sales)", max: 32, value: member.sales_slug || "", placeholder: "otomatis dari nama", hint: "Jadi kantoong.id/alamat-ini. Huruf kecil, angka, minus." },
        {
            name: "modules", label: "Batasi modul (kosong = sesuai jabatan)", type: "checkboxes",
            value: Array.isArray(member.modules) ? member.modules : [],
            options: MODULES.filter((module) => module.key !== "workspace").map((module) => ({ value: module.key, label: module.label })),
        },
        { name: "is_active", label: "Status", type: "select", value: member.is_active === false ? "0" : "1", options: [{ value: "1", label: "Aktif" }, { value: "0", label: "Nonaktif (tidak bisa login ERP)" }] },
    ];

    if (salaryEditable) {
        fields.push({ name: "base_salary", label: "Gaji pokok (Rp) — rahasia", type: "number", min: 0, step: 1000, value: salary?.base_salary ?? 0, hint: "Hanya orangnya sendiri, HR, dan owner yang bisa melihat." });
    }

    const values = await formDialog({ title: isNew ? "Tambah anggota" : `Ubah — ${member.full_name}`, fields });
    if (!values) return;

    let slug = values.sales_slug.trim().toLowerCase();
    if (values.job_role === "sales" && !slug) slug = slugify(values.full_name);
    if (values.job_role !== "sales" && !slug) slug = null;

    if (slug && !isValidSlug(slug)) {
        toast("Alamat toko tidak valid atau memakai kata yang dicadangkan.", "error");
        return;
    }

    if (!isNew && !isValidManager(members, member.id, values.manager_id || null)) {
        toast("Atasan tidak boleh dirinya sendiri atau bawahannya.", "error");
        return;
    }

    try {
        await data.saveMember({
            ...(isNew ? {} : { id: member.id }),
            full_name: values.full_name.trim(),
            email: values.email.trim().toLowerCase(),
            position_title: values.position_title.trim() || "Staf",
            level: Number(values.level) || 1,
            job_role: values.job_role,
            org_unit_id: values.org_unit_id || null,
            manager_id: values.manager_id || null,
            sales_slug: slug || null,
            modules: values.modules.length ? values.modules : null,
            is_active: values.is_active === "1",
        });

        if (salaryEditable && String(values.base_salary) !== String(salary?.base_salary ?? 0)) {
            await data.saveSalary(member.id, values.base_salary);
        }

        toast(isNew ? "Anggota ditambahkan." : "Data anggota disimpan.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}
