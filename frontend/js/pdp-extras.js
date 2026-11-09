/**
 * KANTOONG — TAMBAHAN HALAMAN PRODUK (tampilan)
 * File: frontend/js/pdp-extras.js
 *
 *  - Harga Jujur: grafik harga 30 hari + kalimat jujur (js/honest-price.js)
 *  - Cocok & Kurang Cocok + Jejak Asal (js/product-story.js)
 *  - Bandingkan & Ruang Ragu (js/doubt-room.js)
 *
 * Mesin hitungnya murni & dites; file ini hanya menggambar.
 * engine.js memberi "ctx" berisi pembantu (nama, foto, harga, buka produk).
 */

import CFG from "../client-config.js";
import { supabase } from "./supabase-client.js";
import { chartPath, groupHistory, honestPrice } from "./honest-price.js";
import { hasStory, ORIGIN_FIELDS } from "./product-story.js";
import { compareProducts, detectDoubt, dismissDoubt, dismissedPairs, recordView } from "./doubt-room.js";

const BID = CFG?.business_id ?? "master_template_001";

function el(tag, className, ...children) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    children.flat().forEach((child) => {
        if (child == null || child === false) return;
        node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return node;
}

function button(className, label, ...children) {
    const b = el("button", className, ...children);
    b.type = "button";
    if (label) b.setAttribute("aria-label", label);
    return b;
}

const SVG_NS = "http://www.w3.org/2000/svg";
function svgIcon(paths, size = 16) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    paths.forEach((d) => {
        const p = document.createElementNS(SVG_NS, "path");
        p.setAttribute("d", d);
        svg.append(p);
    });
    return svg;
}

const ICON = {
    shield: ["M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z", "M9 12l2 2 4-4"],
    check: ["M5 12l4 4 10-10"],
    cross: ["M6 6l12 12", "M18 6L6 18"],
    leaf: ["M5 19c0-8 6-14 15-14 0 9-6 15-14 15", "M5 19l7-7"],
    compare: ["M8 4v16", "M16 4v16", "M4 8h4", "M16 16h4"],
    close: ["M6 6l12 12", "M18 6L6 18"],
};

/* ============================================================
   HARGA JUJUR
   ============================================================ */

let historyMap = null; // null = belum/tidak tersedia → tampilan lama
const honestCache = new Map();

export async function loadPriceHistory() {
    try {
        let q = supabase.from("product_price_history").select("product_id, price, compare_at_price, changed_at");
        if (CFG?.filter_by_business_id === true) q = q.eq("business_id", BID);
        const { data, error } = await q.order("changed_at", { ascending: true }).limit(5000);
        if (error) throw error;
        historyMap = groupHistory(data);
    } catch (error) {
        historyMap = null;
        console.info("[KANTOONG] Riwayat harga belum tersedia:", error?.message || error);
    }
    honestCache.clear();
    return historyMap;
}

/** Hasil Harga Jujur untuk satu produk (dicache per id + harga). */
export function honestFor(product, price) {
    const id = String(product?.id ?? "");
    const compareAt = Number(product?.compare_at_price ?? product?.original_price) || 0;
    const key = `${id}|${price}|${compareAt}`;
    if (!honestCache.has(key)) {
        // Produk demo / tanpa id database: tidak dinilai.
        const history = historyMap ? historyMap.get(id) ?? [] : null;
        honestCache.set(key, honestPrice({ price, compareAt, history: id && !id.startsWith("demo") ? history : null }));
    }
    return honestCache.get(key);
}

export function createHonestPrice(product, price, money) {
    const info = honestFor(product, price);
    if (info.strike === null || !info.points.length) return null;

    const box = el("section", "pdp-honest");
    box.append(el("div", "pdp-honest__head",
        el("span", "pdp-honest__badge", svgIcon(ICON.shield, 14), "Harga Jujur"),
        el("span", "pdp-honest__range", info.low === info.high ? money(info.low) : `${money(info.low)} – ${money(info.high)}`)));

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 280 64");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("class", "pdp-honest__chart");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `Grafik harga 30 hari. ${info.verdict}`);
    const line = document.createElementNS(SVG_NS, "path");
    line.setAttribute("d", chartPath(info.points));
    line.setAttribute("vector-effect", "non-scaling-stroke");
    svg.append(line);
    box.append(svg,
        el("div", "pdp-honest__axis", el("span", "", "30 hari lalu"), el("span", "", "Hari ini")),
        el("p", "pdp-honest__verdict", info.verdict));
    return box;
}

