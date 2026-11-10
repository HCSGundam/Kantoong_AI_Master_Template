/**
 * KANTOONG ERP — SUMBER DATA SUPABASE: DOKUMEN & AGEN AI
 * File: frontend/erp/data/supabase-adapter-docs.js
 * Bentuk sama dengan demo-adapter-docs.js. Akses ditegakkan db/erp-docs.sql.
 */

import { supabase } from "../../js/supabase-client.js";

function check({ data, error }) {
    if (error) throw error;
    return data;
}

const missing = (error) => ["42P01", "PGRST205", "42883", "PGRST202", "PGRST116"].includes(error?.code);

export function docsSupabaseMethods() {
    return {
        async getDocSettings() {
            const { data, error } = await supabase.from("erp_doc_settings").select("*").eq("id", 1).maybeSingle();
            if (error && !missing(error)) throw error;
            return data || {};
        },

        async saveDocSettings(values) {
            check(await supabase.from("erp_doc_settings").update({
                signer_name: values.signer_name || null,
                signer_title: values.signer_title || null,
                city: values.city || null,
                address: values.address || null,
                phone: values.phone || null,
                email: values.email || null,
                signature: values.signature || null,
                updated_at: new Date().toISOString(),
            }).eq("id", 1));
        },

        async listDocuments() {
            const { data, error } = await supabase.from("erp_documents").select("*").order("created_at", { ascending: false }).limit(500);
            if (error) {
                if (missing(error)) return [];
                throw error;
            }
            return data || [];
        },

        async createDocument({ model, hash, recipient_id = null, sign = false }) {
            const id = check(await supabase.rpc("erp_create_document", {
                p: {
                    kind: model.kind, number: model.number, title: model.title,
                    party: model.summary?.party || model.to?.name || "", amount: model.summary?.amount ?? "",
                    issued_on: model.date, hash, model, recipient_id: recipient_id || "",
                },
                p_sign: Boolean(sign),
            }));
            return check(await supabase.from("erp_documents").select("*").eq("id", id).single());
        },

        async revokeDocument(id, reason = "") {
            check(await supabase.rpc("erp_revoke_document", { p_id: id, p_reason: reason || null }));
        },

        async verifyDocument(id, code) {
            const { data, error } = await supabase.rpc("erp_verify_document", { p_id: id, p_code: code });
            if (error) return { found: false };
            return data;
        },

        async getAgentSettings() {
            const { data, error } = await supabase.from("ai_agent_settings").select("mode, agents").maybeSingle();
            if (error && !missing(error)) throw error;
            return data || null;
        },

        async saveAgentSettings({ mode, agents }) {
            const { data: me } = await supabase.rpc("erp_link_me");
            check(await supabase.from("ai_agent_settings").upsert({ member_id: me, mode, agents, updated_at: new Date().toISOString() }));
        },

        async listAgentTasks() {
            const { data, error } = await supabase.from("ai_agent_tasks").select("*").order("created_at", { ascending: false }).limit(200);
            if (error) {
                if (missing(error)) return [];
                throw error;
            }
            return data || [];
        },

        async saveAgentTask(task) {
            const { data: me } = await supabase.rpc("erp_link_me");
            const row = { ...task, member_id: me };
            check(await supabase.from("ai_agent_tasks").upsert(row));
            return row;
        },
    };
}
