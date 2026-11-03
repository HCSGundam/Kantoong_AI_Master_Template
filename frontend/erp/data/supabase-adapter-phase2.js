/**
 * KANTOONG ERP — SUMBER DATA SUPABASE FASE 2
 * File: frontend/erp/data/supabase-adapter-phase2.js
 *
 * Stok, kasir, jurnal, absensi jam-server, dan pembayaran gaji ditulis
 * lewat fungsi database (erp-phase2.sql) agar angka tidak bisa diakali.
 */

import { supabase } from "../../js/supabase-client.js";

function check({ data, error }) {
    if (error) throw error;
    return data;
}

export function phase2SupabaseMethods() {
    return {
        /* ---------- Gudang & stok ---------- */

        async listWarehouses() {
            return check(await supabase.from("warehouses").select("*").order("name")) || [];
        },

        async saveWarehouse(warehouse) {
            const { id, ...values } = warehouse;
            if (id) check(await supabase.from("warehouses").update(values).eq("id", id));
            else check(await supabase.from("warehouses").insert(values));
        },

        async listStockLevels() {
            return check(await supabase.from("stock_levels").select("*")) || [];
        },

        async listStockMoves({ limit = 60 } = {}) {
            return check(
                await supabase.from("stock_moves").select("*").order("created_at", { ascending: false }).limit(limit)
            ) || [];
        },

        async stockMove(request) {
            return check(await supabase.rpc("erp_stock_move", { p: request }));
        },

        async setMinQty(warehouseId, productId, minQty) {
            check(await supabase.rpc("erp_set_min_qty", {
                p_warehouse: warehouseId, p_product: String(productId), p_min: Math.max(0, Math.floor(Number(minQty) || 0)),
            }));
        },

        /* ---------- Kasir POS ---------- */

        async posCheckout(payload) {
            const receipt = check(await supabase.rpc("erp_pos_checkout", { p: payload }));
            return { ...receipt, created_at: new Date().toISOString(), outlet_id: payload.outlet_id };
        },

        async listPosSales({ since } = {}) {
            let query = supabase.from("pos_sales").select("*").order("created_at", { ascending: false }).limit(2000);
            if (since) query = query.gte("created_at", new Date(since).toISOString());
            return check(await query) || [];
        },

        /* ---------- Keuangan ---------- */

        async listAccounts() {
            return check(await supabase.from("accounts").select("*").order("code")) || [];
        },

        async listJournal() {
            const entries = check(
                await supabase.from("journal_entries").select("*, lines:journal_lines(account_code, debit, credit)")
                    .order("entry_date", { ascending: true }).limit(5000)
            ) || [];
            return entries.map((entry) => ({
                ...entry,
                lines: (entry.lines || []).map((line) => ({ ...line, debit: Number(line.debit), credit: Number(line.credit) })),
            }));
        },

        async postJournal(payload) {
            return check(await supabase.rpc("erp_post_journal", { p: payload }));
        },

        /* ---------- HR & absensi ---------- */

        async getHrSettings() {
            const row = check(await supabase.from("hr_settings").select("*").eq("id", 1).maybeSingle());
            return row ? { ...row, work_start: String(row.work_start).slice(0, 5) } : null;
        },

        async saveHrSettings(values) {
            check(await supabase.from("hr_settings").update(values).eq("id", 1));
        },

        async listAttendance({ from, to } = {}) {
            let query = supabase.from("attendance").select("*").order("work_date", { ascending: false }).limit(5000);
            if (from) query = query.gte("work_date", from);
            if (to) query = query.lte("work_date", to);
            return check(await query) || [];
        },

        async clock(action) {
            return check(await supabase.rpc("erp_clock", { p_action: action }));
        },

        async saveAttendance(values) {
            check(await supabase.from("attendance").upsert(values, { onConflict: "member_id,work_date" }));
        },

        /* ---------- Payroll ---------- */

        async listPayrollRuns() {
            return check(await supabase.from("payroll_runs").select("*").order("period", { ascending: false })) || [];
        },

        async payrollBase(period) {
            return (check(await supabase.rpc("erp_payroll_base", { p_period: period })) || []).map((row) => ({
                member_id: row.member_id,
                omzet: Number(row.omzet) || 0,
                commission_rate: Number(row.commission_rate) || 0,
                base_salary: Number(row.base_salary) || 0,
            }));
        },

        async createPayrollRun(period) {
            return check(await supabase.from("payroll_runs").insert({ period }).select("*").single());
        },

        async listPayslips(runId) {
            let query = supabase.from("payslips").select("*");
            if (runId) query = query.eq("run_id", runId);
            return check(await query) || [];
        },

        async savePayslips(runId, slips) {
            check(await supabase.from("payslips").delete().eq("run_id", runId));
            if (slips.length) {
                check(await supabase.from("payslips").insert(slips.map((slip) => ({ ...slip, run_id: runId }))));
            }
        },

        async finalizePayroll(runId) {
            check(await supabase.from("payroll_runs")
                .update({ status: "final", finalized_at: new Date().toISOString() })
                .eq("id", runId).eq("status", "draft"));
        },

        async payPayroll(runId) {
            check(await supabase.rpc("erp_payroll_pay", { p_run: runId }));
        },
    };
}