/* ============================================================
   COCOK / KURANG COCOK + JEJAK ASAL
   ============================================================ */

export function createFitCard(product) {
    const story = product?.story;
    if (!story?.fit?.length && !story?.notFit?.length) return null;
    const col = (title, list, kind) => list?.length
        ? el("div", `pdp-fit__col pdp-fit__col--${kind}`,
            el("p", "pdp-fit__title", title),
            el("ul", "pdp-fit__list", list.map((t) => el("li", "", svgIcon(kind === "yes" ? ICON.check : ICON.cross, 14), t))))
        : null;
    return el("section", "pdp-fit",
        el("p", "pdp-fit__eyebrow", "Jujur soal kecocokan"),
        el("div", "pdp-fit__cols",
            col("Cocok untuk", story.fit, "yes"),
            col("Kurang cocok untuk", story.notFit, "no")));
}

export function createOriginCard(product) {
    const origin = product?.story?.origin;
    if (!origin) return null;
    const rows = ORIGIN_FIELDS.filter((f) => f.key !== "note" && origin[f.key])
        .map((f) => el("div", "pdp-origin__row", el("dt", "", f.label), el("dd", "", origin[f.key])));
    return el("section", "pdp-origin",
        el("div", "pdp-origin__head", el("span", "pdp-origin__icon", svgIcon(ICON.leaf, 18)),
            el("div", "", el("p", "pdp-origin__eyebrow", "Jejak Asal"), el("h3", "pdp-origin__title", "Dari mana produk ini datang"))),
        rows.length ? el("dl", "pdp-origin__list", rows) : null,
        origin.note ? el("p", "pdp-origin__note", `“${origin.note}”`) : null);
}

export { hasStory };

/* ============================================================
   BANDINGKAN & RUANG RAGU
   ============================================================ */

let sheet = null;
let lastFocus = null;

function closeSheet() {
    if (!sheet) return;
    const node = sheet;
    sheet = null;
    node.classList.remove("is-open");
    document.removeEventListener("keydown", onKey);
    setTimeout(() => node.remove(), 260);
    lastFocus?.focus?.({ preventScroll: true });
}

function onKey(event) {
    if (event.key === "Escape") closeSheet();
}

function openSheet(title, content, className = "") {
    closeSheet();
    lastFocus = document.activeElement;
    const close = button("kc-compare__close", "Tutup", svgIcon(ICON.close, 18));
    close.addEventListener("click", closeSheet);
    const panel = el("div", `kc-compare__panel ${className}`,
        el("div", "kc-compare__grab"),
        el("header", "kc-compare__head", el("h2", "kc-compare__title", title), close),
        content);
    sheet = el("div", "kc-compare", panel);
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-label", title);
    sheet.addEventListener("click", (e) => {
        if (e.target === sheet) closeSheet();
    });
    document.addEventListener("keydown", onKey);
    (document.querySelector("#appRoot") || document.body).append(sheet);
    requestAnimationFrame(() => sheet?.classList.add("is-open"));
    close.focus({ preventScroll: true });
}

function thumb(ctx, product) {
    const box = el("span", "kc-compare__img");
    const src = ctx.imageOf(product);
    if (ctx.isSafeImage(src)) {
        const img = document.createElement("img");
        img.src = src;
        img.alt = "";
        img.loading = "lazy";
        box.append(img);
    }
    return box;
}

