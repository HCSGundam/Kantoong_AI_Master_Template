/**
 * KANTOONG ERP — PENGATUR HOMEPAGE (zona promosi) & LOGO BRAND
 * File: frontend/erp/modules/storefront-home.js
 * Dipakai modules/storefront.js. Semua blok opsional: nyalakan, matikan, urutkan.
 */

import { el, formDialog, toast, friendlyError } from "../ui.js";
import { HOME_BLOCKS, MEDIA_LAYOUTS, MEDIA_RATIOS, RAIL_SOURCES, blankBlock } from "../../js/storefront-settings.js";
import { PRODUCT_CONFIG, uploadProductImage } from "../data/product-service.js";

const clone = (v) => JSON.parse(JSON.stringify(v));

/* ---------- Unggah gambar (bukan tempel link) ---------- */

/** Perkecil gambar sebelum disimpan. PNG tetap PNG (transparan), lainnya JPG. */
async function shrinkAny(file, max) {
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
        const png = file.type === "image/png";
        const type = png ? "image/png" : "image/jpeg";
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.86));
        return { blob, type, dataUrl: canvas.toDataURL(type, 0.82) };
    } finally {
        URL.revokeObjectURL(url);
    }
}

export async function uploadImage(file, { demo }) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Format gambar harus PNG, JPG, atau WebP.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Ukuran gambar maksimal 8 MB.");
    const { blob, type, dataUrl } = await shrinkAny(file, demo ? 900 : 1800);
    if (demo) return dataUrl;
    return uploadProductImage(new File([blob], type === "image/png" ? "gambar.png" : "gambar.jpg", { type }));
}

/**
 * Dialog isi item dengan kolom GAMBAR yang bisa diunggah langsung.
 * fields: [{ name, label, type?, value?, options?, max?, required?, hint?, placeholder? }]
 */
function itemDialog({ title, fields, image = null, ratio = "16:9", demo = false }) {
    return new Promise((resolve) => {
        const dialog = el("dialog", { class: "erp-dialog hs-dialog" });
        const form = el("form", { method: "dialog", class: "erp-form" });
        form.append(el("h2", { class: "erp-dialog__title" }, title));

        let imageUrl = image?.value ?? "";
        if (image) {
            const [w, h] = ratio.split(":").map(Number);
            const box = el("div", { class: "hs-upload__box", style: `aspect-ratio:${w} / ${h}` });
            const fileInput = el("input", { type: "file", accept: "image/png,image/jpeg,image/webp", hidden: true });
            const pick = el("button", { class: "erp-btn", type: "button" }, "Unggah gambar");
            const clear = el("button", { class: "erp-btn erp-btn--ghost", type: "button" }, "Hapus");
            const draw = () => {
                box.replaceChildren(imageUrl ? el("img", { src: imageUrl, alt: "" }) : el("span", {}, "Belum ada gambar · ketuk Unggah"));
                clear.hidden = !imageUrl;
            };
            box.addEventListener("click", () => fileInput.click());
            pick.addEventListener("click", () => fileInput.click());
            clear.addEventListener("click", () => {
                imageUrl = "";
                draw();
            });
            fileInput.addEventListener("change", async () => {
                const file = fileInput.files?.[0];
                fileInput.value = "";
                if (!file) return;
                pick.disabled = true;
                pick.textContent = "Mengunggah…";
                try {
                    imageUrl = await uploadImage(file, { demo });
                    draw();
                } catch (error) {
                    toast(friendlyError(error), "bad");
                } finally {
                    pick.disabled = false;
                    pick.textContent = "Unggah gambar";
                }
            });
            draw();
            form.append(el("div", { class: "erp-field hs-upload" },
                el("span", {}, `${image.label ?? "Gambar"} · rasio ${ratio}`),
                box,
                el("div", { class: "erp-sf__actions hs-upload__actions" }, pick, clear),
                fileInput));
        }

        fields.forEach((field) => {
            let input;
            if (field.type === "select") {
                input = el("select", { name: field.name }, field.options.map((o) => el("option", { value: o.value, selected: String(o.value) === String(field.value ?? "") }, o.label)));
            } else if (field.type === "textarea") {
                input = el("textarea", { name: field.name, rows: 3, maxlength: field.max || 500, placeholder: field.placeholder });
                input.value = field.value ?? "";
            } else {
                input = el("input", { name: field.name, type: field.type || "text", required: field.required, min: field.min, max: field.type === "number" ? field.max : null, maxlength: field.type !== "number" ? field.max : null, placeholder: field.placeholder });
                input.value = field.value ?? "";
            }
            form.append(el("label", { class: "erp-field" }, el("span", {}, field.label), input, field.hint ? el("small", {}, field.hint) : null));
        });

        form.append(el("div", { class: "erp-form__actions" },
            el("span", { class: "erp-spacer" }),
            el("button", { type: "button", class: "erp-btn", onclick: () => dialog.close("cancel") }, "Batal"),
            el("button", { type: "submit", class: "erp-btn erp-btn--primary" }, "Simpan")));

        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const data = {};
            fields.forEach((f) => (data[f.name] = form.elements[f.name].value));
            if (image) data[image.name] = imageUrl;
            dialog.returnValue = "ok";
            dialog.close();
            resolve(data);
        });
        dialog.addEventListener("close", () => {
            if (dialog.returnValue !== "ok") resolve(null);
            dialog.remove();
        });
        dialog.append(form);
        document.body.append(dialog);
        dialog.showModal();
    });
}

