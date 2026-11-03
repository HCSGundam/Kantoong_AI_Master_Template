/**
 * KANTOONG ERP — SUMBER DATA MODE DEMO
 * File: frontend/erp/data/demo-adapter.js
 *
 * Meniru database sungguhan (termasuk aturan hak akses RLS) memakai
 * data contoh yang tersimpan di perangkat ini. Perubahan di mode demo
 * tidak pernah dikirim ke server.
 */

import { DEMO_VERSION, buildDemoSeed } from "./demo-seed.js";
import {
    canEditSalary,
    canManage,
    canView,
    canViewSalary,
    isOrgAdmin,
    isValidManager,
    isValidSlug,
    unitPath,
} from "../core/org.js";
import { leaderboard, periodStart } from "../core/metrics.js";
import { phase2Methods } from "./demo-adapter-phase2.js";

const STORE_KEY = "kantoong_erp_demo_v1";
const listeners = new Set();

function denied() {
    const error = new Error("Akses ditolak: jabatanmu tidak boleh melakukan ini.");
    error.code = "42501";
    return error;
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

export function createDemoAdapter({ meId, realProducts = [] }) {
    let db;

    try {
        db = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    } catch {
        db = null;
    }

    if (!db || db.version !== DEMO_VERSION) {
        db = buildDemoSeed(realProducts);
    }

    const save = () => {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(db));
        } catch {
            // Penyimpanan penuh/diblokir: perubahan berlaku selama halaman terbuka.
        }
    };

    save();

    const me = () => db.members.find((member) => member.id === meId && member.is_active);
    const id = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

    const audit = (table_name, record_id, action, changes) => {
        db.audit.unshift({
            id: (db.audit[0]?.id || 0) + 1,
            actor_id: meId,
            table_name,
            record_id,
            action,
            changes,
            at: new Date().toISOString(),
        });
        db.audit = db.audit.slice(0, 300);
    };

    const withUnitName = (member) => ({
        ...member,
        unit_name: unitPath(db.units, member.org_unit_id) || "",
    });

    const notify = () => listeners.forEach((callback) => callback());

    // Fase 2: gudang, kasir, keuangan, absensi, payroll.
    const phase2 = phase2Methods({ db: () => db, save, me, audit });

    return {
        mode: "demo",
        ...phase2,

        async getSession() {
            const member = me();
            return member ? { status: "member", member: withUnitName(member) } : { status: "no-member" };
        },

        async signOut() {},

        /* ---------- Organisasi ---------- */

        async listUnits() {
            return clone(db.units);
        },

        async saveUnit(unit) {
            if (!isOrgAdmin(me())) throw denied();

            if (unit.id) {
                const index = db.units.findIndex((entry) => entry.id === unit.id);
                if (index < 0) throw new Error("Unit tidak ditemukan.");
                db.units[index] = { ...db.units[index], ...unit };
                audit("org_units", unit.id, "UPDATE", unit);
            } else {
                const created = { sort: 0, ...unit, id: id("u") };
                db.units.push(created);
                audit("org_units", created.id, "INSERT", created);
            }

            save();
        },

        async deleteUnit(unitId) {
            if (!isOrgAdmin(me())) throw denied();
            const remove = new Set([unitId]);
            let grew = true;
            while (grew) {
                grew = false;
                db.units.forEach((unit) => {
                    if (unit.parent_id && remove.has(unit.parent_id) && !remove.has(unit.id)) {
                        remove.add(unit.id);
                        grew = true;
                    }
                });
            }
            db.units = db.units.filter((unit) => !remove.has(unit.id));
            db.members.forEach((member) => {
                if (remove.has(member.org_unit_id)) member.org_unit_id = null;
            });
            audit("org_units", unitId, "DELETE", null);
            save();
        },

        async listMembers() {
            return db.members.map(withUnitName);
        },

        async saveMember(member) {
            const viewer = me();
            if (!isOrgAdmin(viewer)) throw denied();

            if (member.sales_slug && !isValidSlug(member.sales_slug)) {
                throw new Error("Alamat toko hanya boleh huruf kecil, angka, dan tanda minus (3–32 karakter).");
            }

            const clash = db.members.find((entry) =>
                entry.id !== member.id &&
                ((member.email && entry.email.toLowerCase() === member.email.toLowerCase()) ||
                    (member.sales_slug && entry.sales_slug === member.sales_slug))
            );
            if (clash) throw new Error("Email atau alamat toko sudah dipakai anggota lain.");

            if (member.id) {
                if (!isValidManager(db.members, member.id, member.manager_id)) {
                    throw new Error("Atasan tidak boleh dirinya sendiri atau bawahannya.");
                }
                // Hanya owner yang boleh mengangkat orang ke level owner.
                if (member.level >= 5 && viewer.level < 5) throw denied();

                const index = db.members.findIndex((entry) => entry.id === member.id);
                db.members[index] = { ...db.members[index], ...member };
                audit("members", member.id, "UPDATE", member);
            } else {
                if (member.level >= 5 && viewer.level < 5) throw denied();
                const created = {
                    user_id: null, modules: null, is_active: true, ...member, id: id("m"),
                };
                db.members.push(created);
                audit("members", created.id, "INSERT", created);
                member = created;
            }

            // Sales otomatis punya toko.
            const saved = db.members.find((entry) => entry.id === member.id);
            if (saved.job_role === "sales" && saved.sales_slug &&
                !db.storefronts.some((store) => store.member_id === saved.id)) {
                db.storefronts.push({
                    member_id: saved.id,
                    slug: saved.sales_slug,
                    display_name: `Toko ${saved.full_name.split(" ")[0]}`,
                    tagline: "",
                    hero_image_url: "",
                    theme: {},
                    is_published: true,
                });
            }

            save();
            return clone(saved);
        },

        /* ---------- Target, komisi, gaji ---------- */

        async getTargets() {
            const viewer = me();
            return clone(db.targets.filter((target) => canView(viewer, target.member_id, db.members)));
        },

        async saveTarget(memberId, values) {
            if (!canManage(me(), memberId, db.members)) throw denied();

            const index = db.targets.findIndex((target) => target.member_id === memberId);
            const next = {
                member_id: memberId,
                commission_rate: 0,
                monthly_target: 0,
                daily_target: 0,
                ...(index >= 0 ? db.targets[index] : {}),
                ...values,
            };

            if (index >= 0) db.targets[index] = next;
            else db.targets.push(next);

            audit("member_targets", memberId, index >= 0 ? "UPDATE" : "INSERT", values);
            save();
        },

        async getSalary(memberId) {
            if (!canViewSalary(me(), memberId)) return null;
            return clone(db.salaries.find((salary) => salary.member_id === memberId) || null);
        },

        async saveSalary(memberId, baseSalary) {
            if (!canEditSalary(me())) throw denied();
            const index = db.salaries.findIndex((salary) => salary.member_id === memberId);
            const next = { member_id: memberId, base_salary: Math.max(0, Number(baseSalary) || 0) };
            if (index >= 0) db.salaries[index] = next;
            else db.salaries.push(next);
            audit("member_salary", memberId, "UPDATE", { base_salary: "(disembunyikan)" });
            save();
        },

        /* ---------- Pesanan & peringkat ---------- */

        async listOrders({ since } = {}) {
            const viewer = me();
            const sinceMs = since ? new Date(since).getTime() : -Infinity;

            return clone(
                db.orders.filter((order) => {
                    if (new Date(order.created_at).getTime() < sinceMs) return false;
                    if (viewer.level >= 4) return true;
                    return Boolean(order.sales_member_id) && canView(viewer, order.sales_member_id, db.members);
                })
            );
        },

        async leaderboard(period) {
            return leaderboard({
                members: db.members.map(withUnitName),
                orders: db.orders.filter((order) => new Date(order.created_at) >= periodStart(period)),
                period,
                viewer: me(),
            });
        },

        subscribeOrders(callback) {
            listeners.add(callback);
            return () => listeners.delete(callback);
        },

        /** Khusus demo: tambah satu pesanan dibayar agar papan peringkat terlihat bergerak. */
        async simulateOrder(memberId) {
            const product = db.products[Math.floor(Math.random() * db.products.length)];
            const qty = 1 + Math.floor(Math.random() * 5);
            const serial = db.orders.length + 1;
            const order = {
                id: `o-${serial}-${Date.now()}`,
                order_code: `DEMO-${String(serial).padStart(5, "0")}`,
                status: "dibayar",
                total: product.price * qty + 15000,
                created_at: new Date().toISOString(),
                sales_member_id: memberId,
                storefront_slug: db.members.find((member) => member.id === memberId)?.sales_slug,
                customer_name: "Pembeli Baru",
                city: "Bandung",
                items: [{ product_id: product.id, product_name: product.name, qty, unit_price: product.price }],
            };
            db.orders.push(order);
            phase2.journalForOrder(order);
            save();
            notify();
        },

        /* ---------- Persetujuan & audit ---------- */

        async listApprovals() {
            const viewer = me();
            return clone(
                db.approvals
                    .filter((item) =>
                        item.requester_id === viewer.id ||
                        item.approver_id === viewer.id ||
                        viewer.level >= 5
                    )
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
            );
        },

        async createApproval(values) {
            const viewer = me();
            const owner = db.members.find((member) => member.level === 5 && member.id !== viewer.id);
            const created = {
                id: id("a"),
                status: "menunggu",
                decision_note: null,
                decided_at: null,
                created_at: new Date().toISOString(),
                ...values,
                requester_id: viewer.id,
                approver_id: viewer.manager_id || owner?.id || null,
            };
            db.approvals.push(created);
            audit("approvals", created.id, "INSERT", { title: created.title });
            save();
        },

        async decideApproval(approvalId, status, note) {
            const viewer = me();
            const item = db.approvals.find((entry) => entry.id === approvalId);
            if (!item) throw new Error("Pengajuan tidak ditemukan.");
            if (item.approver_id !== viewer.id && viewer.level < 5) throw denied();

            item.status = status;
            item.decision_note = note || null;
            item.decided_at = new Date().toISOString();
            audit("approvals", approvalId, "UPDATE", { status: { dari: "menunggu", jadi: status } });
            save();
        },

        async listAudit() {
            if (me().level < 4) return [];
            return clone(db.audit);
        },

        /* ---------- Katalog master ---------- */

        async listProducts() {
            return clone(db.products);
        },

        async saveProduct(existing, input) {
            const viewer = me();
            if (viewer.level < 4 && viewer.job_role !== "produk") throw denied();
            const values = {
                name: String(input.name || "").trim(),
                category: String(input.category || "").trim() || "Umum",
                price: Math.max(0, Number(input.price) || 0),
                compare_at_price: Number(input.compare_at_price) > 0 ? Number(input.compare_at_price) : null,
                ship_estimate: input.ship_estimate || null,
                ship_from: input.ship_from || null,
                description: input.description || "",
                image_url: input.image_url || "",
                video_url: input.video_url || null,
                gallery: (input.gallery || []).filter((item) => item.url).map(({ url, label }) => ({ url, label })),
                is_featured: input.is_featured === true,
                is_hero: input.is_hero === true,
                hero_image_url: input.hero_image_url || null,
                hero_caption: input.hero_caption || "",
                hero_text: input.hero_text || "",
            };

            if (existing?.id) {
                const product = db.products.find((entry) => entry.id === existing.id);
                Object.assign(product, values);
                audit("products", existing.id, "UPDATE", { name: values.name });
                save();
                return clone(product);
            }

            const created = { id: id("p"), sku: null, barcode: null, stock: 0, ...values };
            db.products.push(created);
            audit("products", created.id, "INSERT", { name: values.name });
            save();
            return clone(created);
        },

        async deleteProduct(productId) {
            if (me().level < 4) throw denied();
            db.products = db.products.filter((product) => product.id !== productId);
            audit("products", productId, "DELETE", null);
            save();
        },

        async setPublication(productId, changes) {
            const viewer = me();
            if (viewer.level < 4 && viewer.job_role !== "produk") throw denied();
            Object.assign(db.products.find((product) => product.id === productId), changes);
            save();
        },

        async uploadImage() {
            throw new Error("Mode demo tidak mengunggah foto. Tempel URL foto, atau coba di mode asli.");
        },

        async saveProductCodes(productId, values) {
            const viewer = me();
            if (viewer.level < 4 && viewer.job_role !== "produk") throw denied();

            const clash = db.products.find((product) =>
                product.id !== productId &&
                ((values.sku && product.sku === values.sku) || (values.barcode && product.barcode === values.barcode))
            );
            if (clash) throw new Error(`Kode sudah dipakai produk "${clash.name}".`);

            const product = db.products.find((entry) => entry.id === productId);
            Object.assign(product, values);
            audit("products", productId, "UPDATE", values);
            save();
        },

        /* ---------- Toko per sales ---------- */

        async getStorefront(memberId) {
            return clone(db.storefronts.find((store) => store.member_id === memberId) || null);
        },

        async saveStorefront(memberId, values) {
            const viewer = me();
            if (memberId !== viewer.id && viewer.level < 4) throw denied();
            const index = db.storefronts.findIndex((store) => store.member_id === memberId);
            if (index < 0) throw new Error("Toko belum dibuat. Minta HR/owner mengisi alamat toko.");
            db.storefronts[index] = { ...db.storefronts[index], ...values };
            audit("storefronts", memberId, "UPDATE", values);
            save();
        },

        async listStoreProducts(memberId) {
            return clone(db.storefront_products.filter((item) => item.member_id === memberId));
        },

        async saveStoreProducts(memberId, items) {
            const viewer = me();
            if (memberId !== viewer.id && viewer.level < 4) throw denied();
            db.storefront_products = db.storefront_products
                .filter((item) => item.member_id !== memberId)
                .concat(items.map((item, index) => ({ ...item, member_id: memberId, sort: index })));
            save();
        },
    };
}

export function resetDemoData() {
    try {
        localStorage.removeItem(STORE_KEY);
    } catch {
        // abaikan
    }
}
