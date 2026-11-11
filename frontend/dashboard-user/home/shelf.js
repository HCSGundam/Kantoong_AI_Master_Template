/**
 * KANTOONG — FEATURE HUB "TAMBAH FITUR"
 * File: frontend/dashboard-user/home/shelf.js
 *
 * Daftar fitur dikelompokkan per kategori (dari feature-hub-catalog.js).
 * Setiap baris: ikon · nama · deskripsi singkat · status · tindakan.
 * Status berasal dari registry, bukan ditulis di UI:
 *   - Siap ditambahkan  : published + diizinkan paket  → tombol "Tambah"
 *   - Termasuk paket / Add-on : dari `tier` (jenis paket, BUKAN status aktif)
 *   - Paket Pro         : fitur ada tapi tidak termasuk paket toko ini → terkunci
 *   - Segera hadir      : belum dibuat (folder fitur belum ada) → tidak bisa ditambahkan
 * Fitur yang sudah ada di menu tidak ditampilkan (dihitung di atas).
 * Tata letak menyesuaikan lebar panel (container query di home.css).
 */

import { HUB_CATEGORIES } from "../feature-hub/feature-hub-catalog.js";
import { el, icon } from "./home-icons.js";

const TIER = { package: "Termasuk paket", addon: "Add-on" };

export function createShelf({ host, getFeatures, isActive, canAdd, isLocked = () => false, onAdd }) {
    let root = null;
    let query = "";
    let category = "all";
    let openId = null;
    let lastFocus = null;

    const statusOf = (f) => (canAdd(f) ? "ready" : isLocked(f) ? "locked" : "soon");

    function matches(f) {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return [f.title, f.description, ...(f.keywords ?? [])].join(" ").toLowerCase().includes(q);
    }

    function row(feature) {
        const status = statusOf(feature);
        const open = openId === feature.id;
        const li = el("li", `bx-hub__item is-${status}${open ? " is-open" : ""}`);
        li.dataset.category = feature.category;

        const badges = el("span", "bx-hub__badges",
            el("span", `bx-hub__tier bx-hub__tier--${feature.tier || "package"}`, TIER[feature.tier] ?? TIER.package),
            status === "soon" ? el("span", "bx-hub__state bx-hub__state--soon", "Segera hadir") : null,
            status === "locked" ? el("span", "bx-hub__state bx-hub__state--locked", icon("lock"), "Paket Pro") : null);

        const main = el("button", "bx-hub__row",
            el("span", "bx-hub__icon", icon(feature.id)),
            el("span", "bx-hub__text",
                el("strong", "bx-hub__name", feature.title),
                el("span", "bx-hub__desc", feature.description || "")),
            badges,
            el("span", "bx-hub__chev", icon("chevron")));
        main.type = "button";
        main.setAttribute("aria-expanded", String(open));
        main.addEventListener("click", () => {
            openId = open ? null : feature.id;
            draw();
        });

        const detail = el("div", "bx-hub__detail", el("p", "", feature.description || ""));
        if (status === "ready") {
            const add = el("button", "bx-hub__add", icon("plus"), el("span", "", "Tambahkan ke menu"));
            add.type = "button";
            add.addEventListener("click", () => {
                li.classList.add("is-taken");
                setTimeout(() => {
                    onAdd(feature.id);
                    openId = null;
                    draw();
                }, 220);
            });
            detail.append(add);
        } else {
            detail.append(el("p", "bx-hub__note", icon("lock"), status === "locked"
                ? "Fitur ini ada di paket Kantoong Pro. Hubungi toko untuk mengaktifkannya."
                : "Fitur ini sedang kami siapkan — belum bisa dipakai. Kamu akan melihatnya di sini begitu siap."));
        }
        li.append(main, detail);
        return li;
    }

    function draw() {
        if (!root) return;
        const all = getFeatures().filter((f) => !isActive(f.id));
        const items = all.filter((f) => (category === "all" || f.category === category) && matches(f));
        const order = { ready: 0, locked: 1, soon: 2 };
        const sections = HUB_CATEGORIES
            .map((cat) => ({
                cat,
                list: items.filter((f) => f.category === cat.id)
                    .sort((a, b) => order[statusOf(a)] - order[statusOf(b)] || (a.order ?? 999) - (b.order ?? 999)),
            }))
            .filter((s) => s.list.length);

        const host = root.querySelector(".bx-hub__list");
        host.replaceChildren(...sections.map(({ cat, list }) => el("section", "bx-hub__group",
            el("header", "bx-hub__group-head",
                el("h3", "", cat.label),
                el("span", "", `${list.filter((f) => statusOf(f) === "ready").length}/${list.length} siap`)),
            el("ul", "bx-hub__items", list.map(row)))));
        root.querySelector(".bx-hub__empty").hidden = items.length > 0;
        const ready = all.filter((f) => statusOf(f) === "ready").length;
        root.querySelector(".bx-hub__count").textContent = ready
            ? `${ready} fitur siap ditambahkan · ${all.length - ready} lainnya menyusul/terkunci`
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
        input.setAttribute("aria-label", "Cari fitur");
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
                el("div", "", el("p", "bx-shelf__eyebrow", "Feature Hub"), el("h2", "bx-shelf__title", "Tambah fitur"), el("p", "bx-hub__count")),
                close),
            search,
            chips,
            el("div", "bx-hub__list"),
            el("p", "bx-hub__empty", "Tidak ada fitur yang cocok."));

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
