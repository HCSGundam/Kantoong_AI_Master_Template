/**
 * KANTOONG ERP — SUMBER DATA SUPABASE FASE 3
 * File: frontend/erp/data/supabase-adapter-phase3.js
 *
 * PO, alur pesanan, retur, dan CRM ditulis lewat fungsi database
 * (erp-phase3.sql) agar stok & jurnal selalu konsisten.
 */

import { supabase } from "../../js/supabase-client.js";

function check({ data, error }) {
    if (error) throw error;
    return data;
}

const ORDER_FIELDS =
    "id, order_code, status, total, items_total, shipping_cost, created_at, sales_member_id, customer_name, customer_phone, customer_email, " +
    "address_line, district, city, province, postal_code, courier_name, service_name, tracking_number, shipped_at, delivered_at, " +
    "voucher_code, voucher_discount, note, items:order_items(product_id, product_name, qty, unit_price)";

export function phase3SupabaseMethods() {
    return {
        /* ---------- Pembelian ---------- */

        async listSuppliers() {
            return check(await supabase.from("suppliers").select("*").order("name")) || [];
        },

        async saveSupplier(values) {
            const { id, ...rest } = values;
            if (id) check(await supabase.from("suppliers").update(rest).eq("id", id));
            else check(await supabase.from("suppliers").insert(rest));
        },

        async listPurchaseOrders() {
            const rows = check(
                await supabase.from("purchase_orders").select("*, lines:purchase_order_lines(product_id, qty, unit_cost)")
                    .order("created_at", { ascending: false }).limit(300)
            ) || [];
            return rows.map((row) => ({ ...row, total: Number(row.total), lines: (row.lines || []).map((line) => ({ ...line, unit_cost: Number(line.unit_cost) })) }));
        },

        async savePurchaseOrder(payload) {
            return check(await supabase.rpc("erp_po_save", { p: payload }));
        },

        async setPoStatus(poId, status, method = "transfer") {
            check(await supabase.rpc("erp_po_status", { p_id: poId, p_status: status, p_method: method }));
        },

        /* ---------- Logistik ---------- */

        async listOnlineOrders() {
            return check(await supabase.from("orders").select(ORDER_FIELDS).order("created_at", { ascending: false }).limit(500)) || [];
        },

        async orderAdvance(payload) {
            check(await supabase.rpc("erp_order_advance", { p: payload }));
        },

        /* ---------- Customer Service ---------- */

        async listTickets() {
            return check(await supabase.from("cs_tickets").select("*").order("created_at", { ascending: false }).limit(500)) || [];
        },

        async createTicket(values) {
            const { data: me } = await supabase.rpc("erp_link_me");
            return check(await supabase.from("cs_tickets").insert({ ...values, created_by: me }).select("*").single());
        },

        async updateTicket(ticketId, patch) {
            const values = { ...patch };
            if (["selesai", "ditutup"].includes(patch.status)) values.resolved_at = new Date().toISOString();
            check(await supabase.from("cs_tickets").update(values).eq("id", ticketId));
        },

        async listTicketNotes(ticketId) {
            return check(await supabase.from("cs_ticket_notes").select("*").eq("ticket_id", ticketId).order("created_at")) || [];
        },

        async addTicketNote(ticketId, body) {
            const { data: me } = await supabase.rpc("erp_link_me");
            check(await supabase.from("cs_ticket_notes").insert({ ticket_id: ticketId, author_id: me, body }));
        },

        async csReturn(payload) {
            check(await supabase.rpc("erp_cs_return", { p: payload }));
        },

        /* ---------- Marketing ---------- */

        async listVouchers() {
            return check(await supabase.from("vouchers").select("*").order("created_at", { ascending: false })) || [];
        },

        async saveVoucher(values) {
            const { id, used: _used, ...rest } = values;
            if (id) check(await supabase.from("vouchers").update(rest).eq("id", id));
            else {
                const { data: me } = await supabase.rpc("erp_link_me");
                check(await supabase.from("vouchers").insert({ ...rest, created_by: me }));
            }
        },

        async listRedemptions() {
            return check(await supabase.from("voucher_redemptions").select("*").order("created_at", { ascending: false }).limit(2000)) || [];
        },

        async checkVoucher(code, subtotal) {
            return check(await supabase.rpc("erp_check_voucher", { p_code: code, p_subtotal: subtotal }));
        },

        /* ---------- CRM ---------- */

        async listCustomers() {
            const rows = check(await supabase.rpc("erp_customers")) || [];
            return rows.map((row) => ({
                ...row,
                phone_key: row.phone,
                total_spent: Number(row.total_spent) || 0,
                paid_count: row.orders_count,
            }));
        },

        async saveCrmProfile(phone, { tags, note, marketing_consent: consent }) {
            check(await supabase.rpc("erp_crm_save", { p_phone: phone, p_tags: tags || [], p_note: note || "", p_consent: Boolean(consent) }));
        },
    };
}
