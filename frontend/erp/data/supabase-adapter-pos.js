/**
 * KANTOONG ERP — SUMBER DATA SUPABASE KASIR POS PRO (Tahap 1)
 * File: frontend/erp/data/supabase-adapter-pos.js
 *
 * Tabel & fungsi dari db/erp-pos-pro.sql. Harga, pajak, service, stok &
 * jurnal dihitung di database (erp_pos_checkout_v2), bukan di browser.
 * Bila SQL belum dijalankan: kasir tetap tampil (pengaturan bawaan),
 * dan saat menyimpan muncul pesan yang jelas.
 */

import { supabase } from "../../js/supabase-client.js";
import { posSettings } from "../core/pos-pro.js";
import { cleanPromo, validatePromo } from "../core/promo.js";
import { memberProfile } from "../core/loyalty.js";

const NOT_INSTALLED = "Fitur kasir Pro belum dipasang di database. Jalankan db/erp-pos-pro.sql di Supabase (SQL Editor).";

const missing = (error) => ["42P01", "PGRST205", "PGRST202", "42883"].includes(error?.code)
    || /does not exist|could not find the (table|function)/i.test(error?.message || "");

function check({ data, error }) {
    if (error) {
        if (missing(error)) throw new Error(NOT_INSTALLED);
        throw error;
    }
    return data;
}

/** Baca: tabel belum ada = kosong (halaman tetap jalan). */
function soft({ data, error }, fallback) {
    if (error) {
        if (missing(error)) return fallback;
        throw error;
    }
    return data ?? fallback;
}

