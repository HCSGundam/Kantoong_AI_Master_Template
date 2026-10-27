/**
 * KANTOONG CORE — FEATURE HUB: PUBLISHER
 * File: frontend/dashboard-user/feature-hub/feature-hub-publisher.js
 *
 * Siklus hidup tampilan fitur:
 *   Coming soon (gelap, tidak bisa diklik)
 *        -> Rilis (bisa ditambahkan)  + tag NEW selama NEW_TAG_DAYS hari
 */

import { NEW_TAG_DAYS } from "./feature-hub-catalog.js";

export const FEATURE_STATUS = Object.freeze({
    COMING_SOON: "coming-soon",
    PUBLISHED: "published",
});

const DAY_MS = 24 * 60 * 60 * 1000;

export function isPublished(feature) {
    return feature?.status === FEATURE_STATUS.PUBLISHED;
}

export function isComingSoon(feature) {
    return !isPublished(feature);
}

export function canAddFeature(feature) {
    return Boolean(
        feature &&
        feature.available !== false &&
        isPublished(feature)
    );
}

export function isNewFeature(feature, now = Date.now()) {
    if (!isPublished(feature) || !feature.publishedAt) {
        return false;
    }

    const publishedAt = Date.parse(feature.publishedAt);

    if (!Number.isFinite(publishedAt)) {
        return false;
    }

    const age = now - publishedAt;

    return age >= 0 && age <= NEW_TAG_DAYS * DAY_MS;
}

/** "coming-soon" | "new" | null */
export function getFeatureBadge(feature, now = Date.now()) {
    if (isComingSoon(feature)) {
        return FEATURE_STATUS.COMING_SOON;
    }

    return isNewFeature(feature, now) ? "new" : null;
}

/**
 * Tampilan sementara untuk fitur yang sudah dirilis tetapi belum
 * punya layar sendiri (mis. saat demo publish dari konsol).
 */
export function createPlaceholderMount(feature) {
    return {
        mount({ element }) {
            const box = document.createElement("section");
            box.className = "dashboard-feature-placeholder";

            const title = document.createElement("h2");
            title.textContent = feature.title;

            const description = document.createElement("p");
            description.textContent = feature.description;

            const note = document.createElement("p");
            note.className = "dashboard-feature-placeholder__note";
            note.textContent =
                "Fitur ini sudah dirilis. Tampilan lengkapnya sedang disiapkan.";

            box.append(title, description, note);
            element.replaceChildren(box);
        },

        unmount({ element }) {
            element.replaceChildren();
        },
    };
}

/**
 * Merilis fitur saat aplikasi berjalan (untuk demo realtime).
 * Perubahan ini tidak disimpan; rilis permanen = membuat
 * features/<id>/feature.js.
 */
export function publishFeature(api, featureId, now = new Date()) {
    const feature = api.getFeature(featureId);

    if (!feature || isPublished(feature)) {
        return false;
    }

    const patch = {
        status: FEATURE_STATUS.PUBLISHED,
        publishedAt: now.toISOString(),
    };

    if (!feature.mount && !feature.onOpen) {
        Object.assign(patch, createPlaceholderMount(feature));
    }

    api.updateFeature(featureId, patch);
    api.announce(`${feature.title} sekarang tersedia.`);

    return true;
}

/** Mengembalikan fitur ke Coming soon (demo). */
export function markComingSoon(api, featureId) {
    const feature = api.getFeature(featureId);

    if (!feature || isComingSoon(feature)) {
        return false;
    }

    if (api.isActive(featureId)) {
        api.deactivate(featureId);
    }

    api.updateFeature(featureId, {
        status: FEATURE_STATUS.COMING_SOON,
        publishedAt: "",
    });

    api.announce(`${feature.title} kembali menjadi Coming soon.`);

    return true;
}
