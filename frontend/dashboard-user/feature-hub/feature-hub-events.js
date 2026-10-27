/**
 * KANTOONG CORE — FEATURE HUB: EVENTS
 * File: frontend/dashboard-user/feature-hub/feature-hub-events.js
 *
 * Event yang khusus milik Feature Hub (chip filter).
 * Tombol buka/tutup, cari, dan tambah masih ditangani oleh
 * dashboard-user-events.js dan memanggil fungsi hub yang sama.
 */

export function bindFeatureHubEvents({ hub, getElements }) {
    const dialog = getElements()?.featureHubDialog;

    if (!dialog) {
        return () => {};
    }

    const controller = new AbortController();

    dialog.addEventListener(
        "click",
        (event) => {
            const chip = event.target.closest("[data-hub-filter]");

            if (!chip || !dialog.contains(chip)) {
                return;
            }

            hub.setFilter(chip.dataset.hubFilter);
        },
        { signal: controller.signal }
    );

    return () => controller.abort();
}
