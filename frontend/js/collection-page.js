/**
 * KANTOONG — HALAMAN KOLEKSI ("kamar" tiap bagian homepage)
 * File: frontend/js/collection-page.js
 *
 * Tombol "Jelajahi sekarang" di Pilihan Terbaik / Best Seller / rel lain
 * membuka halaman SENDIRI berisi produk bagian itu saja (bukan katalog utama),
 * tersusun ke bawah ala marketplace, dengan cari + filter yang mengatur
 * lalu lintas kartu di bagian itu. Di bawah ada pintu ke katalog utama.
 *
 * Alamat: #koleksi/<kunci>  → tombol kembali HP & berbagi link berfungsi.
 */

import { PRICE_BANDS, SORTS, searchCatalog } from "../dashboard-user/home/catalog-search.js";

export const COLLECTION_ROUTE = "#koleksi/";

const registry = new Map(); // kunci -> { title, eyebrow, description, getProducts }
let ctx = null; // { makeCard(product, index), onAllProducts() }
let root = null;
let current = null;
let state = { query: "", sort: "relevan", band: "all", discount: false, inStock: false, rating4: false };

function el(tag, className, ...children) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    children.flat().forEach((c) => {
        if (c == null || c === false) return;
        node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    });
    return node;
}

function button(className, label, onClick, aria) {
    const b = el("button", className, label);
    b.type = "button";
    if (aria) b.setAttribute("aria-label", aria);
    b.addEventListener("click", onClick);
    return b;
}

const slug = (v) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "koleksi";

/** Daftarkan bagian homepage agar bisa dibuka (juga lewat link). */
export function registerCollection(key, info) {
    const k = slug(key);
    registry.set(k, info);
    return k;
}

export function initCollections(options) {
    ctx = options;
    window.addEventListener("hashchange", sync);
    sync();
}

export function openCollection(key) {
    const k = slug(key);
    if (!registry.has(k)) return;
    if (location.hash !== `${COLLECTION_ROUTE}${k}`) location.hash = `${COLLECTION_ROUTE}${k}`;
    else render(k);
}

function sync() {
    if (location.hash.startsWith(COLLECTION_ROUTE)) {
        const k = decodeURIComponent(location.hash.slice(COLLECTION_ROUTE.length));
        if (registry.has(k)) return render(k);
    }
    hide();
}

function hide() {
    if (!root || root.hidden) return;
    root.classList.remove("is-open");
    window.dispatchEvent(new CustomEvent("kantoong:overlay", { detail: { name: "collection", open: false } }));
    setTimeout(() => {
        if (root && !root.classList.contains("is-open")) root.hidden = true;
    }, 260);
}

function close() {
    if (history.length > 1 && location.hash.startsWith(COLLECTION_ROUTE)) history.back();
    else {
        history.replaceState(null, "", location.pathname + location.search);
        hide();
    }
}

function activeCount() {
    return [state.sort !== "relevan", state.band !== "all", state.discount, state.inStock, state.rating4].filter(Boolean).length;
}

function openFilter() {
    const draft = { ...state };
    const sheet = el("div", "kc-col-sheet");
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-label", "Atur & saring");
    const body = el("div", "kc-col-sheet__body");
    const chip = (label, on, fn) => button(`kc-col-chip${on ? " is-on" : ""}`, label, () => {
        fn();
        draw();
    });
    const draw = () => body.replaceChildren(
        el("h4", "", "Urutkan"),
        el("div", "kc-col-chips", SORTS.map((s) => chip(s.label, draft.sort === s.id, () => (draft.sort = s.id)))),
        el("h4", "", "Harga"),
        el("div", "kc-col-chips", PRICE_BANDS.map((b) => chip(b.label, draft.band === b.id, () => (draft.band = b.id)))),
        el("h4", "", "Lainnya"),
        el("div", "kc-col-chips",
            chip("Lagi diskon", draft.discount, () => (draft.discount = !draft.discount)),
            chip("Ready stok", draft.inStock, () => (draft.inStock = !draft.inStock)),
            chip("★ 4 ke atas", draft.rating4, () => (draft.rating4 = !draft.rating4))));
    const shut = () => {
        sheet.classList.remove("is-open");
        setTimeout(() => sheet.remove(), 240);
    };
    sheet.append(el("div", "kc-col-sheet__panel",
        el("div", "kc-col-sheet__grab"),
        el("header", "kc-col-sheet__head", el("h3", "", "Atur & saring"), button("kc-col-x", "×", shut, "Tutup")),
        body,
        el("footer", "kc-col-sheet__foot",
            button("kc-col-btn kc-col-btn--ghost", "Reset", () => {
                Object.assign(draft, { sort: "relevan", band: "all", discount: false, inStock: false, rating4: false });
                draw();
            }),
            button("kc-col-btn", "Terapkan", () => {
                Object.assign(state, draft);
                shut();
                drawGrid();
            }))));
    sheet.addEventListener("click", (e) => {
        if (e.target === sheet) shut();
    });
    draw();
    root.append(sheet);
    requestAnimationFrame(() => sheet.classList.add("is-open"));
}

