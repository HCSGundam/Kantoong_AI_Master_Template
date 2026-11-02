/**
 * KANTOONG CORE — DASHBOARD ADMIN (STATE + TAMPILAN)
 * File: frontend/dashboard-admin/dashboard-admin.js
 *
 * Tanggung jawab: state, render daftar produk, form, dan notifikasi.
 * Semua teks dari database dipasang lewat textContent (anti-XSS).
 */

import { ADMIN_CONFIG } from "./dashboard-admin-config.js";
import { listProducts } from "./services/product-detail-service.js";
import { summarizePublication } from "./services/published-storefront-service.js";

export const adminState = {
    products: [],
    editingId: null,
    filter: "",
};

export const $ = (id) => document.getElementById(id);

/* ---------- Umum ---------- */

export function formatRupiah(value) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(Number(value) || 0);
}

export function friendlyError(error) {
    const message = String(error?.message ?? error ?? "");

    if (/invalid login credentials/i.test(message)) {
        return "Email atau password salah.";
    }

    if (/row-level security|permission denied|not authorized/i.test(message)) {
        return "Akunmu tidak punya izin. Pastikan sudah terdaftar sebagai owner.";
    }

    if (/compare_at_price|ship_estimate|ship_from/i.test(message)) {
        return "Kolom kartu produk belum ada. Jalankan db/product-card.sql di Supabase.";
    }

    if (/relation .* does not exist|column .* does not exist/i.test(message)) {
        return "Struktur database belum siap. Jalankan db/owner-and-pin.sql di Supabase.";
    }

    if (/failed to fetch|network/i.test(message)) {
        return "Koneksi bermasalah. Coba lagi.";
    }

    return message || "Terjadi kesalahan. Coba lagi.";
}

export function setMessage(element, text, kind = "info") {
    if (!element) return;

    element.textContent = text ?? "";
    element.dataset.kind = kind;
    element.hidden = !text;
}

let toastTimer = null;

export function toast(message) {
    const element = $("adminToast");

    if (!element) return;

    element.textContent = message;
    element.hidden = false;

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
        element.hidden = true;
    }, 2800);
}

export function showView(name) {
    $("adminLoginView").hidden = name !== "login";
    $("adminDeniedView").hidden = name !== "denied";
    $("adminAppView").hidden = name !== "app";
}

/* ---------- Ringkasan ---------- */

export function renderSummary() {
    const summary = summarizePublication(adminState.products);

    $("sumTotal").textContent = String(summary.total);
    $("sumFeatured").textContent = String(summary.featured);
    $("sumHero").textContent = `${summary.hero}/${ADMIN_CONFIG.maxHeroSlides}`;
}

/* ---------- Daftar produk ---------- */

function createThumb(product) {
    const thumb = document.createElement("div");
    thumb.className = "admin-product__thumb";

    if (product.image_url) {
        const image = document.createElement("img");
        image.src = product.image_url;
        image.alt = "";
        image.loading = "lazy";
        image.addEventListener("error", () => {
            image.remove();
            thumb.textContent = "P";
        });
        thumb.append(image);
    } else {
        thumb.textContent = "P";
    }

    return thumb;
}

function createPill(label, action, pressed) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-pill";
    button.dataset.action = action;
    button.setAttribute("aria-pressed", String(Boolean(pressed)));
    button.textContent = label;

    return button;
}

function createActionButton(label, action, extraClass = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `admin-btn admin-btn--sm ${extraClass}`.trim();
    button.dataset.action = action;
    button.textContent = label;

    return button;
}

function createProductItem(product) {
    const item = document.createElement("li");
    item.className = "admin-product";
    item.dataset.productId = String(product.id);

    const body = document.createElement("div");
    body.className = "admin-product__body";

    const name = document.createElement("h3");
    name.className = "admin-product__name";
    name.textContent = product.name || "(tanpa nama)";

    const meta = document.createElement("p");
    meta.className = "admin-product__meta";
    meta.textContent = [
        product.category || "Umum",
        formatRupiah(product.price),
        `Stok ${Number(product.stock) || 0}`,
    ].join(" · ");

    const actions = document.createElement("div");
    actions.className = "admin-product__actions";
    actions.append(
        createPill("Unggulan", "toggle-featured", product.is_featured),
        createPill("Hero", "toggle-hero", product.is_hero),
        createActionButton("Edit", "edit"),
        createActionButton("Hapus", "delete", "admin-btn--danger")
    );

    body.append(name, meta, actions);
    item.append(createThumb(product), body);

    return item;
}

