/**
 * KANTOONG ERP — DATA CONTOH FASE 2
 * File: frontend/erp/data/demo-seed-phase2.js
 *
 * Gudang & outlet, stok, penjualan kasir, jurnal keuangan, absensi,
 * dan payroll bulan lalu. Semua FIKTIF dan konsisten satu sama lain:
 * setiap penjualan (online & kasir) punya jurnalnya.
 */

import { DEFAULT_ACCOUNTS, QUICK_ENTRIES } from "../core/accounting.js";
import { DEFAULT_HR_SETTINGS, checkInStatus, monthlyRecap, previousPeriod, wibDate } from "../core/hr.js";
import { computePayslip, payrollJournal } from "../core/payroll.js";
import { isPaid } from "../core/metrics.js";
import { receiptNumber } from "../core/pos.js";

function prng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function extendSeedPhase2(seed, now = new Date()) {
    const random = prng(20261104);
    const dayMs = 86400000;
    const iso = (date) => new Date(date).toISOString();

    // ---------- Anggota tambahan: kasir, gudang, keuangan ----------
    seed.units.push({ id: "u-outlet", parent_id: "u-prod", name: "Outlet Bandung", kind: "tim", sort: 2 });

    const base = (id, full_name, extra) => ({
        id, user_id: null, email: `${id.slice(2)}@contoh.kantoong.id`, full_name,
        org_unit_id: "u-co", position_title: "Staf", level: 1, job_role: "umum",
        manager_id: "m-owner", modules: null, sales_slug: null, is_active: true, ...extra,
    });

    seed.members.push(
        base("m-dewi", "Dewi Anggraini", { position_title: "Kasir Outlet", job_role: "kasir", org_unit_id: "u-outlet", manager_id: "m-lina" }),
        base("m-joko", "Joko Susilo", { position_title: "Staf Gudang", job_role: "gudang", org_unit_id: "u-prod", manager_id: "m-owner" }),
        base("m-fajar", "Fajar Nugroho", { position_title: "Staf Keuangan", job_role: "keuangan", org_unit_id: "u-fin", manager_id: "m-owner" })
    );

    for (const id of ["m-dewi", "m-joko", "m-fajar"]) {
        seed.salaries.push({ member_id: id, base_salary: id === "m-fajar" ? 5500000 : 4500000 });
    }

    // ---------- Gudang & stok ----------
    seed.warehouses = [
        { id: "w-pusat", name: "Gudang Pusat", kind: "gudang", address: "Jl. Contoh Industri No. 1", is_active: true },
        { id: "w-bdg", name: "Outlet Bandung", kind: "outlet", address: "Jl. Contoh Dago No. 10", is_active: true },
    ];

    seed.stock_levels = [];
    seed.stock_moves = [];
    let moveId = 1;
    const opening = new Date(now.getTime() - 35 * dayMs);

    seed.products.forEach((product, index) => {
        const central = 60 + Math.floor(random() * 90);
        const outlet = 10 + Math.floor(random() * 20);
        // Satu produk sengaja menipis agar peringatan terlihat.
        const outletQty = index === 1 ? 3 : outlet;

        seed.stock_levels.push(
            { warehouse_id: "w-pusat", product_id: product.id, qty: central, min_qty: 20 },
            { warehouse_id: "w-bdg", product_id: product.id, qty: outletQty, min_qty: 6 }
        );
        seed.stock_moves.push(
            { id: moveId++, warehouse_id: "w-pusat", product_id: product.id, qty: central + 40, kind: "masuk", ref: "MUT-AWAL", note: "Stok awal", actor_id: "m-joko", created_at: iso(opening) },
            { id: moveId++, warehouse_id: "w-pusat", product_id: product.id, qty: -40, kind: "transfer_keluar", ref: "MUT-OUTLET", note: "Kirim ke outlet", actor_id: "m-joko", created_at: iso(opening.getTime() + dayMs) },
            { id: moveId++, warehouse_id: "w-bdg", product_id: product.id, qty: 40, kind: "transfer_masuk", ref: "MUT-OUTLET", note: "Kirim ke outlet", actor_id: "m-joko", created_at: iso(opening.getTime() + dayMs) }
        );
        product.stock = central + outletQty;
    });

    // ---------- Penjualan kasir 14 hari terakhir ----------
    seed.pos_sales = [];
    let serial = 1;
    const methods = ["tunai", "tunai", "qris", "qris", "debit"];

    for (let day = 13; day >= 0; day -= 1) {
        const count = 2 + Math.floor(random() * 5);
        for (let n = 0; n < count; n += 1) {
            const created = new Date(now.getTime() - day * dayMs - Math.floor(random() * 8) * 3600000);
            const lines = 1 + Math.floor(random() * 3);
            const items = [];
            let subtotal = 0;

            for (let l = 0; l < lines; l += 1) {
                const product = seed.products[Math.floor(random() * seed.products.length)];
                const qty = 1 + Math.floor(random() * 3);
                items.push({ product_id: product.id, name: product.name, price: product.price, qty });
                subtotal += product.price * qty;
            }

            const method = methods[Math.floor(random() * methods.length)];
            const paid = method === "tunai" ? Math.ceil(subtotal / 10000) * 10000 : subtotal;

            seed.pos_sales.push({
                id: `pos-${serial}`,
                receipt_no: receiptNumber(serial, created),
                outlet_id: "w-bdg",
                cashier_id: "m-dewi",
                items,
                subtotal,
                discount: 0,
                total: subtotal,
                paid,
                change: paid - subtotal,
                method,
                status: "selesai",
                created_at: iso(created),
            });
            serial += 1;
        }
    }
    seed.pos_serial = serial;

    // ---------- Keuangan: jurnal dari semua transaksi ----------
    seed.accounts = DEFAULT_ACCOUNTS.map((account) => ({ ...account, is_active: true }));
    seed.journal = [];
    let entryId = 1;
    const addEntry = (date, memo, source, ref, lines, actor = null) => {
        seed.journal.push({
            id: `j-${entryId++}`,
            entry_date: wibDate(date),
            memo, source, ref,
            created_by: actor,
            created_at: iso(date),
            lines: lines.map((line) => ({ ...line })),
        });
    };


    for (const order of seed.orders) {
        if (isPaid(order)) {
            addEntry(order.created_at, `Penjualan online ${order.order_code}`, "order", order.order_code, QUICK_ENTRIES.penjualanOnline(order.total));
        }
    }

    for (const sale of seed.pos_sales) {
        addEntry(sale.created_at, `Penjualan kasir ${sale.receipt_no}`, "pos", sale.receipt_no, QUICK_ENTRIES.penjualanKasir(sale.total, sale.method), "m-dewi");
    }

    for (let week = 5; week >= 0; week -= 1) {
        const date = new Date(now.getTime() - week * 7 * dayMs - 2 * dayMs);
        addEntry(date, "Listrik, air & internet outlet", "pengeluaran", null, QUICK_ENTRIES.pengeluaran(350000 + Math.round(random() * 10) * 10000), "m-fajar");
        if (week % 2 === 0) {
            addEntry(date, "Iklan media sosial", "pengeluaran", null, QUICK_ENTRIES.pengeluaran(250000, "6-1300"), "m-fajar");
        }
    }

    // ---------- Absensi 30 hari (Senin–Sabtu) ----------
    seed.hr_settings = { ...DEFAULT_HR_SETTINGS };
    seed.attendance = [];
    const staff = seed.members.filter((member) => member.level < 5);

    for (let day = 30; day >= 0; day -= 1) {
        const date = new Date(now.getTime() - day * dayMs);
        const local = new Date(date.getTime() + 7 * 3600000);
        if (local.getUTCDay() === 0) continue; // Minggu libur
        const dateKey = wibDate(date);

        for (const member of staff) {
            const roll = random();
            const isToday = day === 0;
            // Hari ini: sebagian belum absen (masih pagi).
            if (isToday && roll < 0.35) continue;

            let status;
            if (roll < 0.03) status = "alpa";
            else if (roll < 0.06) status = "sakit";
            else if (roll < 0.08) status = "izin";
            else status = "hadir";

            const record = { id: `att-${member.id}-${dateKey}`, member_id: member.id, work_date: dateKey, check_in: null, check_out: null, status, note: null, updated_by: member.id };

            if (status === "hadir") {
                // Masuk 08.25–09.25 WIB.
                const minutes = 8 * 60 + 25 + Math.floor(random() * 60);
                const checkIn = new Date(Date.parse(`${dateKey}T00:00:00+07:00`) + minutes * 60000);
                record.check_in = iso(checkIn);
                record.status = checkInStatus(checkIn, seed.hr_settings);
                if (!isToday) record.check_out = iso(checkIn.getTime() + (8 * 60 + Math.floor(random() * 60)) * 60000);
            }

            seed.attendance.push(record);
        }
    }

    // ---------- Payroll bulan lalu (sudah dibayar) ----------
    const lastPeriod = previousPeriod(wibDate(now).slice(0, 7));
    const runId = `run-${lastPeriod}`;
    seed.payroll_runs = [{
        id: runId, period: lastPeriod, status: "dibayar", created_by: "m-wati",
        created_at: iso(now.getTime() - 5 * dayMs), finalized_at: iso(now.getTime() - 4 * dayMs), paid_at: iso(now.getTime() - 3 * dayMs),
    }];

    const from = Date.parse(`${lastPeriod}-01T00:00:00+07:00`);
    const [year, month] = lastPeriod.split("-").map(Number);
    const to = Date.parse(`${new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)}T00:00:00+07:00`);

    seed.payslips = seed.members
        .filter((member) => member.is_active && member.level < 5)
        .map((member) => {
            const omzet = seed.orders
                .filter((order) => order.sales_member_id === member.id && isPaid(order))
                .filter((order) => {
                    const time = Date.parse(order.created_at);
                    return time >= from && time < to;
                })
                .reduce((sum, order) => sum + order.total, 0);
            const rate = seed.targets.find((target) => target.member_id === member.id)?.commission_rate || 0;
            const salary = seed.salaries.find((entry) => entry.member_id === member.id)?.base_salary || 0;
            const recap = monthlyRecap(seed.attendance, member.id, lastPeriod);

            return {
                id: `slip-${member.id}-${lastPeriod}`,
                run_id: runId,
                member_id: member.id,
                ...computePayslip({
                    baseSalary: salary, commissionRate: rate, omzet, alpaDays: recap.alpa,
                    workingDays: seed.hr_settings.working_days, allowance: 300000,
                }),
            };
        });

    addEntry(new Date(now.getTime() - 3 * dayMs), `Pembayaran gaji ${lastPeriod}`, "payroll", lastPeriod, payrollJournal(seed.payslips), "m-wati");

    // Modal awal cukup menutup gaji & beban (demo tetap wajar untuk harga produk apa pun).
    const outflow = seed.journal
        .flatMap((entry) => entry.lines)
        .filter((line) => line.account_code === "1-1100" || line.account_code === "1-1000")
        .reduce((sum, line) => sum + line.credit, 0);
    const capital = Math.max(50000000, Math.ceil((outflow + 25000000) / 5000000) * 5000000);
    addEntry(new Date(now.getTime() - 45 * dayMs), "Setoran modal awal", "manual", null, QUICK_ENTRIES.modal(capital), "m-owner");

    seed.journal.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return seed;
}