/** Perbandingan berdampingan: hanya perbedaan yang penting. */
export function openCompare(ctx, a, b) {
    const result = compareProducts(a, b, { industry: ctx.industry, nameOf: ctx.nameOf });

    const head = (p, side) => {
        const pick = button("kc-compare__pick", `Lihat ${ctx.nameOf(p)}`, "Pilih ini");
        pick.addEventListener("click", () => {
            closeSheet();
            ctx.open(p);
        });
        return el("div", `kc-compare__product kc-compare__product--${side}`,
            thumb(ctx, p),
            el("strong", "kc-compare__name", ctx.nameOf(p)),
            el("span", "kc-compare__price", ctx.money(ctx.priceOf(p))),
            pick);
    };

    const rows = result.rows.map((r) => el("div", "kc-compare__row",
        el("p", "kc-compare__label", r.label),
        el("div", "kc-compare__cells",
            el("span", `kc-compare__cell${r.better === "a" ? " is-better" : ""}`, r.a),
            el("span", `kc-compare__cell${r.better === "b" ? " is-better" : ""}`, r.b))));

    openSheet("Bandingkan", el("div", "kc-compare__body",
        el("div", "kc-compare__products", head(a, "a"), head(b, "b")),
        el("p", "kc-compare__summary", result.summary),
        rows.length ? el("div", "kc-compare__rows", rows) : null,
        result.same.length ? el("p", "kc-compare__same", `Sama: ${result.same.join(", ").toLowerCase()}`) : null,
        el("p", "kc-compare__hint", "Hanya perbedaan yang penting yang ditampilkan.")));
}

/** Pilih lawan banding: dari yang terakhir dilihat + produk serupa. */
export function openComparePicker(ctx, product, candidates) {
    const id = String(product?.id);
    const list = [];
    const seen = new Set([id]);
    (candidates ?? []).forEach((p) => {
        const key = String(p?.id);
        if (p && !seen.has(key)) {
            seen.add(key);
            list.push(p);
        }
    });
    if (!list.length) {
        openSheet("Bandingkan dengan…", el("p", "kc-compare__empty", "Buka satu produk lain dulu, lalu kembali ke sini untuk membandingkan."));
        return;
    }
    const items = list.slice(0, 8).map((p) => {
        const b = button("kc-compare__option", `Bandingkan dengan ${ctx.nameOf(p)}`,
            thumb(ctx, p),
            el("span", "kc-compare__option-text", el("strong", "", ctx.nameOf(p)), el("small", "", ctx.money(ctx.priceOf(p)))),
            svgIcon(ICON.compare, 18));
        b.addEventListener("click", () => openCompare(ctx, product, p));
        return b;
    });
    openSheet("Bandingkan dengan…", el("div", "kc-compare__options", items), "is-picker");
}

/** Catat kunjungan & kembalikan banner Ruang Ragu bila user bolak-balik. */
export function createDoubtBanner(ctx, product) {
    const id = String(product?.id ?? "");
    const trail = recordView(id);
    const otherId = detectDoubt(trail, id, { dismissed: dismissedPairs() });
    const other = otherId ? ctx.find(otherId) : null;
    if (!other) return null;

    const open = button("kc-doubt__open", "", "Lihat bedanya");
    const dismiss = button("kc-doubt__dismiss", "Tutup tawaran banding", svgIcon(ICON.close, 14));
    const banner = el("aside", "kc-doubt",
        el("span", "kc-doubt__icon", svgIcon(ICON.compare, 18)),
        el("p", "kc-doubt__text", "Masih menimbang dengan ", el("strong", "", ctx.nameOf(other)), "? Lihat bedanya berdampingan."),
        open, dismiss);
    banner.setAttribute("aria-live", "polite");
    open.addEventListener("click", () => openCompare(ctx, product, other));
    dismiss.addEventListener("click", () => {
        dismissDoubt(id, otherId);
        banner.remove();
    });
    return banner;
}

export function createCompareLink(ctx, product, getCandidates) {
    const link = button("pdp-compare-link", "", svgIcon(ICON.compare, 16), "Bandingkan dengan produk lain");
    link.addEventListener("click", () => openComparePicker(ctx, product, getCandidates()));
    return link;
}
