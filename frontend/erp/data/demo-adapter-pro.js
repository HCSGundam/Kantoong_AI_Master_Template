/**
 * KANTOONG ERP PRO — SUMBER DATA DEMO (Pro Max)
 * File: frontend/erp/data/demo-adapter-pro.js
 *
 * Aturan akses sama dengan db/erp-pro.sql:
 * - Aturan persetujuan: semua anggota baca, hanya owner ubah.
 * - Tagihan & anggaran: keuangan + direktur/owner.
 * - Batch kedaluwarsa: gudang/produk + manajer ke atas.
 * - Cuti: diri sendiri; atasan & HR melihat timnya/semua.
 * - Kontrak: HR & owner/direktur; pemilik kontrak melihat miliknya.
 * - Penilaian: yang dinilai, penilainya, HR & owner/direktur.
 * - Deal CRM: pemilik deal; manajer ke atas melihat semua.
 */

import { hasRole, canView } from "../core/org.js";
import { buildChain, validateRule } from "../core/approval-chain.js";
import { applyPayment, validateInvoice } from "../core/finance-pro.js";
import { validateLeave, workDays } from "../core/hr-pro.js";
import { moveStage, STAGES } from "../core/crm-pro.js";
import { wibDate } from "../core/hr.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const newId = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function denied(message = "Akses ditolak: jabatanmu tidak boleh melakukan ini.") {
    const error = new Error(message);
    error.code = "42501";
    return error;
}

