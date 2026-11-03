/**
 * KANTOONG ERP — SUMBER DATA DEMO FASE 2
 * File: frontend/erp/data/demo-adapter-phase2.js
 *
 * Gudang, kasir, keuangan, absensi, payroll — dengan aturan akses yang
 * sama seperti erp-phase2.sql. Dipasang ke demo-adapter.js.
 */

import { canView, hasRole, isPayrollAdmin } from "../core/org.js";
import { applyMoves, planMoves } from "../core/inventory.js";
import { QUICK_ENTRIES, validateJournal } from "../core/accounting.js";
import { priceCart, receiptNumber, settle } from "../core/pos.js";
import { checkInStatus, wibDate } from "../core/hr.js";
import { payrollJournal } from "../core/payroll.js";
import { isPaid } from "../core/metrics.js";

function denied(message = "Akses ditolak: jabatanmu tidak boleh melakukan ini.") {
    const error = new Error(message);
    error.code = "42501";
    return error;
}

const clone = (value) => JSON.parse(JSON.stringify(value));

export function phase2Methods({ db: getDb, save, me, audit }) {
    const nextId = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

    const journalWrite = (memo, source, ref, lines, actor = null, date = new Date()) => {
        const db = getDb();
        if (ref && db.journal.some((entry) => entry.source === source && entry.ref === ref)) return null;
        const problem = validateJournal(lines);
        if (problem) throw new Error(problem);
        const entry = {
            id: nextId("j"),
            entry_date: typeof date === "string" ? date : wibDate(date),
            memo, source, ref: ref || null,
            created_by: actor,
            created_at: new Date().toISOString(),
            lines: lines.filter((line) => line.debit > 0 || line.credit > 0).map((line) => ({ ...line })),
        };
        db.journal.push(entry);
        return entry.id;
    };

    const syncProductStock = (productIds) => {
        const db = getDb();
        for (const id of new Set(productIds.map(String))) {
            const product = db.products.find((entry) => String(entry.id) === id);
            if (product) {
                product.stock = db.stock_levels
                    .filter((level) => String(level.product_id) === id)
                    .reduce((sum, level) => sum + level.qty, 0);
            }
        }
    };

    const recordMoves = (moves, ref, note = null) => {
        const db = getDb();
        db.stock_levels = applyMoves(db.stock_levels, moves);
        const at = new Date().toISOString();
        for (const move of moves) {
            db.stock_moves.push({
                id: (db.stock_moves.at(-1)?.id || 0) + 1,
                ...move, ref, note, actor_id: me().id, created_at: at,
            });
        }
        syncProductStock(moves.map((move) => move.product_id));
    };

    return {
        /** Dipanggil demo-adapter saat pesanan demo dibayar. */
        journalForOrder(order) {
            if (isPaid(order)) {
                journalWrite(`Penjualan online ${order.order_code}`, "order", order.order_code, QUICK_ENTRIES.penjualanOnline(order.total));
            }
        },

        /* ---------- Gudang & stok ---------- */

        async listWarehouses() {
            return clone(getDb().warehouses);
        },

        async saveWarehouse(warehouse) {
            if (!hasRole(me(), "gudang")) throw denied();
            const db = getDb();
            if (warehouse.id) {
                Object.assign(db.warehouses.find((entry) => entry.id === warehouse.id), warehouse);
                audit("warehouses", warehouse.id, "UPDATE", warehouse);
            } else {
                const created = { is_active: true, ...warehouse, id: nextId("w") };
                db.warehouses.push(created);
                audit("warehouses", created.id, "INSERT", created);
            }
            save();
        },

        async listStockLevels() {
            return clone(getDb().stock_levels);
        },

        async listStockMoves({ limit = 60 } = {}) {
            const viewer = me();
            if (viewer.level < 3 && !hasRole(viewer, "gudang", "produk", "kasir", "keuangan")) return [];
            return clone(getDb().stock_moves.slice(-limit).reverse());
        },

        async stockMove(request) {
            if (!hasRole(me(), "gudang")) throw denied("Akses ditolak: hanya bagian gudang yang boleh mengubah stok.");
            const db = getDb();
            if (!db.products.some((product) => String(product.id) === String(request.product_id))) {
                throw new Error("Produk tidak ditemukan di katalog master.");
            }
            const moves = planMoves(db.stock_levels, request);
            const ref = `MUT-${Date.now().toString(36).toUpperCase()}`;
            if (moves.length) recordMoves(moves, ref, request.note || (request.kind === "opname" ? "Stock opname" : null));
            save();
            return { ref, difference: moves.reduce((sum, move) => sum + (move.kind === "penyesuaian" ? move.qty : 0), 0) };
        },

        async setMinQty(warehouseId, productId, minQty) {
            if (!hasRole(me(), "gudang")) throw denied();
            const db = getDb();
            let level = db.stock_levels.find((entry) => entry.warehouse_id === warehouseId && String(entry.product_id) === String(productId));
            if (!level) {
                level = { warehouse_id: warehouseId, product_id: String(productId), qty: 0, min_qty: 0 };
                db.stock_levels.push(level);
            }
            level.min_qty = Math.max(0, Math.floor(Number(minQty) || 0));
            save();
        },

        /* ---------- Kasir POS ---------- */

        async posCheckout({ outlet_id: outletId, method, paid, discount, items }) {
            const viewer = me();
            if (!hasRole(viewer, "kasir")) throw denied("Akses ditolak: hanya kasir yang boleh mencatat penjualan.");
            const db = getDb();
            if (!db.warehouses.some((entry) => entry.id === outletId && entry.kind === "outlet" && entry.is_active)) {
                throw new Error("Outlet tidak ditemukan.");
            }

            const priced = priceCart(items, db.products, discount);
            if (!priced.items.length) throw new Error("Keranjang kasir kosong.");

            const payment = settle(priced.total, method, paid);
            if (!payment.ok) throw new Error("Uang yang diterima kurang dari total belanja.");

            // Cek stok semua barang dulu (semua atau tidak sama sekali).
            let levels = db.stock_levels;
            const moves = [];
            for (const item of priced.items) {
                const planned = planMoves(levels, { kind: "penjualan", warehouse_id: outletId, product_id: item.product_id, qty: item.qty });
                levels = applyMoves(levels, planned);
                moves.push(...planned);
            }

            const receipt = receiptNumber(db.pos_serial++);
            recordMoves(moves, receipt);

            const sale = {
                id: nextId("pos"),
                receipt_no: receipt,
                outlet_id: outletId,
                cashier_id: viewer.id,
                items: priced.items.map(({ product_id, name, price, qty }) => ({ product_id, name, price, qty })),
                subtotal: priced.subtotal,
                discount: priced.discount,
                total: priced.total,
                paid: payment.paid,
                change: payment.change,
                method,
                status: "selesai",
                created_at: new Date().toISOString(),
            };
            db.pos_sales.push(sale);

            if (sale.total > 0) {
                journalWrite(`Penjualan kasir ${receipt}`, "pos", receipt, QUICK_ENTRIES.penjualanKasir(sale.total, method), viewer.id);
            }

            save();
            return clone(sale);
        },

        async listPosSales({ since } = {}) {
            const viewer = me();
            const sinceMs = since ? new Date(since).getTime() : -Infinity;
            return clone(
                getDb().pos_sales.filter((sale) =>
                    new Date(sale.created_at).getTime() >= sinceMs &&
                    (sale.cashier_id === viewer.id || hasRole(viewer, "keuangan", "gudang"))
                )
            );
        },

        /* ---------- Keuangan ---------- */

        async listAccounts() {
            if (!hasRole(me(), "keuangan")) return [];
            return clone(getDb().accounts);
        },

        async listJournal() {
            if (!hasRole(me(), "keuangan")) return [];
            return clone(getDb().journal);
        },

        async postJournal({ entry_date: entryDate, memo, source = "manual", lines }) {
            if (!hasRole(me(), "keuangan")) throw denied("Akses ditolak: hanya bagian keuangan yang boleh mencatat jurnal.");
            if (!["manual", "pengeluaran"].includes(source)) throw new Error("Sumber jurnal tidak valid.");
            const id = journalWrite(memo || "Jurnal manual", source, null, lines, me().id, entryDate || new Date());
            save();
            return id;
        },

        /* ---------- HR & absensi ---------- */

        async getHrSettings() {
            return clone(getDb().hr_settings);
        },

        async saveHrSettings(values) {
            if (!hasRole(me(), "hr")) throw denied();
            Object.assign(getDb().hr_settings, values);
            audit("hr_settings", "1", "UPDATE", values);
            save();
        },

        async listAttendance({ from, to } = {}) {
            const viewer = me();
            const db = getDb();
            return clone(db.attendance.filter((record) =>
                (!from || record.work_date >= from) &&
                (!to || record.work_date <= to) &&
                (canView(viewer, record.member_id, db.members) || viewer.job_role === "hr")
            ));
        },

        async clock(action) {
            const viewer = me();
            const db = getDb();
            const today = wibDate();
            let record = db.attendance.find((entry) => entry.member_id === viewer.id && entry.work_date === today);

            if (action === "in") {
                if (record?.check_in) throw new Error("Kamu sudah absen masuk hari ini.");
                const now = new Date();
                const status = checkInStatus(now, db.hr_settings);
                if (record) Object.assign(record, { check_in: now.toISOString(), status });
                else {
                    record = { id: nextId("att"), member_id: viewer.id, work_date: today, check_in: now.toISOString(), check_out: null, status, note: null, updated_by: viewer.id };
                    db.attendance.push(record);
                }
            } else if (action === "out") {
                if (!record?.check_in || record.check_out) throw new Error("Belum absen masuk, atau sudah absen pulang.");
                record.check_out = new Date().toISOString();
            } else {
                throw new Error("Aksi absensi tidak dikenal.");
            }

            save();
            return clone(record);
        },

        async saveAttendance(values) {
            if (!hasRole(me(), "hr")) throw denied();
            const db = getDb();
            let record = db.attendance.find((entry) => entry.member_id === values.member_id && entry.work_date === values.work_date);
            if (!record) {
                record = { id: nextId("att"), check_in: null, check_out: null, note: null, ...values };
                db.attendance.push(record);
            }
            Object.assign(record, values, { updated_by: me().id });
            audit("attendance", record.id, "UPDATE", { status: values.status, work_date: values.work_date });
            save();
        },

        /* ---------- Payroll ---------- */

        async listPayrollRuns() {
            return clone(getDb().payroll_runs.slice().sort((a, b) => b.period.localeCompare(a.period)));
        },

        async payrollBase(period) {
            if (!isPayrollAdmin(me())) throw denied();
            const db = getDb();
            const from = Date.parse(`${period}-01T00:00:00+07:00`);
            const [year, month] = period.split("-").map(Number);
            const to = Date.parse(`${new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)}T00:00:00+07:00`);

            return db.members.filter((member) => member.is_active).map((member) => ({
                member_id: member.id,
                omzet: db.orders
                    .filter((order) => order.sales_member_id === member.id && isPaid(order))
                    .filter((order) => {
                        const time = Date.parse(order.created_at);
                        return time >= from && time < to;
                    })
                    .reduce((sum, order) => sum + order.total, 0),
                commission_rate: db.targets.find((target) => target.member_id === member.id)?.commission_rate || 0,
                base_salary: db.salaries.find((salary) => salary.member_id === member.id)?.base_salary || 0,
            }));
        },

        async createPayrollRun(period) {
            if (!isPayrollAdmin(me())) throw denied();
            const db = getDb();
            if (db.payroll_runs.some((run) => run.period === period)) throw new Error("Periode itu sudah dibuat.");
            const run = { id: nextId("run"), period, status: "draft", created_by: me().id, created_at: new Date().toISOString(), finalized_at: null, paid_at: null };
            db.payroll_runs.push(run);
            audit("payroll_runs", run.id, "INSERT", { period });
            save();
            return clone(run);
        },

        async listPayslips(runId) {
            const viewer = me();
            const db = getDb();
            const runs = new Map(db.payroll_runs.map((run) => [run.id, run]));
            return clone(db.payslips.filter((slip) =>
                (!runId || slip.run_id === runId) &&
                (isPayrollAdmin(viewer) || (slip.member_id === viewer.id && runs.get(slip.run_id)?.status !== "draft"))
            ));
        },

        async savePayslips(runId, slips) {
            const db = getDb();
            const run = db.payroll_runs.find((entry) => entry.id === runId);
            if (!isPayrollAdmin(me())) throw denied();
            if (run?.status !== "draft") throw new Error("Slip hanya bisa diubah saat payroll masih draf.");
            db.payslips = db.payslips.filter((slip) => slip.run_id !== runId).concat(
                slips.map((slip) => ({ id: nextId("slip"), ...slip, run_id: runId }))
            );
            audit("payslips", runId, "UPDATE", { _: "dirahasiakan" });
            save();
        },

        async finalizePayroll(runId) {
            if (!isPayrollAdmin(me())) throw denied();
            const run = getDb().payroll_runs.find((entry) => entry.id === runId);
            if (run?.status !== "draft") throw new Error("Payroll ini sudah final.");
            Object.assign(run, { status: "final", finalized_at: new Date().toISOString() });
            audit("payroll_runs", runId, "UPDATE", { status: { dari: "draft", jadi: "final" } });
            save();
        },

        async payPayroll(runId) {
            if (!isPayrollAdmin(me())) throw denied();
            const db = getDb();
            const run = db.payroll_runs.find((entry) => entry.id === runId);
            if (run?.status !== "final") throw new Error("Payroll harus difinalkan dulu sebelum dibayar.");
            const lines = payrollJournal(db.payslips.filter((slip) => slip.run_id === runId));
            if (lines.length) journalWrite(`Pembayaran gaji ${run.period}`, "payroll", run.period, lines, me().id);
            Object.assign(run, { status: "dibayar", paid_at: new Date().toISOString() });
            audit("payroll_runs", runId, "UPDATE", { status: { dari: "final", jadi: "dibayar" } });
            save();
        },
    };
}
