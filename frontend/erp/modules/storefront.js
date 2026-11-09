/**
 * KANTOONG ERP — ETALASE & BRAND
 * File: frontend/erp/modules/storefront.js
 *
 * - Nama brand & slogan (HANYA OWNER). Tampil seragam di toko, dashboard user, dll.
 * - Katalog: nama tampilan kategori, urutan, sembunyikan, dan saran filter per
 *   kategori (admin/sales/marketing). Jumlah slot saran bisa diatur.
 * - PRATINJAU realtime: setiap ketikan langsung terlihat (desktop = panel samping,
 *   HP = pop-up). Setelah disimpan, toko & dashboard pelanggan ikut berubah
 *   saat itu juga (Supabase Realtime) — tanpa perlu membuka homepage.
 */

import { el, formDialog, pageHeader, toast, friendlyError } from "../ui.js";
import {
    CHIP_KINDS,
    DEFAULT_CHIPS,
    chipLabel,
    getStorefront,
    loadStorefront,
    saveStorefront,
    sanitizeStorefront,
} from "../../js/storefront-settings.js";
import { renderCatalog } from "../../dashboard-user/home/catalog-view.js";
import "../../dashboard-user/home/home.css";

const clone = (v) => JSON.parse(JSON.stringify(v));

export async function render(ctx) {
    const { data, me } = ctx;
    const demo = data.mode === "demo";
    const isOwner = me.level >= 5;

    await loadStorefront();
    const saved = getStorefront();
    const draft = clone(saved);
    const products = (await data.listProducts()).filter((p) => p.is_published !== false);
    const categories = [...new Set(products.map((p) => String(p.category ?? "").trim() || "Lainnya"))]
        .sort((a, b) => (draft.catalog.categories[a]?.order ?? 999) - (draft.catalog.categories[b]?.order ?? 999) || a.localeCompare(b, "id"));

    const page = el("div", { class: "erp-page__inner erp-sf" });

    /* ---------- Pratinjau ---------- */

    const previewInner = el("div", { class: "erp-sf__screen" });
    const previewWrap = el("div", { class: "dashboard-user erp-sf__phone" }, previewInner);
    const syncTheme = () => (previewWrap.dataset.theme = document.documentElement.dataset.theme || "light");
    syncTheme();
    const view = renderCatalog(previewInner, {
        products,
        settings: draft,
        compact: true,
        sheetHost: previewWrap,
        onOpenProduct: () => toast("Di toko, ketukan ini membuka halaman produk."),
    });
    const refresh = () => {
        syncTheme();
        view.update(sanitizeStorefront(draft));
        brandPreview.textContent = draft.brand.name || "Nama brand";
        dirty();
    };

    const brandPreview = el("strong", { class: "erp-sf__brand" }, draft.brand.name);
    const preview = el("aside", { class: "erp-sf__preview", "aria-label": "Pratinjau katalog" },
        el("div", { class: "erp-sf__preview-head" },
            el("span", { class: "erp-sf__live" }, "● Pratinjau langsung"),
            brandPreview),
        previewWrap);

    /* ---------- Brand ---------- */

    const nameInput = el("input", { class: "erp-input", maxlength: "60", value: draft.brand.name, disabled: !isOwner, "aria-label": "Nama brand" });
    const taglineInput = el("input", { class: "erp-input", maxlength: "120", value: draft.brand.tagline, placeholder: "Contoh: Susu segar setiap hari", disabled: !isOwner, "aria-label": "Slogan" });
    nameInput.addEventListener("input", () => {
        draft.brand.name = nameInput.value;
        refresh();
    });
    taglineInput.addEventListener("input", () => {
        draft.brand.tagline = taglineInput.value;
        refresh();
    });
    const saveBrand = el("button", { class: "erp-btn erp-btn--primary", type: "button", disabled: !isOwner }, "Simpan brand");
    saveBrand.addEventListener("click", async () => {
        if (!draft.brand.name.trim()) return toast("Nama brand wajib diisi.", "bad");
        saveBrand.disabled = true;
        try {
            await saveStorefront("brand", draft.brand, { demo });
            Object.assign(saved, clone(getStorefront()));
            toast("Nama brand tersimpan · toko & dashboard langsung berubah.");
            dirty();
        } catch (error) {
            toast(friendlyError(error), "bad");
        } finally {
            saveBrand.disabled = !isOwner;
        }
    });

    const brandCard = el("section", { class: "erp-card erp-sf__card" },
        el("div", { class: "erp-card__head" }, el("h2", {}, "Identitas brand")),
        el("p", { class: "erp-muted" }, isOwner
            ? "Nama ini tampil seragam di header toko, tab browser, dashboard pelanggan, dan asisten."
            : "🔒 Hanya owner yang bisa mengubah nama brand."),
        el("label", { class: "erp-field" }, el("span", {}, "Nama brand"), nameInput),
        el("label", { class: "erp-field" }, el("span", {}, "Slogan (opsional)"), taglineInput),
        el("div", { class: "erp-sf__actions" }, saveBrand));

    /* ---------- Katalog ---------- */

    const limitInput = el("input", { class: "erp-input erp-sf__limit", type: "number", min: "1", max: "20", value: String(draft.catalog.chipLimit), "aria-label": "Jumlah slot saran" });
    limitInput.addEventListener("input", () => {
        draft.catalog.chipLimit = Number(limitInput.value) || 1;
        refresh();
    });

    const list = el("div", { class: "erp-sf__cats" });

    function catEntry(key) {
        return draft.catalog.categories[key] ?? (draft.catalog.categories[key] = { label: "", order: 999, hidden: false });
    }

    function chipsOf(key) {
        if (!Array.isArray(draft.catalog.chips[key]) || !draft.catalog.chips[key].length) {
            const fallback = draft.catalog.chips["*"]?.length
                ? draft.catalog.chips["*"]
                : DEFAULT_CHIPS.map((kind) => ({ kind, label: CHIP_KINDS.find((k) => k.kind === kind).label }));
            draft.catalog.chips[key] = clone(fallback);
        }
        return draft.catalog.chips[key];
    }

    function chipEditor(key) {
        const chips = chipsOf(key);
        const wrap = el("div", { class: "erp-sf__chips" });
        chips.forEach((chip, i) => {
            const x = el("button", { class: "erp-sf__chip-x", type: "button", "aria-label": `Hapus saran ${chipLabel(chip)}` }, "×");
            x.addEventListener("click", () => {
                chips.splice(i, 1);
                drawCats();
                refresh();
            });
            const left = el("button", { class: "erp-sf__chip-move", type: "button", "aria-label": "Geser ke kiri", disabled: i === 0 }, "‹");
            left.addEventListener("click", () => {
                [chips[i - 1], chips[i]] = [chips[i], chips[i - 1]];
                drawCats();
                refresh();
            });
            wrap.append(el("span", { class: `erp-sf__chip${i >= draft.catalog.chipLimit ? " is-over" : ""}` }, left, chipLabel(chip), x));
        });

        const select = el("select", { class: "erp-input erp-sf__add", "aria-label": "Tambah saran" },
            el("option", { value: "" }, "+ Tambah saran"),
            CHIP_KINDS.map((k) => el("option", { value: k.kind }, k.label)));
        select.addEventListener("change", async () => {
            const kind = CHIP_KINDS.find((k) => k.kind === select.value);
            select.value = "";
            if (!kind) return;
            const chip = { kind: kind.kind, label: kind.label };
            // Isian tambahan memakai dialog ERP (bukan kotak bawaan browser di atas layar).
            if (kind.needsValue === "price") {
                const answer = await formDialog({
                    title: `Saran “Di bawah …” · ${key}`,
                    submitLabel: "Tambahkan",
                    fields: [
                        { name: "value", label: "Batas harga (Rupiah)", type: "number", min: 1000, step: 1000, value: 50000, required: true, hint: "Pelanggan yang mengetuk saran ini melihat produk di bawah harga tersebut." },
                        { name: "label", label: "Tulisan di tombol (opsional)", placeholder: "Di bawah", max: 30 },
                    ],
                });
                const value = Math.round(Number(answer?.value));
                if (!value) return;
                chip.value = value;
                if (answer.label?.trim()) chip.label = answer.label.trim().slice(0, 30);
            }
            if (kind.needsValue === "text") {
                const answer = await formDialog({
                    title: `Saran kata kunci · ${key}`,
                    submitLabel: "Tambahkan",
                    fields: [
                        { name: "value", label: "Kata kunci yang dicari", placeholder: "Contoh: coklat", max: 40, required: true, hint: "Produk yang nama/deskripsinya memuat kata ini akan tampil." },
                        { name: "label", label: "Tulisan di tombol (opsional)", placeholder: "Sama dengan kata kunci", max: 30 },
                    ],
                });
                const raw = String(answer?.value ?? "").trim();
                if (!raw) return;
                chip.value = raw.slice(0, 40);
                chip.label = (answer.label?.trim() || raw).slice(0, 30);
            }
            chips.push(chip);
            drawCats();
            refresh();
        });
        wrap.append(select);
        return wrap;
    }

    function drawCats() {
        list.replaceChildren(...categories.map((key, index) => {
            const entry = catEntry(key);
            entry.order = index;
            const count = products.filter((p) => (String(p.category ?? "").trim() || "Lainnya") === key).length;
            const label = el("input", { class: "erp-input", maxlength: "40", value: entry.label, placeholder: key, "aria-label": `Nama tampilan ${key}` });
            label.addEventListener("input", () => {
                entry.label = label.value;
                refresh();
            });
            const show = el("input", { type: "checkbox", checked: !entry.hidden });
            show.addEventListener("change", () => {
                entry.hidden = !show.checked;
                refresh();
            });
            const up = el("button", { class: "erp-btn erp-btn--ghost erp-sf__move", type: "button", "aria-label": "Naikkan", disabled: index === 0 }, "↑");
            const down = el("button", { class: "erp-btn erp-btn--ghost erp-sf__move", type: "button", "aria-label": "Turunkan", disabled: index === categories.length - 1 }, "↓");
            up.addEventListener("click", () => {
                [categories[index - 1], categories[index]] = [categories[index], categories[index - 1]];
                drawCats();
                refresh();
            });
            down.addEventListener("click", () => {
                [categories[index + 1], categories[index]] = [categories[index], categories[index + 1]];
                drawCats();
                refresh();
            });
            return el("article", { class: `erp-sf__cat${entry.hidden ? " is-hidden" : ""}` },
                el("div", { class: "erp-sf__cat-head" },
                    el("div", { class: "erp-sf__order" }, up, down),
                    el("label", { class: "erp-field erp-sf__label" }, el("span", {}, `Nama tampilan · asal “${key}” · ${count} produk`), label),
                    el("label", { class: "erp-sf__toggle" }, show, "Tampil")),
                el("p", { class: "erp-sf__hint" }, "Saran filter (bisa digeser pelanggan; yang melewati batas slot disembunyikan):"),
                chipEditor(key));
        }));
    }

    const saveCatalog = el("button", { class: "erp-btn erp-btn--primary", type: "button" }, "Simpan katalog");
    const reset = el("button", { class: "erp-btn erp-btn--ghost", type: "button" }, "Batalkan perubahan");
    saveCatalog.addEventListener("click", async () => {
        saveCatalog.disabled = true;
        try {
            await saveStorefront("catalog", sanitizeStorefront(draft).catalog, { demo });
            Object.assign(saved, clone(getStorefront()));
            toast("Katalog tersimpan · dashboard pelanggan langsung berubah.");
            dirty();
        } catch (error) {
            toast(friendlyError(error), "bad");
        } finally {
            saveCatalog.disabled = false;
        }
    });
    reset.addEventListener("click", () => {
        Object.assign(draft, clone(saved));
        nameInput.value = draft.brand.name;
        taglineInput.value = draft.brand.tagline;
        limitInput.value = String(draft.catalog.chipLimit);
        drawCats();
        refresh();
    });

    const status = el("span", { class: "erp-sf__dirty" });
    function dirty() {
        const changed = JSON.stringify(sanitizeStorefront(draft)) !== JSON.stringify(sanitizeStorefront(saved));
        status.textContent = changed ? "Ada perubahan belum disimpan" : "Semua tersimpan";
        status.classList.toggle("is-dirty", changed);
    }

    const catalogCard = el("section", { class: "erp-card erp-sf__card" },
        el("div", { class: "erp-card__head" }, el("h2", {}, "Susunan katalog")),
        el("p", { class: "erp-muted" }, "Atur nama kategori yang dilihat pelanggan, urutannya, dan saran filter di samping nama kategori. Nama asli produk tidak berubah."),
        el("label", { class: "erp-field erp-sf__limit-row" }, el("span", {}, "Jumlah slot saran per kategori"), limitInput),
        list,
        el("div", { class: "erp-sf__actions erp-sf__actions--sticky" }, status, reset, saveCatalog));

    drawCats();

    /* ---------- Pratinjau di HP: pop-up ---------- */

    const previewBtn = el("button", { class: "erp-btn erp-btn--primary erp-sf__preview-btn", type: "button" }, "👁 Pratinjau");
    previewBtn.addEventListener("click", () => {
        preview.classList.add("is-popup");
        document.body.classList.add("erp-sf-lock");
    });
    const closePreview = el("button", { class: "erp-sf__preview-close", type: "button", "aria-label": "Tutup pratinjau" }, "×");
    closePreview.addEventListener("click", () => {
        preview.classList.remove("is-popup");
        document.body.classList.remove("erp-sf-lock");
    });
    preview.querySelector(".erp-sf__preview-head").append(closePreview);

    const onTheme = () => refresh();
    window.addEventListener("kantoong:theme-applied", onTheme);
    ctx.onCleanup?.(() => {
        window.removeEventListener("kantoong:theme-applied", onTheme);
        document.body.classList.remove("erp-sf-lock");
    });

    page.append(
        pageHeader("Etalase & Brand", demo ? "Mode demo: perubahan hanya tersimpan di perangkat ini." : "Perubahan tampil realtime di toko & dashboard pelanggan.", previewBtn),
        el("div", { class: "erp-sf__layout" },
            el("div", { class: "erp-sf__editor" }, brandCard, catalogCard),
            preview));

    refresh();
    return page;
}
