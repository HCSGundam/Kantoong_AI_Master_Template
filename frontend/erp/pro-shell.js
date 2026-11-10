/**
 * KANTOONG ERP PRO — Ctrl+K & PUSAT NOTIFIKASI (bilah atas)
 * File: frontend/erp/pro-shell.js
 *
 * Ctrl+K (⌘K di Mac) / tombol "Cari": ketik apa saja → lompat ke menu, sub-menu,
 * orang, produk, calon pelanggan, atau hal yang perlu diputuskan.
 * Lonceng: semua sinyal (sama dengan Ruang Komando). Tanda "sudah dibaca"
 * disimpan HANYA di perangkat ini, per anggota.
 */

import { searchCommands, unreadCount } from "./core/command-center.js";
import { el, icon } from "./ui.js";
import { loadProData } from "./modules/pro-data.js";

const BELL = "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0";
const SEARCH = "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3";

const SUB_PAGES = [
    { module: "finance", path: "piutang", label: "Piutang", keywords: "tagihan pelanggan belum bayar aging" },
    { module: "finance", path: "hutang", label: "Hutang", keywords: "tagihan pemasok supplier bayar" },
    { module: "finance", path: "kas", label: "Proyeksi kas 30 hari", keywords: "cash flow arus kas" },
    { module: "finance", path: "anggaran", label: "Anggaran", keywords: "budget beban" },
    { module: "inventory", path: "saran", label: "Saran belanja", keywords: "restok reorder pesan barang habis" },
    { module: "inventory", path: "kedaluwarsa", label: "Kedaluwarsa", keywords: "expired batch fefo" },
    { module: "hr", path: "cuti", label: "Cuti", keywords: "izin sakit libur" },
    { module: "hr", path: "kontrak", label: "Kontrak kerja", keywords: "pkwt percobaan" },
    { module: "hr", path: "kinerja", label: "Penilaian kinerja", keywords: "nilai review kpi" },
    { module: "crm", path: "pipeline", label: "Pipeline penjualan", keywords: "deal prospek calon pelanggan follow up" },
    { module: "documents", path: "buat", label: "Buat dokumen / surat", keywords: "slip gaji invoice po surat penawaran keterangan kerja peringatan sp laporan" },
    { module: "documents", path: "kotak", label: "Kotak Masuk dokumen", keywords: "tanda tangan inbox arsip surat" },
    { module: "documents", path: "alat", label: "Alat PDF", keywords: "gabung pisah split merge kompres tanda tangan watermark jpg scan sensor" },
    { module: "documents", path: "kop", label: "Kop surat & tanda tangan", keywords: "logo kop signature" },
];

let state = { getCtx: null, modules: [], signals: [], raw: null, timer: 0 };

const readKey = () => `kantoong:erp-read:${state.getCtx?.()?.me?.id || "-"}`;
function readIds() {
    try {
        return JSON.parse(localStorage.getItem(readKey()) || "[]");
    } catch {
        return [];
    }
}
function saveRead(ids) {
    try {
        localStorage.setItem(readKey(), JSON.stringify(ids.slice(-300)));
    } catch {
        // abaikan: tetap jalan tanpa penyimpanan
    }
}

/** Dipanggil sekali saat ERP terbuka. */
export function mountProShell({ getCtx, getModules }) {
    state.getCtx = getCtx;
    state.getModules = getModules;
    const right = document.querySelector(".erp-top__right");
    if (!right || document.getElementById("erpSearchBtn")) return;

    const searchBtn = el("button", { class: "erp-btn erp-btn--sm erp-search-btn", id: "erpSearchBtn", type: "button", title: "Cari menu, orang, produk (Ctrl+K)", onclick: openPalette },
        icon(SEARCH), el("span", { class: "erp-search-btn__text", text: "Cari" }), el("kbd", { text: navigator.platform?.includes("Mac") ? "⌘K" : "Ctrl K" }));
    const bell = el("button", { class: "erp-icon-btn erp-bell", id: "erpBell", type: "button", "aria-label": "Notifikasi", "aria-haspopup": "dialog", onclick: togglePanel },
        icon(BELL), el("span", { class: "erp-bell__count", id: "erpBellCount", hidden: true }));
    right.prepend(searchBtn, bell);

    document.addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
            if (document.getElementById("appView")?.hidden) return;
            event.preventDefault();
            openPalette();
        }
    });
}

