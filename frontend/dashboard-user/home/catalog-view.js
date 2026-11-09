/**
 * KANTOONG — TAMPILAN KATALOG PER KATEGORI (dipakai Dashboard User & pratinjau ERP)
 * File: frontend/dashboard-user/home/catalog-view.js
 *
 * Susunan (sesuai sketsa pemilik):
 *   [ kotak cari .................. ] [⚙ filter semua produk]
 *   Nama Kategori | saran saran saran (geser, memudar) | [⚙]
 *   kartu kartu kartu kartu
 *   Nama Kategori | ...
 *
 * - Nama kategori, urutan, & saran filter diatur admin di ERP
 *   (js/storefront-settings.js) dan berubah realtime.
 * - Filter = lembar pop-up dengan latar buram gelap.
 */

import { el, icon } from "./home-icons.js";
import { PRICE_BANDS, SORTS, describeFilters, searchCatalog, suggest } from "./catalog-search.js";
import { applyChip, chipLabel, chipsFor, orderedCategories } from "../../js/storefront-settings.js";
import { productImage, rupiah } from "./home-data.js";
import { getPlan } from "../../js/plan.js";
import { bigPrice } from "../../js/industry.js";
import { addHistory, readHistory, removeHistory, writeHistory } from "../../js/catalog-url.js";

const FILTER_ICON = ["M4 7h10", "M18 7h2", "M4 17h4", "M12 17h8", "M16 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M10 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"];

function svg(paths, className = "bx-icon") {
    const node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    node.setAttribute("viewBox", "0 0 24 24");
    node.setAttribute("aria-hidden", "true");
    node.setAttribute("class", className);
    paths.forEach((d) => {
        const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
        p.setAttribute("d", d);
        node.append(p);
    });
    return node;
}

const blankFilter = () => ({ sort: "relevan", band: "all", discount: false, inStock: false, rating4: false });

export function isFilterActive(f) {
    return f.sort !== "relevan" || f.band !== "all" || f.discount || f.inStock || f.rating4;
}

/* ---------- Kartu produk (selalu ada bintang) ---------- */

export function productTile(p, { onOpen } = {}) {
    const tile = el("article", "bx-tile");
    const open = el("button", "bx-tile__open");
    open.type = "button";
    open.setAttribute("aria-label", `Lihat ${p.name}`);
    const img = el("span", "bx-tile__img");
    const src = productImage(p);
    if (src) {
        const i = document.createElement("img");
        i.src = src;
        i.alt = "";
        i.loading = "lazy";
        img.append(i);
    }
    const now = Number(p.price) || 0;
    const was = Number(p.compare_at_price) || 0;
    if (was > now) img.append(el("span", "bx-tile__off", `-${Math.round((1 - now / was) * 100)}%`));
    if (p.stock !== null && p.stock !== undefined && Number(p.stock) <= 0) img.append(el("span", "bx-tile__out", "Habis"));

    const rating = Number(p.rating_avg) || 0;
    const reviews = Number(p.review_count) || 0;
    const stars = el("span", `bx-tile__rating${rating > 0 ? "" : " is-new"}`,
        el("span", "bx-tile__star", "★"),
        rating > 0 ? `${rating.toFixed(1).replace(".", ",")}${reviews ? ` (${reviews})` : ""}` : "Baru");

    open.append(
        img,
        el("span", "bx-tile__name", p.name),
        p.spec_line ? el("span", "bx-tile__spec", p.spec_line) : null,
        el("span", "bx-tile__price", getPlan().industry === "properti" ? bigPrice(now) : rupiah(now), was > now ? el("s", "", rupiah(was)) : null),
        el("span", "bx-tile__meta", stars, el("span", "bx-tile__dot", "·"), `${Number(p.sales_count) || 0} terjual`),
    );
    open.addEventListener("click", () => onOpen?.(p));
    tile.append(open);
    return tile;
}

/* ---------- Lembar filter (pop-up, latar buram gelap) ---------- */

