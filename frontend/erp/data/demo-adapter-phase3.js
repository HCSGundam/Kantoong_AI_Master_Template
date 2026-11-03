/**
 * KANTOONG ERP — SUMBER DATA DEMO FASE 3
 * File: frontend/erp/data/demo-adapter-phase3.js
 *
 * Pembelian, logistik, CS, voucher, CRM — aturan akses sama dengan
 * erp-phase3.sql. Dipasang ke demo-adapter.js.
 */

import { hasRole } from "../core/org.js";
import { applyMoves, planMoves } from "../core/inventory.js";
import { validateJournal } from "../core/accounting.js";
import { canTransition, payJournal, poNumber, poTotal, receiveJournal, validatePoLines } from "../core/purchasing.js";
import { applyAction } from "../core/logistics.js";
import { checkVoucher, isValidCode, normalizeCode } from "../core/marketing.js";
import { aggregateCustomers } from "../core/crm.js";
import { refundJournal, ticketNumber } from "../core/cs.js";
import { wibDate } from "../core/hr.js";

function denied(message = "Akses ditolak: jabatanmu tidak boleh melakukan ini.") {
    const error = new Error(message);
    error.code = "42501";
    return error;
}

const clone = (value) => JSON.parse(JSON.stringify(value));

export function phase3Methods({ db: getDb, save, me, audit }) {
    const nextId = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

    const journal = (memo, source, ref, lines) => {
        const db = getDb();
        if (ref && db.journal.some((entry) => entry.source === source && entry.ref === ref)) return;
        const problem = validateJournal(lines);
        if (problem) throw new Error(problem);
        db.journal.push({
            id: nextId("j"), entry_date: wibDate(), memo, source, ref,
            created_by: me().id, created_at: new Date().toISOString(),
            lines: lines.filter((line) => line.debit > 0 || line.credit > 0),
        });
    };

    const moveStock = (request, ref, note) => {
        const db = getDb();
        const moves = planMoves(db.stock_levels, request);
        db.stock_levels = applyMoves(db.stock_levels, moves);
        for (const move of moves) {
            db.stock_moves.push({
                id: (db.stock_moves.at(-1)?.id || 0) + 1, ...move, ref, note,
                actor_id: me().id, created_at: new Date().toISOString(),
            });
            const product = db.products.find((entry) => String(entry.id) === String(move.product_id));
            if (product) {
                product.stock = db.stock_levels
                    .filter((level) => String(level.product_id) === String(move.product_id))
                    .reduce((sum, level) => sum + level.qty, 0);
            }
        }
    };

    const canPurchase = () => hasRole(me(), "gudang", "keuangan");
    const seesPurchasing = () => me().level >= 3 || canPurchase();
    const seesOrders = () => me().level >= 3 || hasRole(me(), "gudang", "cs", "keuangan");

    return {
        /* ---------- Pembelian ---------- */

        async listSuppliers() {
            return seesPurchasing() ? clone(getDb().suppliers) : [];
        },

        async saveSupplier(values) {
            if (!canPurchase()) throw denied();
            const db = getDb();
            if (values.id) Object.assign(db.suppliers.find((entry) => entry.id === values.id), values);
            else db.suppliers.push({ is_active: true, ...values, id: nextId("s") });
            audit("suppliers", values.id || "baru", values.id ? "UPDATE" : "INSERT", { name: values.name });
            save();
        },

        async listPurchaseOrders() {
            if (!seesPurchasing()) return [];
            return clone(getDb().purchase_orders.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)));
        },

        async savePurchaseOrder({ id, supplier_id: supplierId, warehouse_id: warehouseId, note, lines }) {
            if (!canPurchase()) throw denied("Akses ditolak: hanya gudang/keuangan yang boleh membuat PO.");
            const problem = validatePoLines(lines);
            if (problem) throw new Error(problem);
            const db = getDb();
            const clean = lines.map((line) => ({ product_id: String(line.product_id), qty: Number(line.qty), unit_cost: Math.round(Number(line.unit_cost)) }));

            if (id) {
                const order = db.purchase_orders.find((entry) => entry.id === id);
                if (order?.status !== "draft") throw new Error("PO hanya bisa diubah saat masih draf.");
                Object.assign(order, { supplier_id: supplierId, warehouse_id: warehouseId, note: note || null, lines: clean, total: poTotal(clean) });
            } else {
                db.purchase_orders.push({
                    id: nextId("po"), po_number: poNumber(db.po_serial++), supplier_id: supplierId, warehouse_id: warehouseId,
                    status: "draft", note: note || null, total: poTotal(clean), paid_method: null, created_by: me().id,
                    created_at: new Date().toISOString(), ordered_at: null, received_at: null, paid_at: null, lines: clean,
                });
            }
            save();
        },

        async setPoStatus(poId, status, method = "transfer") {
            if (!canPurchase()) throw denied();
            const db = getDb();
            const order = db.purchase_orders.find((entry) => entry.id === poId);
            if (!order) throw new Error("PO tidak ditemukan.");
            if (!canTransition(order.status, status)) throw new Error(`Perubahan status PO tidak valid (${order.status} ke ${status}).`);
            const now = new Date().toISOString();

            if (status === "diterima") {
                for (const line of order.lines) {
                    moveStock({ kind: "masuk", warehouse_id: order.warehouse_id, product_id: line.product_id, qty: line.qty }, order.po_number, "Penerimaan PO");
                    const product = db.products.find((entry) => String(entry.id) === String(line.product_id));
                    if (product) product.cost_price = line.unit_cost;
                }
                if (order.total > 0) journal(`Penerimaan barang ${order.po_number}`, "pembelian", order.po_number, receiveJournal(order.total));
                order.received_at = now;
            }

            if (status === "dibayar") {
                if (!hasRole(me(), "keuangan")) throw denied("Pelunasan PO hanya oleh bagian keuangan.");
                if (order.total > 0) journal(`Pelunasan ${order.po_number}`, "pembelian", `${order.po_number}-bayar`, payJournal(order.total, method));
                order.paid_at = now;
                order.paid_method = method === "tunai" ? "tunai" : "transfer";
            }

            if (status === "dipesan") order.ordered_at = now;
            order.status = status;
            audit("purchase_orders", poId, "UPDATE", { status });
            save();
        },

        /* ---------- Logistik ---------- */

        async listOnlineOrders() {
            if (!seesOrders()) return [];
            return clone(getDb().orders.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)));
        },

        async orderAdvance({ order_id: orderId, action, warehouse_id: warehouseId, courier_name: courier, tracking_number: tracking }) {
            const viewer = me();
            const db = getDb();
            const order = db.orders.find((entry) => entry.id === orderId);
            if (!order) throw new Error("Pesanan tidak ditemukan.");

            const roles = { bayar: ["keuangan", "cs"], proses: ["gudang"], kirim: ["gudang"], selesai: ["gudang", "cs"], batal: ["cs", "keuangan"] }[action] || [];
            if (!hasRole(viewer, ...roles)) throw denied();

            const next = applyAction(order.status, action, { tracking, warehouseId });

            if (action === "kirim") {
                // Cek semua barang dulu (semua atau tidak sama sekali).
                let levels = db.stock_levels;
                for (const item of order.items || []) {
                    levels = applyMoves(levels, planMoves(levels, { kind: "penjualan", warehouse_id: warehouseId, product_id: item.product_id, qty: item.qty }));
                }
                for (const item of order.items || []) {
                    moveStock({ kind: "penjualan", warehouse_id: warehouseId, product_id: item.product_id, qty: item.qty }, order.order_code, "Kirim pesanan online");
                }
                Object.assign(order, { tracking_number: tracking.trim(), shipped_at: new Date().toISOString(), ship_warehouse_id: warehouseId, courier_name: courier || order.courier_name });
            }

            if (action === "bayar") {
                journal(`Penjualan online ${order.order_code}`, "order", order.order_code, [
                    { account_code: "1-1100", debit: order.total, credit: 0 },
                    { account_code: "4-1000", debit: 0, credit: order.total },
                ]);
            }

            if (action === "batal" && ["dibayar", "diproses"].includes(order.status)) {
                journal(`Pembatalan pesanan ${order.order_code}`, "order", `${order.order_code}-batal`, [
                    { account_code: "4-1000", debit: order.total, credit: 0 },
                    { account_code: "1-1100", debit: 0, credit: order.total },
                ]);
            }

            if (action === "selesai") order.delivered_at = new Date().toISOString();
            order.status = next;
            save();
        },

        /* ---------- Customer Service ---------- */

        async listTickets() {
            const viewer = me();
            const all = viewer.level >= 3 || hasRole(viewer, "cs");
            return clone(getDb().cs_tickets.filter((ticket) => all || ticket.created_by === viewer.id || ticket.assigned_to === viewer.id));
        },

        async createTicket(values) {
            const db = getDb();
            const created = {
                id: nextId("t"), ticket_no: ticketNumber(db.ticket_serial++), status: "baru",
                created_by: me().id, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), resolved_at: null,
                assigned_to: values.assigned_to || null, ...values,
            };
            db.cs_tickets.push(created);
            audit("cs_tickets", created.id, "INSERT", { subject: created.subject });
            save();
            return clone(created);
        },

        async updateTicket(ticketId, patch) {
            const viewer = me();
            const ticket = getDb().cs_tickets.find((entry) => entry.id === ticketId);
            if (!ticket) throw new Error("Tiket tidak ditemukan.");
            if (!(viewer.level >= 3 || hasRole(viewer, "cs") || ticket.assigned_to === viewer.id)) throw denied();
            Object.assign(ticket, patch, { updated_at: new Date().toISOString() });
            if (["selesai", "ditutup"].includes(patch.status) && !ticket.resolved_at) ticket.resolved_at = new Date().toISOString();
            audit("cs_tickets", ticketId, "UPDATE", patch);
            save();
        },

        async listTicketNotes(ticketId) {
            return clone(getDb().cs_ticket_notes.filter((note) => note.ticket_id === ticketId));
        },

        async addTicketNote(ticketId, body) {
            const db = getDb();
            db.cs_ticket_notes.push({ id: (db.cs_ticket_notes.at(-1)?.id || 0) + 1, ticket_id: ticketId, author_id: me().id, body, created_at: new Date().toISOString() });
            save();
        },

        async csReturn({ ticket_id: ticketId, product_id: productId, qty, warehouse_id: warehouseId, refund_amount: refund, refund_method: method }) {
            if (!hasRole(me(), "cs")) throw denied("Akses ditolak: retur diproses oleh CS.");
            const db = getDb();
            const ticket = db.cs_tickets.find((entry) => entry.id === ticketId);
            if (!ticket) throw new Error("Tiket tidak ditemukan.");
            if (Number(qty) > 0) moveStock({ kind: "retur", warehouse_id: warehouseId, product_id: productId, qty: Number(qty) }, ticket.ticket_no, "Retur pelanggan");
            const amount = Math.max(0, Math.round(Number(refund) || 0));
            if (amount > 0) journal(`Pengembalian dana ${ticket.ticket_no}`, "retur", ticket.ticket_no, refundJournal(amount, method));
            db.cs_ticket_notes.push({ id: (db.cs_ticket_notes.at(-1)?.id || 0) + 1, ticket_id: ticketId, author_id: me().id, body: `Retur diterima: ${qty || 0} pcs. Pengembalian dana Rp ${amount.toLocaleString("id-ID")}.`, created_at: new Date().toISOString() });
            Object.assign(ticket, { status: "selesai", resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() });
            save();
        },

        /* ---------- Marketing ---------- */

        async listVouchers() {
            const viewer = me();
            return viewer.level >= 3 || hasRole(viewer, "marketing", "keuangan") ? clone(getDb().vouchers) : [];
        },

        async saveVoucher(values) {
            if (!hasRole(me(), "marketing")) throw denied();
            const db = getDb();
            const code = normalizeCode(values.code);
            if (!isValidCode(code)) throw new Error("Kode voucher 3–20 huruf besar/angka, tanpa spasi.");
            if (db.vouchers.some((voucher) => voucher.code === code && voucher.id !== values.id)) throw new Error("Kode voucher sudah dipakai.");
            if (values.id) Object.assign(db.vouchers.find((voucher) => voucher.id === values.id), { ...values, code });
            else db.vouchers.push({ used: 0, created_by: me().id, created_at: new Date().toISOString(), ...values, code, id: nextId("v") });
            audit("vouchers", values.id || code, values.id ? "UPDATE" : "INSERT", { code });
            save();
        },

        async listRedemptions() {
            const viewer = me();
            return viewer.level >= 3 || hasRole(viewer, "marketing", "keuangan") ? clone(getDb().voucher_redemptions) : [];
        },

        async checkVoucher(code, subtotal) {
            const voucher = getDb().vouchers.find((entry) => entry.code === normalizeCode(code));
            const result = checkVoucher(voucher, subtotal);
            return result.valid ? { ...result, ...clone(voucher) } : result;
        },

        /* ---------- CRM ---------- */

        async listCustomers() {
            const viewer = me();
            const all = viewer.level >= 3 || hasRole(viewer, "cs", "marketing");
            if (!all && viewer.job_role !== "sales") return [];
            const db = getDb();
            return aggregateCustomers(db.orders, db.crm_profiles, {
                onlySalesId: all ? null : viewer.id,
                maskWithoutConsent: viewer.level < 3 && viewer.job_role === "marketing",
            });
        },

        async saveCrmProfile(phone, { tags, note, marketing_consent: consent }) {
            const viewer = me();
            const db = getDb();
            const allowed = viewer.level >= 3 || hasRole(viewer, "cs", "marketing")
                || db.orders.some((order) => order.customer_phone === phone && order.sales_member_id === viewer.id);
            if (!allowed) throw denied("Akses ditolak: ini bukan pelangganmu.");
            const existing = db.crm_profiles.find((profile) => profile.phone === phone);
            const values = { phone, tags: tags || [], note: note || null, marketing_consent: Boolean(consent), updated_by: viewer.id, updated_at: new Date().toISOString() };
            if (existing) Object.assign(existing, values);
            else db.crm_profiles.push(values);
            audit("crm_profiles", phone.slice(-4), "UPDATE", { marketing_consent: values.marketing_consent });
            save();
        },
    };
}