/* ---------- Isian per jenis bagian ---------- */

const ACTIONS = [
    { value: "catalog", label: "Katalog produk" },
    { value: "chat", label: "Chat asisten AI" },
    { value: "none", label: "Tanpa tombol" },
];

const ITEM_SPEC = {
    banner: (it = {}) => ({
        image: { name: "image", label: "Gambar latar (opsional)", value: it.image }, ratio: "16:9",
        fields: [
            { name: "title", label: "Judul", value: it.title, max: 60, required: true },
            { name: "text", label: "Keterangan", type: "textarea", value: it.text, max: 160 },
            { name: "cta", label: "Tulisan tombol", value: it.cta ?? "Lihat produk", max: 30 },
            { name: "action", label: "Tombol membuka", type: "select", value: it.action ?? "catalog", options: ACTIONS },
        ],
    }),
    coupons: (it = {}) => ({
        fields: [
            { name: "title", label: "Judul kupon", value: it.title, max: 40, required: true, placeholder: "Diskon 10%" },
            { name: "code", label: "Kode", value: it.code, max: 20, required: true, placeholder: "HEMAT10", hint: "Buat juga kode yang sama di menu Voucher (CRM) agar berlaku saat checkout." },
            { name: "text", label: "Syarat singkat", value: it.text, max: 100, placeholder: "Min. belanja Rp 50.000" },
            { name: "expires", label: "Berlaku sampai", type: "date", value: it.expires },
        ],
    }),
    posters: (it = {}) => ({
        image: { name: "image", label: "Gambar poster", value: it.image }, ratio: "4:5",
        fields: [
            { name: "title", label: "Judul", value: it.title, max: 60, required: true },
            { name: "text", label: "Keterangan", value: it.text, max: 120 },
        ],
    }),
    media: (it = {}, block) => ({
        image: { name: "image", label: "Gambar", value: it.image }, ratio: block.ratio,
        fields: [
            { name: "title", label: "Nama / judul (opsional)", value: it.title, max: 60, placeholder: "Contoh: nama brand mitra" },
            { name: "text", label: "Keterangan (opsional)", value: it.text, max: 120 },
            { name: "link", label: "Tautan saat diketuk (opsional, https)", value: it.link, placeholder: "https://…" },
        ],
    }),
    rewards: (it = {}) => ({
        fields: [
            { name: "label", label: "Hadiah", value: it.label, max: 50, required: true, placeholder: "Diskon 5%" },
            { name: "code", label: "Kode (kosongkan untuk 'coba lagi besok')", value: it.code, max: 20 },
            { name: "weight", label: "Peluang (1–100, makin besar makin sering)", type: "number", min: 1, max: 100, value: it.weight ?? 10 },
        ],
    }),
};