function openFilterSheet({ title, subtitle, filter, categories, onApply, host }) {
    const draft = { ...filter };
    const root = el("div", "bx-sheet");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", title);

    const body = el("div", "bx-sheet__body");
    const close = () => {
        root.classList.remove("is-open");
        setTimeout(() => root.remove(), 260);
        document.removeEventListener("keydown", onKey);
    };
    const onKey = (event) => {
        if (event.key === "Escape") close();
    };

    function chip(label, on, onClick) {
        const c = el("button", `bx-chip${on ? " is-on" : ""}`, label);
        c.type = "button";
        c.setAttribute("aria-pressed", String(on));
        c.addEventListener("click", () => {
            onClick();
            draw();
        });
        return c;
    }

    function draw() {
        // filter(Boolean): bagian "Kategori" hanya ada di filter semua produk;
        // replaceChildren menulis null sebagai teks "null" bila tidak disaring.
        body.replaceChildren(...[
            el("h4", "bx-sheet__label", "Urutkan"),
            el("div", "bx-sheet__chips", SORTS.map((s) => chip(s.label, draft.sort === s.id, () => (draft.sort = s.id)))),
            el("h4", "bx-sheet__label", "Harga"),
            el("div", "bx-sheet__chips", PRICE_BANDS.map((b) => chip(b.label, draft.band === b.id, () => (draft.band = b.id)))),
            el("h4", "bx-sheet__label", "Lainnya"),
            el("div", "bx-sheet__chips",
                chip("Sedang diskon", draft.discount, () => (draft.discount = !draft.discount)),
                chip("Ready stok", draft.inStock, () => (draft.inStock = !draft.inStock)),
                chip("★ 4 ke atas", draft.rating4, () => (draft.rating4 = !draft.rating4))),
            categories?.length
                ? el("div", "", el("h4", "bx-sheet__label", "Kategori"),
                    el("div", "bx-sheet__chips",
                        chip("Semua", (draft.category ?? "all") === "all", () => (draft.category = "all")),
                        ...categories.map((c) => chip(c.label, draft.category === c.key, () => (draft.category = c.key)))))
                : null,
        ].filter(Boolean));
    }

    const reset = el("button", "bx-btn bx-btn--ghost", "Atur ulang");
    reset.type = "button";
    reset.addEventListener("click", () => {
        Object.assign(draft, blankFilter(), { category: "all" });
        draw();
    });
    const apply = el("button", "bx-btn", "Terapkan");
    apply.type = "button";
    apply.addEventListener("click", () => {
        onApply(draft);
        close();
    });
    const x = el("button", "bx-sheet__close", icon("close"));
    x.type = "button";
    x.setAttribute("aria-label", "Tutup");
    x.addEventListener("click", close);

    root.append(el("div", "bx-sheet__panel",
        el("div", "bx-shelf__grab"),
        el("header", "bx-sheet__head", el("div", "", el("h3", "bx-sheet__title", title), subtitle ? el("p", "bx-muted", subtitle) : null), x),
        body,
        el("footer", "bx-sheet__foot", reset, apply)));
    root.addEventListener("click", (event) => {
        if (event.target === root) close();
    });
    document.addEventListener("keydown", onKey);
    draw();
    (host ?? document.body).append(root);
    requestAnimationFrame(() => root.classList.add("is-open"));
    apply.focus({ preventScroll: true });
}

/* ---------- Katalog ---------- */

/**
 * root     : elemen tujuan
 * options  : { products, settings, onOpenProduct, state, compact, sheetHost }
 * Mengembalikan { update(settings, products) } untuk perubahan realtime.
 */
