/**
 * KANTOONG — ASISTEN AI UNIVERSAL (satu chat untuk semua halaman & brand)
 * File: frontend/js/kantoong-assistant.js
 *
 * Pasang di halaman mana pun dengan satu baris:
 *   <script type="module" src="/js/kantoong-assistant.js"></script>
 * Opsional, sebelum baris itu:
 *   <script>window.KantoongAssistantContext = { surface: "erp" }</script>
 *
 * Yang dilakukan:
 * 1. Memasang kotak chat (markup dari assistant-markup.js) bila belum ada.
 *    Di toko: di dalam #appRoot. Di halaman lain (ERP, dll): lapisan tetap.
 * 2. Mengenali pengguna (nama dari Kantoong ID) untuk sapaan personal.
 * 3. Izin memori (UU PDP): "ingat di semua toko Kantoong" atau "hanya toko ini".
 * 4. Memori lintas brand & perangkat: bila login & diizinkan, obrolan
 *    disinkronkan ke Supabase (db/assistant-memory.sql), hanya teks.
 * 5. Di atas keranjang / dashboard, chat mengecil jadi orb agar tidak
 *    menutupi tombol penting; tetap bisa dibuka kapan saja.
 *    Desktop: chat terbuka menempel di samping (assistant-dock.js), KECUALI
 *    context.dock === false (ERP & kasir): mode BEBAS — pil "Halo Kak" di bawah,
 *    digeser kiri/kanan saja, dibuka naik seperti di HP (setengah/penuh),
 *    halaman utama tidak pernah menyempit.
 * 6. Hak pengguna: menu "Hapus memori asisten" menghapus lokal + server.
 */

import { supabase } from "./supabase-client.js";
import { ASSISTANT_MARKUP } from "./assistant-markup.js";
import { brandName, getMemoryScope, historyStorageKey, setMemoryScope } from "./assistant-context.js";
import { initAssistantDock } from "./assistant-dock.js";
import { initAssistantHistory } from "./assistant-history.js";
import { initChatProductGestures } from "./chat-product-gestures.js";
import { initAiTelemetry } from "./ai-telemetry.js";

const context = (window.KantoongAssistantContext = window.KantoongAssistantContext || {});
if (!context.surface) context.surface = location.pathname.includes("/erp/") ? "erp" : "store";
if (context.dock === false) document.documentElement.dataset.kcFree = "";

/* ---------- 1. Pasang kotak chat ---------- */

function mountMarkup() {
    if (document.getElementById("chatPanel")) return;

    const template = document.createElement("template");
    template.innerHTML = ASSISTANT_MARKUP.trim();

    const appRoot = document.getElementById("appRoot");

    if (appRoot) {
        appRoot.appendChild(template.content);
        return;
    }

    // Halaman tanpa kerangka toko: lapisan setinggi layar, tidak menghalangi klik.
    const host = document.createElement("div");
    host.id = "kantoongAssistantHost";
    host.className = "kc-host";
    host.appendChild(template.content);
    document.body.appendChild(host);
}

async function ensureStyles() {
    const loaded = [...document.styleSheets].some((sheet) => String(sheet.href || "").includes("chat-sheet.css"))
        || document.querySelector('link[href*="chat-sheet.css"], style[data-vite-dev-id*="chat-sheet"]');
    if (!loaded) await import("../css/chat-sheet.css");
}

/* ---------- 2. Kenali pengguna & siapkan produk ---------- */

async function identifyUser() {
    try {
        const { data } = await supabase.auth.getSession();
        const user = data?.session?.user;
        if (!user) return null;
        const meta = user.user_metadata || {};
        if (!context.userName) context.userName = String(meta.full_name || meta.name || "").trim();
        return user;
    } catch {
        return null;
    }
}

/** Di luar toko (mis. ERP), asisten mengambil katalog sendiri agar tetap bisa menjawab soal produk. */
async function ensureProducts() {
    if (window.KantoongState || document.getElementById("appRoot")) return;
    try {
        const { data } = await supabase
            .from("products")
            .select("id, name, price, category, description, image_url")
            .limit(60);
        window.KantoongState = { products: data || [] };
    } catch {
        window.KantoongState = { products: [] };
    }
}

/* ---------- 3. Izin memori lintas brand (UU PDP) ---------- */

function mergeMessages(...lists) {
    const byId = new Map();
    for (const list of lists) {
        for (const message of list || []) {
            if (message && message.id && !byId.has(message.id)) byId.set(message.id, message);
        }
    }
    return [...byId.values()].sort((a, b) => Number(a.timestamp) - Number(b.timestamp)).slice(-200);
}

function readKey(key) {
    try {
        return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
        return [];
    }
}

