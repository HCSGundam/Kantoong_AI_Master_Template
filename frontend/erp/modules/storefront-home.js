/**
 * KANTOONG ERP — PENGATUR HOMEPAGE (zona promosi) & LOGO BRAND
 * File: frontend/erp/modules/storefront-home.js
 * Dipakai modules/storefront.js. Semua blok opsional: nyalakan, matikan, urutkan.
 */

import { el, formDialog, toast, friendlyError } from "../ui.js";
import { HOME_BLOCKS } from "../../js/storefront-settings.js";
import { PRODUCT_CONFIG, uploadProductImage } from "../data/product-service.js";

const clone = (v) => JSON.parse(JSON.stringify(v));

/* ---------- Isian per jenis blok ---------- */

const ITEM_FIELDS = {
    banner: (it = {}) => [
        { name: "title", label: "Judul", value: it.title, max: 60, required: true },
        { name: "text", label: "Keterangan", type: "textarea", value: it.text, max: 160 },
        { name: "image", label: "Link gambar (https, opsional)", value: it.image, placeholder: "https://…", hint: "Kosongkan untuk latar gradasi mewah bawaan." },
        { name: "cta", label: "Tulisan tombol", value: it.cta ?? "Lihat produk", max: 30 },
        { name: "action", label: "Tombol membuka", type: "select", value: it.action ?? "catalog", options: [
            { value: "catalog", label: "Katalog produk" }, { value: "chat", label: "Chat asisten AI" }, { value: "none", label: "Tanpa tombol" },
        ] },
    ],
    coupons: (it = {}) => [
        { name: "title", label: "Judul kupon", value: it.title, max: 40, required: true, placeholder: "Diskon 10%" },
        { name: "code", label: "Kode", value: it.code, max: 20, required: true, placeholder: "HEMAT10", hint: "Buat juga kode yang sama di menu Voucher (CRM) agar berlaku saat checkout." },
        { name: "text", label: "Syarat singkat", value: it.text, max: 100, placeholder: "Min. belanja Rp 50.000" },
        { name: "expires", label: "Berlaku sampai", type: "date", value: it.expires },
    ],
    posters: (it = {}) => [
        { name: "title", label: "Judul", value: it.title, max: 60, required: true },
        { name: "text", label: "Keterangan", value: it.text, max: 120 },
        { name: "image", label: "Link gambar (https, opsional)", value: it.image, placeholder: "https://…" },
    ],
    rewards: (it = {}) => [
        { name: "label", label: "Hadiah", value: it.label, max: 50, required: true, placeholder: "Diskon 5%" },
        { name: "code", label: "Kode (kosongkan untuk 'coba lagi besok')", value: it.code, max: 20 },
        { name: "weight", label: "Peluang (1–100, makin besar makin sering)", type: "number", min: 1, max: 100, value: it.weight ?? 10 },
    ],
};

/* ---------- Ikon blok ---------- */

const BLOCK_ICONS = {
    hero: "M3 5h18v11H3zM7 20h10M12 16v4",
    featured: "M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.6 6.7 19.4l1.2-6L3.4 9.3l6-.7z",
    banner: "M4 6h16v10H4zM8 20h8",
    coupons: "M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 1 0-4V4H3zM9 4v16",
    jackpot: "M4 10h16v10H4zM3 6h18v4H3zM12 6v14M12 6c-2-3-6-3-6 0M12 6c2-3 6-3 6 0",
    posters: "M5 3h14v18H5zM8 15l3-3 2 2 3-3",
    pinned: "M9 4h6l-1 6 3 3H7l3-3zM12 13v8",
};

function svgIcon(d) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.append(path);
    return svg;
}

export function grip() {
    const g = el("span", { class: "hs-grip", "aria-hidden": "true" });
    for (let i = 0; i < 6; i++) g.append(el("i"));
    return g;
}

