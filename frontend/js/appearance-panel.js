/**
 * KANTOONG — PANEL TAMPILAN (tema, warna chat, font) — gaya One UI
 * File: frontend/js/appearance-panel.js
 *
 * Satu panel yang sama di Dashboard User › Pengaturan dan ERP › tombol Tampilan.
 * Semua pilihan hanya berlaku di browser ini (lihat personalize.js & theme.js).
 */

import { AREAS, CHOICES, readPrefs, savePrefs } from "./theme.js";
import { CHAT_SKINS, DEFAULT_FONT, FONTS, previewCss, readPersonal, savePersonal } from "./personalize.js";
import "../css/appearance.css";

function el(tag, className, ...children) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    children.flat().forEach((child) => {
        if (child == null || child === false) return;
        node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return node;
}

function btn(className, label, onClick, pressed) {
    const b = el("button", className, label);
    b.type = "button";
    if (pressed !== undefined) b.setAttribute("aria-pressed", String(pressed));
    b.addEventListener("click", onClick);
    return b;
}

const SWATCH = { light: ["#fffdf8", "#16130e"], dark: ["#16130e", "#f1e9d6"], system: ["linear-gradient(135deg,#fffdf8 50%,#16130e 50%)", "#b8913f"] };

function themeSection(say) {
    const box = el("div", "ap-stack");
    const draw = () => {
        const prefs = readPrefs();
        const mode = el("div", "ap-seg",
            btn(`ap-seg__btn${prefs.mode === "all" ? " is-on" : ""}`, "Semua halaman sama", () => {
                savePrefs({ ...prefs, mode: "all" });
                draw();
            }, prefs.mode === "all"),
            btn(`ap-seg__btn${prefs.mode === "per-area" ? " is-on" : ""}`, "Atur per halaman", () => {
                savePrefs({ ...prefs, mode: "per-area" });
                draw();
            }, prefs.mode === "per-area"));
        const body = prefs.mode === "all"
            ? el("div", "ap-cards", CHOICES.map((c) => {
                const [bg, ink] = SWATCH[c.id];
                const prev = el("span", "ap-theme__preview", el("i"), el("i"), el("b"));
                prev.style.background = bg;
                prev.style.color = ink;
                return btn(`ap-card${prefs.all === c.id ? " is-on" : ""}`, [prev, el("span", "ap-card__label", c.label)], () => {
                    savePrefs({ ...prefs, all: c.id });
                    say(`Tema ${c.label.toLowerCase()} untuk semua halaman.`);
                    draw();
                }, prefs.all === c.id);
            }))
            : el("div", "ap-rows", AREAS.map((a) => el("div", "ap-row",
                el("span", "ap-row__label", a.label),
                el("div", "ap-seg ap-seg--sm", CHOICES.map((c) => btn(`ap-seg__btn${prefs.areas[a.id] === c.id ? " is-on" : ""}`, c.label, () => {
                    savePrefs({ ...prefs, areas: { ...prefs.areas, [a.id]: c.id } });
                    draw();
                }, prefs.areas[a.id] === c.id))))));
        box.replaceChildren(mode, body);
    };
    draw();
    return box;
}

function chatSection(say) {
    const box = el("div", "ap-cards");
    const draw = () => {
        const current = readPersonal().chatSkin;
        box.replaceChildren(...CHAT_SKINS.map((s) => {
            const mock = el("span", `ap-chat ap-chat--${s.id}`,
                el("span", "ap-chat__bubble ap-chat__bubble--ai"),
                el("span", "ap-chat__bubble ap-chat__bubble--me"),
                el("span", "ap-chat__bar"));
            return btn(`ap-card${current === s.id ? " is-on" : ""}`, [mock, el("span", "ap-card__label", s.label)], () => {
                savePersonal({ chatSkin: s.id });
                say(`Kotak chat: ${s.label.toLowerCase()}.`);
                draw();
            }, current === s.id);
        }));
    };
    draw();
    return box;
}

function fontSection(say) {
    // Pratinjau semua font: satu permintaan kecil berisi huruf contoh saja.
    if (!document.getElementById("kcFontPreview")) {
        const link = document.createElement("link");
        link.id = "kcFontPreview";
        link.rel = "stylesheet";
        link.href = previewCss();
        document.head.appendChild(link);
    }
    const groups = ["Semua", ...new Set(FONTS.map((f) => f.group))];
    let group = "Semua";
    let query = "";

    const search = el("input", "ap-search");
    search.type = "search";
    search.placeholder = "Cari font…";
    const chips = el("div", "ap-chips");
    const grid = el("div", "ap-fonts");
    const current = el("p", "ap-current");

    const draw = () => {
        const chosen = readPersonal().font;
        current.replaceChildren("Font aktif: ", el("strong", "", chosen), chosen === DEFAULT_FONT ? " (bawaan)" : "");
        chips.replaceChildren(...groups.map((g) => btn(`ap-chip${g === group ? " is-on" : ""}`, g, () => {
            group = g;
            draw();
        }, g === group)));
        const q = query.trim().toLowerCase();
        grid.replaceChildren(...FONTS
            .filter((f) => (group === "Semua" || f.group === group) && (!q || f.name.toLowerCase().includes(q)))
            .map((f) => {
                const sample = el("span", "ap-font__sample", "Aa");
                const line = el("span", "ap-font__line", "Selamat sore, Kak");
                sample.style.fontFamily = `"${f.name}", system-ui`;
                line.style.fontFamily = `"${f.name}", system-ui`;
                return btn(`ap-font${chosen === f.name ? " is-on" : ""}`, [
                    sample, line, el("span", "ap-font__name", f.name, f.name === DEFAULT_FONT ? " · bawaan" : ""),
                ], () => {
                    savePersonal({ font: f.name });
                    say(`Font ${f.name} dipakai di seluruh web (hanya di browser ini).`);
                    draw();
                }, chosen === f.name);
            }));
    };
    search.addEventListener("input", () => {
        query = search.value;
        draw();
    });
    draw();
    return el("div", "ap-stack", current, el("div", "ap-fontbar", search), chips, grid);
}

/** Pasang panel ke `root`. */
export function renderAppearance(root) {
    const status = el("p", "ap-status");
    status.setAttribute("role", "status");
    const say = (text) => (status.textContent = text);
    root.replaceChildren(el("div", "ap",
        el("section", "ap-section", el("h3", "ap-h", "Tema"), el("p", "ap-hint", "Gelap, terang, atau ikuti perangkat — untuk semua halaman atau per halaman."), themeSection(say)),
        el("section", "ap-section", el("h3", "ap-h", "Warna kotak chat"), el("p", "ap-hint", "Untuk kotak konsultasi AI (tertutup maupun saat dibuka)."), chatSection(say)),
        el("section", "ap-section", el("h3", "ap-h", "Font"), el("p", "ap-hint", "50 pilihan. Berlaku di toko, dashboard, ERP & kasir — hanya di browser ini; pengguna lain tidak terpengaruh."), fontSection(say)),
        status));
}

/** Buka panel sebagai lembar pop-up (dipakai ERP). */
export function openAppearanceSheet() {
    const sheet = el("div", "ap-sheet");
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-label", "Tampilan");
    const body = el("div", "ap-sheet__body");
    const close = btn("ap-sheet__close", "×", () => shut());
    close.setAttribute("aria-label", "Tutup");
    const shut = () => {
        sheet.classList.remove("is-open");
        document.removeEventListener("keydown", onKey);
        setTimeout(() => sheet.remove(), 240);
    };
    const onKey = (event) => {
        if (event.key === "Escape") shut();
    };
    sheet.append(el("div", "ap-sheet__panel", el("header", "ap-sheet__head", el("h2", "", "Tampilan"), close), body));
    sheet.addEventListener("click", (event) => {
        if (event.target === sheet) shut();
    });
    document.addEventListener("keydown", onKey);
    renderAppearance(body);
    document.body.appendChild(sheet);
    requestAnimationFrame(() => sheet.classList.add("is-open"));
}
