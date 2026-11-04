/**
 * KANTOONG ERP — SUMBER DATA DEMO KASIR POS PRO (Tahap 1)
 * File: frontend/erp/data/demo-adapter-pos.js
 *
 * Aturan akses SAMA dengan db/erp-pos-pro.sql:
 *   - jualan & bill terbuka: kasir (atau level 4+)
 *   - pengaturan pajak/service/struk: level 4+ (owner & manajer)
 *   - varian & tambahan: staf katalog/produk (atau level 4+)
 *   - layar dapur (Tahap 2): kasir & dapur/bar
 *   - penjualan hilang: kasir mencatat; owner/manajer/keuangan melihat semua
 *   - Tahap 3 kontrol uang: jualan wajib shift aktif; void & diskon besar wajib
 *     PIN atasan (level 3+, bukan dirinya sendiri kecuali owner/manajer);
 *     owner/keuangan melihat semua shift
 *   - Tahap 4 member & promo: kasir mencari/mendaftarkan member (wajib izin simpan
 *     riwayat); kelola promo: owner/manajer/marketing; nomor HP lengkap hanya untuk
 *     member yang mengizinkan promo. Member bisa minta datanya dihapus.
 *   - Tahap 5 resep & HPP: bahan baku per outlet; menu ber-resep TIDAK memakai stok barang jadi
 *     (dibuat saat dipesan) -> bahan dipotong sesuai resep + varian, HPP tercatat di struk & jurnal.
 *     Kelola bahan/resep: staf produk/gudang (atau level 4+). Catat bahan dibuang: semua staf outlet.
 *   - Tahap 6: rating pelanggan 1 ketukan dari layar pelanggan (kasir menyimpan, owner/keuangan membaca);
 *     transaksi offline disinkron dengan jam aslinya (maks 48 jam lalu) untuk harga promo & laporan.
 * Harga dihitung ulang di sini dari katalog (bukan dari layar).
 */

import { hasRole } from "../core/org.js";
import { applyMoves, planMoves } from "../core/inventory.js";
import { DEFAULT_ACCOUNTS } from "../core/accounting.js";
import { receiptNumber } from "../core/pos.js";
import { LOST_REASONS, priceOrder, posSettings, saleJournalLines, settlePayments } from "../core/pos-pro.js";
import { TICKET_STATUS, queueCode, splitTickets } from "../core/kitchen.js";
import { CASH_MOVES, VOID_REASONS, cashOf, needsDiscountApproval, shiftSummary } from "../core/cash-control.js";
import { buildCashSeed, demoPinHash } from "./demo-seed-cash.js";
import { buildPosSeed } from "./demo-seed-pos.js";
import { buildKitchenSeed, ensurePosMembers } from "./demo-seed-kitchen.js";
import { buildLoyaltySeed } from "./demo-seed-loyalty.js";
import { buildRecipeSeed } from "./demo-seed-recipe.js";
import { WASTE_REASONS, cleanRecipeItems, hasRecipe, orderUsage, usageCost, weightedCost } from "../core/recipe.js";
import { cleanPromo, validatePromo } from "../core/promo.js";
import { displayPhone, maskedPhone, memberProfile, normalizePhone, pointsBalance } from "../core/loyalty.js";

function denied(message = "Akses ditolak: jabatanmu tidak boleh melakukan ini.") {
    const error = new Error(message);
    error.code = "42501";
    return error;
}

const clone = (value) => JSON.parse(JSON.stringify(value));