export function posProSupabaseMethods() {
    return {
        async getPosSettings(outletId) {
            const row = soft(await supabase.from("pos_settings").select("settings").eq("outlet_id", outletId).maybeSingle(), null);
            return posSettings(row?.settings);
        },

        async savePosSettings(outletId, values) {
            const settings = posSettings(values);
            check(await supabase.rpc("erp_pos_save_settings", { p_outlet: outletId, p_settings: settings }));
            return settings;
        },

        async listPosModifiers() {
            return soft(await supabase.from("pos_modifier_groups").select("*").order("sort"), []);
        },

        async savePosModifier(group) {
            const { id, ...values } = group;
            if (id) check(await supabase.from("pos_modifier_groups").update(values).eq("id", id));
            else check(await supabase.from("pos_modifier_groups").insert(values));
        },

        async deletePosModifier(groupId) {
            check(await supabase.from("pos_modifier_groups").delete().eq("id", groupId));
        },

        async listOpenBills(outletId) {
            return soft(await supabase.from("pos_open_bills").select("*").eq("outlet_id", outletId).order("updated_at"), []);
        },

        async saveOpenBill(bill) {
            const values = {
                outlet_id: bill.outlet_id,
                channel: bill.channel,
                table_no: String(bill.table_no || "").trim(),
                customer_name: String(bill.customer_name || "").trim(),
                discount: Math.max(0, Math.round(Number(bill.discount) || 0)),
                lines: bill.lines,
                queue_no: String(bill.queue_no || ""),
                sent: bill.sent || {},
                member_id: bill.member_id || null,
                updated_at: new Date().toISOString(),
            };
            if (!values.table_no && !values.customer_name) throw new Error("Isi nomor meja atau nama pemesan dulu.");
            const query = bill.id
                ? supabase.from("pos_open_bills").update(values).eq("id", bill.id).select().single()
                : supabase.from("pos_open_bills").insert(values).select().single();
            return check(await query);
        },

        async deleteOpenBill(billId) {
            check(await supabase.from("pos_open_bills").delete().eq("id", billId));
        },

        /* ---------- Tahap 2: nomor antrian, dapur & bar, penjualan hilang ---------- */

        async nextQueueNo(outletId) {
            return check(await supabase.rpc("erp_pos_next_queue", { p_outlet: outletId }));
        },

        /** tickets = [{ station, items }] (dipecah di kasir dengan splitTickets). */
        async sendToKitchen({ outlet_id, queue_no, label, channel, ref = null, tickets = [] }) {
            return check(await supabase.rpc("erp_kitchen_send", {
                p: { outlet_id, queue_no, label, channel, ref, tickets },
            })) || [];
        },

        async listKitchenTickets({ outletId, days = 7 } = {}) {
            const since = new Date(Date.now() - days * 86400000).toISOString();
            return soft(await supabase.from("pos_tickets").select("*")
                .eq("outlet_id", outletId).gte("created_at", since).order("created_at").limit(800), []);
        },

        async setTicketStatus(ticketId, status) {
            return check(await supabase.rpc("erp_kitchen_status", { p_ticket: ticketId, p_status: status }));
        },

        async kitchenInterest({ hours = 2 } = {}) {
            return soft(await supabase.rpc("erp_kitchen_interest", { p_hours: hours }), []);
        },

        async recordLostSale(entry) {
            return check(await supabase.from("pos_lost_sales").insert({
                outlet_id: entry.outlet_id, product_id: String(entry.product_id || ""), name: String(entry.name || "").slice(0, 80),
                qty: Math.max(1, Math.round(Number(entry.qty) || 1)), value: Math.max(0, Math.round(Number(entry.value) || 0)),
                reason: entry.reason,
            }).select().single());
        },

        async listLostSales({ outletId, since } = {}) {
            let query = supabase.from("pos_lost_sales").select("*").order("created_at", { ascending: false }).limit(2000);
            if (outletId) query = query.eq("outlet_id", outletId);
            if (since) query = query.gte("created_at", new Date(since).toISOString());
            return soft(await query, []);
        },

        /* ---------- Tahap 3: shift, kas, void ber-PIN (semua lewat fungsi database) ---------- */

        async getMyShift(outletId) {
            return soft(await supabase.rpc("erp_pos_my_shift", { p_outlet: outletId }), null) || null;
        },

        async openShift({ outlet_id, opening_cash }) {
            return check(await supabase.rpc("erp_pos_open_shift", { p_outlet: outlet_id, p_opening: Math.round(Number(opening_cash) || 0) }));
        },

        async addCashMove({ shift_id, kind, amount, reason }) {
            return check(await supabase.rpc("erp_pos_cash_move", {
                p_shift: shift_id, p_kind: kind, p_amount: Math.round(Number(amount) || 0), p_reason: String(reason || ""),
            }));
        },

        async listCashMoves({ shiftIds = [] } = {}) {
            if (!shiftIds.length) return [];
            return soft(await supabase.from("pos_cash_moves").select("*").in("shift_id", shiftIds).order("created_at"), []);
        },

        async closeShift({ shift_id, counted_cash, note = "" }) {
            return check(await supabase.rpc("erp_pos_close_shift", {
                p_shift: shift_id, p_counted: Math.round(Number(counted_cash) || 0), p_note: String(note || ""),
            }));
        },

        async listShifts({ outletId, days = 30 } = {}) {
            const since = new Date(Date.now() - days * 86400000).toISOString();
            let query = supabase.from("pos_shifts").select("*").gte("opened_at", since).order("opened_at", { ascending: false });
            if (outletId) query = query.eq("outlet_id", outletId);
            return soft(await query, []);
        },

        async voidSale({ sale_id, reason, note = "", pin }) {
            return check(await supabase.rpc("erp_pos_void", { p_sale: sale_id, p_reason: reason, p_note: String(note || ""), p_pin: String(pin || "") }));
        },

        async hasMyPin() {
            return Boolean(soft(await supabase.rpc("erp_pos_has_pin"), false));
        },

        async setMyPin(pin) {
            check(await supabase.rpc("erp_pos_set_pin", { p_pin: String(pin || "") }));
        },

        /* ---------- Tahap 4: member, poin & promo ---------- */

        async findMembers(query) {
            if (String(query || "").trim().length < 3) return [];
            return soft(await supabase.rpc("erp_pos_member_find", { p_query: String(query).trim() }), []);
        },

        /** Kartu member: data aman + riwayat (hanya bila member mengizinkan) -> Kasir yang Ingat. */
        async getMemberCard(memberId) {
            const card = check(await supabase.rpc("erp_pos_member_card", { p_member: memberId }));
            const member = card?.member;
            if (!member) throw new Error("Member tidak ditemukan.");
            return { member, profile: member.consent_history ? memberProfile(member, (card.sales || []).map((sale) => ({ ...sale, member_id: member.id }))) : null };
        },

        async saveMember(values) {
            return check(await supabase.rpc("erp_pos_member_save", { p: values }));
        },

        async forgetMember(memberId) {
            check(await supabase.rpc("erp_pos_member_forget", { p_member: memberId }));
        },

        async listPosMembers() {
            return soft(await supabase.rpc("erp_pos_members"), []);
        },

        async listPointsLedger() {
            return soft(await supabase.from("pos_points").select("*").order("created_at").limit(5000), []);
        },

        async listMemberSales() {
            return soft(await supabase.rpc("erp_pos_member_sales"), []);
        },

        async listPromos() {
            return soft(await supabase.from("pos_promos").select("*").order("created_at"), []);
        },

        async savePromo(promo) {
            const problem = validatePromo(promo);
            if (problem) throw new Error(problem);
            const { id, created_at, created_by, ...values } = cleanPromo(promo);
            if (id) check(await supabase.from("pos_promos").update(values).eq("id", id));
            else check(await supabase.from("pos_promos").insert(values));
        },

        async deletePromo(promoId) {
            check(await supabase.from("pos_promos").delete().eq("id", promoId));
        },

        /* ---------- Tahap 5: bahan baku, resep & HPP ---------- */

        async listIngredients(outletId) {
            return soft(await supabase.rpc("erp_pos_ingredients", { p_outlet: outletId }), []);
        },

        async saveIngredient(values) {
            const row = {
                name: String(values.name || "").trim().slice(0, 60),
                unit: ["gram", "ml", "pcs"].includes(values.unit) ? values.unit : "gram",
                cost: Math.max(0, Number(values.cost) || 0),
                min_stock: Math.max(0, Number(values.min_stock) || 0),
                is_active: values.is_active !== false,
            };
            if (!row.name) throw new Error("Isi nama bahan.");
            if (values.id) check(await supabase.from("pos_ingredients").update(row).eq("id", values.id));
            else check(await supabase.from("pos_ingredients").insert(row));
        },

        async getRecipes() {
            const [base, options] = await Promise.all([
                supabase.from("pos_recipes").select("product_id, items"),
                supabase.from("pos_option_recipes").select("option_key, items"),
            ]);
            return {
                recipes: Object.fromEntries(soft(base, []).map((row) => [row.product_id, row.items])),
                optionRecipes: Object.fromEntries(soft(options, []).map((row) => [row.option_key, row.items])),
            };
        },

        async saveRecipe(productId, items) {
            if (items.length) check(await supabase.from("pos_recipes").upsert({ product_id: String(productId), items }));
            else check(await supabase.from("pos_recipes").delete().eq("product_id", String(productId)));
        },

        async saveOptionRecipe(key, items) {
            if (items.length) check(await supabase.from("pos_option_recipes").upsert({ option_key: key, items }));
            else check(await supabase.from("pos_option_recipes").delete().eq("option_key", key));
        },

        async ingredientMove(values) {
            return check(await supabase.rpc("erp_ingredient_move", { p: values }));
        },

        async listIngredientMoves({ outletId, days = 30 } = {}) {
            const since = new Date(Date.now() - days * 86400000).toISOString();
            let query = supabase.from("pos_ingredient_moves").select("*").gte("created_at", since).order("created_at").limit(4000);
            if (outletId) query = query.eq("outlet_id", outletId);
            return soft(await query, []);
        },

        /* ---------- Permintaan restok ---------- */

        async requestRestock(values) {
            return check(await supabase.rpc("erp_pos_request_restock", { p: values }));
        },

        async listRestockRequests({ outletId, includeDone = false } = {}) {
            let query = supabase.from("pos_restock_requests").select("*").order("last_at", { ascending: false }).limit(200);
            if (outletId) query = query.eq("outlet_id", outletId);
            if (!includeDone) query = query.eq("status", "baru");
            return soft(await query, []);
        },

        async resolveRestock(id, note = "") {
            check(await supabase.rpc("erp_pos_resolve_restock", { p_id: id, p_note: String(note || "") }));
        },

        /* ---------- Tahap 6: rating pelanggan ---------- */

        async rateSale(saleId, score) {
            check(await supabase.rpc("erp_pos_rate_sale", { p_sale: saleId, p_score: Number(score) }));
        },

        async listRatings({ since } = {}) {
            let query = supabase.from("pos_sale_ratings").select("*").order("created_at").limit(5000);
            if (since) query = query.gte("created_at", new Date(since).toISOString());
            return soft(await query, []);
        },

        async posCheckoutPro(payload) {
            const sale = check(await supabase.rpc("erp_pos_checkout_v2", { p: payload }));
            return { ...sale, created_at: sale.created_at || new Date().toISOString(), outlet_id: payload.outlet_id };
        },
    };
}