export function renderCatalog(root, options) {
    let products = options.products ?? [];
    let settings = options.settings;
    const st = options.state ?? { query: "", global: { ...blankFilter(), category: "all" }, perCat: {} };
    // Membuka produk dari hasil pencarian = kata itu masuk riwayat (hanya di perangkat ini).
    const onOpen = (p) => {
        rememberQuery(st.query);
        options.onOpenProduct?.(p);
    };
    const rememberQuery = (q) => writeHistory(addHistory(readHistory(), q));
    const sheetHost = options.sheetHost;

    const input = document.createElement("input");
    input.type = "search";
    input.className = "bx-cat__input";
    input.placeholder = "Cari produk, atau tulis: “sepatu hitam di bawah 500rb”";
    input.value = st.query;
    input.setAttribute("aria-label", "Cari produk");
    const suggestBox = el("ul", "bx-suggest");
    suggestBox.hidden = true;

    const filterBtn = el("button", "bx-square", svg(FILTER_ICON), el("span", "bx-square__badge"));
    filterBtn.type = "button";
    filterBtn.setAttribute("aria-label", "Saring & urutkan semua produk");

    const top = el("div", "bx-cat2__top",
        el("div", "bx-cat__bar", el("label", "bx-cat__search", icon("search"), input), suggestBox),
        filterBtn);
    const content = el("div", "bx-cat2__content");
    root.replaceChildren(el("div", `bx-cat2${options.compact ? " is-compact" : ""}`, top, content));

    function cats() {
        return orderedCategories(products, settings);
    }

    function results(list) {
        const g = st.global;
        const result = searchCatalog(list, { ...g, query: st.query });
        const info = describeFilters(result);
        const clear = el("button", "bx-chip", icon("close"), "Hapus saringan");
        clear.type = "button";
        clear.addEventListener("click", () => {
            st.query = "";
            input.value = "";
            st.global = { ...blankFilter(), category: "all" };
            draw();
        });
        // Salin link: saringan yang sama bisa dibagikan / dibuka lagi.
        const share = options.shareLink ? el("button", "bx-chip", icon("link"), "Salin link") : null;
        share?.setAttribute("type", "button");
        share?.addEventListener("click", async () => {
            const url = options.shareLink(st);
            try {
                await navigator.clipboard.writeText(url);
                share.lastChild.textContent = "Link tersalin";
            } catch {
                window.prompt("Salin link ini:", url);
            }
            setTimeout(() => { if (share.isConnected) share.lastChild.textContent = "Salin link"; }, 1800);
        });
        const head = el("div", "bx-cat2__summary",
            el("p", "bx-cat__summary", ...[el("strong", "", `${result.items.length} produk`), info ? ` · ${info}` : ""].filter(Boolean)),
            el("div", "bx-cat2__actions", share, clear));
        if (!result.items.length) {
            return [head, el("div", "bx-empty", el("span", "bx-empty__icon", icon("search", "bx-icon bx-icon--xl")), el("h3", "", "Belum ketemu yang pas"), el("p", "", "Coba kata lain atau longgarkan saringan. Asisten juga bisa carikan yang paling mirip."))];
        }
        return [head, el("div", "bx-results", result.items.map((p) => productTile(p, { onOpen })))];
    }

    function section(cat) {
        const own = st.perCat[cat.key] ?? (st.perCat[cat.key] = { chip: -1, filter: blankFilter() });
        let items = products.filter((p) => (String(p.category ?? "").trim() || "Lainnya") === cat.key);
        const chips = chipsFor(settings, cat.key);
        if (own.chip >= 0 && chips[own.chip]) items = applyChip(items, chips[own.chip]);
        if (isFilterActive(own.filter)) items = searchCatalog(items, own.filter).items;

        const rail = el("div", "bx-sec__chips");
        chips.forEach((c, i) => {
            const b = el("button", `bx-chip${own.chip === i ? " is-on" : ""}`, chipLabel(c));
            b.type = "button";
            b.setAttribute("aria-pressed", String(own.chip === i));
            b.addEventListener("click", () => {
                own.chip = own.chip === i ? -1 : i;
                draw();
            });
            rail.append(b);
        });

        const filter = el("button", `bx-sec__filter${isFilterActive(own.filter) ? " is-on" : ""}`, svg(FILTER_ICON));
        filter.type = "button";
        filter.setAttribute("aria-label", `Saring ${cat.label}`);
        filter.addEventListener("click", () => openFilterSheet({
            title: cat.label,
            subtitle: "Saring produk di kategori ini saja",
            filter: own.filter,
            host: sheetHost,
            onApply: (next) => {
                own.filter = { ...blankFilter(), ...next };
                draw();
            },
        }));

        const grid = items.length
            ? el("div", "bx-results", items.map((p) => productTile(p, { onOpen })))
            : el("p", "bx-muted bx-sec__empty", "Tidak ada produk yang cocok dengan saringan ini.");

        const sec = el("section", "bx-sec",
            el("div", "bx-sec__head", el("h3", "bx-sec__name", cat.label), el("div", "bx-sec__track", rail), filter),
            grid);
        return sec;
    }

    function drawView() {
        const active = st.query.trim() || isFilterActive(st.global) || (st.global.category && st.global.category !== "all");
        const count = [st.global.sort !== "relevan", st.global.band !== "all", st.global.discount, st.global.inStock, st.global.rating4, st.global.category && st.global.category !== "all"].filter(Boolean).length;
        const badge = filterBtn.querySelector(".bx-square__badge");
        badge.textContent = count ? String(count) : "";
        badge.hidden = !count;
        filterBtn.classList.toggle("is-on", count > 0);

        if (!products.length) {
            content.replaceChildren(...Array.from({ length: 4 }, () => el("div", "bx-tile bx-tile--ghost", el("span", "bx-shimmer"))));
            return;
        }
        if (active) {
            const list = st.global.category && st.global.category !== "all"
                ? products.filter((p) => (String(p.category ?? "").trim() || "Lainnya") === st.global.category)
                : products;
            content.replaceChildren(...results(list));
            return;
        }
        content.replaceChildren(...cats().map(section));
    }

    // Setiap gambar ulang: kabari pemilik (alamat link ikut berubah).
    function draw() {
        drawView();
        options.onStateChange?.(st);
    }

    filterBtn.addEventListener("click", () => openFilterSheet({
        title: "Saring semua produk",
        subtitle: "Berlaku untuk seluruh katalog",
        filter: st.global,
        categories: cats(),
        host: sheetHost,
        onApply: (next) => {
            st.global = { ...blankFilter(), category: "all", ...next };
            draw();
        },
    }));

    // Riwayat pencarian: muncul saat kotak cari diketuk & masih kosong.
    function showHistory() {
        const list = readHistory();
        if (input.value.trim() || !list.length) return;
        const rows = list.map((q) => {
            const b = el("button", "", el("span", "bx-suggest__kind", "terakhir"), q);
            b.type = "button";
            b.addEventListener("mousedown", (event) => event.preventDefault());
            b.addEventListener("click", () => {
                st.query = q;
                input.value = q;
                suggestBox.hidden = true;
                rememberQuery(q);
                draw();
            });
            const x = el("button", "bx-suggest__remove", icon("close"));
            x.type = "button";
            x.setAttribute("aria-label", `Hapus "${q}" dari riwayat`);
            x.addEventListener("mousedown", (event) => event.preventDefault());
            x.addEventListener("click", () => {
                writeHistory(removeHistory(readHistory(), q));
                showHistory();
                if (!readHistory().length) suggestBox.hidden = true;
            });
            return el("li", "bx-suggest__row", b, x);
        });
        const clearAll = el("button", "bx-suggest__clear", "Hapus semua riwayat");
        clearAll.type = "button";
        clearAll.addEventListener("mousedown", (event) => event.preventDefault());
        clearAll.addEventListener("click", () => {
            writeHistory([]);
            suggestBox.hidden = true;
        });
        suggestBox.replaceChildren(el("li", "bx-suggest__head", el("span", "", "Pencarian terakhir · hanya di perangkat ini"), clearAll), ...rows);
        suggestBox.hidden = false;
    }
    input.addEventListener("focus", showHistory);

    let timer = 0;
    input.addEventListener("input", () => {
        clearTimeout(timer);
        if (!input.value.trim()) {
            showHistory();
            timer = setTimeout(() => {
                st.query = "";
                draw();
            }, 160);
            return;
        }
        const list = suggest(products, input.value);
        suggestBox.replaceChildren(...list.map((s) => {
            const b = el("button", "", el("span", "bx-suggest__kind", s.kind), s.label);
            b.type = "button";
            b.addEventListener("mousedown", (event) => event.preventDefault());
            b.addEventListener("click", () => {
                if (s.kind === "kategori") {
                    st.global.category = s.label;
                    st.query = "";
                    input.value = "";
                } else {
                    st.query = s.label;
                    input.value = s.label;
                    rememberQuery(s.label);
                }
                suggestBox.hidden = true;
                draw();
            });
            return el("li", "", b);
        }));
        suggestBox.hidden = list.length === 0;
        timer = setTimeout(() => {
            st.query = input.value;
            draw();
        }, 160);
    });
    input.addEventListener("blur", () => setTimeout(() => (suggestBox.hidden = true), 120));
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            suggestBox.hidden = true;
            st.query = input.value;
            rememberQuery(st.query);
            draw();
        }
    });

    draw();

    return {
        state: st,
        update(nextSettings, nextProducts) {
            if (nextSettings) settings = nextSettings;
            if (nextProducts) products = nextProducts;
            draw();
        },
    };
}
