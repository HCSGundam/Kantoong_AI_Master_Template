/**
 * KANTOONG ERP — SUMBER DATA DEMO FASE 4 (AI Research & Second Brain)
 * File: frontend/erp/data/demo-adapter-phase4.js
 *
 * Aturan akses sama dengan erp-phase4.sql: HANYA owner (level 5) yang
 * bisa membaca aktivitas AI (Second Brain).
 */

import CFG from "../../client-config.js";
import { withinDays } from "../core/research.js";
import { demoAiSession } from "./demo-seed-phase4.js";
import { ADDON_ID, viewFor } from "../core/analysis.js";

const clone = (value) => JSON.parse(JSON.stringify(value));

export function phase4Methods({ db: getDb, save, me }) {
    const seesResearch = () => me().level >= 5;

    return {
        async listAiEvents({ days = 30 } = {}) {
            if (!seesResearch()) return [];
            return clone(withinDays(getDb().ai_events || [], days));
        },

        /** Add-on yang dibeli brand. Demo/template: Anachronos Analysis aktif untuk presentasi. */
        async listAddons() {
            // Template/demo: semua add-on menyala untuk presentasi (Analysis + Agen AI).
            if (CFG.erp_demo === true) return [ADDON_ID, "ai-agents"];
            return [...(CFG.addons ?? [])];
        },

        /** Data Anachronos Analysis — hanya divisi yang berhadapan dengan pembeli + owner/manajer. */
        async analysisData({ days = 30 } = {}) {
            if (!viewFor(me())) return { events: [], lost: [], orders: [] };
            const db = getDb();
            return {
                events: clone(withinDays(db.ai_events || [], days)),
                lost: clone(db.pos_lost || []),
                orders: clone(db.orders || []),
            };
        },

        /** Kuota add-on berjumlah (mis. jumlah Agen AI tambahan). Demo: 4. */
        async addonQuota(addon) {
            return CFG.erp_demo === true ? 4 : Number(CFG.addon_quota?.[addon]) || 0;
        },

        async researchBrands() {
            return [{ id: CFG.business_id, name: CFG.app_name || "Toko" }];
        },

        /**
         * Mode demo saja: satu tamu fiktif baru "datang" ke toko, agar
         * Second Brain terlihat hidup saat dipresentasikan.
         */
        async demoAiTick() {
            if (!seesResearch()) return [];
            const db = getDb();
            const sessionKey = `s-live${Math.random().toString(36).slice(2, 8)}`;
            const events = demoAiSession(Math.random, (db.products || []).slice(0, 8), { at: new Date(), sessionKey })
                .map((event) => ({ ...event, at: new Date().toISOString() }));
            db.ai_events = [...(db.ai_events || []), ...events].slice(-2500);
            save();
            return clone(events);
        },
    };
}
