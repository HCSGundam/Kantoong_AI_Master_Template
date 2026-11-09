/**
 * KANTOONG — MULTI BAHASA (seluruh web: toko, dashboard user, ERP, kasir)
 * File: frontend/js/i18n.js   (dimuat otomatis lewat theme.js)
 *
 * Cara kerja:
 *  - Web ditulis dalam Bahasa Indonesia. Kunjungan pertama = popup "Pilih bahasa".
 *  - Bila memilih bahasa lain, SEMUA teks di layar (termasuk tulisan admin:
 *    nama produk, banner, kebijakan) diterjemahkan AI lewat backend
 *    POST /api/translate (kunci AI tetap di server, tidak di frontend).
 *  - Hasil disimpan di perangkat (kantoong:i18n:<bahasa>) → kunjungan
 *    berikutnya langsung tampil tanpa menunggu & tanpa biaya.
 *  - Tidak diterjemahkan: harga/angka, email, link, kode, nama brand,
 *    isi kotak ketik, pesan yang DIKETIK pengguna di chat, dan elemen
 *    bertanda translate="no" / .notranslate / [data-no-translate].
 *  - Jawaban AI chat langsung ditulis dalam bahasa pilihan (lang dikirim
 *    ke /api/chat).
 *
 * Bagian murni (diekspor) dites di test/i18n.test.js.
 */

import CFG from "../client-config.js";
import "../css/i18n.css";

export const LANG_KEY = "kantoong:lang";
export const CACHE_PREFIX = "kantoong:i18n:";
export const SOURCE_LANG = "id";
export const LANGUAGES = Object.freeze([
    { id: "id", label: "Bahasa Indonesia", native: "Indonesia", hello: "Halo" },
    { id: "en", label: "English", native: "English", hello: "Hello" },
    { id: "zh", label: "中文 (简体)", native: "中文", hello: "你好" },
    { id: "ja", label: "日本語", native: "日本語", hello: "こんにちは" },
    { id: "ko", label: "한국어", native: "한국어", hello: "안녕하세요" },
    { id: "ms", label: "Bahasa Melayu", native: "Melayu", hello: "Helo" },
    { id: "ar", label: "العربية", native: "العربية", hello: "مرحبا", rtl: true },
]);
const VALID = new Set(LANGUAGES.map((l) => l.id));
const CACHE_MAX = 4000;
const BATCH_COUNT = 80;
const BATCH_CHARS = 8000;
const TEXT_MAX = 400;

/* ============================================================
   BAGIAN MURNI (dites)
   ============================================================ */

export const sanitizeLang = (value) => (VALID.has(String(value ?? "")) ? String(value) : null);

/** Tebak bahasa dari pengaturan HP/laptop (hanya untuk tanda "Disarankan"). */
export function guessLang(languages = []) {
    for (const raw of languages) {
        const base = String(raw ?? "").toLowerCase().split("-")[0];
        if (base === "in") return "id";
        if (VALID.has(base)) return base;
    }
    return SOURCE_LANG;
}

/** Layak diterjemahkan? (harga, angka, kode, email, link, emoji saja = tidak) */
export function shouldTranslate(text) {
    const t = String(text ?? "").trim();
    if (t.length < 2 || t.length > TEXT_MAX) return false;
    if (!/\p{L}{2,}/u.test(t)) return false; // minimal satu kata
    if (/^(Rp|IDR|USD|\$)\s?[\d.,]+(\s?(rb|jt|M))?$/i.test(t)) return false;
    if (/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(t)) return false;
    if (/^(https?:\/\/|www\.)\S+$/i.test(t)) return false;
    if (/^[A-Z0-9][A-Z0-9-]{2,}$/.test(t) && /\d/.test(t)) return false; // kode barang / voucher
    return true;
}

/** Pecah daftar teks menjadi paket kecil (batas jumlah & panjang). */
export function splitBatches(texts, { maxCount = BATCH_COUNT, maxChars = BATCH_CHARS } = {}) {
    const batches = [];
    let current = [];
    let size = 0;
    texts.forEach((t) => {
        if (current.length && (current.length >= maxCount || size + t.length > maxChars)) {
            batches.push(current);
            current = [];
            size = 0;
        }
        current.push(t);
        size += t.length;
    });
    if (current.length) batches.push(current);
    return batches;
}

/**
 * Pecah teks di tanda pemisah (" · ", " | ", " • ", " — "): tiap bagian diterjemahkan
 * sendiri, pemisahnya dipertahankan. [{ raw, text, translate }]
 */
