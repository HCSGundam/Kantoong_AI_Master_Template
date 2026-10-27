/**
 * KANTOONG CORE — FEATURE HUB: VIEW
 * File: frontend/dashboard-user/feature-hub/feature-hub-view.js
 *
 * Merender isi halaman Feature Hub. Hanya menyentuh DOM; tidak
 * menyimpan state dan tidak memanggil sistem lain.
 *
 * Teks dari data dipasang lewat textContent (anti-XSS).
 */

import "./feature-hub.css";

import { HUB_CATEGORIES } from "./feature-hub-catalog.js";
import {
    canAddFeature,
    getFeatureBadge,
} from "./feature-hub-publisher.js";

export const HUB_FILTERS = Object.freeze([
    { id: "all", label: "Semua" },
    { id: "published", label: "Tersedia" },
    { id: "coming-soon", label: "Coming soon" },
]);

const CATEGORY_BY_ID = new Map(
    HUB_CATEGORIES.map((category, index) => [
        category.id,
        { ...category, index },
    ])
);

export function getCategoryMeta(categoryId) {
    return (
        CATEGORY_BY_ID.get(categoryId) ?? {
            id: categoryId,
            label: categoryId || "Fitur lainnya",
            description: "",
            index: 999,
        }
    );
}

/* ---------- Filter bar ---------- */

function ensureFilterBar(container) {
    let bar = container.parentElement?.querySelector(
        "[data-feature-hub-filters]"
    );

    if (!bar) {
        bar = document.createElement("div");
        bar.className = "dashboard-feature-hub__filters";
        bar.dataset.featureHubFilters = "";
        bar.setAttribute("role", "group");
        bar.setAttribute("aria-label", "Saring fitur");

        container.before(bar);
    }

    return bar;
}

function renderFilterBar(container, activeFilter) {
    const bar = ensureFilterBar(container);

    const chips = HUB_FILTERS.map((filter) => {
        const chip = document.createElement("button");

        chip.type = "button";
        chip.className = "dashboard-feature-hub__chip";
        chip.dataset.hubFilter = filter.id;
        chip.setAttribute(
            "aria-pressed",
            String(filter.id === activeFilter)
        );
        chip.textContent = filter.label;

        return chip;
    });

    bar.replaceChildren(...chips);
}

/* ---------- Kartu fitur ---------- */

function createBadge(kind) {
    const badge = document.createElement("span");

    badge.className = "dashboard-feature-hub__badge";
    badge.dataset.badge = kind;
    badge.textContent = kind === "new" ? "NEW" : "Coming soon";

    return badge;
}

function createFeatureItem(feature) {
    const addable = canAddFeature(feature);
    const badgeKind = getFeatureBadge(feature);

    const article = document.createElement("article");

    article.className = "dashboard-feature-hub__item";
    article.dataset.featureId = feature.id;
    article.dataset.state = addable ? "available" : "coming-soon";

    // --- kepala: ikon + judul + deskripsi
    const header = document.createElement("div");
    header.className = "dashboard-feature-hub__item-header";

    const icon = document.createElement("span");
    icon.className = "dashboard-feature-hub__item-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = feature.icon || "\u25A1";

    const copy = document.createElement("div");
    copy.className = "dashboard-feature-hub__item-copy";

    const titleRow = document.createElement("div");
    titleRow.className = "dashboard-feature-hub__item-title-row";

    const title = document.createElement("h4");
    title.textContent = feature.title;

    titleRow.append(title);

    if (badgeKind) {
        titleRow.append(createBadge(badgeKind));
    }

    copy.append(titleRow);

    if (feature.description) {
        const description = document.createElement("p");
        description.textContent = feature.description;
        copy.append(description);
    }

    header.append(icon, copy);

    // --- aksi: tombol + (rilis) atau keterangan (coming soon)
    const actions = document.createElement("div");
    actions.className = "dashboard-feature-hub__item-actions";

    if (addable) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "dashboard-feature-hub__add";
        button.dataset.action = "add-feature";
        button.dataset.featureId = feature.id;
        button.setAttribute(
            "aria-label",
            `Tambah ${feature.title} ke menu`
        );
        button.textContent = "+";

        actions.append(button);
    } else {
        const note = document.createElement("span");

        note.className = "dashboard-feature-hub__soon-note";
        note.textContent = "Sedang disiapkan";

        article.setAttribute("aria-disabled", "true");

        actions.append(note);
    }

    article.append(header, actions);

    return article;
}

/* ---------- Render utama ---------- */

/**
 * @param {object}   options
 * @param {object}   options.elements  elemen dialog hub
 * @param {object[]} options.features  fitur yang akan ditampilkan
 * @param {string}   options.filter    id filter aktif
 */
export function renderHubView({ elements, features, filter }) {
    const container = elements.featureHubCategories;

    if (!container) {
        return;
    }

    renderFilterBar(container, filter);

    // Kelompokkan per kategori, urut sesuai HUB_CATEGORIES.
    const groups = new Map();

    for (const feature of features) {
        const key = feature.category || "other";

        if (!groups.has(key)) {
            groups.set(key, []);
        }

        groups.get(key).push(feature);
    }

    const orderedGroups = [...groups.entries()].sort(
        (a, b) =>
            getCategoryMeta(a[0]).index - getCategoryMeta(b[0]).index
    );

    const fragment = document.createDocumentFragment();

    orderedGroups.forEach(([categoryId, items], index) => {
        const meta = getCategoryMeta(categoryId);
        const letter = String.fromCharCode(65 + (index % 26));

        const section = document.createElement("section");
        section.className = "dashboard-feature-hub__category";

        const header = document.createElement("header");
        header.className = "dashboard-feature-hub__category-header";

        const heading = document.createElement("h3");
        heading.textContent = `${letter}. ${meta.label}`;
        header.append(heading);

        if (meta.description) {
            const text = document.createElement("p");
            text.textContent = meta.description;
            header.append(text);
        }

        const grid = document.createElement("div");
        grid.className = "dashboard-feature-hub__category-grid";

        grid.append(...items.map(createFeatureItem));

        section.append(header, grid);
        fragment.append(section);
    });

    container.replaceChildren(fragment);

    if (elements.featureHubLoading) {
        elements.featureHubLoading.hidden = true;
    }

    if (elements.featureHubEmpty) {
        elements.featureHubEmpty.hidden = features.length > 0;
    }
}
