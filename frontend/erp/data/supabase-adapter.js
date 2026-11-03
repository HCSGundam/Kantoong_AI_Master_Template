/**
 * KANTOONG ERP — SUMBER DATA SUPABASE (MODE ASLI)
 * File: frontend/erp/data/supabase-adapter.js
 *
 * Bentuknya sama dengan demo-adapter.js. Penguncian data dilakukan
 * oleh RLS di database (db/erp-foundation.sql); kode ini tidak
 * pernah memakai kunci rahasia (service role).
 */

import { supabase } from "../../js/supabase-client.js";
import { unitPath } from "../core/org.js";
import { phase2SupabaseMethods } from "./supabase-adapter-phase2.js";
import { createProduct, deleteProduct, setPublication, updateProduct, uploadProductImage } from "./product-service.js";

const MEMBER_FIELDS =
    "id, user_id, email, full_name, org_unit_id, position_title, level, job_role, manager_id, modules, sales_slug, is_active, created_at";

const ORDER_FIELDS =
    "id, order_code, status, total, created_at, sales_member_id, storefront_slug, customer_name, city";

function check({ data, error }) {
    if (error) throw error;
    return data;
}

export function createSupabaseAdapter() {
    let unitsCache = [];

    const withUnitName = (member) => ({
        ...member,
        unit_name: unitPath(unitsCache, member.org_unit_id) || "",
    });

    const refreshUnits = async () => {
        unitsCache = check(await supabase.from("org_units").select("*")) || [];
        return unitsCache;
    };

    return {
        mode: "supabase",
        ...phase2SupabaseMethods(),

        async getSession() {
            const { data } = await supabase.auth.getUser();
            const user = data?.user;
            if (!user) return { status: "signed-out" };

            const linked = await supabase.rpc("erp_link_me");
            if (linked.error) {
                if (/erp_link_me|function/i.test(linked.error.message || "")) {
                    return { status: "not-installed", user };
                }
                throw linked.error;
            }

            const memberId = linked.data;
            if (!memberId) return { status: "no-member", user };

            await refreshUnits();
            const member = check(
                await supabase.from("members").select(MEMBER_FIELDS).eq("id", memberId).maybeSingle()
            );

            if (!member || !member.is_active) return { status: "no-member", user };
            return { status: "member", user, member: withUnitName(member) };
        },

        async signOut() {
            await supabase.auth.signOut();
        },

        /* ---------- Organisasi ---------- */

        async listUnits() {
            return refreshUnits();
        },

        async saveUnit(unit) {
            const { id, ...values } = unit;
            if (id) check(await supabase.from("org_units").update(values).eq("id", id));
            else check(await supabase.from("org_units").insert(values));
        },

        async deleteUnit(unitId) {
            check(await supabase.from("org_units").delete().eq("id", unitId));
        },

        async listMembers() {
            await refreshUnits();
            const members = check(await supabase.from("members").select(MEMBER_FIELDS).order("full_name")) || [];
            return members.map(withUnitName);
        },

        async saveMember(member) {
            const { id, unit_name: _ignored, ...values } = member;
            const saved = id
                ? check(await supabase.from("members").update(values).eq("id", id).select(MEMBER_FIELDS).single())
                : check(await supabase.from("members").insert(values).select(MEMBER_FIELDS).single());

            // Sales otomatis punya toko.
            if (saved.job_role === "sales" && saved.sales_slug) {
                const existing = check(
                    await supabase.from("storefronts").select("member_id").eq("member_id", saved.id).maybeSingle()
                );
                if (!existing) {
                    check(await supabase.from("storefronts").insert({
                        member_id: saved.id,
                        slug: saved.sales_slug,
                        display_name: `Toko ${saved.full_name.split(" ")[0]}`,
                    }));
                }
            }

            return saved;
        },

        /* ---------- Target, komisi, gaji ---------- */

        async getTargets() {
            return check(await supabase.from("member_targets").select("*")) || [];
        },

        async saveTarget(memberId, values) {
            check(await supabase.from("member_targets").upsert({
                member_id: memberId,
                ...values,
                updated_at: new Date().toISOString(),
            }));
        },

        async getSalary(memberId) {
            return check(
                await supabase.from("member_salary").select("*").eq("member_id", memberId).maybeSingle()
            );
        },

        async saveSalary(memberId, baseSalary) {
            check(await supabase.from("member_salary").upsert({
                member_id: memberId,
                base_salary: Math.max(0, Number(baseSalary) || 0),
                updated_at: new Date().toISOString(),
            }));
        },

        /* ---------- Pesanan & peringkat ---------- */

        async listOrders({ since } = {}) {
            let query = supabase.from("orders").select(ORDER_FIELDS).order("created_at", { ascending: false }).limit(5000);
            if (since) query = query.gte("created_at", new Date(since).toISOString());
            return check(await query) || [];
        },

        async leaderboard(period) {
            return check(await supabase.rpc("erp_leaderboard", { p_period: period })) || [];
        },

        subscribeOrders(callback) {
            const channel = supabase
                .channel("erp-orders")
                .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => callback())
                .subscribe();

            return () => supabase.removeChannel(channel);
        },

        /* ---------- Persetujuan & audit ---------- */

        async listApprovals() {
            return check(
                await supabase.from("approvals").select("*").order("created_at", { ascending: false }).limit(200)
            ) || [];
        },

        async createApproval(values) {
            const { data } = await supabase.rpc("erp_link_me");
            check(await supabase.from("approvals").insert({ ...values, requester_id: data }));
        },

        async decideApproval(approvalId, status, note) {
            check(await supabase.from("approvals").update({
                status,
                decision_note: note || null,
                decided_at: new Date().toISOString(),
            }).eq("id", approvalId));
        },

        async listAudit() {
            return check(
                await supabase.from("audit_log").select("*").order("at", { ascending: false }).limit(200)
            ) || [];
        },

        /* ---------- Katalog master ---------- */

        async listProducts() {
            return check(await supabase.from("products").select("*").order("name")) || [];
        },

        /* Editor produk lengkap (dulu di dashboard admin lama). */
        async saveProduct(existing, input) {
            const payload = {
                ...input,
                existing_keys: Object.keys(existing || {}),
                had_hero_image: Boolean(existing?.hero_image_url),
            };
            return existing?.id ? updateProduct(existing.id, payload) : createProduct(payload);
        },

        async deleteProduct(productId) {
            await deleteProduct(productId);
        },

        async setPublication(productId, changes) {
            return setPublication(productId, changes);
        },

        async uploadImage(file) {
            return uploadProductImage(file);
        },

        async saveProductCodes(productId, values) {
            check(await supabase.from("products").update(values).eq("id", productId));
        },

        /* ---------- Toko per sales ---------- */

        async getStorefront(memberId) {
            return check(await supabase.from("storefronts").select("*").eq("member_id", memberId).maybeSingle());
        },

        async saveStorefront(memberId, values) {
            check(await supabase.from("storefronts").update({
                ...values,
                updated_at: new Date().toISOString(),
            }).eq("member_id", memberId));
        },

        async listStoreProducts(memberId) {
            return check(await supabase.from("storefront_products").select("*").eq("member_id", memberId)) || [];
        },

        async saveStoreProducts(memberId, items) {
            check(await supabase.from("storefront_products").delete().eq("member_id", memberId));
            if (items.length) {
                check(await supabase.from("storefront_products").insert(
                    items.map((item, index) => ({
                        member_id: memberId,
                        product_id: String(item.product_id),
                        custom_image_url: item.custom_image_url || null,
                        sort: index,
                    }))
                ));
            }
        },
    };
}