function showConsent() {
    if (getMemoryScope() || document.querySelector(".kc-consent")) return;

    const chatBox = document.getElementById("chatBox");
    if (!chatBox) return;

    const box = document.createElement("div");
    box.className = "kc-consent";
    box.setAttribute("role", "region");
    box.setAttribute("aria-label", "Izin memori asisten");

    const text = document.createElement("p");
    text.textContent =
        "Boleh aku mengingat obrolan kita di semua toko jaringan Kantoong? " +
        "Jadi saat kamu pindah toko, aku tetap nyambung. Kamu bisa menghapusnya kapan saja lewat menu +.";

    const yes = document.createElement("button");
    yes.type = "button";
    yes.className = "kc-consent__yes";
    yes.textContent = "Ingat di semua toko";

    const no = document.createElement("button");
    no.type = "button";
    no.className = "kc-consent__no";
    no.textContent = `Hanya di ${brandName()}`;

    const decide = async (scope) => {
        const brandHistory = readKey(historyStorageKey());
        setMemoryScope(scope);
        box.remove();

        if (scope === "network") {
            // Gabungkan obrolan toko ini ke memori jaringan, lalu sinkron.
            const merged = mergeMessages(readKey(historyStorageKey()), brandHistory);
            window.KantoongAIBrain?.reload?.(merged);
            await syncFromServer();
        } else {
            window.KantoongAIBrain?.reload?.();
        }
    };

    yes.addEventListener("click", () => decide("network"));
    no.addEventListener("click", () => decide("brand"));

    const actions = document.createElement("div");
    actions.className = "kc-consent__actions";
    actions.append(yes, no);
    box.append(text, actions);
    chatBox.before(box);
}

/* ---------- 4. Sinkron memori ke server (login + izin "semua toko") ---------- */

let currentUser = null;
let remoteDisabled = false;
let pushTimer = 0;

async function syncFromServer() {
    if (!currentUser || remoteDisabled || getMemoryScope() !== "network") return;

    const { data, error } = await supabase
        .from("assistant_memory")
        .select("messages")
        .eq("user_id", currentUser.id)
        .maybeSingle();

    if (error) {
        // Tabel belum dibuat (db/assistant-memory.sql): cukup memori lokal.
        remoteDisabled = true;
        return;
    }

    const local = window.KantoongAIBrain?.getHistory?.() || [];
    const merged = mergeMessages(local, data?.messages || []);

    if (merged.length !== local.length) window.KantoongAIBrain?.reload?.(merged);
    if (merged.length !== (data?.messages || []).length) schedulePush(merged);
}

function schedulePush(history) {
    if (!currentUser || remoteDisabled || getMemoryScope() !== "network") return;

    clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
        const messages = (history || []).slice(-200).map((message) => ({
            id: message.id,
            who: message.who,
            text: String(message.text || "").slice(0, 3000),
            timestamp: message.timestamp,
            brand: message.brand,
            surface: message.surface,
            productIds: message.productIds,
            attachments: (message.attachments || []).map((file) => ({ name: file.name, type: file.type, product: file.product })),
        }));

        const { error } = await supabase
            .from("assistant_memory")
            .upsert({ user_id: currentUser.id, messages, updated_at: new Date().toISOString() });

        if (error) remoteDisabled = true;
    }, 1500);
}

window.addEventListener("kantoong:assistant-history", (event) => schedulePush(event.detail?.history));

/* ---------- 6. Hapus memori (hak pengguna) ---------- */

window.addEventListener("kantoong:forget-memory", async () => {
    const ok = window.confirm(
        "Hapus semua memori asisten? Riwayat obrolan di semua toko Kantoong (perangkat ini" +
        (currentUser ? " dan akunmu" : "") + ") akan dihapus permanen."
    );
    if (!ok) return;

    try {
        Object.keys(localStorage)
            .filter((key) => key.startsWith("kantoong:chat:"))
            .forEach((key) => localStorage.removeItem(key));
    } catch {
        // abaikan
    }

    if (currentUser && !remoteDisabled) {
        await supabase.from("assistant_memory").delete().eq("user_id", currentUser.id);
    }

    window.KantoongAIBrain?.clearHistory?.();
});

/* ---------- 5. Lapisan keranjang / dashboard: chat jadi orb ---------- */

let minimizedByOverlay = false;
const openOverlays = new Set();

function setOverlay(name, open) {
    if (open) openOverlays.add(name);
    else openOverlays.delete(name);

    document.body.classList.toggle("kc-overlay-open", openOverlays.size > 0);
    const chat = window.KantoongChat;
    if (!chat) return;

    if (openOverlays.size && !chat.isMinimized?.()) {
        chat.minimize();
        minimizedByOverlay = true;
    } else if (!openOverlays.size && minimizedByOverlay) {
        minimizedByOverlay = false;
        chat.restore?.();
    }
}

window.addEventListener("kantoong:overlay", (event) => setOverlay(event.detail?.name || "lapisan", Boolean(event.detail?.open)));
window.addEventListener("kantoong:dashboard-opened", () => setOverlay("dashboard", true));
window.addEventListener("kantoong:dashboard-closed", () => setOverlay("dashboard", false));

/* ---------- Kartu produk di jawaban AI, di luar toko: buka di toko ---------- */

document.addEventListener("click", (event) => {
    if (window.KantoongEngine) return;
    const card = event.target.closest?.("#chatBox [data-product-id]");
    if (!card) return;
    event.preventDefault();
    window.open(`/index.html#produk/${encodeURIComponent(card.dataset.productId)}`, "_blank", "noopener");
}, true);

/* ---------- Mulai ---------- */

async function start() {
    mountMarkup();
    await ensureStyles();
    currentUser = await identifyUser();
    await ensureProducts();

    // Urutan penting: markup & konteks siap dulu, baru otak AI & panel dihidupkan.
    await import("./ai-brain.js");
    window.KantoongAIBrain?.init?.();
    await import("./chat-sheet.js");

    if (context.startMinimized) window.KantoongChat?.minimize?.();
    if (context.dock !== false) initAssistantDock();
    initAssistantHistory();
    initChatProductGestures();
    initAiTelemetry();

    showConsent();
    syncFromServer();

    window.dispatchEvent(new CustomEvent("kantoong:assistant-ready", { detail: { surface: context.surface } }));
}

start();