export function splitSegments(text) {
    return String(text ?? "")
        .split(/(\s[·|•—]\s)/)
        .filter((raw) => raw !== "")
        .map((raw, i, all) => {
            const isSep = /^\s[·|•—]\s$/.test(raw);
            return { raw, text: raw.trim(), translate: !isSep && shouldTranslate(raw) && all.length > 0 };
        });
}

/** Tempel ulang spasi depan/belakang asli ke hasil terjemahan. */
export function keepSpacing(original, translated) {
    const lead = String(original).match(/^\s*/)[0];
    const trail = String(original).match(/\s*$/)[0];
    return `${lead}${String(translated).trim()}${trail}`;
}

/** Batasi cache: buang entri tertua bila lebih dari batas. */
export function trimCache(obj, max = CACHE_MAX) {
    const keys = Object.keys(obj ?? {});
    if (keys.length <= max) return obj;
    const out = {};
    keys.slice(keys.length - max).forEach((k) => (out[k] = obj[k]));
    return out;
}

/* ============================================================
   PILIHAN BAHASA
   ============================================================ */

function readStore(key) {
    try {
        return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
        return null;
    }
}

function writeStore(key, value) {
    try {
        if (value == null) globalThis.localStorage?.removeItem(key);
        else globalThis.localStorage?.setItem(key, value);
    } catch {
        /* penyimpanan diblokir */
    }
}

/** Bahasa aktif (null = pengunjung belum memilih). */
export const getLang = () => sanitizeLang(readStore(LANG_KEY));
export const activeLang = () => getLang() ?? SOURCE_LANG;

export function setLang(id) {
    const lang = sanitizeLang(id) ?? SOURCE_LANG;
    const before = activeLang();
    writeStore(LANG_KEY, lang);
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("kantoong:lang", { detail: { lang } }));
    // Kembali ke Indonesia / ganti bahasa: muat ulang agar teks asli bersih.
    if (before !== lang) window.location.reload();
}

/* ============================================================
   PENERJEMAH HALAMAN (DOM)
   ============================================================ */

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA", "SVG", "CANVAS", "IFRAME", "KBD", "SAMP"]);
const SKIP_SELECTOR = '[translate="no"], .notranslate, [data-no-translate], [contenteditable="true"], .ai-message--user';
const ATTRS = ["placeholder", "title", "aria-label", "alt"];

function endpoint() {
    const chat = String(CFG?.ai_endpoint || "/api/chat");
    return chat.replace(/\/chat\/?$/, "/translate");
}

