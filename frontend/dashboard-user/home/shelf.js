/**
 * KANTOONG — LEMARI FITUR "TAMBAH FITUR" (Feature Hub, sistem D)
 * File: frontend/dashboard-user/home/shelf.js
 *
 * Kartu fitur ditumpuk seperti dompet digital. Ketuk kartu = terbuka
 * (kartu lain bergeser), lalu "Tambahkan ke menu". Fitur yang belum
 * selesai tampil "Segera hadir" dan tidak bisa ditambahkan.
 * Fitur yang diarsipkan dari menu kembali muncul di sini.
 */

import { HUB_CATEGORIES } from "../feature-hub/feature-hub-catalog.js";
import { el, icon } from "./home-icons.js";

const TIER_LABEL = { package: "Termasuk paket", addon: "Add-on" };

export function createShelf({ host, getFeatures, isActive, canAdd, isLocked = () => false, onAdd }) {
    let root = null;
    let query = "";
    let category = "all";
    let openId = null;
    let lastFocus = null;

    function list() {
        const q = query.trim().toLowerCase();
        return getFeatures()
            .filter((f) => !isActive(f.id))
            .filter((f) => category === "all" || f.category === category)
            .filter((f) => {
                if (!q) return true;
                return [f.title, f.description, ...(f.keywords ?? [])].join(" ").toLowerCase().includes(q);
            })
            .sort((a, b) => (canAdd(b) ? 1 : 0) - (canAdd(a) ? 1 : 0) || (a.order ?? 999) - (b.order ?? 999));
    }

    function card(feature, index) {
        const ready = canAdd(feature);
        const item = el("li", `bx-wallet__card${ready ? "" : " is-soon"}${openId === feature.id ? " is-open" : ""}`);
        item.style.setProperty("--i", String(index));
        item.dataset.category = feature.category;

        const head = el("button", "bx-wallet__head",
            el("span", "bx-wallet__icon", icon(feature.id)),
            el("span", "bx-wallet__name", feature.title),
            el("span", "bx-wallet__tag", ready ? TIER_LABEL[feature.tier] ?? "Tersedia" : isLocked(feature) ? "Paket Pro" : "Segera hadir"));
        head.type = "button";
        head.setAttribute("aria-expanded", String(openId === feature.id));
        head.addEventListener("click", () => {
            openId = openId === feature.id ? null : feature.id;
            draw();
        });

        const art = el("div", "bx-wallet__art", icon(feature.id, "bx-icon bx-wallet__glyph"));
        const body = el("div", "bx-wallet__body",
            el("p", "bx-wallet__desc", feature.description || ""),
        );
        if (ready) {
            const add = el("button", "bx-wallet__add", icon("plus"), el("span", "", "Tambahkan ke menu"));
            add.type = "button";
            add.addEventListener("click", () => {
                item.classList.add("is-taken");
                setTimeout(() => {
                    onAdd(feature.id);
                    openId = null;
                    draw();
                }, 260);
            });
            body.append(add);
        } else {
            body.append(el("p", "bx-wallet__soon", icon("lock"), isLocked(feature)
                ? "Fitur ini tersedia di paket Kantoong Pro."
                : "Sedang kami siapkan. Kamu akan melihatnya di sini begitu siap."));
        }

        item.append(head, art, body);
        return item;
    }

    function draw() {
        if (!root) return;
        const items = list();
        const ul = root.querySelector(".bx-wallet__list");
        ul.replaceChildren(...items.map(card));
        ul.dataset.hasOpen = openId ? "true" : "false";
        root.querySelector(".bx-wallet__empty").hidden = items.length > 0;
        const readyCount = getFeatures().filter((f) => !isActive(f.id) && canAdd(f)).length;
        root.querySelector(".bx-wallet__count").textContent = readyCount
            ? `${readyCount} fitur siap ditambahkan`
            : "Semua fitur yang tersedia sudah ada di menumu";
    }

    function build() {
        root = el("div", "bx-shelf");
        root.setAttribute("role", "dialog");
        root.setAttribute("aria-modal", "true");
        root.setAttribute("aria-label", "Tambah fitur");

        const close = el("button", "bx-shelf__close", icon("close"));
        close.type = "button";
        close.setAttribute("aria-label", "Tutup");
        close.addEventListener("click", hide);

        const search = el("label", "bx-shelf__search", icon("search"));
        const input = document.createElement("input");
        input.type = "search";
        input.placeholder = "Cari fitur…";
        input.addEventListener("input", () => {
            query = input.value;
            openId = null;
            draw();
        });
        search.append(input);

        const chips = el("div", "bx-shelf__chips");
        [{ id: "all", label: "Semua" }, ...HUB_CATEGORIES].forEach((cat) => {
            const chip = el("button", `bx-chip${cat.id === category ? " is-on" : ""}`, cat.label);
            chip.type = "button";
            chip.addEventListener("click", () => {
                category = cat.id;
                openId = null;
                chips.querySelectorAll(".bx-chip").forEach((c) => c.classList.toggle("is-on", c === chip));
                draw();
            });
            chips.append(chip);
        });

        const panel = el("div", "bx-shelf__panel",
            el("div", "bx-shelf__grab"),
            el("header", "bx-shelf__head",
                el("div", "", el("p", "bx-shelf__eyebrow", "Feature Hub"), el("h2", "bx-shelf__title", "Tambah fitur"), el("p", "bx-wallet__count")),
                close),
            search,
            chips,
            el("ul", "bx-wallet__list"),
            el("p", "bx-wallet__empty", "Tidak ada fitur yang cocok."));

        root.append(panel);
        root.addEventListener("click", (event) => {
            if (event.target === root) hide();
        });
        root.addEventListener("keydown", (event) => {
            if (event.key === "Escape") hide();
        });
        host.append(root);
    }

    function show() {
        lastFocus = document.activeElement;
        if (!root) build();
        openId = null;
        draw();
        root.hidden = false;
        requestAnimationFrame(() => root.classList.add("is-open"));
        root.querySelector("input")?.focus({ preventScroll: true });
    }

    function hide() {
        if (!root) return;
        root.classList.remove("is-open");
        setTimeout(() => {
            if (!root.classList.contains("is-open")) root.hidden = true;
        }, 280);
        lastFocus?.focus?.({ preventScroll: true });
    }

    return { show, hide, refresh: draw };
}