function switchEl(checked, onChange, label) {
    const input = el("input", { type: "checkbox", checked, "aria-label": label });
    input.addEventListener("change", () => onChange(input.checked));
    return el("label", { class: "hs-switch" }, input, el("span", { class: "hs-switch__track" }, el("span", { class: "hs-switch__dot" })));
}

/* ---------- Pemilih produk bergambar ---------- */

/**
 * Admin cukup mengetuk foto produk. Urutan ketukan = urutan tampil.
 * selected: array id (diubah langsung), max: batas jumlah.
 */
function productPicker({ products, selected, max = 20, onChange, empty = "Belum ada produk dipilih." }) {
    const wrap = el("div", { class: "hs-picker" });
    const info = el("p", { class: "hs-picker__info" });
    const grid = el("div", { class: "hs-picker__grid" });

    function draw() {
        info.textContent = selected.length
            ? `${selected.length} dipilih${max < 99 ? ` dari maks. ${max}` : ""} · ketuk foto untuk memilih / melepas`
            : `${empty} Ketuk foto produk untuk memilih.`;
        grid.replaceChildren(...products.map((p) => {
            const id = String(p.id);
            const at = selected.indexOf(id);
            const tile = el("button", { class: `hs-pick${at >= 0 ? " is-on" : ""}`, type: "button", "aria-pressed": String(at >= 0), title: p.name },
                el("span", { class: "hs-pick__img" },
                    p.image_url ? el("img", { src: p.image_url, alt: "", loading: "lazy" }) : el("span", { class: "hs-pick__ph" }, p.name.charAt(0)),
                    at >= 0 ? el("span", { class: "hs-pick__num" }, String(at + 1)) : null),
                el("span", { class: "hs-pick__name" }, p.name));
            tile.addEventListener("click", () => {
                if (at >= 0) selected.splice(at, 1);
                else if (selected.length >= max) return toast(`Maksimal ${max} produk.`, "bad");
                else selected.push(id);
                draw();
                onChange();
            });
            return tile;
        }));
    }
    draw();
    wrap.append(info, grid);
    return wrap;
}

/* ---------- Geser bebas untuk mengurutkan (realtime) ---------- */

export function makeSortable(list, { handle, item: itemSelector = ".hs-block", onDrop }) {
    let drag = null;

    list.addEventListener("pointerdown", (event) => {
        const h = event.target.closest(handle);
        if (!h || !list.contains(h)) return;
        const item = h.closest(itemSelector);
        if (!item) return;
        event.preventDefault();
        const items = [...list.children];
        drag = {
            item,
            from: items.indexOf(item),
            to: items.indexOf(item),
            startY: event.clientY,
            rects: items.map((node) => node.getBoundingClientRect()),
            items,
            pointerId: event.pointerId,
        };
        h.setPointerCapture?.(event.pointerId);
        item.classList.add("is-dragging");
        list.classList.add("is-sorting");
    });

    list.addEventListener("pointermove", (event) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        const dy = event.clientY - drag.startY;
        drag.item.style.transform = `translateY(${dy}px) scale(1.01)`;
        const self = drag.rects[drag.from];
        const center = self.top + self.height / 2 + dy;
        let to = drag.from;
        drag.rects.forEach((r, i) => {
            const mid = r.top + r.height / 2;
            if (i > drag.from && center > mid) to = Math.max(to, i);
            if (i < drag.from && center < mid) to = Math.min(to, i);
        });
        drag.to = to;
        const gap = 12;
        drag.items.forEach((node, i) => {
            if (node === drag.item) return;
            let shift = 0;
            if (drag.from < to && i > drag.from && i <= to) shift = -(self.height + gap);
            if (drag.from > to && i < drag.from && i >= to) shift = self.height + gap;
            node.style.transform = shift ? `translateY(${shift}px)` : "";
        });
    });

    const end = () => {
        if (!drag) return;
        const { from, to, items } = drag;
        items.forEach((node) => (node.style.transform = ""));
        drag.item.classList.remove("is-dragging");
        list.classList.remove("is-sorting");
        drag = null;
        if (from !== to) onDrop(from, to);
    };
    list.addEventListener("pointerup", end);
    list.addEventListener("pointercancel", end);
}