export async function refreshProShell({ fresh = false } = {}) {
    const ctx = state.getCtx?.();
    if (!ctx?.data) return;
    try {
        const { signals, raw } = await loadProData(ctx, { fresh });
        state.signals = signals;
        state.raw = raw;
        const count = unreadCount(signals, readIds());
        const badge = document.getElementById("erpBellCount");
        if (badge) {
            badge.hidden = count === 0;
            badge.textContent = count > 9 ? "9+" : String(count);
        }
        document.getElementById("erpBell")?.setAttribute("aria-label", count ? `Notifikasi, ${count} belum dibaca` : "Notifikasi");
    } catch {
        // Sinyal gagal dimuat: lonceng tetap tanpa angka.
    }
    clearInterval(state.timer);
    state.timer = setInterval(() => refreshProShell({ fresh: true }), 60000);
}

export function stopProShell() {
    clearInterval(state.timer);
    closePanel();
}

/* ---------- Pusat notifikasi ---------- */

function closePanel() {
    document.getElementById("erpNotify")?.remove();
    document.getElementById("erpBell")?.setAttribute("aria-expanded", "false");
}

function togglePanel() {
    if (document.getElementById("erpNotify")) return closePanel();
    const read = new Set(readIds());
    const panel = el("div", { class: "erp-notify", id: "erpNotify", role: "dialog", "aria-label": "Notifikasi" },
        el("header", { class: "erp-notify__head" },
            el("strong", { text: "Notifikasi" }),
            el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => {
                saveRead([...new Set([...readIds(), ...state.signals.map((s) => s.id)])]);
                closePanel();
                refreshProShell();
            } }, "Tandai semua dibaca")),
        state.signals.length
            ? el("ul", { class: "erp-notify__list" }, state.signals.map((s) => el("li", {},
                el("a", { class: `erp-notify__item erp-notify__item--${s.tone}${read.has(s.id) ? " is-read" : ""}`, href: s.href, onclick: () => {
                    saveRead([...readIds(), s.id]);
                    closePanel();
                    refreshProShell();
                } },
                    el("span", { class: "erp-notify__area", text: s.area }),
                    el("strong", { text: s.title }),
                    el("small", { text: s.body })))))
            : el("p", { class: "erp-notify__empty", text: "Tidak ada yang perlu perhatianmu. 👌" }));
    document.body.append(panel);
    document.getElementById("erpBell")?.setAttribute("aria-expanded", "true");
    setTimeout(() => {
        const outside = (event) => {
            if (!panel.contains(event.target) && event.target.closest?.("#erpBell") == null) {
                closePanel();
                document.removeEventListener("pointerdown", outside, true);
            }
        };
        document.addEventListener("pointerdown", outside, true);
    });
    const onKey = (event) => {
        if (event.key === "Escape") {
            closePanel();
            document.removeEventListener("keydown", onKey);
        }
    };
    document.addEventListener("keydown", onKey);
}

/* ---------- Ctrl+K ---------- */

