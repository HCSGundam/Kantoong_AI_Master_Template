/**
 * KANTOONG — MESIN "RUANG" FITUR (Lapisan 2, dashboard user)
 * File: frontend/dashboard-user/home/room.js
 *
 * Setiap fitur = satu ruang:
 *   [ kepala: ikon · judul · kalimat pembeda · STATUS SAAT INI · Tanya asisten ]
 *   [ kisi sub-fitur (tiap kartu punya lencana angka asli) ]
 *   → ketuk sub-fitur = panel di dalam ruang (tombol kembali)
 *
 * Definisi ruang (home/rooms/*.js):
 * {
 *   id, title, tagline, tone?: "ink"|"gold"|"light",
 *   load: async () => data,
 *   hero: (data) => ({ value, note }),
 *   tools: [{ id, title, desc, badge?: (data)=>string, render: (body, data, api) => void }],
 *   snapshot: (data) => string   // ringkasan untuk AI (konteks + entitas)
 * }
 * AI boleh membuka sub-fitur lewat event "kantoong:room-open" { feature, tool }.
 */

import { el, icon } from "./home-icons.js";
import { registerRoom } from "./ai-bridge.js";

function btn(label, onClick, className = "bx-btn") {
    const b = el("button", className, label);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
}

function toParent(message) {
    if (window.parent && window.parent !== window) {
        window.parent.postMessage(message, window.location.origin);
        return true;
    }
    return false;
}

/** Pembantu yang dipakai semua sub-fitur. */
export function roomApi(extra = {}) {
    return {
        openFeature: (id) => window.dispatchEvent(new CustomEvent("kantoong:bento-open", { detail: { id } })),
        openProduct: (id, from = "") => toParent({ type: "kantoong:open-product", id: String(id), from }),
        openCart: () => toParent({ type: "kantoong:open-cart" }),
        // Membuka asisten saja — TIDAK menulis/mengirim kalimat otomatis.
        openAssistant: () => {
            const chat = window.KantoongChat;
            if (chat) {
                if (chat.isMinimized?.()) chat.restore?.();
                chat.open?.("mid");
                return;
            }
            toParent({ type: "kantoong:open-assistant" });
        },
        toast(text) {
            const t = el("div", "bx-room-toast", text);
            t.setAttribute("role", "status");
            document.body.append(t);
            setTimeout(() => t.classList.add("is-out"), 2200);
            setTimeout(() => t.remove(), 2600);
        },
        ...extra,
    };
}

/** Pasang ruang ke root. Mengembalikan { openTool(id) }. */
/**
 * Jenis tata letak per fitur (komposisi berbeda sesuai fungsi):
 *   list      : isi daftar langsung tampil + tab sub-fitur (tanpa harus mengetuk menu dulu)
 *   analytics : angka besar + sub-fitur sebagai kotak statistik
 *   form      : satu kartu pengaturan berisi baris bergaris pemisah
 *   media     : area unggah / mikrofon besar sebagai pusat halaman
 *   live      : status besar dengan penanda "live" + sub-fitur bergaya garis waktu
 *   default   : kepala + kisi sub-fitur
 */
const LAYOUTS = {
    "my-orders": "list", "transaction-history": "list", "shipping-address": "list", "product-reviews": "list",
    "vouchers-promos": "list", "banner-carousel": "list", "cooperation-documents": "list", "ai-chat-history": "list",
    calendar: "list", wishlist: "list",
    "total-spending": "analytics", "spending-analytics": "analytics", membership: "analytics",
    settings: "form", localization: "form", "data-export": "form", "my-card": "form",
    "media-upload": "media", "voice-interaction": "media",
    "queue-management": "live", "takeaway-ordering": "live", "package-tracking": "live", clock: "live",
};

