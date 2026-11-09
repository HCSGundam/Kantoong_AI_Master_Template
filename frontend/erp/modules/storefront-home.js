/**
 * KANTOONG ERP — PENGATUR HOMEPAGE (zona promosi) & LOGO BRAND
 * File: frontend/erp/modules/storefront-home.js
 * Dipakai modules/storefront.js. Semua blok opsional: nyalakan, matikan, urutkan.
 */

import { el, formDialog, toast, friendlyError } from "../ui.js";
import { HOME_BLOCKS } from "../../js/storefront-settings.js";
import { uploadProductImage } from "../data/product-service.js";

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

function summaryOf(block, products) {
    if (block.type === "jackpot") return `${block.rewards?.length ?? 0} hadiah`;
    if (block.type === "pinned") {
        const names = new Map(products.map((p) => [String(p.id), p.name]));
        const list = (block.productIds ?? []).map((id) => names.get(id)).filter(Boolean);
        return list.length ? list.join(", ") : "Belum ada produk";
    }
    return `${block.items?.length ?? 0} isi`;
}

/**
 * opts: { draft, products, onChange }
 * Mengembalikan elemen kartu pengatur homepage.
 */
export function homeEditor({ draft, products, onChange }) {
    const list = el("div", { class: "erp-sf__blocks" });

    function itemsKey(block) {
        return block.type === "jackpot" ? "rewards" : "items";
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

    async function editPinned(block) {
        const answer = await formDialog({
            title: "Produk pilihan admin",
            submitLabel: "Simpan",
            fields: [
                { name: "title", label: "Judul baris", value: block.title, max: 60 },
                { name: "ids", label: "Produk yang disematkan", type: "checkboxes", value: block.productIds, options: products.map((p) => ({ value: String(p.id), label: p.name })) },
            ],
        });
        if (!answer) return;
        block.title = answer.title;
        block.productIds = answer.ids;
        block.sample = false;
        draw();
        onChange();
    }

    function blockCard(block, index) {
        const meta = HOME_BLOCKS.find((b) => b.type === block.type);
        const blocks = draft.home.blocks;
        const toggle = el("input", { type: "checkbox", checked: block.enabled });
        toggle.addEventListener("change", () => {
            block.enabled = toggle.checked;
            draw();
            onChange();
        });
        const up = el("button", { class: "erp-btn erp-btn--ghost erp-sf__move", type: "button", disabled: index === 0, "aria-label": "Naikkan" }, "↑");
        const down = el("button", { class: "erp-btn erp-btn--ghost erp-sf__move", type: "button", disabled: index === blocks.length - 1, "aria-label": "Turunkan" }, "↓");
        up.addEventListener("click", () => {
            [blocks[index - 1], blocks[index]] = [blocks[index], blocks[index - 1]];
            draw();
            onChange();
        });
        down.addEventListener("click", () => {
            [blocks[index + 1], blocks[index]] = [blocks[index], blocks[index + 1]];
            draw();
            onChange();
        });

        const title = el("input", { class: "erp-input", maxlength: "60", value: block.title ?? "", placeholder: "Judul bagian (opsional)", "aria-label": `Judul ${meta.label}` });
        title.addEventListener("input", () => {
            block.title = title.value;
            block.sample = false;
            onChange();
        });

        const body = el("div", { class: "erp-sf__items" });
        if (block.type === "pinned") {
            body.append(el("p", { class: "erp-sf__hint" }, summaryOf(block, products)),
                el("button", { class: "erp-btn", type: "button", onclick: () => editPinned(block) }, "Pilih produk"));
        } else {
            const key = itemsKey(block);
            if (block.type === "jackpot") {
                const text = el("input", { class: "erp-input", maxlength: "160", value: block.text ?? "", placeholder: "Keterangan kotak" });
                text.addEventListener("input", () => {
                    block.text = text.value;
                    onChange();
                });
                body.append(text);
            }
            (block[key] ?? []).forEach((it, i) => {
                const remove = el("button", { class: "erp-sf__chip-x", type: "button", "aria-label": "Hapus" }, "×");
                remove.addEventListener("click", () => {
                    block[key].splice(i, 1);
                    block.sample = false;
                    draw();
                    onChange();
                });
                const label = it.title || it.label || it.code;
                const extra = block.type === "coupons" ? ` · ${it.code}` : block.type === "jackpot" ? ` · peluang ${it.weight}` : "";
                body.append(el("div", { class: "erp-sf__item" },
                    el("button", { class: "erp-sf__item-edit", type: "button", onclick: () => editItem(block, i) }, `${label}${extra}`),
                    remove));
            });
            body.append(el("button", { class: "erp-btn erp-btn--ghost", type: "button", onclick: () => editItem(block, (block[key] ?? []).length) }, "+ Tambah"));
        }

        return el("article", { class: `erp-sf__cat${block.enabled ? "" : " is-hidden"}` },
            el("div", { class: "erp-sf__cat-head" },
                el("div", { class: "erp-sf__order" }, up, down),
                el("div", {},
                    el("strong", {}, meta.label, block.sample ? el("span", { class: "erp-sf__sample" }, "contoh") : null),
                    el("p", { class: "erp-sf__hint" }, meta.hint)),
                el("label", { class: "erp-sf__toggle" }, toggle, "Aktif")),
            block.enabled ? title : null,
            block.enabled ? body : null);
    }

    function draw() {
        list.replaceChildren(...draft.home.blocks.map(blockCard));
    }
    draw();
    return { element: list, redraw: draw };
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