let gridEl = null;
let countEl = null;
let filterBtn = null;

function drawGrid() {
    if (!current || !gridEl) return;
    const all = current.getProducts() ?? [];
    const { items } = searchCatalog(all, { ...state, category: "all" });
    countEl.textContent = state.query || activeCount() ? `${items.length} dari ${all.length} produk` : `${all.length} produk`;
    const badge = filterBtn.querySelector(".kc-col-badge");
    badge.textContent = activeCount() ? String(activeCount()) : "";
    badge.hidden = !activeCount();
    gridEl.replaceChildren(...(items.length
        ? items.map((p, i) => ctx.makeCard(p, i))
        : [el("div", "kc-col-empty", el("strong", "", "Belum ketemu nih"), el("span", "", "Coba kata lain atau longgarkan filternya ✨"))]));
}

function render(key) {
    current = registry.get(key);
    state = { query: "", sort: "relevan", band: "all", discount: false, inStock: false, rating4: false };
    if (!root) {
        root = el("section", "kc-col");
        root.setAttribute("aria-label", "Koleksi");
        (document.querySelector("#appRoot") || document.body).append(root);
    }
    const back = button("kc-col-back", "‹", close, "Kembali");
    const input = el("input", "kc-col-search__input");
    input.type = "search";
    input.placeholder = `Cari di ${current.title}…`;
    input.addEventListener("input", () => {
        state.query = input.value;
        drawGrid();
    });
    filterBtn = button("kc-col-filter", [svgFilter(), el("span", "kc-col-badge")], openFilter, "Atur & saring");
    countEl = el("span", "kc-col-count");
    gridEl = el("div", "kc-col-grid");
    root.replaceChildren(
        el("header", "kc-col-top", back, el("div", "kc-col-titles", current.eyebrow ? el("p", "kc-col-eyebrow", current.eyebrow) : null, el("h1", "kc-col-title", current.title)), countEl),
        current.description ? el("p", "kc-col-desc", current.description) : null,
        el("div", "kc-col-tools", el("label", "kc-col-search", svgSearch(), input), filterBtn),
        gridEl,
        button("kc-col-all", [el("span", "", "Klik di sini buat lihat semua produk hits kita"), el("span", "kc-col-all__arrow", "→")], () => {
            close();
            setTimeout(() => ctx.onAllProducts?.(), 120);
        }));
    root.hidden = false;
    root.scrollTop = 0;
    window.dispatchEvent(new CustomEvent("kantoong:overlay", { detail: { name: "collection", open: true } }));
    requestAnimationFrame(() => root.classList.add("is-open"));
    drawGrid();
}

const SVG_NS = "http://www.w3.org/2000/svg";
function svg(paths) {
    const s = document.createElementNS(SVG_NS, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("aria-hidden", "true");
    paths.forEach((d) => {
        const p = document.createElementNS(SVG_NS, "path");
        p.setAttribute("d", d);
        s.append(p);
    });
    return s;
}
const svgSearch = () => svg(["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z", "M20 20l-4.3-4.3"]);
const svgFilter = () => svg(["M4 7h10", "M18 7h2", "M4 17h4", "M12 17h8", "M16 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M10 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"]);