/* ---------- Ikon bagian ---------- */

const BLOCK_ICONS = {
    hero: "M3 5h18v11H3zM7 20h10M12 16v4",
    featured: "M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.6 6.7 19.4l1.2-6L3.4 9.3l6-.7z",
    rail: "M3 7h5v10H3zM10 5h5v14h-5zM17 7h4v10h-4z",
    media: "M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4M15.5 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
    banner: "M4 6h16v10H4zM8 20h8",
    coupons: "M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 1 0-4V4H3zM9 4v16",
    jackpot: "M4 10h16v10H4zM3 6h18v4H3zM12 6v14M12 6c-2-3-6-3-6 0M12 6c2-3 6-3 6 0",
    posters: "M5 3h14v18H5zM8 15l3-3 2 2 3-3",
    text: "M5 6h14M5 11h14M5 16h9",
    pinned: "M9 4h6l-1 6 3 3H7l3-3zM12 13v8",
    trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
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
    const g = el("span", { class: "hs-grip", "aria-hidden": "true", title: "Tahan lalu geser" });
    for (let i = 0; i < 6; i++) g.append(el("i"));
    return g;
}

function switchEl(checked, onChange, label) {
    const input = el("input", { type: "checkbox", checked, "aria-label": label });
    input.addEventListener("change", () => onChange(input.checked));
    return el("label", { class: "hs-switch" }, input, el("span", { class: "hs-switch__track" }, el("span", { class: "hs-switch__dot" })));
}

function chipGroup(options, value, onPick) {
    return el("div", { class: "hs-chips" }, options.map((o) => {
        const id = typeof o === "string" ? o : o.id;
        const label = typeof o === "string" ? o : o.label;
        const b = el("button", { class: `hs-chip${id === value ? " is-on" : ""}`, type: "button", "aria-pressed": String(id === value) }, label);
        b.addEventListener("click", () => onPick(id));
        return b;
    }));
}

