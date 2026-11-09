/**
 * KANTOONG — PERSONALISASI TAMPILAN (gaya One UI)
 * File: frontend/js/personalize.js
 *
 * - Font: 50 pilihan Google Fonts untuk SELURUH web (toko, dashboard, ERP, kasir).
 * - Warna kotak chat konsultasi: ikut tema / hitam / putih.
 * Disimpan HANYA di browser pengguna ini (localStorage). Pengguna lain tetap
 * melihat bawaan (Poppins) atau pilihan mereka sendiri. Diterapkan otomatis
 * oleh js/theme.js di semua halaman, dan langsung berlaku di tab lain.
 */

export const PERSONAL_KEY = "kantoong:personal";

/** [nama, kelompok, ketebalan yang tersedia] */
export const FONTS = Object.freeze([
    ["Poppins", "Modern", "400;500;600;700"],
    ["Inter", "Modern", "400;500;600;700"],
    ["Plus Jakarta Sans", "Modern", "400;500;600;700"],
    ["Manrope", "Modern", "400;500;600;700"],
    ["DM Sans", "Modern", "400;500;600;700"],
    ["Outfit", "Modern", "400;500;600;700"],
    ["Urbanist", "Modern", "400;500;600;700"],
    ["Sora", "Modern", "400;500;600;700"],
    ["Lexend", "Modern", "400;500;600;700"],
    ["Figtree", "Modern", "400;500;600;700"],
    ["Onest", "Modern", "400;500;600;700"],
    ["Montserrat", "Modern", "400;500;600;700"],
    ["Raleway", "Modern", "400;500;600;700"],
    ["Work Sans", "Modern", "400;500;600;700"],
    ["Rubik", "Modern", "400;500;600;700"],
    ["Karla", "Modern", "400;500;600;700"],
    ["Mulish", "Modern", "400;500;600;700"],
    ["Space Grotesk", "Modern", "400;500;600;700"],
    ["IBM Plex Sans", "Modern", "400;500;600;700"],
    ["Source Sans 3", "Modern", "400;500;600;700"],
    ["Lato", "Klasik", "400;700"],
    ["Open Sans", "Klasik", "400;500;600;700"],
    ["Roboto", "Klasik", "400;500;700"],
    ["Noto Sans", "Klasik", "400;500;600;700"],
    ["Heebo", "Klasik", "400;500;600;700"],
    ["Barlow", "Klasik", "400;500;600;700"],
    ["Archivo", "Klasik", "400;500;600;700"],
    ["Hanken Grotesk", "Klasik", "400;500;600;700"],
    ["Albert Sans", "Klasik", "400;500;600;700"],
    ["Red Hat Display", "Klasik", "400;500;600;700"],
    ["Be Vietnam Pro", "Klasik", "400;500;600;700"],
    ["Kanit", "Klasik", "400;500;600;700"],
    ["Prompt", "Klasik", "400;500;600;700"],
    ["Nunito", "Bulat", "400;500;600;700"],
    ["Nunito Sans", "Bulat", "400;500;600;700"],
    ["Quicksand", "Bulat", "400;500;600;700"],
    ["Comfortaa", "Bulat", "400;500;600;700"],
    ["Varela Round", "Bulat", "400"],
    ["Josefin Sans", "Bulat", "400;500;600;700"],
    ["Playfair Display", "Elegan", "400;500;600;700"],
    ["Cormorant Garamond", "Elegan", "400;500;600;700"],
    ["Lora", "Elegan", "400;500;600;700"],
    ["Libre Baskerville", "Elegan", "400;700"],
    ["Merriweather", "Elegan", "400;700"],
    ["Fraunces", "Elegan", "400;500;600;700"],
    ["EB Garamond", "Elegan", "400;500;600;700"],
    ["DM Serif Display", "Elegan", "400"],
    ["Caveat", "Tulisan tangan", "400;500;600;700"],
    ["Dancing Script", "Tulisan tangan", "400;500;600;700"],
    ["Space Mono", "Mesin ketik", "400;700"],
].map(([name, group, weights]) => Object.freeze({ name, group, weights })));

export const DEFAULT_FONT = "Poppins";
export const CHAT_SKINS = Object.freeze([
    { id: "auto", label: "Ikuti tema" },
    { id: "dark", label: "Hitam" },
    { id: "light", label: "Putih" },
]);

export function sanitizePersonal(raw) {
    const font = FONTS.some((f) => f.name === raw?.font) ? raw.font : DEFAULT_FONT;
    const chatSkin = CHAT_SKINS.some((s) => s.id === raw?.chatSkin) ? raw.chatSkin : "auto";
    return { font, chatSkin };
}

export function readPersonal() {
    try {
        return sanitizePersonal(JSON.parse(localStorage.getItem(PERSONAL_KEY) || "null"));
    } catch {
        return sanitizePersonal(null);
    }
}

export function fontCss(font) {
    const entry = FONTS.find((f) => f.name === font) ?? FONTS[0];
    return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(entry.name).replace(/%20/g, "+")}:wght@${entry.weights}&display=swap`;
}

/** URL pratinjau semua font, hanya huruf yang dipakai contoh (sangat kecil). */
export function previewCss(text = "Aa Selamat sore, Kak 123") {
    const families = FONTS.map((f) => `family=${encodeURIComponent(f.name).replace(/%20/g, "+")}`).join("&");
    return `https://fonts.googleapis.com/css2?${families}&text=${encodeURIComponent(text)}&display=swap`;
}

function ensureLink(id, href) {
    let link = document.getElementById(id);
    if (!link) {
        link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        document.head.appendChild(link);
    }
    if (link.getAttribute("href") !== href) link.setAttribute("href", href);
}

export function applyPersonal(prefs = readPersonal()) {
    const root = document.documentElement;
    if (prefs.font && prefs.font !== DEFAULT_FONT) {
        ensureLink("kcUserFont", fontCss(prefs.font));
        root.style.setProperty("--kc-user-font", `"${prefs.font}", system-ui, -apple-system, "Segoe UI", sans-serif`);
        root.dataset.userFont = prefs.font;
    } else {
        document.getElementById("kcUserFont")?.remove();
        root.style.removeProperty("--kc-user-font");
        delete root.dataset.userFont;
    }
    if (prefs.chatSkin && prefs.chatSkin !== "auto") root.dataset.chatSkin = prefs.chatSkin;
    else delete root.dataset.chatSkin;
}

export function savePersonal(patch) {
    const next = sanitizePersonal({ ...readPersonal(), ...patch });
    try {
        localStorage.setItem(PERSONAL_KEY, JSON.stringify(next));
    } catch {
        /* diblokir: tetap berlaku di halaman ini */
    }
    applyPersonal(next);
    window.dispatchEvent(new CustomEvent("kantoong:personal-changed", { detail: next }));
    return next;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
    applyPersonal();
    window.addEventListener("storage", (event) => {
        if (event.key === PERSONAL_KEY) applyPersonal();
    });
}
