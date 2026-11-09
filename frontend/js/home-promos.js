/**
 * KANTOONG — ZONA PROMOSI HOMEPAGE
 * File: frontend/js/home-promos.js
 *
 * Homepage = etalase yang memancing minat (bukan katalog lengkap).
 * Blok diatur admin di ERP › Etalase & Brand › Homepage:
 *   banner · kupon & voucher (klaim) · kotak hadiah misteri · poster · produk pilihan admin
 * Semua blok opsional, urutannya bebas. Dipakai juga oleh pratinjau ERP.
 *
 * Kejujuran: hadiah misteri diambil acak dari daftar hadiah yang diisi toko
 * (tertulis jelas di kotaknya), 1× sehari per perangkat.
 */

import { drawReward } from "./storefront-settings.js";

const CLAIM_KEY = "kantoong:claimed-coupons";
const JACKPOT_KEY = "kantoong:jackpot";

function el(tag, className, ...children) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    children.flat().forEach((child) => {
        if (child == null || child === false || child === "") return;
        node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return node;
}

function button(className, label, onClick) {
    const b = el("button", className, label);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
}

const read = (key, fallback) => {
    try {
        return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
    } catch {
        return fallback;
    }
};
const write = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        /* diblokir */
    }
};

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
const rupiah = (n) => `Rp ${(Number(n) || 0).toLocaleString("id-ID")}`;

