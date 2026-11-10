/**
 * KANTOONG ERP PRO — SUMBER DATA SUPABASE (Pro Max)
 * File: frontend/erp/data/supabase-adapter-pro.js
 *
 * Bentuk sama dengan demo-adapter-pro.js. Aturan akses ditegakkan RLS +
 * fungsi di db/erp-pro.sql (rantai persetujuan & pembayaran tagihan
 * dihitung server, tidak bisa diakali dari browser).
 * Bila db/erp-pro.sql belum dijalankan, daftar kosong (bukan error).
 */

import { supabase } from "../../js/supabase-client.js";
import { validateRule } from "../core/approval-chain.js";
import { validateInvoice } from "../core/finance-pro.js";
import { validateLeave } from "../core/hr-pro.js";
import { moveStage } from "../core/crm-pro.js";

function check({ data, error }) {
    if (error) throw error;
    return data;
}

/** Tabel belum ada (SQL Pro belum dijalankan) → kosong. */
async function soft(query) {
    const { data, error } = await query;
    if (error) {
        if (["42P01", "PGRST205", "42883", "PGRST202"].includes(error.code)) return [];
        throw error;
    }
    return data || [];
}

export function proSupabaseMethods() {
    return {
        async listApprovalRules() {
            return soft(supabase.from("approval_rules").select("*").order("kind").order("min_amount"));
        },

        async saveApprovalRules(rules) {
            for (const rule of rules) {
                const problem = validateRule(rule);
                if (problem) throw new Error(problem);
            }
            const keep = rules.map((r) => r.id).filter(Boolean);
            const existing = await soft(supabase.from("approval_rules").select("id"));
            const remove = existing.map((r) => r.id).filter((id) => !keep.includes(id));
            if (remove.length) check(await supabase.from("approval_rules").delete().in("id", remove));
            check(await supabase.from("approval_rules").upsert(rules.map((r) => ({
                id: r.id || `r-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
                kind: r.kind, min_amount: Number(r.min_amount) || 0, steps: r.steps, updated_at: new Date().toISOString(),
            }))));
        },

        async listDelegations() {
            return soft(supabase.from("approval_delegations").select("*").order("starts", { ascending: false }));
        },

        async saveDelegation({ to_id, starts, ends }) {
            const { data: me } = await supabase.rpc("erp_link_me");
            check(await supabase.from("approval_delegations").insert({ from_id: me, to_id, starts, ends }));
        },

        async removeDelegation(id) {
            check(await supabase.from("approval_delegations").delete().eq("id", id));
        },

        async previewChain({ kind, amount }) {
            const { data, error } = await supabase.rpc("erp_pro_preview_chain", { p_kind: kind, p_amount: Number(amount) || 0 });
            if (error) return [];
            return data || [];
        },

        async listInvoices() {
            return soft(supabase.from("finance_invoices").select("*").order("due_date"));
        },

        async saveInvoice(input) {
            const problem = validateInvoice(input);
            if (problem) throw new Error(problem);
            const { data: me } = await supabase.rpc("erp_link_me");
            check(await supabase.from("finance_invoices").insert({
                direction: input.direction,
                party: String(input.party).trim().slice(0, 80),
                number: String(input.number || "").trim().slice(0, 40) || `INV-${Date.now().toString().slice(-6)}`,
                amount: Math.round(Number(input.amount)),
                due_date: input.due_date,
                created_by: me,
            }));
        },

        async payInvoice(id, amount, cashCode = "1-1100") {
            check(await supabase.rpc("erp_pro_pay_invoice", { p_id: id, p_amount: Number(amount), p_cash: cashCode }));
        },

        async listRecurring() {
            return soft(supabase.from("finance_recurring").select("*"));
        },

        async listBudgets() {
            return soft(supabase.from("finance_budgets").select("*"));
        },

        async saveBudget({ account_code, label, period, amount }) {
            check(await supabase.from("finance_budgets").upsert(
                { account_code, label: label || account_code, period, amount: Math.round(Number(amount)) },
                { onConflict: "account_code,period" }
            ));
        },

        async listBatches() {
            return soft(supabase.from("stock_batches").select("*").gt("qty", 0).order("expires_on"));
        },

        async saveBatch({ product_id, warehouse_id, lot, qty, expires_on }) {
            const { data: me } = await supabase.rpc("erp_link_me");
            check(await supabase.from("stock_batches").insert({
                product_id: String(product_id), warehouse_id: warehouse_id || null, lot: String(lot || "-").slice(0, 30),
                qty: Math.round(Number(qty)), expires_on, created_by: me,
            }));
        },

        async disposeBatch(id) {
            check(await supabase.from("stock_batches").update({ qty: 0 }).eq("id", id));
        },

        async listLeaves() {
            return soft(supabase.from("hr_leaves").select("*").order("starts", { ascending: false }).limit(300));
        },

        async requestLeave(input) {
            const problem = validateLeave(input);
            if (problem) throw new Error(problem);
            check(await supabase.rpc("erp_pro_request_leave", {
                p_kind: input.kind, p_starts: input.starts, p_ends: input.ends, p_reason: input.reason || null,
            }));
        },

        async listContracts() {
            return soft(supabase.from("hr_contracts").select("*"));
        },

        async saveContract(input) {
            const row = {
                member_id: input.member_id, type: input.type, starts_on: input.starts_on || null,
                ends_on: input.ends_on || null, probation_ends_on: input.probation_ends_on || null,
            };
            if (input.id) check(await supabase.from("hr_contracts").update(row).eq("id", input.id));
            else check(await supabase.from("hr_contracts").insert(row));
        },

        async listReviews() {
            return soft(supabase.from("hr_reviews").select("*").order("created_at", { ascending: false }).limit(300));
        },

        async saveReview({ member_id, period, scores, note }) {
            const { data: me } = await supabase.rpc("erp_link_me");
            check(await supabase.from("hr_reviews").insert({ member_id, reviewer_id: me, period, scores, note: note || null }));
        },

        async listDeals() {
            return soft(supabase.from("crm_deals").select("*").order("updated_at", { ascending: false }).limit(500));
        },

        async saveDeal(input) {
            const row = {
                title: String(input.title || input.customer).trim().slice(0, 80),
                customer: String(input.customer || "").trim().slice(0, 80),
                value: Math.round(Number(input.value) || 0),
                next_action: String(input.next_action || "").slice(0, 120) || null,
                next_action_at: input.next_action_at ? new Date(input.next_action_at).toISOString() : null,
                updated_at: new Date().toISOString(),
            };
            if (!row.customer) throw new Error("Nama calon pelanggan wajib diisi.");
            if (input.id) {
                check(await supabase.from("crm_deals").update(row).eq("id", input.id));
            } else {
                const { data: me } = await supabase.rpc("erp_link_me");
                check(await supabase.from("crm_deals").insert({ ...row, stage: input.stage || "prospek", owner_id: me }));
            }
        },

        async moveDeal(id, stage, reason = "") {
            const next = moveStage({ id }, stage, { reason });
            check(await supabase.from("crm_deals").update({
                stage: next.stage, lost_reason: next.lost_reason, updated_at: next.updated_at,
                ...(next.next_action_at === null ? { next_action_at: null } : {}),
            }).eq("id", id));
        },
    };
}
