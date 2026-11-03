/**
 * KANTOONG ERP — ATURAN ORGANISASI & HAK LIHAT
 * File: frontend/erp/core/org.js
 *
 * Fungsi murni (tanpa database) yang mencerminkan aturan RLS di
 * db/erp-foundation.sql. Dipakai tampilan dan mode demo.
 * Keamanan sesungguhnya tetap ada di database.
 */

export const LEVELS = Object.freeze({
    5: "Owner",
    4: "Direktur",
    3: "Manager",
    2: "Supervisor",
    1: "Staf",
});

export const JOB_ROLES = Object.freeze({
    umum: "Umum",
    sales: "Sales",
    produk: "Produk & Katalog",
    gudang: "Gudang",
    keuangan: "Keuangan",
    hr: "HR",
    marketing: "Marketing",
    cs: "Customer Service",
    kasir: "Kasir",
});

/** Boleh mengerjakan bagian ini? (direktur/owner selalu boleh) */
export function hasRole(viewer, ...roles) {
    return Boolean(viewer) && (viewer.level >= 4 || roles.includes(viewer.job_role));
}

/** Pembuat/penyetuju payroll: HR & owner saja. */
export function isPayrollAdmin(viewer) {
    return Boolean(viewer) && (viewer.level >= 5 || viewer.job_role === "hr");
}

export const UNIT_KINDS = Object.freeze({
    perusahaan: "Perusahaan",
    divisi: "Divisi",
    departemen: "Departemen",
    tim: "Tim",
    unit: "Unit",
});

const idOf = (value) => (value && typeof value === "object" ? value.id : value);

/** Semua bawahan (langsung & tidak langsung) dari rootId. */
export function subtreeIds(members, rootId) {
    const result = new Set();
    if (!rootId) return result;

    const byManager = new Map();
    for (const member of members) {
        if (!member.manager_id) continue;
        if (!byManager.has(member.manager_id)) byManager.set(member.manager_id, []);
        byManager.get(member.manager_id).push(member.id);
    }

    const queue = [...(byManager.get(rootId) || [])];
    while (queue.length) {
        const id = queue.shift();
        if (result.has(id) || id === rootId) continue;
        result.add(id);
        queue.push(...(byManager.get(id) || []));
    }

    return result;
}

/** Boleh melihat data kerja (omzet, target, komisi)? */
export function canView(viewer, target, members) {
    if (!viewer) return false;
    const targetId = idOf(target);
    if (viewer.level >= 4 || targetId === viewer.id) return true;
    return subtreeIds(members, viewer.id).has(targetId);
}

/** Boleh mengatur target & komisi? (atasan, bukan diri sendiri) */
export function canManage(viewer, target, members) {
    if (!viewer) return false;
    const targetId = idOf(target);
    if (viewer.level >= 4) return true;
    return subtreeIds(members, viewer.id).has(targetId);
}

/** Boleh melihat gaji? (diri sendiri, HR, owner) */
export function canViewSalary(viewer, target) {
    if (!viewer) return false;
    return viewer.level >= 5 || viewer.job_role === "hr" || idOf(target) === viewer.id;
}

export function canEditSalary(viewer) {
    return Boolean(viewer) && (viewer.level >= 5 || viewer.job_role === "hr");
}

/** Boleh mengelola struktur organisasi & anggota? */
export function isOrgAdmin(viewer) {
    return Boolean(viewer) && (viewer.level >= 4 || viewer.job_role === "hr");
}

export function levelName(level) {
    return LEVELS[level] || LEVELS[1];
}

/** Pohon unit: [{...unit, children: [...]}] urut sesuai sort lalu nama. */
export function buildUnitTree(units) {
    const nodes = new Map(units.map((unit) => [unit.id, { ...unit, children: [] }]));
    const roots = [];

    for (const node of nodes.values()) {
        const parent = node.parent_id && nodes.get(node.parent_id);
        (parent ? parent.children : roots).push(node);
    }

    const sortTree = (list) => {
        list.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name, "id"));
        list.forEach((node) => sortTree(node.children));
        return list;
    };

    return sortTree(roots);
}

/** "Divisi Sales › Tim Bandung" */
export function unitPath(units, unitId) {
    const byId = new Map(units.map((unit) => [unit.id, unit]));
    const names = [];
    let current = byId.get(unitId);
    const guard = new Set();

    while (current && !guard.has(current.id)) {
        guard.add(current.id);
        if (current.kind !== "perusahaan") names.unshift(current.name);
        current = byId.get(current.parent_id);
    }

    return names.join(" › ");
}

/** Semua unit di bawah unitId (termasuk dirinya). */
export function unitSubtreeIds(units, unitId) {
    const result = new Set([unitId]);
    let added = true;

    while (added) {
        added = false;
        for (const unit of units) {
            if (unit.parent_id && result.has(unit.parent_id) && !result.has(unit.id)) {
                result.add(unit.id);
                added = true;
            }
        }
    }

    return result;
}

/** Rantai atasan dari bawah ke atas (tanpa dirinya). */
export function managerChain(members, memberId) {
    const byId = new Map(members.map((member) => [member.id, member]));
    const chain = [];
    const guard = new Set([memberId]);
    let current = byId.get(byId.get(memberId)?.manager_id);

    while (current && !guard.has(current.id)) {
        guard.add(current.id);
        chain.push(current);
        current = byId.get(current.manager_id);
    }

    return chain;
}

/** Atasan tidak boleh diset ke dirinya sendiri atau bawahannya (mencegah lingkaran). */
export function isValidManager(members, memberId, managerId) {
    if (!managerId) return true;
    if (managerId === memberId) return false;
    return !subtreeIds(members, memberId).has(managerId);
}

/** "Budi Santoso" -> "budi-santoso" (aturan sama dengan kolom sales_slug). */
export function slugify(text) {
    const slug = String(text ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 32)
        .replace(/-+$/g, "");

    return slug.length >= 3 ? slug : "";
}

export const RESERVED_SLUGS = Object.freeze([
    "erp", "auth", "cart", "css", "js", "db", "api", "dashboard-admin",
    "dashboard-user", "assets", "index", "admin", "login", "produk",
]);

export function isValidSlug(slug) {
    return /^[a-z0-9]([a-z0-9-]{1,30})[a-z0-9]$/.test(String(slug ?? "")) && !RESERVED_SLUGS.includes(slug);
}
