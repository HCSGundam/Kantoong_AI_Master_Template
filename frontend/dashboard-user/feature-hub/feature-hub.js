/**
 * KANTOONG CORE — FEATURE HUB: PUSAT KENDALI
 * File: frontend/dashboard-user/feature-hub/feature-hub.js
 *
 * Menyatukan katalog, kontrak klien, tampilan, tambah/arsip, dan publish.
 * Tidak mengimpor dashboard-user.js: semua akses ke dashboard melalui
 * `api` yang disuntikkan, agar modul ini mudah diuji dan dipindahkan.
 *
 * api yang dibutuhkan:
 *   getFeatures, getFeature, isActive, getElements,
 *   activate, deactivate, updateFeature, announce, record
 */

import { CLIENT_CONTRACT } from "./feature-hub-catalog.js";
import { addFeature, archiveFeature } from "./feature-hub-archive.js";
import { filterByContract } from "./feature-hub-permissions.js";
import {
    canAddFeature,
    markComingSoon,
    publishFeature,
} from "./feature-hub-publisher.js";
import { getCategoryMeta, renderHubView } from "./feature-hub-view.js";

function normalize(value) {
    return String(value ?? "").trim().toLowerCase();
}

export function createFeatureHub({ api, contract = CLIENT_CONTRACT }) {
    const hubState = {
        filter: "all",
        query: "",
    };

    /** Fitur yang boleh tampil sekarang: sesuai kontrak, belum di dashboard. */
    function getVisibleFeatures() {
        const query = normalize(hubState.query);

        const list = filterByContract(api.getFeatures(), contract)
            .filter((feature) => !api.isActive(feature.id))
            .filter((feature) => {
                if (hubState.filter === "published") {
                    return canAddFeature(feature);
                }

                if (hubState.filter === "coming-soon") {
                    return !canAddFeature(feature);
                }

                return true;
            })
            .filter((feature) => {
                if (!query) {
                    return true;
                }

                const text = [
                    feature.title,
                    feature.description,
                    getCategoryMeta(feature.category).label,
                    ...(feature.keywords ?? []),
                ]
                    .join(" ")
                    .toLowerCase();

                return text.includes(query);
            });

        // Yang bisa ditambahkan tampil lebih dulu, lalu urutan katalog.
        return list.sort((a, b) => {
            const stateA = canAddFeature(a) ? 0 : 1;
            const stateB = canAddFeature(b) ? 0 : 1;

            if (stateA !== stateB) {
                return stateA - stateB;
            }

            return (a.order ?? 999) - (b.order ?? 999);
        });
    }

    /** Beberapa fitur yang bisa ditambahkan (untuk pratinjau kartu). */
    function getSuggestedFeatures(limit = 4) {
        return filterByContract(api.getFeatures(), contract)
            .filter((feature) => !api.isActive(feature.id))
            .sort((a, b) => {
                const stateA = canAddFeature(a) ? 0 : 1;
                const stateB = canAddFeature(b) ? 0 : 1;

                if (stateA !== stateB) {
                    return stateA - stateB;
                }

                return (a.order ?? 999) - (b.order ?? 999);
            })
            .slice(0, limit);
    }

    function render(query = hubState.query) {
        hubState.query = normalize(query);

        const elements = api.getElements();

        if (!elements?.featureHubCategories) {
            return;
        }

        renderHubView({
            elements,
            features: getVisibleFeatures(),
            filter: hubState.filter,
        });
    }

    function open() {
        const elements = api.getElements();
        const dialog = elements?.featureHubDialog;

        if (!dialog) {
            return false;
        }

        render(elements.featureHubSearch?.value ?? "");

        if (!dialog.open) {
            if (typeof dialog.showModal === "function") {
                dialog.showModal();
            } else {
                dialog.setAttribute("open", "");
            }
        }

        api.record({
            type: "feature-hub-open",
            title: "Feature Hub",
        });

        return true;
    }

    function close() {
        const dialog = api.getElements()?.featureHubDialog;

        if (!dialog) {
            return;
        }

        if (typeof dialog.close === "function" && dialog.open) {
            dialog.close();
        } else {
            dialog.removeAttribute("open");
        }
    }

    function setFilter(filterId) {
        hubState.filter = filterId;
        render();
    }

    function add(featureId) {
        const done = addFeature(api, featureId);

        if (done) {
            render();
        }

        return done;
    }

    function archive(featureId) {
        const done = archiveFeature(api, featureId);

        if (done) {
            render();
        }

        return done;
    }

    function publish(featureId) {
        const done = publishFeature(api, featureId);

        if (done) {
            render();
        }

        return done;
    }

    function comingSoon(featureId) {
        const done = markComingSoon(api, featureId);

        if (done) {
            render();
        }

        return done;
    }

    return {
        render,
        open,
        close,
        add,
        archive,
        publish,
        comingSoon,
        setFilter,
        getVisibleFeatures,
        getSuggestedFeatures,
    };
}