async function copy(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

function head(title, sample) {
    if (!title && !sample) return null;
    return el("div", "kc-promo__head",
        title ? el("h2", "kc-promo__title", title) : null,
        sample ? el("span", "kc-promo__sample", "Contoh") : null);
}

function media(image, fallbackClass) {
    const box = el("div", `kc-promo__media ${fallbackClass}`);
    if (image) {
        const img = document.createElement("img");
        img.src = image;
        img.alt = "";
        img.loading = "lazy";
        box.append(img);
    }
    return box;
}

/* ---------- Blok ---------- */

function banner(block, ctx) {
    const track = el("div", "kc-promo__banners");
    block.items.forEach((item, i) => {
        const card = el("article", `kc-banner kc-banner--${i % 3}`,
            media(item.image, "kc-banner__bg"),
            el("div", "kc-banner__body",
                el("h3", "kc-banner__title", item.title),
                item.text ? el("p", "kc-banner__text", item.text) : null,
                item.action !== "none" && item.cta
                    ? button("kc-banner__cta", item.cta, () => ctx.onAction?.({ type: item.action, hint: item.text || item.title }))
                    : null));
        track.append(card);
    });
    return [head(block.title, block.sample), track];
}

function coupons(block, ctx) {
    const claimed = new Set(read(CLAIM_KEY, []));
    const list = el("div", "kc-promo__coupons");
    block.items.forEach((item) => {
        const isClaimed = claimed.has(item.code);
        const action = button(`kc-coupon__btn${isClaimed ? " is-claimed" : ""}`, isClaimed ? "Salin kode" : "Klaim", async () => {
            if (ctx.preview) return;
            claimed.add(item.code);
            write(CLAIM_KEY, [...claimed]);
            const ok = await copy(item.code);
            action.classList.add("is-claimed");
            action.textContent = ok ? "Kode disalin ✓" : "Diklaim ✓";
            ctx.onAction?.({ type: "coupon", code: item.code });
        });
        list.append(el("article", "kc-coupon",
            el("div", "kc-coupon__left",
                el("p", "kc-coupon__title", item.title),
                item.text ? el("p", "kc-coupon__text", item.text) : null,
                el("p", "kc-coupon__code", item.code, item.expires ? el("span", "", ` · s.d. ${item.expires}`) : null)),
            el("div", "kc-coupon__right", action)));
    });
    return [head(block.title, block.sample), list];
}

function jackpot(block, ctx) {
    const state = read(JACKPOT_KEY, {});
    const done = state.date === today() ? state.result : null;
    const prize = el("div", "kc-jackpot__prize");
    const box = el("div", "kc-jackpot__box", el("span", "kc-jackpot__lid"), el("span", "kc-jackpot__body"), el("span", "kc-jackpot__glow"));
    const showResult = (result) => {
        // filter(Boolean): replaceChildren menulis null sebagai teks "null".
        prize.replaceChildren(...[
            el("p", "kc-jackpot__label", result.label),
            result.code ? el("p", "kc-jackpot__code", result.code) : null,
            el("p", "kc-jackpot__note", result.code ? "Kode disalin. Pakai saat checkout." : "Kotak berikutnya terbuka besok."),
        ].filter(Boolean));
        box.classList.add("is-open");
    };
    const open = button("kc-jackpot__btn", done ? "Sudah dibuka hari ini" : "Buka kotak", async () => {
        if (ctx.preview || done || box.classList.contains("is-shaking")) return;
        const result = drawReward(block.rewards);
        if (!result) return;
        box.classList.add("is-shaking");
        open.disabled = true;
        await new Promise((r) => setTimeout(r, 1100));
        box.classList.remove("is-shaking");
        write(JACKPOT_KEY, { date: today(), result });
        if (result.code) copy(result.code);
        showResult(result);
        open.textContent = "Sampai jumpa besok";
        ctx.onAction?.({ type: "jackpot", result });
    });
    if (done) {
        showResult(done);
        open.disabled = true;
    }
    const odds = el("details", "kc-jackpot__odds",
        el("summary", "", "Lihat daftar hadiah"),
        el("ul", "", block.rewards.map((r) => el("li", "", r.label))));
    return [head(block.title, block.sample), el("section", "kc-jackpot",
        box,
        el("div", "kc-jackpot__side",
            block.text ? el("p", "kc-jackpot__text", block.text) : null,
            prize,
            open,
            odds))];
}

function posters(block) {
    const grid = el("div", "kc-promo__posters");
    block.items.forEach((item, i) => {
        grid.append(el("article", `kc-poster kc-poster--${i % 4}`,
            media(item.image, "kc-poster__bg"),
            el("div", "kc-poster__body", el("h3", "", item.title), item.text ? el("p", "", item.text) : null)));
    });
    return [head(block.title, block.sample), grid];
}

function pinned(block, ctx) {
    const byId = new Map((ctx.products ?? []).map((p) => [String(p.id), p]));
    const items = block.productIds.map((id) => byId.get(id)).filter(Boolean);
    if (!items.length) {
        return ctx.preview ? [head(block.title, block.sample), el("p", "kc-promo__empty", "Belum ada produk yang disematkan.")] : null;
    }
    const rail = el("div", "kc-promo__rail", items.map((p) => {
        const card = button("kc-pin", "", () => ctx.onAction?.({ type: "product", product: p }));
        const img = el("span", "kc-pin__img");
        if (p.image_url) {
            const i = document.createElement("img");
            i.src = p.image_url;
            i.alt = "";
            i.loading = "lazy";
            img.append(i);
        }
        card.append(img, el("span", "kc-pin__name", p.name), el("span", "kc-pin__price", rupiah(p.price)));
        return card;
    }));
    return [head(block.title, block.sample), rail];
}

const RENDER = { banner, coupons, jackpot, posters, pinned };

/**
 * root : wadah
 * opts : { home, products, onAction, preview }
 * Blok kosong (tanpa isi) disembunyikan dari pelanggan.
 */
export function renderHomePromos(root, opts) {
    const blocks = (opts.home?.blocks ?? []).filter((b) => b.enabled);
    const sections = blocks.map((block) => {
        const hasContent = block.type === "jackpot" ? block.rewards?.length : block.type === "pinned" ? true : block.items?.length;
        if (!hasContent) return null;
        const nodes = RENDER[block.type]?.(block, opts);
        if (!nodes) return null;
        return el("section", `kc-promo__block kc-promo__block--${block.type}`, nodes);
    }).filter(Boolean);
    root.replaceChildren(...sections);
    root.hidden = sections.length === 0;
    return sections.length;
}