export function proMethods({ db: getDb, save, me, audit, journalWrite }) {
    const pro = () => getDb().pro;
    const seesMoney = () => hasRole(me(), "keuangan");
    const seesStock = () => me().level >= 3 || hasRole(me(), "gudang", "produk");
    const isHr = () => hasRole(me(), "hr");
    const members = () => getDb().members || [];

    return {
        /* ---------- Persetujuan berjenjang ---------- */

        async listApprovalRules() {
            return clone(pro().rules);
        },

        async saveApprovalRules(rules) {
            if (me().level < 5) throw denied("Hanya owner yang boleh mengubah aturan persetujuan.");
            for (const rule of rules) {
                const problem = validateRule(rule);
                if (problem) throw new Error(problem);
            }
            pro().rules = rules.map((r) => ({ id: r.id || newId("r"), kind: r.kind, min_amount: Number(r.min_amount) || 0, steps: [...r.steps] }));
            audit("approval_rules", "*", "UPDATE", { jumlah: rules.length });
            save();
        },

        async listDelegations() {
            const viewer = me();
            return clone(pro().delegations.filter((d) => viewer.level >= 5 || d.from_id === viewer.id || d.to_id === viewer.id));
        },

        async saveDelegation({ to_id, starts, ends }) {
            const viewer = me();
            if (viewer.level < 2) throw denied("Delegasi hanya untuk atasan.");
            if (to_id === viewer.id) throw new Error("Pilih orang lain.");
            if (!members().some((m) => m.id === to_id && m.is_active)) throw new Error("Penerima delegasi tidak ditemukan.");
            if (!starts || !ends || ends < starts) throw new Error("Tanggal delegasi tidak valid.");
            const item = { id: newId("dg"), from_id: viewer.id, to_id, starts, ends, is_active: true };
            pro().delegations.push(item);
            audit("approval_delegations", item.id, "INSERT", item);
            save();
        },

        async removeDelegation(delegationId) {
            const viewer = me();
            const list = pro().delegations;
            const item = list.find((d) => d.id === delegationId);
            if (!item) return;
            if (item.from_id !== viewer.id && viewer.level < 5) throw denied();
            pro().delegations = list.filter((d) => d.id !== delegationId);
            save();
        },

        /** Pratinjau rantai sebelum mengajukan ("akan disetujui oleh …"). */
        async previewChain({ kind, amount }) {
            return buildChain({ kind, amount, requester_id: me().id }, { rules: pro().rules, members: members(), delegations: pro().delegations }).chain;
        },

        /* ---------- Tagihan (piutang & hutang) ---------- */

        async listInvoices() {
            if (!seesMoney()) return [];
            return clone(pro().invoices);
        },

        async saveInvoice(input) {
            if (!seesMoney()) throw denied("Hanya bagian keuangan yang boleh mencatat tagihan.");
            const problem = validateInvoice(input);
            if (problem) throw new Error(problem);
            const item = {
                id: newId("inv"),
                direction: input.direction,
                party: String(input.party).trim().slice(0, 80),
                number: String(input.number || "").trim().slice(0, 40) || `INV-${Date.now().toString().slice(-6)}`,
                amount: Math.round(Number(input.amount)),
                paid: 0,
                issued_at: wibDate(new Date()),
                due_date: input.due_date,
                status: "terbuka",
            };
            pro().invoices.push(item);
            audit("finance_invoices", item.id, "INSERT", { party: item.party, amount: item.amount });
            save();
        },

        async payInvoice(invoiceId, amount, cashCode = "1-1100") {
            if (!seesMoney()) throw denied("Hanya bagian keuangan yang boleh mencatat pembayaran.");
            const list = pro().invoices;
            const index = list.findIndex((inv) => inv.id === invoiceId);
            if (index < 0) throw new Error("Tagihan tidak ditemukan.");
            const updated = applyPayment(list[index], amount);
            const value = updated.paid - list[index].paid;
            const lines = updated.direction === "piutang"
                ? [{ account_code: cashCode, debit: value, credit: 0 }, { account_code: "1-1200", debit: 0, credit: value }]
                : [{ account_code: "2-1000", debit: value, credit: 0 }, { account_code: cashCode, debit: 0, credit: value }];
            journalWrite?.(`${updated.direction === "piutang" ? "Terima pembayaran" : "Bayar tagihan"} ${updated.party} (${updated.number})`, "manual", null, lines, me().id);
            list[index] = updated;
            audit("finance_invoices", invoiceId, "UPDATE", { bayar: value });
            save();
            return clone(updated);
        },

        async listRecurring() {
            if (!seesMoney()) return [];
            return clone(pro().recurring);
        },

        async listBudgets() {
            if (!seesMoney()) return [];
            return clone(pro().budgets);
        },

        async saveBudget({ account_code, label, period, amount }) {
            if (!seesMoney()) throw denied();
            const value = Math.round(Number(amount));
            if (!(value > 0)) throw new Error("Nominal anggaran harus lebih dari 0.");
            if (!/^\d{4}-\d{2}$/.test(period)) throw new Error("Periode tidak valid.");
            const list = pro().budgets;
            const existing = list.find((b) => b.account_code === account_code && b.period === period);
            if (existing) Object.assign(existing, { amount: value, label: label || existing.label });
            else list.push({ id: newId("bg"), account_code, label: label || account_code, period, amount: value });
            audit("finance_budgets", account_code, "UPSERT", { period, amount: value });
            save();
        },

        /* ---------- Gudang pro ---------- */

        async listBatches() {
            if (!seesStock()) return [];
            return clone(pro().batches);
        },

        async saveBatch({ product_id, warehouse_id, lot, qty, expires_on }) {
            if (!hasRole(me(), "gudang")) throw denied("Hanya bagian gudang yang boleh mencatat batch.");
            const amount = Math.round(Number(qty));
            if (!(amount > 0)) throw new Error("Jumlah harus lebih dari 0.");
            if (!/^\d{4}-\d{2}-\d{2}$/.test(expires_on || "")) throw new Error("Tanggal kedaluwarsa tidak valid.");
            const item = { id: newId("bt"), product_id: String(product_id), warehouse_id, lot: String(lot || "").slice(0, 30) || "-", qty: amount, expires_on };
            pro().batches.push(item);
            audit("stock_batches", item.id, "INSERT", item);
            save();
        },

        async disposeBatch(batchId) {
            if (!hasRole(me(), "gudang")) throw denied();
            const item = pro().batches.find((b) => b.id === batchId);
            if (!item) return;
            audit("stock_batches", batchId, "UPDATE", { dibuang: item.qty });
            item.qty = 0;
            save();
        },

        /* ---------- SDM pro ---------- */

        async listLeaves() {
            const viewer = me();
            const db = getDb();
            return clone(pro().leaves.filter((l) => l.member_id === viewer.id || isHr() || canView(viewer, l.member_id, db.members)));
        },

        /** Cuti = pengajuan "cuti" yang ikut rantai persetujuan (atasan → HR). */
        async requestLeave(input) {
            const viewer = me();
            const problem = validateLeave(input);
            if (problem) throw new Error(problem);
            const days = workDays(input.starts, input.ends);
            const db = getDb();
            const leave = { id: newId("lv"), member_id: viewer.id, kind: input.kind, starts: input.starts, ends: input.ends, days, status: "menunggu", reason: String(input.reason || "").slice(0, 200), approval_id: null };
            const built = buildChain({ kind: "cuti", amount: 0, requester_id: viewer.id }, { rules: pro().rules, members: db.members, delegations: pro().delegations });
            const approval = {
                id: newId("a"), kind: "cuti", title: `Cuti ${days} hari (${input.starts} s.d. ${input.ends})`, amount: null,
                note: leave.reason || null, requester_id: viewer.id, status: built.chain.length ? "menunggu" : "disetujui",
                decision_note: null, created_at: new Date().toISOString(), decided_at: built.chain.length ? null : new Date().toISOString(),
                ...built, approver_id: built.chain[0]?.approver_id ?? null, leave_id: leave.id,
            };
            leave.approval_id = approval.id;
            leave.status = approval.status;
            db.approvals.push(approval);
            pro().leaves.push(leave);
            audit("hr_leaves", leave.id, "INSERT", { days });
            save();
        },

        async listContracts() {
            const viewer = me();
            return clone(pro().contracts.filter((c) => isHr() || c.member_id === viewer.id));
        },

        async saveContract(input) {
            if (!isHr()) throw denied("Hanya HR/owner yang boleh mengatur kontrak.");
            const list = pro().contracts;
            const clean = {
                member_id: input.member_id, type: input.type,
                starts_on: input.starts_on || null, ends_on: input.ends_on || null,
                probation_ends_on: input.probation_ends_on || null, salary_note: "",
            };
            if (clean.ends_on && clean.starts_on && clean.ends_on < clean.starts_on) throw new Error("Tanggal selesai sebelum tanggal mulai.");
            const existing = input.id ? list.find((c) => c.id === input.id) : null;
            if (existing) Object.assign(existing, clean);
            else list.push({ id: newId("ct"), ...clean });
            audit("hr_contracts", input.id || "baru", input.id ? "UPDATE" : "INSERT", clean);
            save();
        },

        async listReviews() {
            const viewer = me();
            const db = getDb();
            return clone(pro().reviews.filter((r) => isHr() || r.member_id === viewer.id || r.reviewer_id === viewer.id || canView(viewer, r.member_id, db.members)));
        },

        async saveReview({ member_id, period, scores, note }) {
            const viewer = me();
            const db = getDb();
            const target = db.members.find((m) => m.id === member_id);
            if (!target) throw new Error("Anggota tidak ditemukan.");
            if (member_id === viewer.id) throw new Error("Tidak boleh menilai diri sendiri.");
            if (!isHr() && !(canView(viewer, member_id, db.members) && viewer.level > target.level)) throw denied("Hanya atasan atau HR yang boleh menilai.");
            const item = { id: newId("rv"), member_id, period, reviewer_id: viewer.id, scores, note: String(note || "").slice(0, 300), created_at: new Date().toISOString() };
            pro().reviews.unshift(item);
            audit("hr_reviews", item.id, "INSERT", { member_id, period });
            save();
        },

        /* ---------- CRM pro ---------- */

        async listDeals() {
            const viewer = me();
            return clone(pro().deals.filter((d) => viewer.level >= 3 || hasRole(viewer, "marketing") || d.owner_id === viewer.id));
        },

        async saveDeal(input) {
            const viewer = me();
            if (!(viewer.level >= 2 || hasRole(viewer, "sales", "cs", "marketing"))) throw denied();
            const list = pro().deals;
            const now = new Date().toISOString();
            const value = Math.round(Number(input.value) || 0);
            if (!String(input.customer || "").trim()) throw new Error("Nama calon pelanggan wajib diisi.");
            if (input.stage && !STAGES.some((s) => s.key === input.stage)) throw new Error("Tahap tidak dikenal.");
            const existing = input.id ? list.find((d) => d.id === input.id) : null;
            if (existing && existing.owner_id !== viewer.id && viewer.level < 3) throw denied();
            const fields = {
                title: String(input.title || input.customer).trim().slice(0, 80),
                customer: String(input.customer).trim().slice(0, 80),
                value,
                next_action: String(input.next_action || "").slice(0, 120),
                next_action_at: input.next_action_at ? new Date(input.next_action_at).toISOString() : null,
                updated_at: now,
            };
            if (existing) Object.assign(existing, fields);
            else list.push({ id: newId("dl"), stage: input.stage || "prospek", owner_id: viewer.id, created_at: now, lost_reason: null, ...fields });
            save();
        },

        async moveDeal(dealId, stage, reason = "") {
            const viewer = me();
            const list = pro().deals;
            const index = list.findIndex((d) => d.id === dealId);
            if (index < 0) throw new Error("Deal tidak ditemukan.");
            if (list[index].owner_id !== viewer.id && viewer.level < 3) throw denied();
            list[index] = moveStage(list[index], stage, { reason });
            audit("crm_deals", dealId, "UPDATE", { stage });
            save();
        },
    };
}