/* ---------- Pemilih produk bergambar ---------- */

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
        if (!item || item.parentElement !== list) return;
        event.preventDefault();
        const items = [...list.children].filter((node) => node.matches(itemSelector));
        drag = {
            item,
            from: items.indexOf(item),
            to: items.indexOf(item),
            startY: event.clientY,
            rects: items.map((node) => node.getBoundingClientRect()),
            items,
            pointerId: event.pointerId,
            gap: parseFloat(getComputedStyle(list).rowGap) || 12,
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
        drag.items.forEach((node, i) => {
            if (node === drag.item) return;
            let shift = 0;
            if (drag.from < to && i > drag.from && i <= to) shift = -(self.height + drag.gap);
            if (drag.from > to && i < drag.from && i >= to) shift = self.height + drag.gap;
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

/* ---------- Kartu isi ---------- */

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
    } else if (block.type === "media") {
        const [w, h] = block.ratio.split(":").map(Number);
        face = el("span", { class: `hs-item__media${block.fit === "contain" ? " is-contain" : ""}`, style: `aspect-ratio:${w} / ${h}` },
            item.image ? el("img", { src: item.image, alt: "", loading: "lazy" }) : el("b", {}, (item.title || "?").slice(0, 2)),
            item.title ? el("small", {}, item.title) : null);
    } else {
        face = el("span", { class: `hs-item__visual hs-item__visual--${index % 3}` },
            item.image ? el("img", { src: item.image, alt: "", loading: "lazy" }) : null,
            el("strong", {}, item.title));
    }
    const card = el("button", { class: `hs-item hs-item--${block.type}`, type: "button", title: "Ketuk untuk mengubah" }, face, remove);
    card.addEventListener("click", onEdit);
    return card;
}

/* ---------- Pemilih jenis bagian baru ---------- */

function chooseBlockType() {
    return new Promise((resolve) => {
        const dialog = el("dialog", { class: "erp-dialog hs-dialog hs-chooser" });
        const options = [
            ...HOME_BLOCKS.map((b) => ({ type: b.type, preset: "", label: b.label, hint: b.hint })),
            { type: "media", preset: "logos", label: "Logo mitra / brand partner", hint: "Galeri logo rasio 1:1, gambar utuh, bisa digeser" },
        ];
        const grid = el("div", { class: "hs-chooser__grid" }, options.map((o) => {
            const b = el("button", { class: "hs-chooser__card", type: "button" },
                el("span", { class: "hs-block__icon" }, svgIcon(BLOCK_ICONS[o.type])),
                el("strong", {}, o.label),
                el("small", {}, o.hint));
            b.addEventListener("click", () => {
                dialog.returnValue = "ok";
                dialog.close();
                resolve(o);
            });
            return b;
        }));
        dialog.append(el("div", { class: "erp-form" },
            el("h2", { class: "erp-dialog__title" }, "Tambah bagian ke homepage"),
            el("p", { class: "erp-muted" }, "Bebas pilih apa saja yang ingin dipajang di etalase depan tokomu. Bisa ditambah berkali-kali."),
            grid,
            el("div", { class: "erp-form__actions" }, el("span", { class: "erp-spacer" }), el("button", { class: "erp-btn", type: "button", onclick: () => dialog.close("cancel") }, "Batal"))));
        dialog.addEventListener("close", () => {
            if (dialog.returnValue !== "ok") resolve(null);
            dialog.remove();
        });
        document.body.append(dialog);
        dialog.showModal();
    });
}

/**
 * opts: { draft, products, onChange, demo }
 * Mengembalikan { element, redraw, pendingFlags, markSaved, heroIds, featuredIds }.
 * Hero & Unggulan = tanda di produk (is_hero / is_featured), disimpan saat "Simpan homepage".
 */
export function homeEditor({ draft, products, onChange, demo = false }) {
    const root = el("div", { class: "hs" });
    const open = new Set(["hero"]);
    const categories = [...new Set(products.map((p) => String(p.category ?? "").trim()).filter(Boolean))];

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

    const changed = (block) => {
        if (block) block.sample = false;
        onChange();
    };

    async function editItem(block, index) {
        const key = itemsKey(block);
        const spec = (block.type === "jackpot" ? ITEM_SPEC.rewards : ITEM_SPEC[block.type])(block[key][index], block);
        const meta = HOME_BLOCKS.find((b) => b.type === block.type);
        const answer = await itemDialog({
            title: index < block[key].length ? `Ubah · ${meta.label}` : `Tambah · ${meta.label}`,
            fields: spec.fields,
            image: spec.image ?? null,
            ratio: spec.ratio,
            demo,
        });
        if (!answer) return;
        if (answer.weight !== undefined) answer.weight = Number(answer.weight) || 1;
        block[key][index] = { ...(block[key][index] ?? {}), ...answer };
        draw();
        changed(block);
    }

    function toggleOpen(id) {
        if (open.has(id)) open.delete(id);
        else open.add(id);
        draw();
    }

    function shell({ id, iconKey, label, hint, sample, enabled, onToggle, onDelete, body, sortable, fixed }) {
        const isOpen = open.has(id) && enabled !== false;
        const head = el("div", { class: "hs-block__head" },
            sortable ? grip() : el("span", { class: "hs-pin", title: "Posisi tetap" }, svgIcon(BLOCK_ICONS.pinned)),
            el("span", { class: "hs-block__icon" }, svgIcon(BLOCK_ICONS[iconKey])),
            el("button", { class: "hs-block__title", type: "button", onclick: () => toggleOpen(id) },
                el("strong", {}, label, sample ? el("span", { class: "hs-badge" }, "Contoh") : null, fixed ? el("span", { class: "hs-badge hs-badge--soft" }, "Posisi tetap di atas") : null),
                el("small", {}, hint)),
            el("div", { class: "hs-block__tools" },
                onDelete ? el("button", { class: "hs-icon-btn", type: "button", "aria-label": `Hapus ${label}`, title: "Hapus bagian", onclick: onDelete }, svgIcon(BLOCK_ICONS.trash)) : null,
                onToggle ? switchEl(enabled !== false, onToggle, `Aktifkan ${label}`) : null,
                el("button", { class: `hs-chevron${isOpen ? " is-open" : ""}`, type: "button", "aria-label": isOpen ? "Tutup" : "Buka", onclick: () => toggleOpen(id) }, svgIcon("M6 9l6 6 6-6"))));
        return el("article", { class: `hs-block${enabled === false ? " is-off" : ""}${isOpen ? " is-open" : ""}`, dataset: { id } },
            head,
            isOpen ? el("div", { class: "hs-block__body" }, body()) : null);
    }

    function textField(label, value, onInput, { max = 60, placeholder = "", area = false } = {}) {
        const input = el(area ? "textarea" : "input", { class: "hs-input", maxlength: String(max), placeholder, rows: area ? 4 : null });
        input.value = value ?? "";
        input.addEventListener("input", () => onInput(input.value));
        return el("label", { class: "hs-field" }, el("span", {}, label), input);
    }

    function itemsGrid(block) {
        const key = itemsKey(block);
        const grid = el("div", { class: `hs-items hs-items--${block.type}` });
        (block[key] ?? []).forEach((item, i) => grid.append(itemCard(block, item, i, {
            onEdit: () => editItem(block, i),
            onRemove: () => {
                block[key].splice(i, 1);
                draw();
                changed(block);
            },
        })));
        const add = el("button", { class: "hs-add", type: "button" }, el("span", {}, "+"), block.type === "jackpot" ? "Tambah hadiah" : "Tambah isi");
        add.addEventListener("click", () => editItem(block, (block[key] ?? []).length));
        grid.append(add);
        return grid;
    }

    function blockBody(block) {
        const nodes = [textField("Judul di homepage", block.title, (v) => {
            block.title = v;
            changed(block);
        }, { placeholder: "Judul bagian (opsional)" })];

        if (block.type === "rail") {
            nodes.push(
                textField("Tulisan kecil di atas judul", block.eyebrow, (v) => {
                    block.eyebrow = v;
                    changed(block);
                }, { max: 40, placeholder: "Paling laris" }),
                textField("Keterangan", block.text, (v) => {
                    block.text = v;
                    changed(block);
                }, { max: 160 }),
                el("div", { class: "hs-field" }, el("span", {}, "Isi rel"), chipGroup(RAIL_SOURCES, block.source, (v) => {
                    block.source = v;
                    draw();
                    changed(block);
                })));
            if (block.source === "kategori") {
                nodes.push(el("div", { class: "hs-field" }, el("span", {}, "Kategori"), categories.length
                    ? chipGroup(categories, block.category, (v) => {
                        block.category = v;
                        draw();
                        changed(block);
                    })
                    : el("p", { class: "erp-muted" }, "Belum ada kategori di produk.")));
            }
            if (block.source === "manual") {
                nodes.push(productPicker({ products, selected: block.productIds, max: 30, onChange: () => changed(block) }));
            } else {
                nodes.push(el("div", { class: "hs-field" }, el("span", {}, "Jumlah produk maksimal"), chipGroup(["5", "8", "10", "15", "20"], String(block.limit), (v) => {
                    block.limit = Number(v);
                    draw();
                    changed(block);
                })));
            }
            return nodes;
        }

        if (block.type === "media") {
            nodes.push(
                el("div", { class: "hs-field" }, el("span", {}, "Rasio gambar"), chipGroup(MEDIA_RATIOS, block.ratio, (v) => {
                    block.ratio = v;
                    draw();
                    changed(block);
                })),
                el("div", { class: "hs-row" },
                    el("div", { class: "hs-field" }, el("span", {}, "Susunan"), chipGroup(MEDIA_LAYOUTS, block.layout, (v) => {
                        block.layout = v;
                        draw();
                        changed(block);
                    })),
                    el("div", { class: "hs-field" }, el("span", {}, "Kolom (laptop)"), chipGroup(["2", "3", "4", "5", "6", "8"], String(block.columns), (v) => {
                        block.columns = Number(v);
                        draw();
                        changed(block);
                    })),
                    el("div", { class: "hs-field" }, el("span", {}, "Gambar"), chipGroup([{ id: "cover", label: "Penuh" }, { id: "contain", label: "Utuh (logo)" }], block.fit, (v) => {
                        block.fit = v;
                        draw();
                        changed(block);
                    }))),
                itemsGrid(block));
            return nodes;
        }

        if (block.type === "text") {
            nodes.push(
                textField("Isi teks", block.text, (v) => {
                    block.text = v;
                    changed(block);
                }, { max: 600, area: true }),
                el("div", { class: "hs-row" },
                    textField("Tulisan tombol (opsional)", block.cta, (v) => {
                        block.cta = v;
                        changed(block);
                    }, { max: 30 }),
                    el("div", { class: "hs-field" }, el("span", {}, "Tombol membuka"), chipGroup(ACTIONS.map((a) => ({ id: a.value, label: a.label })), block.action, (v) => {
                        block.action = v;
                        draw();
                        changed(block);
                    }))));
            return nodes;
        }

        if (block.type === "pinned") {
            nodes.push(productPicker({ products, selected: block.productIds, onChange: () => changed(block) }));
            return nodes;
        }

        if (block.type === "jackpot") {
            nodes.push(textField("Keterangan", block.text, (v) => {
                block.text = v;
                changed(block);
            }, { max: 160 }));
        }
        nodes.push(itemsGrid(block));
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
                hint: "Kartu putar 3D tepat di bawah hero.",
                body: () => [productPicker({ products, selected: featuredIds, onChange, empty: "Belum ada produk unggulan." })],
            }));

        const blocks = draft.home.blocks;
        const sortList = el("div", { class: "hs-list hs-list--sort" });
        blocks.forEach((block, index) => {
            const meta = HOME_BLOCKS.find((b) => b.type === block.type);
            sortList.append(shell({
                id: block.id, iconKey: block.type,
                label: block.title ? `${block.title}` : meta.label,
                hint: block.title ? meta.label : meta.hint,
                sample: block.sample, enabled: block.enabled, sortable: true,
                onToggle: (on) => {
                    block.enabled = on;
                    if (on) open.add(block.id);
                    draw();
                    onChange();
                },
                onDelete: () => {
                    blocks.splice(index, 1);
                    draw();
                    onChange();
                    toast(`Bagian "${block.title || meta.label}" dihapus. Tekan Simpan homepage untuk menerapkan.`);
                },
                body: () => blockBody(block),
            }));
        });
        makeSortable(sortList, {
            handle: ".hs-grip",
            onDrop: (from, to) => {
                const [moved] = blocks.splice(from, 1);
                blocks.splice(to, 0, moved);
                draw();
                onChange();
            },
        });

        const addSection = el("button", { class: "hs-add-section", type: "button" },
            el("span", {}, "+"), el("strong", {}, "Tambah bagian"), el("small", {}, "Rel produk, galeri bebas, logo mitra, banner, kupon, teks…"));
        addSection.addEventListener("click", async () => {
            const choice = await chooseBlockType();
            if (!choice) return;
            const block = blankBlock(choice.type, choice.preset);
            blocks.push(block);
            open.add(block.id);
            draw();
            onChange();
            root.querySelector(`[data-id="${block.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        });

        root.replaceChildren(
            el("p", { class: "hs-section" }, "Selalu di atas"),
            fixed,
            el("p", { class: "hs-section" }, "Bagian homepage · tahan ⠿ lalu geser untuk mengatur urutan"),
            blocks.length ? sortList : el("p", { class: "erp-muted" }, "Belum ada bagian. Tambahkan apa pun yang ingin kamu pajang."),
            addSection);
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