export async function mountRoom(root, def, context = null) {
    registerRoom(def);
    root.replaceChildren(el("div", "bx-room is-loading", el("div", "bx-shimmer bx-shimmer--block")));

    let data = null;
    let current = null; // sub-fitur yang terbuka
    const kind = def.layout ?? LAYOUTS[def.id] ?? "default";
    const view = el("div", `bx-room bx-room--${def.tone ?? "light"} bx-room--${kind}`);
    view.dataset.layout = kind;

    const api = roomApi({
        context,
        refresh: async () => {
            data = await safeLoad();
            draw();
        },
        openTool: (id) => openTool(id),
        back: () => openTool(null),
    });

    async function safeLoad() {
        try {
            return (await def.load?.()) ?? {};
        } catch (error) {
            console.warn(`[KANTOONG ${def.title}]`, error?.message || error);
            return { error: true };
        }
    }

    function heroBlock() {
        const h = def.hero?.(data) ?? {};
        const ask = btn([icon("ai-chat-history"), "Tanya asisten tentang ini"], api.openAssistant, "bx-room__ask");
        // Media: kepala menjadi area aksi besar (ketuk = buka sub-fitur pertama).
        if (kind === "media") {
            const first = def.tools[0];
            const zone = btn([
                el("span", "bx-room__zone-icon", icon(def.id, "bx-icon bx-icon--xl")),
                el("strong", "", first?.title ?? def.title),
                el("span", "", first?.desc ?? h.note ?? ""),
            ], () => first && openTool(first.id), "bx-room__zone");
            return el("header", "bx-room__hero bx-room__hero--media",
                el("div", "bx-room__head",
                    el("p", "bx-room__eyebrow", def.title),
                    el("h2", "bx-room__value", h.value ?? def.title),
                    h.note ? el("p", "bx-room__note", h.note) : null),
                zone,
                ask);
        }
        return el("header", "bx-room__hero",
            kind === "live" ? el("span", "bx-room__live", el("i"), "LIVE") : null,
            el("span", "bx-room__orb", icon(def.id, "bx-icon bx-icon--xl")),
            el("div", "bx-room__head",
                el("p", "bx-room__eyebrow", def.title),
                el("h2", "bx-room__value", h.value ?? def.title),
                h.note ? el("p", "bx-room__note", h.note) : null,
                data?.offline ? el("p", "bx-room__offline", "📡 Sinyal lagi hilang — ini data terakhir yang tersimpan di perangkatmu.") : null,
                def.tagline ? el("p", "bx-room__tagline", def.tagline) : null),
            ask);
    }

    function toolGrid() {
        return el("div", "bx-room__tools", def.tools.map((t, i) => {
            const badge = safe(() => t.badge?.(data));
            const card = btn([
                el("span", "bx-room__tool-icon", icon(t.icon ?? def.id, "bx-icon")),
                el("span", "bx-room__tool-text", el("strong", "", t.title), el("small", "", t.desc ?? "")),
                badge ? el("span", "bx-room__badge", badge) : null,
                el("span", "bx-room__chev", "›"),
            ], () => openTool(t.id), "bx-room__tool");
            card.style.setProperty("--i", String(i));
            card.dataset.tool = t.id;
            return card;
        }));
    }

    function tabs() {
        return el("div", "bx-room__tabs", def.tools.map((t) => {
            const badge = safe(() => t.badge?.(data));
            const b = btn([el("span", "", t.title), badge ? el("span", "bx-room__tab-badge", badge) : null], () => openTool(t.id), `bx-room__tab${t.id === current ? " is-on" : ""}`);
            b.setAttribute("aria-pressed", String(t.id === current));
            return b;
        }));
    }

    function panel(tool) {
        const body = el("div", "bx-room__body");
        // Bagian opsional (cond ? x : null) jangan pernah tertulis "null" di layar.
        const rawAppend = body.append.bind(body);
        body.append = (...nodes) => rawAppend(...nodes.flat().filter((n) => n != null && n !== false && n !== ""));
        const back = btn([icon("back"), "Kembali"], () => openTool(null), "bx-room__back");
        try {
            tool.render(body, data, api);
        } catch (error) {
            console.warn(`[KANTOONG ${def.title} › ${tool.title}]`, error);
            body.replaceChildren(el("p", "bx-muted", "Bagian ini belum bisa ditampilkan. Coba muat ulang."));
        }
        if (kind === "list") return el("section", "bx-room__panel bx-room__panel--inline", tool.desc ? el("p", "bx-room__panel-desc", tool.desc) : null, body);
        return el("section", "bx-room__panel", el("div", "bx-room__panel-head", back, el("h3", "", tool.title)), tool.desc ? el("p", "bx-room__panel-desc", tool.desc) : null, body);
    }

    function draw() {
        // Daftar: sub-fitur pertama langsung terbuka, sub-fitur lain lewat tab.
        if (kind === "list" && !def.tools.some((t) => t.id === current)) current = def.tools[0]?.id ?? null;
        const tool = def.tools.find((t) => t.id === current);
        if (kind === "list" && tool) {
            view.replaceChildren(heroBlock(), tabs(), panel(tool));
            view.dataset.open = "list";
            return;
        }
        view.replaceChildren(heroBlock(), tool ? panel(tool) : toolGrid());
        view.dataset.open = tool ? "tool" : "grid";
    }

    function openTool(id) {
        current = def.tools.some((t) => t.id === id) ? id : null;
        draw();
        if (kind !== "list") view.scrollIntoView?.({ block: "start", behavior: "smooth" });
    }

    // AI / Sinyal meminta sub-fitur tertentu.
    const onOpen = (event) => {
        if (!root.isConnected) return window.removeEventListener("kantoong:room-open", onOpen);
        if (event.detail?.feature === def.id) openTool(event.detail.tool ?? null);
    };
    window.addEventListener("kantoong:room-open", onOpen);
    const onChange = () => {
        if (!root.isConnected) return window.removeEventListener("kantoong:me-changed", onChange);
        api.refresh();
    };
    window.addEventListener("kantoong:me-changed", onChange);

    data = await safeLoad();
    root.replaceChildren(view);
    const pending = window.__kcPendingTool;
    if (pending?.feature === def.id) {
        window.__kcPendingTool = null;
        current = pending.tool ?? null;
    }
    draw();
    return { openTool };
}