function buildItems() {
    const modules = state.getModules?.() || [];
    const allowed = new Set(modules.map((m) => m.key));
    const raw = state.raw || {};
    const items = [
        ...modules.map((m) => ({ id: `m-${m.key}`, group: "Menu", label: m.label, hint: m.hint, keywords: m.key, href: `#/${m.key}` })),
        ...SUB_PAGES.filter((p) => allowed.has(p.module)).map((p) => ({
            id: `p-${p.module}-${p.path}`, group: "Menu", label: p.label, hint: modules.find((m) => m.key === p.module)?.label, keywords: p.keywords, href: `#/${p.module}/${p.path}`,
        })),
        ...state.signals.map((s) => ({ id: `s-${s.id}`, group: "Perlu perhatian", label: s.title, hint: s.body, keywords: s.area, href: s.href })),
    ];
    if (allowed.has("org")) {
        (raw.members || []).filter((m) => m.is_active !== false).forEach((m) => items.push({ id: `u-${m.id}`, group: "Orang", label: m.full_name, hint: m.position_title, keywords: `${m.email || ""} ${m.job_role || ""}`, href: "#/org" }));
    }
    if (allowed.has("catalog")) {
        (raw.products || []).forEach((p) => items.push({ id: `pr-${p.id}`, group: "Produk", label: p.name, hint: [p.sku, p.category].filter(Boolean).join(" · "), keywords: `${p.sku || ""} ${p.barcode || ""}`, href: "#/catalog" }));
    }
    if (allowed.has("crm")) {
        (raw.deals || []).forEach((d) => items.push({ id: `d-${d.id}`, group: "Calon pelanggan", label: d.customer, hint: d.title, keywords: d.stage, href: "#/crm/pipeline" }));
    }
    return items;
}

function openPalette() {
    if (document.getElementById("erpPalette")) return;
    closePanel();
    const items = buildItems();
    const input = el("input", { class: "erp-palette__input", type: "search", autofocus: true, placeholder: "Cari menu, orang, produk, calon pelanggan…", "aria-label": "Cari", autocomplete: "off" });
    const list = el("ul", { class: "erp-palette__list", role: "listbox" });
    let results = [];
    let active = 0;

    const go = (item) => {
        dialog.close();
        if (!item) return;
        if (location.hash === item.href) window.dispatchEvent(new HashChangeEvent("hashchange"));
        else location.hash = item.href;
    };

    const draw = () => {
        const q = input.value;
        results = q.trim() ? searchCommands(q, items, 14) : items.filter((i) => i.group !== "Orang" && i.group !== "Produk" && i.group !== "Calon pelanggan").slice(0, 10);
        active = Math.min(active, Math.max(0, results.length - 1));
        let lastGroup = "";
        list.replaceChildren(...(results.length ? results.flatMap((item, index) => {
            const head = item.group !== lastGroup ? el("li", { class: "erp-palette__group", role: "presentation", text: item.group }) : null;
            lastGroup = item.group;
            const row = el("li", { class: `erp-palette__item${index === active ? " is-active" : ""}`, role: "option", "aria-selected": String(index === active), onclick: () => go(item), onmousemove: () => {
                if (active !== index) {
                    active = index;
                    draw();
                }
            } },
                el("strong", { text: item.label }),
                item.hint ? el("small", { text: item.hint }) : null);
            return [head, row].filter(Boolean);
        }) : [el("li", { class: "erp-palette__empty", text: "Tidak ditemukan. Coba kata lain." })]));
        list.querySelector(".is-active")?.scrollIntoView({ block: "nearest" });
    };

    input.addEventListener("input", () => {
        active = 0;
        draw();
    });
    input.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            active = Math.min(results.length - 1, active + 1);
            draw();
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            active = Math.max(0, active - 1);
            draw();
        } else if (event.key === "Enter") {
            event.preventDefault();
            go(results[active]);
        }
    });

    const dialog = el("dialog", { class: "erp-palette", id: "erpPalette", "aria-label": "Cari cepat" },
        el("div", { class: "erp-palette__box" },
            input,
            list,
            el("p", { class: "erp-palette__foot", text: "↑↓ pilih · Enter buka · Esc tutup" })));
    dialog.addEventListener("close", () => dialog.remove());
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
    });
    document.body.append(dialog);
    dialog.showModal();
    draw();
    input.focus();
    requestAnimationFrame(() => input.focus());
}
