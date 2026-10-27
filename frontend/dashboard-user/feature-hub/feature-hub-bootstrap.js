/**
 * KANTOONG CORE — FEATURE HUB: BOOTSTRAP
 * File: frontend/dashboard-user/feature-hub/feature-hub-bootstrap.js
 *
 * - mergeWithHubCatalog: menggabungkan fitur yang DITEMUKAN (ada
 *   folder + feature.js) dengan rencana fitur di katalog. Fitur
 *   yang belum dibuat otomatis menjadi "Coming soon".
 * - initFeatureHub: memasang event hub dan alat demo (mode dev).
 */

import { HUB_FEATURES } from "./feature-hub-catalog.js";
import { bindFeatureHubEvents } from "./feature-hub-events.js";
import { FEATURE_STATUS } from "./feature-hub-publisher.js";

export function mergeWithHubCatalog(discovered = []) {
    const plannedById = new Map(
        HUB_FEATURES.map((planned, index) => [
            planned.id,
            { ...planned, order: 100 + index * 10 },
        ])
    );

    const discoveredIds = new Set();
    const merged = [];

    // 1. Fitur yang sudah ada: data katalog sebagai cadangan,
    //    data dari feature.js diutamakan.
    for (const feature of discovered) {
        discoveredIds.add(feature.id);

        const planned = plannedById.get(feature.id);

        merged.push(planned ? { ...planned, ...feature } : feature);
    }

    // 2. Fitur yang belum dibuat: Coming soon.
    for (const [id, planned] of plannedById) {
        if (discoveredIds.has(id)) {
            continue;
        }

        merged.push({
            ...planned,
            status: FEATURE_STATUS.COMING_SOON,
            defaultActive: false,
            available: true,
        });
    }

    return merged;
}

export function initFeatureHub({ hub, getElements }) {
    const unbind = bindFeatureHubEvents({ hub, getElements });

    // Alat demo: hanya ada saat `npm run dev`, tidak di build produksi.
    //   KantoongHub.publish("wishlist")     -> Coming soon jadi rilis + NEW
    //   KantoongHub.comingSoon("wishlist")  -> kembali ke Coming soon
    let devTools = null;

    if (import.meta.env?.DEV) {
        devTools = {
            publish: (id) => hub.publish(id),
            comingSoon: (id) => hub.comingSoon(id),
            list: () =>
                hub
                    .getVisibleFeatures()
                    .map((feature) => `${feature.id} (${feature.status})`),
        };

        window.KantoongHub = devTools;

        try {
            // Dashboard berjalan di iframe: pasang juga di jendela utama
            // agar bisa dipanggil dari Console biasa.
            if (window.top && window.top !== window) {
                window.top.KantoongHub = devTools;
            }
        } catch {
            // Lintas origin: abaikan.
        }
    }

    return {
        destroy() {
            unbind();

            if (devTools && window.KantoongHub === devTools) {
                delete window.KantoongHub;
            }
        },
    };
}
