/**
 * KANTOONG ERP — SUMBER DATA SUPABASE FASE 4 (AI Research & Second Brain)
 * File: frontend/erp/data/supabase-adapter-phase4.js
 *
 * Membaca ai_events (erp-phase4.sql). RLS hanya mengizinkan OWNER;
 * peran lain otomatis mendapat daftar kosong.
 */

import CFG from "../../client-config.js";
import { supabase } from "../../js/supabase-client.js";

export function phase4SupabaseMethods() {
    return {
        async listAiEvents({ days = 30 } = {}) {
            const since = new Date(Date.now() - days * 86400000).toISOString();
            const { data, error } = await supabase
                .from("ai_events")
                .select("at, business_id, session_key, kind, product_id, product_name, keywords, surface")
                .gte("at", since)
                .order("at", { ascending: false })
                .limit(5000);

            // Tabel belum dibuat (erp-phase4.sql belum dijalankan): tampil kosong.
            if (error) {
                if (error.code === "42P01" || error.code === "PGRST205") return [];
                throw error;
            }
            return data || [];
        },

        async researchBrands() {
            return [{ id: CFG.business_id, name: CFG.app_name || "Toko" }];
        },
    };
}
