/**
 * KANTOONG CORE — FEATURE SYSTEM: UI
 * File: frontend/dashboard-user/feature-system/feature-ui.js
 *
 * Komponen tampilan yang dipakai bersama oleh kartu fitur.
 * Teks dipasang lewat textContent (anti-XSS).
 */

function span(className, text) {
    const node = document.createElement("span");

    node.className = className;

    if (text !== undefined) {
        node.textContent = text;
    }

    return node;
}

/**
 * Kotak ringkasan di dalam kartu (mis. "Paket dalam perjalanan").
 *
 * @param {object} data
 * @param {string} data.title       judul singkat
 * @param {string} [data.text]      keterangan satu-dua baris
 * @param {number} [data.progress]  0..1 untuk bilah kemajuan (opsional)
 */
export function createSummaryBox({ title, text, progress } = {}) {
    const box = span("kc-summary");

    box.append(span("kc-summary__title", title ?? ""));

    if (text) {
        box.append(span("kc-summary__text", text));
    }

    if (Number.isFinite(progress)) {
        const track = span("kc-summary__progress");
        const bar = span("kc-summary__progress-bar");

        bar.style.width = `${Math.round(
            Math.min(1, Math.max(0, progress)) * 100
        )}%`;

        track.append(bar);
        box.append(track);
    }

    return box;
}