function createTranslator(lang) {
    const cacheKey = `${CACHE_PREFIX}${lang}`;
    let cache = {};
    try {
        cache = JSON.parse(readStore(cacheKey) || "{}") || {};
    } catch {
        cache = {};
    }
    const outputs = new Set(Object.values(cache));
    const waiting = new Map(); // teks -> [{node, attr}]
    const keep = [CFG?.app_name, CFG?.brand?.name].filter(Boolean).map(String);
    let timer = 0;
    let saveTimer = 0;
    let busy = false;
    let pausedUntil = 0;
    let warned = false;

    const skip = (el) => !el || SKIP_TAGS.has(el.tagName) || Boolean(el.closest?.(SKIP_SELECTOR));

    function apply(target, text) {
        const translated = cache[text];
        if (translated == null) return false;
        if (target.attr) target.node.setAttribute(target.attr, translated);
        else target.node.nodeValue = keepSpacing(target.node.nodeValue, translated);
        return true;
    }

    // Teks berpemisah ("Tukar & retur · Miloat") dipecah per bagian agar tanda pemisah utuh.
    const composites = new Map(); // teks utuh -> [target]

    function resolveComposite(text) {
        const parts = splitSegments(text);
        const ready = parts.every((p) => !p.translate || cache[p.text] != null);
        if (!ready) return false;
        const out = parts.map((p) => (p.translate ? keepSpacing(p.raw, cache[p.text]) : p.raw)).join("");
        cache[text] = out;
        outputs.add(out);
        (composites.get(text) ?? []).forEach((target) => {
            if (target.node.isConnected) apply(target, text);
        });
        composites.delete(text);
        return true;
    }

    function consider(target, raw) {
        const text = String(raw ?? "").trim();
        if (!shouldTranslate(text) || outputs.has(text)) return;
        if (apply(target, text)) return;
        const parts = splitSegments(text);
        if (parts.length > 1) {
            if (!composites.has(text)) composites.set(text, []);
            composites.get(text).push(target);
            if (resolveComposite(text)) return;
            parts.filter((p) => p.translate && cache[p.text] == null).forEach((p) => {
                if (!waiting.has(p.text)) waiting.set(p.text, []);
            });
            return;
        }
        if (!waiting.has(text)) waiting.set(text, []);
        waiting.get(text).push(target);
    }

    function scan(root) {
        if (!root) return;
        if (root.nodeType === Node.TEXT_NODE) {
            if (!skip(root.parentElement)) consider({ node: root }, root.nodeValue);
            return;
        }
        if (root.nodeType !== Node.ELEMENT_NODE) return;
        // Kotak ketik: isinya milik pengguna (tidak diterjemahkan), tapi placeholder-nya ya.
        const attrOnly = (el) => !el.closest?.(SKIP_SELECTOR) && !/^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName);
        if (skip(root)) {
            if (attrOnly(root)) ATTRS.forEach((attr) => root.hasAttribute(attr) && consider({ node: root, attr }, root.getAttribute(attr)));
            schedule();
            return;
        }
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: (n) => (skip(n.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
        });
        for (let n = walker.nextNode(); n; n = walker.nextNode()) consider({ node: n }, n.nodeValue);
        const els = [root, ...root.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(","))];
        els.forEach((el) => {
            if (!attrOnly(el)) return;
            ATTRS.forEach((attr) => {
                if (el.hasAttribute?.(attr)) consider({ node: el, attr }, el.getAttribute(attr));
            });
            if (el.tagName === "INPUT" && /^(button|submit)$/i.test(el.type) && el.value) consider({ node: el, attr: "value" }, el.value);
        });
        schedule();
    }

    function save() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            cache = trimCache(cache);
            writeStore(cacheKey, JSON.stringify(cache));
        }, 400);
    }

    function warnOnce() {
        if (warned) return;
        warned = true;
        const note = document.createElement("div");
        note.className = "kc-lang-note";
        note.setAttribute("role", "status");
        note.textContent = "Translation is not available right now. Showing Indonesian.";
        document.body.appendChild(note);
        setTimeout(() => note.remove(), 4200);
    }

    async function sendBatch(batch) {
        const res = await fetch(endpoint(), {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ lang, texts: batch, keep }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list = Array.isArray(data?.translations) ? data.translations : [];
        batch.forEach((text, i) => {
            const out = typeof list[i] === "string" && list[i].trim() ? list[i].trim() : text;
            cache[text] = out;
            outputs.add(out);
            (waiting.get(text) ?? []).forEach((target) => {
                if (target.node.isConnected) apply(target, text);
            });
            waiting.delete(text);
        });
        [...composites.keys()].forEach(resolveComposite);
        save();
    }

    async function flush() {
        if (busy || !waiting.size || Date.now() < pausedUntil) return;
        busy = true;
        // Paket besar & sedikit: kuota AI gratis dihitung per permintaan, bukan per kata.
        const queue = splitBatches([...waiting.keys()]);
        try {
            const worker = async () => {
                while (queue.length) await sendBatch(queue.shift());
            };
            await Promise.all([worker(), worker()]);
        } catch (error) {
            // Server mati / kuota habis: coba lagi 30 detik kemudian, halaman tetap jalan.
            pausedUntil = Date.now() + 30000;
            setTimeout(schedule, 30500);
            console.info("[KANTOONG] Terjemahan tertunda:", error?.message || error);
            warnOnce();
        } finally {
            busy = false;
            if (waiting.size && Date.now() >= pausedUntil) schedule();
        }
    }

    function schedule() {
        clearTimeout(timer);
        timer = setTimeout(flush, 120);
    }

    function start() {
        scan(document.body);
        const observer = new MutationObserver((records) => {
            records.forEach((r) => {
                if (r.type === "characterData") scan(r.target);
                else if (r.type === "attributes") scan(r.target);
                else r.addedNodes.forEach((n) => scan(n));
            });
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
        // Judul tab ikut diterjemahkan (juga saat halaman menggantinya belakangan).
        const titleEl = document.querySelector("title");
        const doTitle = () => {
            const node = titleEl?.firstChild;
            if (!node) return;
            consider({ node }, node.nodeValue);
            schedule();
        };
        doTitle();
        if (titleEl) new MutationObserver(doTitle).observe(titleEl, { childList: true, characterData: true, subtree: true });
    }

    return { start };
}

/* ============================================================
   POPUP PILIH BAHASA
   ============================================================ */

function el(tag, className, ...children) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    children.flat().forEach((child) => {
        if (child == null || child === false) return;
        node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return node;
}

/** Popup pilih bahasa. firstVisit = sapaan pertama (tanpa tombol tutup "batal"). */
export function openLanguagePicker({ firstVisit = false } = {}) {
    if (document.querySelector(".kc-lang")) return;
    const current = activeLang();
    const suggested = guessLang(navigator.languages ?? [navigator.language]);
    const root = el("div", "kc-lang notranslate");
    root.setAttribute("translate", "no");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Pilih bahasa / Choose language");

    const close = () => {
        root.classList.remove("is-open");
        document.removeEventListener("keydown", onKey);
        setTimeout(() => root.remove(), 260);
    };
    const choose = (id) => {
        if (firstVisit && id === SOURCE_LANG) {
            writeStore(LANG_KEY, id);
            close();
            return;
        }
        setLang(id);
        close();
    };
    const onKey = (event) => {
        if (event.key === "Escape") choose(current);
    };

    const list = el("div", "kc-lang__list", LANGUAGES.map((l) => {
        const b = el("button", `kc-lang__item${l.id === current ? " is-on" : ""}`,
            el("span", "kc-lang__hello", l.hello),
            el("span", "kc-lang__name", l.label),
            l.id === suggested && l.id !== current ? el("span", "kc-lang__tag", "✦") : null,
            l.id === current ? el("span", "kc-lang__check", "✓") : null);
        b.type = "button";
        b.lang = l.id;
        if (l.rtl) b.dir = "rtl";
        b.addEventListener("click", () => choose(l.id));
        return b;
    }));

    const x = el("button", "kc-lang__close", "×");
    x.type = "button";
    x.setAttribute("aria-label", "Tutup / Close");
    x.addEventListener("click", () => choose(current));

    root.append(el("div", "kc-lang__panel",
        el("div", "kc-lang__grab"),
        el("header", "kc-lang__head",
            el("div", "",
                el("p", "kc-lang__eyebrow", "Bahasa · Language · 语言"),
                el("h2", "kc-lang__title", firstVisit ? "Mau pakai bahasa apa?" : "Pilih bahasa"),
                el("p", "kc-lang__sub", "Choose your language. Semua teks di web ikut diterjemahkan.")),
            x),
        list,
        el("p", "kc-lang__foot", "Bisa diganti kapan saja di Pengaturan › Tampilan.")));
    root.addEventListener("click", (event) => {
        if (event.target === root) choose(current);
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(root);
    requestAnimationFrame(() => root.classList.add("is-open"));
    list.querySelector(".is-on")?.focus({ preventScroll: true });
}

/* ============================================================
   MULAI OTOMATIS
   ============================================================ */

function boot() {
    const lang = activeLang();
    const info = LANGUAGES.find((l) => l.id === lang);
    document.documentElement.lang = lang;
    if (info?.rtl) document.documentElement.dir = "rtl";
    if (lang !== SOURCE_LANG) createTranslator(lang).start();

    // Kunjungan pertama: tanya bahasa (hanya di jendela utama, bukan di dalam iframe).
    const top = (() => {
        try {
            return window.top === window;
        } catch {
            return false;
        }
    })();
    if (top && getLang() === null) setTimeout(() => openLanguagePicker({ firstVisit: true }), 900);

    // Bahasa diganti di tab/iframe lain → ikut.
    window.addEventListener("storage", (event) => {
        if (event.key === LANG_KEY && sanitizeLang(event.newValue) !== lang) window.location.reload();
    });
    window.kantoongLanguage = { open: openLanguagePicker, get: activeLang, set: setLang };

    // Tombol bahasa di mana pun: [data-kc-lang-open] membuka popup, [data-kc-lang-code] = kode aktif.
    document.querySelectorAll("[data-kc-lang-code]").forEach((n) => (n.textContent = lang.toUpperCase()));
    document.addEventListener("click", (event) => {
        if (event.target.closest?.("[data-kc-lang-open]")) openLanguagePicker();
    });
}

if (typeof window !== "undefined" && typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
    if (document.body) boot();
    else document.addEventListener("DOMContentLoaded", boot, { once: true });
}