export function renderProducts() {
    const list = $("productList");
    const keyword = adminState.filter.trim().toLowerCase();

    const visible = adminState.products.filter((product) => {
        if (!keyword) return true;

        return `${product.name ?? ""} ${product.category ?? ""}`
            .toLowerCase()
            .includes(keyword);
    });

    list.replaceChildren(...visible.map(createProductItem));

    $("productLoading").hidden = true;
    $("productEmpty").hidden = adminState.products.length > 0;

    renderSummary();
}

export async function refreshProducts() {
    $("productLoading").hidden = false;

    try {
        adminState.products = await listProducts();
    } finally {
        $("productLoading").hidden = true;
    }

    renderProducts();
}

export function replaceProductInState(updated) {
    const index = adminState.products.findIndex(
        (product) => String(product.id) === String(updated.id)
    );

    if (index === -1) {
        adminState.products.unshift(updated);
    } else {
        adminState.products[index] = updated;
    }

    renderProducts();
}

export function removeProductFromState(id) {
    adminState.products = adminState.products.filter(
        (product) => String(product.id) !== String(id)
    );

    renderProducts();
}

/* ---------- Form ---------- */

export function updateImagePreview(url, previewId = "imagePreview", emptyText = "P") {
    const preview = $(previewId);

    preview.replaceChildren();

    if (!url) {
        preview.textContent = emptyText;
        return;
    }

    const image = document.createElement("img");
    image.src = url;
    image.alt = "";
    image.addEventListener("error", () => {
        preview.textContent = emptyText;
    });
    preview.append(image);
}

export function updateHeroImagePreview(url) {
    updateImagePreview(url, "heroImagePreview", "16:9");
}

export function toggleHeroFields() {
    $("heroFields").hidden = !$("fHero").checked;
}

export function readForm() {
    return {
        name: $("fName").value,
        category: $("fCategory").value,
        price: $("fPrice").value,
        stock: $("fStock").value,
        compare_at_price: $("fCompareAt").value,
        ship_estimate: $("fShipEstimate").value,
        ship_from: $("fShipFrom").value,
        description: $("fDescription").value,
        image_url: $("fImageUrl").value,
        is_featured: $("fFeatured").checked,
        is_hero: $("fHero").checked,
        hero_image_url: $("fHeroImageUrl").value,
        hero_caption: $("fHeroCaption").value,
        hero_text: $("fHeroText").value,
    };
}

export function resetForm() {
    $("productForm").reset();
    $("productId").value = "";
    $("fStock").value = "0";

    adminState.editingId = null;

    $("formTitle").textContent = "Tambah produk";
    $("formSubmit").textContent = "Simpan produk";
    $("formCancel").hidden = true;

    setMessage($("formMessage"), "");
    updateImagePreview("");
    updateHeroImagePreview("");
    toggleHeroFields();
}

export function fillForm(product) {
    adminState.editingId = product.id;

    $("productId").value = String(product.id);
    $("fName").value = product.name ?? "";
    $("fCategory").value = product.category ?? "";
    $("fPrice").value = product.price ?? "";
    $("fStock").value = product.stock ?? 0;
    $("fCompareAt").value = product.compare_at_price ?? "";
    $("fShipEstimate").value = product.ship_estimate ?? "";
    $("fShipFrom").value = product.ship_from ?? "";
    $("fDescription").value = product.description ?? "";
    $("fImageUrl").value = product.image_url ?? "";
    $("fImageFile").value = "";
    $("fFeatured").checked = product.is_featured === true;
    $("fHero").checked = product.is_hero === true;
    $("fHeroImageUrl").value = product.hero_image_url ?? "";
    $("fHeroImageFile").value = "";
    $("fHeroCaption").value = product.hero_caption ?? "";
    $("fHeroText").value = product.hero_text ?? "";

    $("formTitle").textContent = "Edit produk";
    $("formSubmit").textContent = "Simpan perubahan";
    $("formCancel").hidden = false;

    setMessage($("formMessage"), "");
    updateImagePreview(product.image_url ?? "");
    updateHeroImagePreview(product.hero_image_url ?? "");
    toggleHeroFields();

    $("productForm").scrollIntoView({ behavior: "smooth", block: "start" });
    $("fName").focus({ preventScroll: true });
}
