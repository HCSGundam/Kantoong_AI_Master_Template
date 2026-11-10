/**
 * KANTOONG — IZIN AI MEMBACA AKTIVITAS DASHBOARD (UU PDP 27/2022)
 * File: frontend/js/ai-consent.js
 *
 * Pilihan Koko: (a) DITANYA SEKALI di awal, dengan sakelar jelas.
 *  - "granted" : AI boleh membaca ringkasan fitur dashboard (pesanan, wishlist,
 *                kalender, dll.) untuk menjawab & menampilkan Sinyal pribadi.
 *  - "denied"  : AI hanya tahu apa yang diketik di chat. Sinyal mati.
 *  - null      : belum ditanya.
 * Hanya di perangkat ini. Bisa diubah kapan saja di Pengaturan › Privasi & Izin AI.
 */

export const CONSENT_KEY = "kantoong:ai-activity-consent";
const VALID = new Set(["granted", "denied"]);

export function sanitizeConsent(raw) {
    if (!raw || typeof raw !== "object" || !VALID.has(raw.status)) return null;
    const at = Number.isFinite(Date.parse(raw.at)) ? new Date(raw.at).toISOString() : null;
    return { status: raw.status, at };
}

export function getConsent(storage = globalThis.localStorage) {
    try {
        return sanitizeConsent(JSON.parse(storage?.getItem(CONSENT_KEY) || "null"));
    } catch {
        return null;
    }
}

export const consentGranted = (storage) => getConsent(storage)?.status === "granted";

export function setConsent(status, storage = globalThis.localStorage) {
    const value = VALID.has(status) ? { status, at: new Date().toISOString() } : null;
    try {
        if (value) storage?.setItem(CONSENT_KEY, JSON.stringify(value));
        else storage?.removeItem(CONSENT_KEY);
    } catch {
        /* penyimpanan diblokir */
    }
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("kantoong:ai-consent", { detail: value }));
    return value;
}

export function consentLabel(consent = getConsent()) {
    if (!consent) return "Belum diatur";
    return consent.status === "granted" ? "AI boleh membaca aktivitas" : "AI hanya membaca chat";
}

/** Lembar tanya-sekali. host = elemen tempat lembar dipasang. */
export function askConsent({ host = document.body, onDone } = {}) {
    if (document.querySelector(".kc-aiperm")) return;
    const root = document.createElement("div");
    root.className = "kc-aiperm";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "kcAipermTitle");
    root.innerHTML = `
        <div class="kc-aiperm__panel">
            <span class="kc-aiperm__orb" aria-hidden="true"><i></i><i></i></span>
            <p class="kc-aiperm__eyebrow">Privasi · UU PDP</p>
            <h2 class="kc-aiperm__title" id="kcAipermTitle">Boleh asisten AI baca aktivitasmu di sini?</h2>
            <ul class="kc-aiperm__list">
                <li><b>Yang dibaca:</b> ringkasan pesanan, wishlist, keranjang, kalender, voucher & poinmu di toko ini.</li>
                <li><b>Buat apa:</b> jawab "paketku sampai mana?" tanpa kamu jelasin ulang, plus kasih saran "Kayaknya kamu butuh ini".</li>
                <li><b>Nggak akan pernah:</b> dibagikan ke brand lain tanpa izin terpisah, atau dipakai buat iklan di luar web ini.</li>
            </ul>
            <div class="kc-aiperm__actions">
                <button type="button" class="kc-aiperm__btn kc-aiperm__btn--ghost" data-choice="denied">Nanti dulu</button>
                <button type="button" class="kc-aiperm__btn" data-choice="granted">Boleh, gas ✨</button>
            </div>
            <p class="kc-aiperm__foot">Bisa diubah kapan saja di Pengaturan › Privasi &amp; Izin AI.</p>
        </div>`;
    root.addEventListener("click", (event) => {
        const choice = event.target.closest("[data-choice]")?.dataset.choice;
        if (!choice) return;
        setConsent(choice);
        root.classList.remove("is-open");
        setTimeout(() => root.remove(), 260);
        onDone?.(choice);
    });
    host.appendChild(root);
    requestAnimationFrame(() => root.classList.add("is-open"));
    root.querySelector('[data-choice="granted"]')?.focus({ preventScroll: true });
}