/* ---------- Isi tiap blok ---------- */

function itemsKey(block) {
    return block.type === "jackpot" ? "rewards" : "items";
}

function itemCard(block, item, index, { onEdit, onRemove }) {
    const remove = el("button", { class: "hs-item__x", type: "button", "aria-label": "Hapus" }, "×");
    remove.addEventListener("click", (event) => {
        event.stopPropagation();
        onRemove();
    });
    let face;
    if (block.type === "coupons") {
        face = el("span", { class: "hs-item__ticket" }, el("strong", {}, item.title), el("small", {}, item.code));
    } else if (block.type === "jackpot") {
        const total = (block.rewards ?? []).reduce((s, r) => s + (Number(r.weight) || 0), 0) || 1;
        const pct = Math.round(((Number(item.weight) || 0) / total) * 100);
        face = el("span", { class: "hs-item__reward" },
            el("strong", {}, item.label),
            el("small", {}, item.code ? `kode ${item.code}` : "tanpa hadiah"),
            el("span", { class: "hs-item__bar" }, el("i", { style: `width:${pct}%` })),
            el("em", {}, `${pct}% peluang`));
    } else {
        face = el("span", { class: `hs-item__visual hs-item__visual--${index % 3}` },
            item.image ? el("img", { src: item.image, alt: "", loading: "lazy" }) : null,
            el("strong", {}, item.title));
    }
    const card = el("button", { class: `hs-item hs-item--${block.type}`, type: "button", title: "Ketuk untuk mengubah" }, face, remove);
    card.addEventListener("click", onEdit);
    return card;
}

/**
 * opts: { draft, products, onChange }
 * Mengembalikan { element, redraw, pendingFlags }.
 * Hero & Unggulan = tanda di produk (is_hero / is_featured), disimpan saat "Simpan homepage".
 */
