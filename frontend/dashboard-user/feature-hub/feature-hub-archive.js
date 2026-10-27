/**
 * KANTOONG CORE — FEATURE HUB: ARCHIVE
 * File: frontend/dashboard-user/feature-hub/feature-hub-archive.js
 *
 * Menambahkan fitur ke dashboard dan mengarsipkannya kembali ke Hub.
 * Fitur yang diarsipkan tidak dihapus: ia muncul lagi di Feature Hub.
 *
 * `api` disediakan oleh dashboard-user.js (lihat hubApi).
 */

import { canAddFeature } from "./feature-hub-publisher.js";

export function addFeature(api, featureId) {
    const feature = api.getFeature(featureId);

    if (!feature) {
        return false;
    }

    if (!canAddFeature(feature)) {
        api.announce("Fitur ini belum dapat ditambahkan.");
        return false;
    }

    if (api.isActive(featureId)) {
        return false;
    }

    api.activate(featureId);

    api.record({
        type: "feature-added",
        title: `Menambahkan ${feature.title}`,
        featureId,
    });

    api.announce(`${feature.title} berhasil ditambahkan.`);

    return true;
}

export function archiveFeature(api, featureId) {
    const feature = api.getFeature(featureId);

    if (!feature || !api.isActive(featureId)) {
        return false;
    }

    api.deactivate(featureId);

    api.record({
        type: "feature-archived",
        title: `Mengarsipkan ${feature.title}`,
        featureId,
    });

    api.announce(`${feature.title} diarsipkan.`);

    return true;
}