/** Rating contoh: ±45% struk 14 hari dinilai; sebagian besar 😀, sedikit 😐/☹️ (lebih banyak di jam tersibuk). */
function buildRatingSeed(db) {
    const since = Date.now() - 14 * 86400000;
    const rows = [];
    for (const sale of db.pos_sales || []) {
        const ms = new Date(sale.created_at).getTime();
        if (ms < since || sale.status === "batal") continue;
        const seed = [...String(sale.id)].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
        if (seed % 100 >= 45) continue;
        const hour = new Date(ms + 7 * 3600000).getUTCHours();
        const busy = hour >= 14 && hour < 16;
        const roll = (Math.imul(seed ^ (seed >>> 15), 2654435761) >>> 0) % 100;
        const score = roll < (busy ? 12 : 4) ? 1 : roll < (busy ? 30 : 15) ? 2 : 3;
        rows.push({ id: `r-${rows.length + 1}`, sale_id: sale.id, outlet_id: sale.outlet_id, cashier_id: sale.cashier_id, score, created_at: new Date(ms + 60000).toISOString() });
    }
    return rows;
}
const nextId = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function posProMethods({ db: getDb, save, me, audit, journalWrite, recordMoves }) {
    /** Data demo lama belum punya data POS Pro: pasang sekali. */
    const ready = () => {
        const db = getDb();
        if (!db.pos_modifiers) {
            Object.assign(db, buildPosSeed(db));
            save();
        }
        if (!db.pos_tickets) {
            ensurePosMembers(db);
            Object.assign(db, buildKitchenSeed(db));
            save();
        }
        if (!db.pos_shifts) {
            Object.assign(db, buildCashSeed(db));
            save();
        }
        if (!db.pos_members) {
            const { extra_sales: extra, ...loyalty } = buildLoyaltySeed(db);
            Object.assign(db, loyalty);
            (db.pos_sales ||= []).push(...extra);
            save();
        }
        if (!db.pos_ingredients) {
            Object.assign(db, buildRecipeSeed(db));
            save();
        }
        if (!db.pos_restock) {
            db.pos_restock = [];
            save();
        }
        if (!db.pos_ratings) {
            db.pos_ratings = buildRatingSeed(db);
            save();
        }
        for (const account of DEFAULT_ACCOUNTS) {
            if (!db.accounts?.some((entry) => entry.code === account.code)) db.accounts?.push({ ...account, is_active: true });
        }
        return db;
    };

    const isManager = (member) => Boolean(member) && member.level >= 4;
    const kitchenRole = (member) => hasRole(member, "kasir", "dapur");
    const dayWib = (date = new Date()) => new Date(new Date(date).getTime() + 7 * 3600000).toISOString().slice(0, 10);
    const openShiftOf = (db, memberId, outletId = null) =>
        db.pos_shifts.find((shift) => shift.cashier_id === memberId && shift.status === "open" && (!outletId || shift.outlet_id === outletId));

    /** PIN atasan: level 3+ aktif. Tidak boleh menyetujui dirinya sendiri, kecuali owner/manajer. */
    const approverByPin = (db, pin, actor) => {
        const clean = String(pin || "").trim();
        if (!/^\d{4,6}$/.test(clean)) return null;
        const hit = db.pos_pins.find((row) => row.pin_hash === demoPinHash(row.member_id, clean));
        const member = hit && db.members.find((entry) => entry.id === hit.member_id && entry.is_active && entry.level >= 3);
        if (!member || (member.id === actor.id && actor.level < 4)) return null;
        return member;
    };
    /** Data member yang aman ditampilkan: nomor tersamar; lengkap hanya untuk kontak ber-izin. */
    const publicMember = (db, member, { contact = false } = {}) => ({
        id: member.id,
        name: member.name,
        phone_masked: maskedPhone(member.phone),
        phone: contact && member.consent_promo ? displayPhone(member.phone) : null,
        consent_history: member.consent_history,
        consent_promo: member.consent_promo,
        joined_at: member.joined_at,
        points: pointsBalance(db.pos_points, member.id),
    });
    /* ---------- Tahap 5: bahan baku ---------- */
    const canManageStock = (member) => hasRole(member, "produk", "gudang");
    const seesCost = (member) => Boolean(member) && (member.level >= 3 || hasRole(member, "produk", "gudang", "keuangan"));
    const stockAt = (db, outletId) => (db.pos_ingredient_stock[outletId] ||= {});
    /** Catat gerak bahan + ubah stok. delta + = masuk, − = keluar. */
    const ingredientWrite = (db, { outlet_id, ingredient_id, kind, delta, reason = "", ref = "", unit_cost = null }) => {
        const stock = stockAt(db, outlet_id);
        stock[ingredient_id] = Math.round(((Number(stock[ingredient_id]) || 0) + delta) * 100) / 100;
        const ingredient = db.pos_ingredients.find((entry) => entry.id === ingredient_id);
        db.pos_ingredient_moves.push({
            id: nextId("im"), outlet_id, ingredient_id, kind, delta: Math.round(delta * 100) / 100,
            unit_cost: unit_cost ?? ingredient?.cost ?? 0, reason, ref, created_by: me()?.id || null, created_at: new Date().toISOString(),
        });
        db.pos_ingredient_moves = db.pos_ingredient_moves.slice(-4000);
    };
    /** Pemakaian bahan sebuah penjualan: dicatat sebagai satu baris per bahan. */
    const consume = (db, outletId, usage, ref, sign = -1, kind = "pakai") => {
        for (const [ingredient_id, qty] of usage) {
            if (qty > 0) ingredientWrite(db, { outlet_id: outletId, ingredient_id, kind, delta: sign * qty, ref });
        }
    };

    const outletOk = (db, outletId) => db.warehouses.some((entry) => entry.id === outletId && entry.kind === "outlet" && entry.is_active !== false);

    return {
        /* ---------- Pengaturan kasir per outlet ---------- */

        async getPosSettings(outletId) {
            return posSettings(ready().pos_settings[outletId]);
        },

        async savePosSettings(outletId, values) {
            if (!isManager(me())) throw denied("Akses ditolak: hanya owner/manajer yang boleh mengubah pajak & service.");
            const db = ready();
            if (!outletOk(db, outletId)) throw new Error("Outlet tidak ditemukan.");
            db.pos_settings[outletId] = posSettings(values);
            audit("pos_settings", outletId, "UPDATE", db.pos_settings[outletId]);
            save();
            return clone(db.pos_settings[outletId]);
        },

        /* ---------- Varian & tambahan ---------- */

        async listPosModifiers() {
            return clone(ready().pos_modifiers);
        },

        async savePosModifier(group) {
            if (!hasRole(me(), "produk")) throw denied();
            const db = ready();
            const clean = {
                name: String(group.name || "").trim().slice(0, 40),
                required: Boolean(group.required),
                max_select: Math.min(Math.max(Math.floor(Number(group.max_select) || 1), 1), 10),
                applies_all: Boolean(group.applies_all),
                product_ids: (group.product_ids || []).map(String),
                categories: (group.categories || []).map(String),
                options: group.options || [],
                sort: Number(group.sort) || 0,
                is_active: group.is_active !== false,
            };
            if (!clean.name) throw new Error("Nama grup wajib diisi.");
            if (!clean.options.length) throw new Error("Isi minimal satu pilihan.");
            if (group.id) {
                Object.assign(db.pos_modifiers.find((entry) => entry.id === group.id), clean);
                audit("pos_modifier_groups", group.id, "UPDATE", clean);
            } else {
                const created = { id: nextId("g"), ...clean, sort: clean.sort || db.pos_modifiers.length + 1 };
                db.pos_modifiers.push(created);
                audit("pos_modifier_groups", created.id, "INSERT", created);
            }
            save();
        },

        async deletePosModifier(groupId) {
            if (!hasRole(me(), "produk")) throw denied();
            const db = ready();
            db.pos_modifiers = db.pos_modifiers.filter((entry) => entry.id !== groupId);
            audit("pos_modifier_groups", groupId, "DELETE", {});
            save();
        },

        /* ---------- Bill terbuka (pesan dulu, bayar nanti) ---------- */

        async listOpenBills(outletId) {
            if (!hasRole(me(), "kasir", "keuangan")) return [];
            return clone(ready().pos_bills.filter((bill) => bill.outlet_id === outletId));
        },

        /* ---------- Nomor antrian harian ---------- */

        async nextQueueNo(outletId) {
            if (!hasRole(me(), "kasir")) throw denied();
            const db = ready();
            const today = dayWib();
            const counter = db.pos_queue[outletId];
            const n = counter?.day === today ? counter.n + 1 : 1;
            db.pos_queue[outletId] = { day: today, n };
            save();
            return queueCode(n);
        },

        /* ---------- Dapur & Bar (Tahap 2) ---------- */

        /** tickets = [{ station, items }] dari splitTickets (kasir); atau items mentah (dipecah di sini). */
        async sendToKitchen({ outlet_id: outletId, queue_no, label, channel, ref = null, items = [], tickets = null }) {
            if (!hasRole(me(), "kasir")) throw denied();
            const db = ready();
            if (!outletOk(db, outletId)) throw new Error("Outlet tidak ditemukan.");
            const created = (tickets || splitTickets(items, db.products)).map((part) => ({
                id: nextId("t"), outlet_id: outletId, queue_no, label: String(label || "").slice(0, 40), channel, ref, created_by: me().id,
                ...part, status: "baru", created_at: new Date().toISOString(), started_at: null, ready_at: null, picked_at: null,
            }));
            db.pos_tickets.push(...created);
            db.pos_tickets = db.pos_tickets.slice(-600);
            save();
            return clone(created);
        },

        async listKitchenTickets({ outletId, days = 7 } = {}) {
            // Keuangan ikut membaca untuk Rekonsiliasi Dapur ↔ Kasir.
            if (!kitchenRole(me()) && !hasRole(me(), "keuangan")) return [];
            const since = Date.now() - days * 86400000;
            return clone(ready().pos_tickets.filter((ticket) => ticket.outlet_id === outletId && new Date(ticket.created_at).getTime() >= since));
        },

        async setTicketStatus(ticketId, status) {
            if (!kitchenRole(me())) throw denied();
            if (!TICKET_STATUS[status]) throw new Error("Status tidak valid.");
            const db = ready();
            const ticket = db.pos_tickets.find((entry) => entry.id === ticketId);
            if (!ticket) throw new Error("Tiket tidak ditemukan.");
            const at = new Date().toISOString();
            ticket.status = status;
            if (status === "dibuat") ticket.started_at ||= at;
            if (status === "siap") ticket.ready_at = at;
            if (status === "diambil") ticket.picked_at = at;
            if (status === "baru") Object.assign(ticket, { started_at: null, ready_at: null, picked_at: null });
            save();
            return clone(ticket);
        },

        /** Minat chat AI per produk (anonim, hanya hitungan) — sinyal Dapur Prediktif. */
        async kitchenInterest({ hours = 2 } = {}) {
            if (!kitchenRole(me())) return [];
            const since = Date.now() - hours * 3600000;
            const counts = {};
            for (const event of ready().ai_events || []) {
                if (!event.product_name || new Date(event.at).getTime() < since) continue;
                counts[event.product_name] = (counts[event.product_name] || 0) + 1;
            }
            return Object.entries(counts).map(([product_name, count]) => ({ product_name, count }));
        },

        /* ---------- Tahap 3: shift kasir ---------- */

        async getMyShift(outletId) {
            if (!hasRole(me(), "kasir")) return null;
            const shift = openShiftOf(ready(), me().id, outletId);
            return shift ? clone(shift) : null;
        },

        async openShift({ outlet_id: outletId, opening_cash }) {
            const viewer = me();
            if (!hasRole(viewer, "kasir")) throw denied("Akses ditolak: hanya kasir yang membuka shift.");
            const db = ready();
            if (!outletOk(db, outletId)) throw new Error("Outlet tidak ditemukan.");
            if (openShiftOf(db, viewer.id)) throw new Error("Kamu masih punya shift yang belum ditutup.");
            const opening = Math.round(Number(opening_cash));
            if (!(opening >= 0) || opening > 100000000) throw new Error("Isi modal awal laci dengan benar.");
            const shift = {
                id: nextId("sh"), outlet_id: outletId, cashier_id: viewer.id, status: "open", opening_cash: opening,
                opened_at: new Date().toISOString(), closed_at: null, counted_cash: null, expected_cash: null, variance: null, note: "",
            };
            db.pos_shifts.push(shift);
            audit("pos_shifts", shift.id, "INSERT", { opening_cash: opening });
            save();
            return clone(shift);
        },

        async addCashMove({ shift_id, kind, amount, reason }) {
            const viewer = me();
            const db = ready();
            const shift = db.pos_shifts.find((entry) => entry.id === shift_id && entry.status === "open");
            if (!shift || shift.cashier_id !== viewer.id) throw new Error("Shift tidak aktif.");
            if (!CASH_MOVES[kind]) throw new Error("Jenis kas tidak valid.");
            const value = Math.round(Number(amount) || 0);
            if (value <= 0) throw new Error("Isi nominal kas.");
            if (!String(reason || "").trim()) throw new Error("Tulis alasannya (mis. beli es batu).");
            const move = { id: nextId("cm"), shift_id, kind, amount: value, reason: String(reason).trim().slice(0, 80), created_by: viewer.id, created_at: new Date().toISOString() };
            db.pos_cash_moves.push(move);
            save();
            return clone(move);
        },

        async listCashMoves({ shiftIds = [] } = {}) {
            const viewer = me();
            const db = ready();
            const visible = new Set(db.pos_shifts.filter((shift) => hasRole(viewer, "keuangan") || shift.cashier_id === viewer.id).map((shift) => shift.id));
            return clone(db.pos_cash_moves.filter((move) => shiftIds.includes(move.shift_id) && visible.has(move.shift_id)));
        },

        /** Tutup shift BUTA: kasir hanya mengisi hitungan laci; angka "seharusnya" dihitung sistem. */
        async closeShift({ shift_id, counted_cash, note = "" }) {
            const viewer = me();
            const db = ready();
            const shift = db.pos_shifts.find((entry) => entry.id === shift_id && entry.status === "open");
            if (!shift || shift.cashier_id !== viewer.id) throw new Error("Shift tidak aktif.");
            const counted = Math.round(Number(counted_cash));
            if (!(counted >= 0)) throw new Error("Isi jumlah uang di laci.");
            const summary = shiftSummary({ shift, sales: db.pos_sales, moves: db.pos_cash_moves, refunds: db.pos_sales.filter((sale) => sale.refund_shift_id) });
            Object.assign(shift, {
                status: "closed", closed_at: new Date().toISOString(), counted_cash: counted,
                expected_cash: summary.expected, variance: counted - summary.expected, note: String(note || "").slice(0, 200),
            });
            audit("pos_shifts", shift.id, "UPDATE", { counted_cash: counted, variance: shift.variance });
            save();
            return { shift: clone(shift), summary: { ...summary, variance: shift.variance } };
        },

        async listShifts({ outletId, days = 30 } = {}) {
            const viewer = me();
            const since = Date.now() - days * 86400000;
            return clone(ready().pos_shifts.filter((shift) =>
                (!outletId || shift.outlet_id === outletId)
                && new Date(shift.opened_at).getTime() >= since
                && (hasRole(viewer, "keuangan") || shift.cashier_id === viewer.id)));
        },

        /* ---------- Tahap 3: void (batal transaksi) ber-PIN atasan ---------- */

        async voidSale({ sale_id, reason, note = "", pin }) {
            const viewer = me();
            if (!hasRole(viewer, "kasir")) throw denied();
            const db = ready();
            const sale = db.pos_sales.find((entry) => entry.id === sale_id);
            if (!sale || sale.status === "batal") throw new Error("Transaksi tidak ditemukan atau sudah dibatalkan.");
            if (!VOID_REASONS[reason]) throw new Error("Pilih alasan pembatalan.");
            const approver = approverByPin(db, pin, viewer);
            if (!approver) throw new Error("PIN atasan salah (atau atasan tidak boleh menyetujui dirinya sendiri).");

            const refundCash = cashOf(sale);
            const refundShift = refundCash > 0 ? openShiftOf(db, viewer.id) : null;
            if (refundCash > 0 && !refundShift) throw new Error("Buka shift dulu: uang tunai dikembalikan dari laci shift aktif.");

            // Stok kembali ke outlet.
            const back = new Map();
            for (const item of sale.items.filter((entry) => !hasRecipe(entry.product_id, db.pos_recipes))) {
                back.set(String(item.product_id), (back.get(String(item.product_id)) || 0) + item.qty);
            }
            // Bahan kembali sesuai yang dipotong saat jual (dari catatan gerak bahan struk ini).
            const used = new Map();
            for (const row of db.pos_ingredient_moves.filter((entry) => entry.ref === sale.receipt_no && entry.kind === "pakai")) {
                used.set(row.ingredient_id, (used.get(row.ingredient_id) || 0) - row.delta);
            }
            consume(db, sale.outlet_id, used, `${sale.receipt_no}-VOID`, 1, "void");
            if (Number(sale.cogs) > 0) {
                journalWrite(`Void HPP ${sale.receipt_no}`, "pos", `${sale.receipt_no}-HPP-VOID`, [
                    { account_code: "1-1310", debit: Number(sale.cogs), credit: 0 },
                    { account_code: "5-1000", debit: 0, credit: Number(sale.cogs) },
                ], viewer.id);
            }
            const moves = [...back].flatMap(([productId, qty]) => planMoves(db.stock_levels, { kind: "retur", warehouse_id: sale.outlet_id, product_id: productId, qty }));
            recordMoves(moves, `${sale.receipt_no}-VOID`, "Void transaksi kasir");

            // Jurnal balik (debit <-> kredit dari jurnal penjualan).
            const payments = sale.payments?.length ? sale.payments : [{ method: sale.method, amount: sale.total }];
            const lines = saleJournalLines({ total: sale.total, service: sale.service || 0, tax: sale.tax || 0 }, payments)
                .map((line) => ({ account_code: line.account_code, debit: line.credit, credit: line.debit }));
            if (sale.total > 0) journalWrite(`Void kasir ${sale.receipt_no}`, "pos", `${sale.receipt_no}-VOID`, lines, viewer.id);

            // Poin dari transaksi ini dibalik (yang didapat ditarik, yang dipakai dikembalikan).
            for (const row of db.pos_points.filter((entry) => entry.sale_id === sale.id && entry.kind !== "reversal")) {
                db.pos_points.push({ ...row, id: nextId("pt"), delta: -row.delta, kind: "reversal", note: `${sale.receipt_no}-VOID`, created_at: new Date().toISOString() });
            }

            Object.assign(sale, {
                status: "batal", voided_at: new Date().toISOString(), void_reason: reason, void_note: String(note || "").slice(0, 200),
                void_by: viewer.id, void_approved_by: approver.id, refund_cash: refundCash, refund_shift_id: refundShift?.id || null,
            });
            audit("pos_sales", sale.id, "VOID", { receipt_no: sale.receipt_no, reason, approved_by: approver.full_name });
            save();
            return clone(sale);
        },

        /* ---------- PIN persetujuan atasan ---------- */

        async hasMyPin() {
            return ready().pos_pins.some((row) => row.member_id === me().id);
        },

        async setMyPin(pin) {
            const viewer = me();
            if (!viewer || viewer.level < 3) throw denied("Akses ditolak: PIN persetujuan khusus supervisor ke atas.");
            const clean = String(pin || "").trim();
            if (!/^\d{4,6}$/.test(clean)) throw new Error("PIN harus 4–6 angka.");
            if (/^(\d)\1+$/.test(clean) || "0123456789".includes(clean)) throw new Error("PIN terlalu mudah ditebak.");
            const db = ready();
            db.pos_pins = db.pos_pins.filter((row) => row.member_id !== viewer.id);
            db.pos_pins.push({ member_id: viewer.id, pin_hash: demoPinHash(viewer.id, clean), updated_at: new Date().toISOString() });
            audit("pos_pins", viewer.id, "UPDATE", {});
            save();
        },

        /* ---------- Tahap 4: member (izin UU PDP) & poin ---------- */

        /** Cari member dari HP atau nama. Kasir melihat nomor tersamar. */
        async findMembers(query) {
            if (!hasRole(me(), "kasir", "marketing", "cs")) return [];
            const db = ready();
            const text = String(query || "").trim().toLowerCase();
            if (text.length < 3) return [];
            const phone = normalizePhone(text);
            const digits = text.replace(/\D/g, "").replace(/^0/, "");
            return db.pos_members
                .filter((member) => (phone && member.phone === phone)
                    || (digits.length >= 4 && member.phone.includes(digits))
                    || member.name.toLowerCase().includes(text))
                .slice(0, 8)
                .map((member) => publicMember(db, member));
        },

        /** Kartu member di kasir: poin + KASIR YANG INGAT (hanya bila riwayat diizinkan). */
        async getMemberCard(memberId) {
            if (!hasRole(me(), "kasir", "marketing", "cs")) throw denied();
            const db = ready();
            const member = db.pos_members.find((entry) => entry.id === memberId);
            if (!member) throw new Error("Member tidak ditemukan.");
            return {
                member: publicMember(db, member),
                profile: member.consent_history ? memberProfile(member, db.pos_sales) : null,
            };
        },

        async saveMember({ id = null, name, phone, consent_history, consent_promo }) {
            const viewer = me();
            if (!hasRole(viewer, "kasir", "marketing", "cs")) throw denied();
            const db = ready();
            const clean = { name: String(name || "").trim().slice(0, 60), phone: normalizePhone(phone) };
            if (!clean.name) throw new Error("Isi nama member.");
            if (!clean.phone) throw new Error("Nomor HP tidak valid (contoh: 0812xxxxxxx).");
            if (!consent_history) throw new Error("Member wajib setuju riwayat belanja & poin disimpan. Tanpa izin itu, layani sebagai tamu biasa.");
            const twin = db.pos_members.find((entry) => entry.phone === clean.phone && entry.id !== id);
            if (twin) throw new Error(`Nomor ini sudah terdaftar atas nama ${twin.name}.`);
            const consent = { consent_history: true, consent_promo: Boolean(consent_promo) };
            let member = id && db.pos_members.find((entry) => entry.id === id);
            if (member) {
                if (member.consent_promo !== consent.consent_promo) consent.consent_at = new Date().toISOString();
                Object.assign(member, clean, consent);
                audit("pos_members", member.id, "UPDATE", { consent_promo: consent.consent_promo });
            } else {
                member = {
                    id: nextId("mem"), business_id: "demo", ...clean, ...consent, consent_at: new Date().toISOString(),
                    joined_at: new Date().toISOString(), created_by: viewer.id,
                };
                db.pos_members.push(member);
                audit("pos_members", member.id, "INSERT", { consent_promo: consent.consent_promo });
            }
            save();
            return publicMember(db, member);
        },

        /** Hak dihapus (UU PDP): data member & poin dihapus; struk lama tetap ada tanpa identitas. */
        async forgetMember(memberId) {
            if (!hasRole(me(), "kasir", "cs")) throw denied();
            const db = ready();
            const member = db.pos_members.find((entry) => entry.id === memberId);
            if (!member) return;
            db.pos_members = db.pos_members.filter((entry) => entry.id !== memberId);
            db.pos_points = db.pos_points.filter((row) => row.member_id !== memberId);
            for (const sale of db.pos_sales) {
                if (sale.member_id !== memberId) continue;
                sale.member_id = null;
                if (sale.customer_name === member.name) sale.customer_name = "";
            }
            for (const bill of db.pos_bills) if (bill.member_id === memberId) bill.member_id = null;
            audit("pos_members", memberId, "DELETE", { alasan: "permintaan member (UU PDP)" });
            save();
        },

        /** Daftar member untuk owner/marketing. Nomor lengkap hanya bila member mengizinkan promo. */
        async listPosMembers() {
            const viewer = me();
            if (!(viewer.level >= 3 || hasRole(viewer, "marketing", "keuangan", "cs"))) return [];
            const db = ready();
            return db.pos_members.map((member) => publicMember(db, member, { contact: true }));
        },

        async listPointsLedger() {
            const viewer = me();
            if (!(viewer.level >= 3 || hasRole(viewer, "marketing", "keuangan"))) return [];
            return clone(ready().pos_points);
        },

        /** Riwayat belanja member (Radar & laporan) — hanya member yang mengizinkan riwayat disimpan. */
        async listMemberSales() {
            const viewer = me();
            if (!(viewer.level >= 3 || hasRole(viewer, "marketing", "keuangan"))) return [];
            const db = ready();
            const allowed = new Set(db.pos_members.filter((member) => member.consent_history).map((member) => member.id));
            return clone(db.pos_sales.filter((sale) => sale.member_id && allowed.has(sale.member_id)));
        },

        /* ---------- Tahap 4: promo otomatis ---------- */

        async listPromos() {
            return clone(ready().pos_promos);
        },

        async savePromo(promo) {
            const viewer = me();
            if (!(viewer.level >= 4 || hasRole(viewer, "marketing"))) throw denied("Akses ditolak: promo diatur owner, manajer, atau marketing.");
            const problem = validatePromo(promo);
            if (problem) throw new Error(problem);
            const db = ready();
            const clean = cleanPromo(promo);
            const existing = promo.id && db.pos_promos.find((entry) => entry.id === promo.id);
            if (existing) {
                Object.assign(existing, clean, { id: existing.id });
                audit("pos_promos", existing.id, "UPDATE", { name: clean.name, is_active: clean.is_active });
            } else {
                const created = { ...clean, id: nextId("promo"), created_by: viewer.id, created_at: new Date().toISOString() };
                db.pos_promos.push(created);
                audit("pos_promos", created.id, "INSERT", { name: clean.name });
            }
            save();
        },

        async deletePromo(promoId) {
            const viewer = me();
            if (!(viewer.level >= 4 || hasRole(viewer, "marketing"))) throw denied();
            const db = ready();
            db.pos_promos = db.pos_promos.filter((entry) => entry.id !== promoId);
            audit("pos_promos", promoId, "DELETE", {});
            save();
        },

        /* ---------- Tahap 5: bahan baku, resep & HPP ---------- */

        /** Bahan + stok outlet. Harga modal hanya untuk supervisor ke atas / produk / gudang / keuangan. */
        async listIngredients(outletId) {
            const viewer = me();
            const db = ready();
            const stock = stockAt(db, outletId);
            const open = seesCost(viewer);
            return db.pos_ingredients.map((entry) => ({ ...clone(entry), cost: open ? entry.cost : null, stock: Number(stock[entry.id]) || 0 }));
        },

        async saveIngredient(values) {
            const viewer = me();
            if (!canManageStock(viewer)) throw denied("Akses ditolak: bahan baku dikelola staf produk/gudang atau owner/manajer.");
            const db = ready();
            const clean = {
                name: String(values.name || "").trim().slice(0, 60),
                unit: ["gram", "ml", "pcs"].includes(values.unit) ? values.unit : "gram",
                cost: Math.max(0, Math.round((Number(values.cost) || 0) * 100) / 100),
                min_stock: Math.max(0, Number(values.min_stock) || 0),
                is_active: values.is_active !== false,
            };
            if (!clean.name) throw new Error("Isi nama bahan.");
            if (db.pos_ingredients.some((entry) => entry.name.toLowerCase() === clean.name.toLowerCase() && entry.id !== values.id)) throw new Error("Nama bahan sudah ada.");
            const existing = values.id && db.pos_ingredients.find((entry) => entry.id === values.id);
            if (existing) Object.assign(existing, clean);
            else db.pos_ingredients.push({ id: nextId("ing"), ...clean, created_at: new Date().toISOString() });
            audit("pos_ingredients", values.id || clean.name, existing ? "UPDATE" : "INSERT", clean);
            save();
        },

        async getRecipes() {
            const db = ready();
            return { recipes: clone(db.pos_recipes), optionRecipes: clone(db.pos_option_recipes) };
        },

        async saveRecipe(productId, items) {
            if (!hasRole(me(), "produk")) throw denied("Akses ditolak: resep diatur staf produk atau owner/manajer.");
            const db = ready();
            const clean = cleanRecipeItems(items, db.pos_ingredients);
            if (clean.length) db.pos_recipes[String(productId)] = clean;
            else delete db.pos_recipes[String(productId)];
            audit("pos_recipes", String(productId), "UPDATE", { items: clean.length });
            save();
        },

        async saveOptionRecipe(key, items) {
            if (!hasRole(me(), "produk")) throw denied("Akses ditolak: resep diatur staf produk atau owner/manajer.");
            const db = ready();
            const clean = cleanRecipeItems(items, db.pos_ingredients, { allowNegative: true });
            if (clean.length) db.pos_option_recipes[key] = clean;
            else delete db.pos_option_recipes[key];
            save();
        },

        /**
         * Gerak bahan manual:
         *  - beli   : qty masuk + total harga -> harga modal rata-rata tertimbang, jurnal persediaan
         *  - buang  : qty dibuang + alasan (semua staf outlet boleh mencatat — kejujuran dihargai)
         *  - opname : qty = HASIL HITUNG; selisih dengan catatan sistem dicatat (Bahan yang Hilang)
         */
        async ingredientMove({ outlet_id: outletId, ingredient_id, kind, qty, total = 0, reason = "", pay = "tunai" }) {
            const viewer = me();
            const db = ready();
            if (!outletOk(db, outletId)) throw new Error("Outlet tidak ditemukan.");
            const ingredient = db.pos_ingredients.find((entry) => entry.id === ingredient_id);
            if (!ingredient) throw new Error("Bahan tidak ditemukan.");
            const amount = Math.round((Number(qty) || 0) * 100) / 100;
            const current = Number(stockAt(db, outletId)[ingredient_id]) || 0;
            let journal = null;

            if (kind === "beli") {
                if (!canManageStock(viewer) && viewer.level < 3) throw denied();
                if (amount <= 0) throw new Error("Isi jumlah yang dibeli.");
                const value = Math.max(0, Math.round(Number(total) || 0));
                if (value <= 0) throw new Error("Isi total harga belanja.");
                ingredient.cost = weightedCost(current, ingredient.cost, amount, value);
                ingredientWrite(db, { outlet_id: outletId, ingredient_id, kind, delta: amount, reason: String(reason || "").slice(0, 80), unit_cost: Math.round((value / amount) * 100) / 100 });
                // Permintaan restok untuk bahan ini otomatis selesai.
                for (const row of (db.pos_restock || []).filter((entry) => entry.outlet_id === outletId && entry.ingredient_id === ingredient_id && entry.status === "baru")) {
                    Object.assign(row, { status: "selesai", resolved_at: new Date().toISOString(), resolved_by: viewer.id, note: "Otomatis: belanja bahan dicatat" });
                }
                const credit = pay === "utang" ? "2-1000" : pay === "transfer" ? "1-1100" : "1-1000";
                journal = [`Belanja bahan ${ingredient.name}`, [{ account_code: "1-1310", debit: value, credit: 0 }, { account_code: credit, debit: 0, credit: value }]];
            } else if (kind === "buang") {
                if (!hasRole(viewer, "kasir", "dapur", "produk", "gudang")) throw denied();
                if (amount <= 0) throw new Error("Isi jumlah yang dibuang.");
                if (!WASTE_REASONS[reason]) throw new Error("Pilih alasan bahan dibuang.");
                ingredientWrite(db, { outlet_id: outletId, ingredient_id, kind, delta: -amount, reason });
                const value = Math.round(amount * ingredient.cost);
                if (value > 0) journal = [`Bahan dibuang: ${ingredient.name}`, [{ account_code: "5-1100", debit: value, credit: 0 }, { account_code: "1-1310", debit: 0, credit: value }]];
            } else if (kind === "opname") {
                if (!canManageStock(viewer) && viewer.level < 3) throw denied();
                if (!(amount >= 0)) throw new Error("Isi hasil hitung stok.");
                const delta = Math.round((amount - current) * 100) / 100;
                if (!delta) { save(); return { delta: 0 }; }
                ingredientWrite(db, { outlet_id: outletId, ingredient_id, kind, delta, reason: "Hitung stok" });
                const value = Math.round(Math.abs(delta) * ingredient.cost);
                if (value > 0) {
                    journal = [`Selisih hitung stok ${ingredient.name}`, delta < 0
                        ? [{ account_code: "5-1100", debit: value, credit: 0 }, { account_code: "1-1310", debit: 0, credit: value }]
                        : [{ account_code: "1-1310", debit: value, credit: 0 }, { account_code: "5-1100", debit: 0, credit: value }]];
                }
                if (journal) journalWrite(journal[0], "bahan", null, journal[1], viewer.id);
                save();
                return { delta };
            } else {
                throw new Error("Jenis gerak bahan tidak valid.");
            }
            if (journal) journalWrite(journal[0], "bahan", null, journal[1], viewer.id);
            save();
            return { delta: kind === "beli" ? amount : -amount };
        },

        async listIngredientMoves({ outletId, days = 30 } = {}) {
            const viewer = me();
            if (!seesCost(viewer) && !hasRole(viewer, "dapur")) return [];
            const since = Date.now() - days * 86400000;
            return clone(ready().pos_ingredient_moves.filter((entry) =>
                (!outletId || entry.outlet_id === outletId) && new Date(entry.created_at).getTime() >= since));
        },

        /* ---------- Permintaan restok dari kasir (menu habis) ---------- */

        /** Kasir/barista minta restok. Permintaan yang masih terbuka untuk menu yang sama digabung (hitungan naik). */
        async requestRestock({ outlet_id: outletId, product_id, name, ingredient_id = null, ingredient_name = "" }) {
            const viewer = me();
            if (!hasRole(viewer, "kasir", "dapur")) throw denied();
            const db = ready();
            const at = new Date().toISOString();
            const open = db.pos_restock.find((entry) => entry.outlet_id === outletId && entry.product_id === String(product_id) && entry.status === "baru");
            if (open) {
                open.count += 1;
                open.last_at = at;
                save();
                return clone(open);
            }
            const row = {
                id: nextId("rs"), outlet_id: outletId, product_id: String(product_id), name: String(name || "").slice(0, 80),
                ingredient_id, ingredient_name: String(ingredient_name || "").slice(0, 60), count: 1, status: "baru",
                requested_by: viewer.id, created_at: at, last_at: at, resolved_at: null, resolved_by: null, note: "",
            };
            db.pos_restock.push(row);
            db.pos_restock = db.pos_restock.slice(-500);
            save();
            return clone(row);
        },

        async listRestockRequests({ outletId, includeDone = false } = {}) {
            return clone(ready().pos_restock.filter((entry) => (!outletId || entry.outlet_id === outletId) && (includeDone || entry.status === "baru")));
        },

        async resolveRestock(id, note = "") {
            const viewer = me();
            if (!hasRole(viewer, "produk", "gudang") && viewer.level < 3) throw denied();
            const row = ready().pos_restock.find((entry) => entry.id === id);
            if (!row) throw new Error("Permintaan tidak ditemukan.");
            Object.assign(row, { status: "selesai", resolved_at: new Date().toISOString(), resolved_by: viewer.id, note: String(note || "").slice(0, 80) });
            save();
        },

        /* ---------- Tahap 6: rating pelanggan 1 ketukan ---------- */

        async rateSale(saleId, score) {
            if (!hasRole(me(), "kasir")) throw denied();
            const value = Number(score);
            if (![1, 2, 3].includes(value)) throw new Error("Nilai tidak valid.");
            const db = ready();
            const sale = db.pos_sales.find((entry) => entry.id === saleId);
            if (!sale) throw new Error("Transaksi tidak ditemukan.");
            if (db.pos_ratings.some((entry) => entry.sale_id === saleId)) return;
            db.pos_ratings.push({ id: nextId("r"), sale_id: saleId, outlet_id: sale.outlet_id, cashier_id: sale.cashier_id, score: value, created_at: new Date().toISOString() });
            save();
        },

        async listRatings({ since } = {}) {
            const viewer = me();
            if (!(viewer.level >= 3 || hasRole(viewer, "keuangan"))) return [];
            const from = since ? new Date(since).getTime() : -Infinity;
            return clone(ready().pos_ratings.filter((entry) => new Date(entry.created_at).getTime() >= from));
        },

        /* ---------- Penjualan hilang ---------- */

        async recordLostSale({ outlet_id: outletId, product_id, name, qty = 1, value = 0, reason }) {
            const viewer = me();
            if (!hasRole(viewer, "kasir")) throw denied();
            const db = ready();
            const entry = {
                id: nextId("l"), outlet_id: outletId, product_id: String(product_id || ""), name: String(name || "").slice(0, 80),
                qty: Math.min(Math.max(Math.round(Number(qty) || 1), 1), 999),
                value: Math.max(0, Math.round(Number(value) || 0)),
                reason: LOST_REASONS[reason] ? reason : "lainnya",
                created_by: viewer.id, created_at: new Date().toISOString(),
            };
            db.pos_lost.push(entry);
            save();
            return clone(entry);
        },

        async listLostSales({ outletId, since } = {}) {
            const viewer = me();
            const from = since ? new Date(since).getTime() : -Infinity;
            const all = hasRole(viewer, "keuangan");
            return clone(ready().pos_lost.filter((entry) =>
                (!outletId || entry.outlet_id === outletId)
                && new Date(entry.created_at).getTime() >= from
                && (all || entry.created_by === viewer.id)));
        },

        async saveOpenBill(bill) {
            const viewer = me();
            if (!hasRole(viewer, "kasir")) throw denied("Akses ditolak: hanya kasir yang boleh menyimpan bill.");
            const db = ready();
            if (!outletOk(db, bill.outlet_id)) throw new Error("Outlet tidak ditemukan.");
            const table = String(bill.table_no || "").trim().slice(0, 10);
            const name = String(bill.customer_name || "").trim().slice(0, 40);
            if (!table && !name) throw new Error("Isi nomor meja atau nama pemesan dulu.");
            if (!bill.lines?.length) throw new Error("Pesanan masih kosong.");
            const clean = {
                outlet_id: bill.outlet_id, channel: bill.channel, table_no: table, customer_name: name,
                discount: Math.max(0, Math.round(Number(bill.discount) || 0)),
                lines: clone(bill.lines), updated_at: new Date().toISOString(),
                queue_no: String(bill.queue_no || ""), sent: clone(bill.sent || {}),
                member_id: bill.member_id && db.pos_members.some((entry) => entry.id === bill.member_id) ? bill.member_id : null,
            };
            const existing = bill.id && db.pos_bills.find((entry) => entry.id === bill.id);
            let saved;
            if (existing) {
                Object.assign(existing, clean);
                saved = existing;
            } else {
                saved = { id: nextId("bill"), created_by: viewer.id, ...clean };
                db.pos_bills.push(saved);
            }
            save();
            return clone(saved);
        },

        async deleteOpenBill(billId) {
            if (!hasRole(me(), "kasir")) throw denied();
            const db = ready();
            db.pos_bills = db.pos_bills.filter((bill) => bill.id !== billId);
            save();
        },

        /* ---------- Bayar ---------- */

        async posCheckoutPro({ outlet_id: outletId, channel, table_no, customer_name, discount, lines, payments, bill_id, queue_no, approval_pin, member_id = null, redeem_points = 0, offline_at = null }) {
            const viewer = me();
            if (!hasRole(viewer, "kasir")) throw denied("Akses ditolak: hanya kasir yang boleh mencatat penjualan.");
            const db = ready();
            if (!outletOk(db, outletId)) throw new Error("Outlet tidak ditemukan.");
            const shift = openShiftOf(db, viewer.id, outletId);
            if (!shift) throw new Error("Buka shift dulu sebelum berjualan.");

            // Tahap 6: transaksi offline memakai jam aslinya (maks 48 jam lalu, tidak di masa depan).
            let clock = new Date();
            if (offline_at) {
                const at = new Date(offline_at);
                if (Number.isNaN(at.getTime()) || at.getTime() > Date.now() + 60000 || Date.now() - at.getTime() > 48 * 3600000) {
                    throw new Error("Transaksi offline terlalu lama (> 48 jam) atau jamnya tidak wajar. Minta supervisor memeriksa.");
                }
                clock = at;
            }

            // Pesanan ojol tidak memakai member/poin/promo toko (sama dengan SQL).
            const online = ["gofood", "grabfood", "shopeefood"].includes(channel);
            const member = member_id && !online ? db.pos_members.find((entry) => entry.id === member_id) : null;
            if (member_id && !online && !member) throw new Error("Member tidak ditemukan (mungkin datanya sudah dihapus).");
            const priced = priceOrder({
                lines, products: db.products, groups: db.pos_modifiers, channel, discount,
                settings: db.pos_settings[outletId], promos: db.pos_promos, now: clock,
                member: member ? { points: pointsBalance(db.pos_points, member.id) } : null, redeem_points,
            });
            if (!priced.items.length) throw new Error("Keranjang kasir kosong.");

            const payment = settlePayments(priced.total, payments);
            if (!payment.ok) throw new Error(payment.problem || "Pembayaran belum lengkap.");

            const rules = posSettings(db.pos_settings[outletId]);
            let approver = null;
            if (needsDiscountApproval(priced.subtotal, priced.discount, rules.discount_pin_percent)) {
                approver = approverByPin(db, approval_pin, viewer);
                if (!approver) throw new Error(`Diskon di atas ${rules.discount_pin_percent}% butuh PIN atasan yang benar.`);
            }

            // Stok barang jadi: hanya menu TANPA resep (menu ber-resep dibuat saat dipesan -> bahan dipotong).
            const need = new Map();
            for (const item of priced.items.filter((entry) => !hasRecipe(entry.product_id, db.pos_recipes))) {
                need.set(item.product_id, (need.get(item.product_id) || 0) + item.qty);
            }
            const usage = orderUsage(priced.items, db.pos_recipes, db.pos_option_recipes);
            const cogs = usageCost(usage, db.pos_ingredients);
            let levels = db.stock_levels;
            const moves = [];
            for (const [productId, qty] of need) {
                const planned = planMoves(levels, { kind: "penjualan", warehouse_id: outletId, product_id: productId, qty });
                levels = applyMoves(levels, planned);
                moves.push(...planned);
            }

            const receipt = receiptNumber(db.pos_serial++);
            recordMoves(moves, receipt);
            // Bahan tidak memblokir penjualan (catatan stok bisa salah); stok minus = tanda perlu hitung ulang.
            consume(db, outletId, usage, receipt);

            const sale = {
                id: nextId("pos"),
                receipt_no: receipt,
                outlet_id: outletId,
                cashier_id: viewer.id,
                channel: priced.channel,
                table_no: String(table_no || "").trim().slice(0, 10),
                customer_name: String(customer_name || "").trim().slice(0, 40),
                queue_no: String(queue_no || "").slice(0, 10),
                shift_id: shift.id,
                discount_approved_by: approver?.id || null,
                member_id: member?.id || null,
                items: priced.items.map(({ product_id, name, qty, unit_price, options, note }) => ({
                    product_id, name, qty, price: unit_price, options, note,
                })),
                subtotal: priced.subtotal,
                promo_discount: priced.promo_discount,
                promos: priced.promos,
                discount: priced.discount,
                points_used: priced.points_used,
                points_value: priced.points_value,
                points_earned: priced.points_earned,
                cogs,
                service: priced.service,
                tax: priced.tax,
                rounding: priced.rounding,
                total: priced.total,
                payments: payment.applied,
                paid: payment.paid,
                change: payment.change,
                method: payment.applied.length > 1 ? "campuran" : payment.applied[0]?.method || "tunai",
                status: "selesai",
                created_at: clock.toISOString(),
                offline: Boolean(offline_at),
                synced_at: offline_at ? new Date().toISOString() : null,
            };
            db.pos_sales.push(sale);

            // Buku besar poin (siap jadi poin jaringan lintas brand: ada business_id).
            const point = (delta, kind) => db.pos_points.push({
                id: nextId("pt"), member_id: member.id, business_id: member.business_id || "demo", sale_id: sale.id,
                delta, kind, note: receipt, created_at: sale.created_at,
            });
            if (member && priced.points_used) point(-priced.points_used, "redeem");
            if (member && priced.points_earned) point(priced.points_earned, "earn");

            if (cogs > 0) {
                journalWrite(`HPP kasir ${receipt}`, "pos", `${receipt}-HPP`, [
                    { account_code: "5-1000", debit: cogs, credit: 0 },
                    { account_code: "1-1310", debit: 0, credit: cogs },
                ], viewer.id);
            }
            if (sale.total > 0) {
                journalWrite(`Penjualan kasir ${receipt}`, "pos", receipt, saleJournalLines(priced, payment.applied), viewer.id);
            }
            if (bill_id) db.pos_bills = db.pos_bills.filter((bill) => bill.id !== bill_id);

            save();
            return clone(sale);
        },
    };
}