export function homeEditor({ draft, products, onChange }) {
    const root = el("div", { class: "hs" });
    const open = new Set(["hero"]);

    const original = new Map(products.map((p) => [String(p.id), { is_hero: p.is_hero === true, is_featured: p.is_featured === true }]));
    const heroIds = products.filter((p) => p.is_hero).map((p) => String(p.id));
    const featuredIds = products.filter((p) => p.is_featured).map((p) => String(p.id));

    function pendingFlags() {
        const out = [];
        original.forEach((was, id) => {
            const now = { is_hero: heroIds.includes(id), is_featured: featuredIds.includes(id) };
            const changes = {};
            if (now.is_hero !== was.is_hero) changes.is_hero = now.is_hero;
            if (now.is_featured !== was.is_featured) changes.is_featured = now.is_featured;
            if (Object.keys(changes).length) out.push({ id, changes });
        });
        return out;
    }

    function markSaved() {
        original.forEach((_, id) => original.set(id, { is_hero: heroIds.includes(id), is_featured: featuredIds.includes(id) }));
    }

    async function editItem(block, index) {
        const key = itemsKey(block);
        const fields = (block.type === "jackpot" ? ITEM_FIELDS.rewards : ITEM_FIELDS[block.type])(block[key][index]);
        const meta = HOME_BLOCKS.find((b) => b.type === block.type);
        const answer = await formDialog({
            title: index < block[key].length ? `Ubah · ${meta.label}` : `Tambah · ${meta.label}`,
            fields,
            submitLabel: "Simpan",
        });
        if (!answer) return;
        if (answer.weight !== undefined) answer.weight = Number(answer.weight) || 1;
        block[key][index] = { ...(block[key][index] ?? {}), ...answer };
        block.sample = false;
        draw();
        onChange();
    }

    function toggleOpen(id) {
        if (open.has(id)) open.delete(id);
        else open.add(id);
        draw();
    }

    function shell({ id, iconKey, label, hint, sample, enabled, onToggle, body, sortable, fixed }) {
        const isOpen = open.has(id) && enabled !== false;
        const head = el("div", { class: "hs-block__head" },
            sortable ? grip() : el("span", { class: "hs-pin", title: "Posisi tetap" }, svgIcon("M9 4h6l-1 6 3 3H7l3-3zM12 13v8")),
            el("span", { class: "hs-block__icon" }, svgIcon(BLOCK_ICONS[iconKey])),
            el("button", { class: "hs-block__title", type: "button", onclick: () => toggleOpen(id) },
                el("strong", {}, label, sample ? el("span", { class: "hs-badge" }, "Contoh") : null, fixed ? el("span", { class: "hs-badge hs-badge--soft" }, "Posisi tetap di atas") : null),
                el("small", {}, hint)),
            onToggle ? switchEl(enabled !== false, onToggle, `Aktifkan ${label}`) : null,
            el("button", { class: `hs-chevron${isOpen ? " is-open" : ""}`, type: "button", "aria-label": isOpen ? "Tutup" : "Buka", onclick: () => toggleOpen(id) }, svgIcon("M6 9l6 6 6-6")));
        return el("article", { class: `hs-block${enabled === false ? " is-off" : ""}${isOpen ? " is-open" : ""}`, dataset: { id } },
            head,
            isOpen ? el("div", { class: "hs-block__body" }, body()) : null);
    }

    function titleInput(block, label) {
        const input = el("input", { class: "hs-input", maxlength: "60", value: block.title ?? "", placeholder: "Judul bagian (opsional)", "aria-label": `Judul ${label}` });
        input.addEventListener("input", () => {
            block.title = input.value;
            block.sample = false;
            onChange();
        });
        return el("label", { class: "hs-field" }, el("span", {}, "Judul di homepage"), input);
    }

    function blockBody(block, meta) {
        const nodes = [titleInput(block, meta.label)];
        if (block.type === "pinned") {
            nodes.push(productPicker({ products, selected: block.productIds, onChange: () => {
                block.sample = false;
                onChange();
            } }));
            return nodes;
        }
        if (block.type === "jackpot") {
            const text = el("input", { class: "hs-input", maxlength: "160", value: block.text ?? "", placeholder: "Keterangan kotak" });
            text.addEventListener("input", () => {
                block.text = text.value;
                onChange();
            });
            nodes.push(el("label", { class: "hs-field" }, el("span", {}, "Keterangan"), text));
        }
        const key = itemsKey(block);
        const grid = el("div", { class: `hs-items hs-items--${block.type}` });
        (block[key] ?? []).forEach((item, i) => grid.append(itemCard(block, item, i, {
            onEdit: () => editItem(block, i),
            onRemove: () => {
                block[key].splice(i, 1);
                block.sample = false;
                draw();
                onChange();
            },
        })));
        const add = el("button", { class: "hs-add", type: "button" }, el("span", {}, "+"), block.type === "jackpot" ? "Tambah hadiah" : "Tambah");
        add.addEventListener("click", () => editItem(block, (block[key] ?? []).length));
        grid.append(add);
        nodes.push(grid);
        return nodes;
    }

    function draw() {
        const fixed = el("div", { class: "hs-list" },
            shell({
                id: "hero", iconKey: "hero", label: "Banner atas (hero)", fixed: true,
                hint: "Slide besar paling atas. Foto & teksnya diisi di Katalog Master › Edit produk.",
                body: () => [productPicker({ products, selected: heroIds, max: PRODUCT_CONFIG.maxHeroSlides, onChange, empty: "Belum ada hero — homepage memakai banner bawaan." })],
            }),
            shell({
                id: "featured", iconKey: "featured", label: "Produk unggulan", fixed: true,
                hint: "Kartu putar 3D di bawah hero.",
                body: () => [productPicker({ products, selected: featuredIds, onChange, empty: "Belum ada produk unggulan." })],
            }));

        const sortList = el("div", { class: "hs-list hs-list--sort" });
        draft.home.blocks.forEach((block) => {
            const meta = HOME_BLOCKS.find((b) => b.type === block.type);
            sortList.append(shell({
                id: block.type, iconKey: block.type, label: meta.label, hint: meta.hint,
                sample: block.sample, enabled: block.enabled, sortable: true,
                onToggle: (on) => {
                    block.enabled = on;
                    if (on) open.add(block.type);
                    draw();
                    onChange();
                },
                body: () => blockBody(block, meta),
            }));
        });
        makeSortable(sortList, {
            handle: ".hs-grip",
            onDrop: (from, to) => {
                const blocks = draft.home.blocks;
                const [moved] = blocks.splice(from, 1);
                blocks.splice(to, 0, moved);
                draw();
                onChange();
            },
        });

        root.replaceChildren(
            el("p", { class: "hs-section" }, "Selalu di atas"),
            fixed,
            el("p", { class: "hs-section" }, "Blok promosi · tahan ⠿ lalu geser untuk mengatur urutan"),
            sortList);
    }

    draw();
    return { element: root, redraw: draw, pendingFlags, markSaved, heroIds, featuredIds };
}