function safe(fn) {
    try {
        return fn();
    } catch {
        return "";
    }
}

/* ---------- Pembangun kecil yang dipakai banyak sub-fitur ---------- */

export const ui = {
    empty(title, text, action) {
        return el("div", "bx-empty bx-empty--soft", el("span", "bx-empty__icon", icon("sparkle", "bx-icon bx-icon--xl")), el("h3", "", title), el("p", "", text), action ?? null);
    },
    stat(label, value, note) {
        return el("div", "bx-stat", el("span", "bx-stat__label", label), el("strong", "bx-stat__value", value), note ? el("span", "bx-stat__note", note) : null);
    },
    stats(...items) {
        return el("div", "bx-stats", items.filter(Boolean));
    },
    row(iconName, title, sub, right) {
        return el("li", "bx-row", el("span", "bx-row__icon", icon(iconName, "bx-icon")), el("div", "bx-row__text", el("strong", "", title), sub ? el("span", "", sub) : null), right ?? null);
    },
    list(items) {
        return el("ul", "bx-rows", items);
    },
    note(text) {
        return el("p", "bx-room__fine", text);
    },
    btn,
    /** Formulir sederhana: fields [{name,label,type,placeholder,options,required}] */
    form(fields, onSubmit, submitLabel = "Simpan") {
        const form = el("form", "bx-form");
        fields.forEach((f) => {
            let input;
            if (f.type === "select") {
                input = el("select", "", (f.options ?? []).map((o) => {
                    const opt = el("option", "", o.label ?? o);
                    opt.value = o.value ?? o;
                    return opt;
                }));
            } else if (f.type === "textarea") {
                input = el("textarea", "");
                input.rows = f.rows ?? 3;
            } else {
                input = el("input", "");
                input.type = f.type ?? "text";
            }
            input.name = f.name;
            if (f.placeholder) input.placeholder = f.placeholder;
            if (f.required) input.required = true;
            if (f.value != null) input.value = f.value;
            if (f.max) input.maxLength = f.max;
            if (f.min != null) input.min = f.min;
            form.append(el("label", "bx-form__field", el("span", "", f.label), input));
        });
        const submit = el("button", "bx-btn", submitLabel);
        submit.type = "submit";
        form.append(submit);
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            onSubmit(Object.fromEntries(new FormData(form).entries()), form);
        });
        return form;
    },
    link(label, href, className = "bx-btn bx-btn--ghost") {
        const a = el("a", className, label);
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener";
        return a;
    },
};