/* ---------- Logo ---------- */

/** Perkecil gambar (maks 512 px) & jadikan PNG, transparansi tetap. */
async function shrinkImage(file, max = 512) {
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = () => reject(new Error("Gambar tidak bisa dibaca."));
            i.src = url;
        });
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        return { blob, dataUrl: canvas.toDataURL("image/png") };
    } finally {
        URL.revokeObjectURL(url);
    }
}

/** opts: { draft, isOwner, demo, onChange } */
export function logoField({ draft, isOwner, demo, onChange }) {
    const preview = el("div", { class: "erp-sf__logo" });
    const input = el("input", { type: "file", accept: "image/png,image/webp,image/jpeg", hidden: true });
    const pick = el("button", { class: "erp-btn", type: "button", disabled: !isOwner }, "Unggah logo");
    const clear = el("button", { class: "erp-btn erp-btn--ghost", type: "button", disabled: !isOwner }, "Hapus logo");

    function draw() {
        preview.replaceChildren(draft.brand.logo
            ? el("img", { src: draft.brand.logo, alt: "Logo brand" })
            : el("span", {}, "Belum ada logo · nama brand yang tampil"));
        clear.hidden = !draft.brand.logo;
    }

    pick.addEventListener("click", () => input.click());
    input.addEventListener("change", async () => {
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) return toast("Ukuran logo maksimal 3 MB.", "bad");
        pick.disabled = true;
        pick.textContent = "Memproses…";
        try {
            const { blob, dataUrl } = await shrinkImage(file);
            if (demo) {
                draft.brand.logo = dataUrl;
            } else {
                const png = new File([blob], "logo.png", { type: "image/png" });
                draft.brand.logo = await uploadProductImage(png);
            }
            draw();
            onChange();
            toast("Logo siap. Tekan Simpan brand untuk memasangnya.");
        } catch (error) {
            toast(friendlyError(error), "bad");
        } finally {
            pick.disabled = !isOwner;
            pick.textContent = "Unggah logo";
        }
    });
    clear.addEventListener("click", () => {
        draft.brand.logo = "";
        draw();
        onChange();
    });
    draw();

    return el("div", { class: "erp-field" },
        el("span", {}, "Logo (PNG transparan disarankan)"),
        el("div", { class: "erp-sf__logo-row" }, preview, el("div", { class: "erp-sf__actions" }, pick, clear), input),
        el("small", {}, "Menggantikan tulisan nama brand di header toko & dashboard. Merapikan logo dengan AI (hapus latar, perjelas) menyusul di tahap AI."));
}

export { clone };
