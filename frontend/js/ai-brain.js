/**
 * ============================================================
 * KANTOONG CORE — AI BRAIN
 * File: frontend/js/ai-brain.js
 *
 * Arsitektur:
 * - ES Modules
 * - Konfigurasi dari client-config.js
 * - State produk dibaca dari window.KantoongState
 * - Integrasi AI backend melalui API
 * - Fallback pencarian produk lokal
 * - Riwayat percakapan per business/tenant
 * - Rekomendasi produk berdasarkan relevansi dan anggaran
 * - Event bridge untuk panel AI dan katalog
 *
 * KEAMANAN:
 * - Jangan menaruh API key LLM di frontend.
 * - Backend wajib memverifikasi identitas pengguna,
 *   business/tenant, izin akses, dan rate limit.
 * ============================================================
 */

import CFG from "../client-config.js";
import { assistantContext, brandName, currentSurface, historyStorageKey } from "./assistant-context.js";

/* ============================================================
   01. KONFIGURASI
   ============================================================ */

const AI_CONFIG = Object.freeze({
    businessId: String(
        CFG?.business_id ||
        CFG?.businessId ||
        "default"
    ),

    endpoint: String(
        CFG?.ai_endpoint ||
        CFG?.aiEndpoint ||
        ""
    ).trim(),

    title: String(
        CFG?.ai_title ||
        CFG?.aiTitle ||
        "KANTOONG AI"
    ),

    greetings: Array.isArray(window.KantoongAssistantContext?.greetings)
        ? window.KantoongAssistantContext.greetings
        : Array.isArray(CFG?.ai_greetings)
        ? CFG.ai_greetings
        : Array.isArray(CFG?.aiGreetings)
            ? CFG.aiGreetings
            : [
                "Halo! Ada yang bisa aku bantu hari ini?",
                "Hai! Mau mencari produk atau bertanya sesuatu?",
                "Selamat datang! Aku siap membantumu."
            ],

    suggestions: Array.isArray(window.KantoongAssistantContext?.suggestions)
        ? window.KantoongAssistantContext.suggestions
        : Array.isArray(CFG?.ai_suggestions)
        ? CFG.ai_suggestions
        : Array.isArray(CFG?.aiSuggestions)
            ? CFG.aiSuggestions
            : [
                "Tampilkan produk populer",
                "Cari produk termurah",
                "Bantu aku memilih produk",
                "Apa saja produk yang tersedia?"
            ],

    historyDays: clampNumber(
        CFG?.ai_history_days ?? CFG?.aiHistoryDays,
        30,
        1,
        365
    ),

    maxHistoryMessages: clampNumber(
        CFG?.ai_max_history_messages ??
        CFG?.aiMaxHistoryMessages,
        60,
        10,
        200
    ),

    maxContextMessages: clampNumber(
        CFG?.ai_max_context_messages ??
        CFG?.aiMaxContextMessages,
        12,
        2,
        40
    ),

    maxProductsInReply: clampNumber(
        CFG?.ai_max_products ??
        CFG?.aiMaxProducts,
        4,
        1,
        8
    ),

    requestTimeoutMs: clampNumber(
        CFG?.ai_timeout_ms ?? CFG?.aiTimeoutMs,
        20000,
        3000,
        60000
    ),

    currency: String(CFG?.currency || "IDR"),

    locale: String(CFG?.locale || "id-ID"),

    allowLocalFallback: CFG?.ai_local_fallback !== false
});

/* ============================================================
   02. STATE INTERNAL
   ============================================================ */

const AIState = {
    initialized: false,
    busy: false,
    history: [],
    suggestionsOpen: false,
    requestController: null,
    requestSequence: 0,
    boundElements: null
};

const STORAGE_PREFIX = "kantoong:chat:";

// Satu asisten untuk seluruh jaringan Kantoong: bila pengguna mengizinkan,
// riwayat disimpan di kunci bersama sehingga nyambung di semua brand.
const historyKey = () => historyStorageKey() || `${STORAGE_PREFIX}${AI_CONFIG.businessId}`;

const MAX_MESSAGE_LENGTH = 3000;

/* ============================================================
   03. UTILITAS UMUM
   ============================================================ */

function clampNumber(value, fallback, min, max) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return fallback;
    }

    return Math.min(max, Math.max(min, Math.floor(number)));
}

function normalizeText(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s.,-]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function escapeRegExp(value) {
    return String(value).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}

function getTimestamp() {
    return Date.now();
}

function getTodayKey() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatTime(timestamp = Date.now()) {
    return new Intl.DateTimeFormat(AI_CONFIG.locale, {
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date(timestamp));
}

function formatRupiah(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "Harga belum tersedia";
    }

    try {
        return new Intl.NumberFormat(AI_CONFIG.locale, {
            style: "currency",
            currency: AI_CONFIG.currency,
            maximumFractionDigits: 0
        }).format(number);
    } catch {
        return `Rp${Math.round(number).toLocaleString("id-ID")}`;
    }
}

function safeText(value, fallback = "") {
    if (value === null || value === undefined) {
        return fallback;
    }

    return String(value).trim() || fallback;
}

function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (text !== undefined && text !== null) {
        element.textContent = String(text);
    }

    return element;
}

/**
 * Event convention:
 *
 * emit("matched", detail)
 * -> window event "kantoong:matched"
 *
 * Jangan mengirim nama yang sudah diawali "kantoong:",
 * karena akan menghasilkan prefix ganda.
 */
function emit(name, detail = {}) {
    const eventName = String(name).replace(/^kantoong:/, "");

    const eventDetail = {
        ...detail,
        business_id: AI_CONFIG.businessId,
        source: "ai-brain"
    };

    document.dispatchEvent(
        new CustomEvent(`kantoong:${eventName}`, {
            detail: eventDetail
        })
    );

    window.dispatchEvent(
        new CustomEvent(`kantoong:${eventName}`, {
            detail: eventDetail
        })
    );
}

function getElements() {
    return {
        chatBox: document.getElementById("chatBox"),
        suggestions: document.getElementById("chatSuggestions"),
        sendButton: document.getElementById("tombolKirim"),
        input: document.getElementById("kolomKetik")
    };
}

function getEngineState() {
    const state = window.KantoongState;

    if (!state || typeof state !== "object") {
        return null;
    }

    return state;
}

/* ============================================================
   04. AKSES DATA PRODUK
   ============================================================ */

function getProducts() {
    const state = getEngineState();

    if (!state) {
        return [];
    }

    const products = Array.isArray(state.products)
        ? state.products
        : [];

    return products.filter(product =>
        product &&
        typeof product === "object"
    );
}

function getProductId(product) {
    if (!product) {
        return "";
    }

    return String(
        product.id ??
        product.product_id ??
        product.productId ??
        product.sku ??
        ""
    ).trim();
}

function getProductName(product) {
    return safeText(
        product?.name ??
        product?.product_name ??
        product?.productName ??
        product?.title,
        "Produk tanpa nama"
    );
}

function getProductPrice(product) {
    const rawPrice =
        product?.price ??
        product?.selling_price ??
        product?.sellingPrice ??
        product?.harga;

    if (rawPrice === null || rawPrice === undefined || rawPrice === "") {
        return null;
    }

    const price = Number(rawPrice);

    return Number.isFinite(price) && price >= 0
        ? price
        : null;
}

function getProductImage(product) {
    return safeText(
        product?.image_url ??
        product?.imageUrl ??
        product?.image ??
        product?.thumbnail ??
        product?.photo_url,
        ""
    );
}

function getProductDescription(product) {
    return safeText(
        product?.description ??
        product?.caption ??
        product?.short_description ??
        product?.shortDescription,
        ""
    );
}

function getProductCategory(product) {
    const category = product?.category;

    if (typeof category === "string") {
        return category;
    }

    if (category && typeof category === "object") {
        return safeText(
            category.name ?? category.title,
            ""
        );
    }

    return safeText(
        product?.category_name ??
        product?.categoryName,
        ""
    );
}

function findProduct(productId) {
    const id = String(productId ?? "").trim();

    if (!id) {
        return null;
    }

    return getProducts().find(product =>
        getProductId(product) === id
    ) || null;
}

function getProductSearchText(product) {
    return normalizeText([
        getProductName(product),
        getProductDescription(product),
        getProductCategory(product),
        product?.brand,
        product?.sku,
        product?.tags
    ].filter(Boolean).join(" "));
}

/* ============================================================
   05. RIWAYAT CHAT
   ============================================================ */

function readHistory() {
    try {
        const raw = localStorage.getItem(historyKey());

        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return [];
        }

        const minimumTimestamp =
            getTimestamp() -
            AI_CONFIG.historyDays * 24 * 60 * 60 * 1000;

        return parsed
            .filter(message => {
                if (!message || typeof message !== "object") {
                    return false;
                }

                const validRole = [
                    "user",
                    "ai",
                    "system"
                ].includes(message.who);

                const validText =
                    typeof message.text === "string";

                const timestamp = Number(message.timestamp);

                return (
                    validRole &&
                    validText &&
                    Number.isFinite(timestamp) &&
                    timestamp >= minimumTimestamp
                );
            })
            .slice(-AI_CONFIG.maxHistoryMessages);
    } catch (error) {
        console.warn(
            "[KANTOONG AI] Tidak dapat membaca riwayat chat:",
            error
        );

        return [];
    }
}

function saveHistory() {
    AIState.history = AIState.history
        .slice(-AI_CONFIG.maxHistoryMessages);

    try {
        localStorage.setItem(
            historyKey(),
            JSON.stringify(AIState.history)
        );
    } catch (error) {
        console.warn(
            "[KANTOONG AI] Riwayat chat tidak dapat disimpan:",
            error
        );
    }

    window.dispatchEvent(new CustomEvent("kantoong:assistant-history", {
        detail: { history: AIState.history }
    }));
}

function addHistoryMessage(who, text, extra = {}) {
    const message = {
        id: (
            typeof crypto !== "undefined" &&
            typeof crypto.randomUUID === "function"
        )
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,

        who,
        text: String(text ?? "").slice(0, MAX_MESSAGE_LENGTH),
        timestamp: getTimestamp(),
        brand: brandName(),
        surface: currentSurface(),
        ...extra
    };

    AIState.history.push(message);

    saveHistory();

    return message;
}

/**
 * Hapus riwayat chat lokal untuk business yang sedang aktif.
 * Fungsi ini tidak menghapus riwayat yang tersimpan di backend.
 */
export function clearAIChatHistory() {
    AIState.history = [];

    try {
        localStorage.removeItem(historyKey());
    } catch (error) {
        console.warn(
            "[KANTOONG AI] Tidak dapat menghapus riwayat lokal:",
            error
        );
    }

    const { chatBox } = getElements();

    if (chatBox) {
        chatBox.replaceChildren();
    }

    renderInitialGreeting();

    emit("chat-history-cleared");
}

/* ---------- Arsip sesi chat (Riwayat Chat AI) ---------- */

const MAX_ARCHIVED_CHATS = 30;
const archiveKey = () => `${historyKey()}:archive`;

/** Sesi lama, urut dari yang terlama. Sesi > historyDays dibuang. */
function readArchive() {
    const minimumTimestamp =
        getTimestamp() - AI_CONFIG.historyDays * 24 * 60 * 60 * 1000;

    try {
        const parsed = JSON.parse(localStorage.getItem(archiveKey()) || "[]");

        return (Array.isArray(parsed) ? parsed : []).filter(entry =>
            entry &&
            Array.isArray(entry.messages) &&
            entry.messages.length > 0 &&
            Number(entry.endedAt) >= minimumTimestamp
        );
    } catch {
        return [];
    }
}

function writeArchive(archive) {
    try {
        localStorage.setItem(
            archiveKey(),
            JSON.stringify(archive.slice(-MAX_ARCHIVED_CHATS))
        );
    } catch (error) {
        console.warn(
            "[KANTOONG AI] Arsip chat tidak dapat disimpan:",
            error
        );
    }
}

/** Percakapan yang layak diarsipkan: user pernah menulis sesuatu. */
const hasUserMessage = messages =>
    messages.some(message => message.who === "user");

/**
 * Memulai chat baru: percakapan sekarang disimpan ke arsip lokal
 * lalu layar chat dikosongkan.
 */
export function startNewChat() {
    if (hasUserMessage(AIState.history)) {
        const archive = readArchive();

        archive.push({
            endedAt: getTimestamp(),
            messages: AIState.history
        });

        writeArchive(archive);
    }

    clearAIChatHistory();

    emit("chat-new");
}

/**
 * Buka lagi sesi lama dari riwayat. Percakapan yang sedang terbuka
 * ikut disimpan ke arsip agar tidak hilang.
 */
export function openArchivedChat(index) {
    const archive = readArchive();
    const picked = archive[index];

    if (!picked) {
        return false;
    }

    archive.splice(index, 1);

    if (hasUserMessage(AIState.history)) {
        archive.push({
            endedAt: getTimestamp(),
            messages: AIState.history
        });
    }

    writeArchive(archive);
    reloadAssistantHistory(picked.messages);

    emit("chat-opened", {
        message_count: picked.messages.length
    });

    return true;
}

/* ============================================================
   06. RENDER PESAN CHAT
   ============================================================ */

function scrollChatToBottom() {
    const { chatBox } = getElements();

    if (!chatBox) {
        return;
    }

    chatBox.scrollTop = chatBox.scrollHeight;
}

function renderMessage(message, options = {}) {
    const { chatBox } = getElements();

    if (!chatBox || !message) {
        return null;
    }

    const wrapper = createElement(
        "div",
        `ai-message ai-message--${message.who}`
    );

    wrapper.dataset.messageId = String(message.id || "");

    const bubble = createElement(
        "div",
        "ai-message__bubble"
    );

    /*
     * Menggunakan textContent agar pesan tidak diperlakukan
     * sebagai HTML. Jangan menggunakan innerHTML untuk
     * memasukkan pesan yang berasal dari pengguna atau API.
     */
    bubble.textContent = String(message.text ?? "");

    wrapper.appendChild(bubble);

    if (message.brand && message.brand !== brandName()) {
        wrapper.appendChild(
            createElement("span", "ai-message__origin", `di ${message.brand}`)
        );
    }

    if (Array.isArray(message.attachments) && message.attachments.length) {
        const list = createElement("div", "ai-message__attachments");

        message.attachments.forEach((file) => {
            // Produk terlampir tampil sebagai kartu kecil berfoto.
            if (file?.type === "product" && file.product) {
                const card = createElement("span", "ai-attachment-product");
                if (isSafeImageURL(file.product.image_url)) {
                    const image = document.createElement("img");
                    image.src = file.product.image_url;
                    image.alt = "";
                    image.loading = "lazy";
                    card.appendChild(image);
                }
                const info = createElement("span", "ai-attachment-product__info");
                info.appendChild(createElement("strong", "", String(file.product.name ?? "Produk")));
                if (file.product.price) {
                    info.appendChild(createElement("small", "", `Rp ${Number(file.product.price).toLocaleString("id-ID")}`));
                }
                card.appendChild(info);
                list.appendChild(card);
                return;
            }

            list.appendChild(
                createElement(
                    "span",
                    "ai-attachment-chip",
                    `\u{1F4CE} ${String(file?.name ?? "lampiran")}`
                )
            );
        });

        wrapper.appendChild(list);
    }

    const timestamp = createElement(
        "time",
        "ai-message__time",
        formatTime(message.timestamp || Date.now())
    );

    wrapper.appendChild(timestamp);

    if (Array.isArray(message.productIds) && message.productIds.length) {
        const products = message.productIds
            .map(findProduct)
            .filter(Boolean)
            .slice(0, AI_CONFIG.maxProductsInReply);

        if (products.length) {
            wrapper.appendChild(renderProductCards(products));
            wrapper.appendChild(createCatalogLink(products));
        }
    }

    chatBox.appendChild(wrapper);

    if (!options.skipScroll) {
        scrollChatToBottom();
    }

    return wrapper;
}

/** Kotak abu-abu berisi huruf pertama bila foto tidak ada. */
function createProductPlaceholder(name) {
    return createElement(
        "span",
        "ai-product-card__ph",
        (String(name ?? "").trim().charAt(0) || "P").toUpperCase()
    );
}

/**
 * Tautan di bawah foto produk: menampilkan produk yang sama pada etalase
 * di belakang chat dan menurunkan kotak chat.
 */
function createCatalogLink(products) {
    const link = createElement(
        "button",
        "ai-catalog-link",
        "Lengkapnya bisa lihat di katalog \u2191"
    );

    link.type = "button";
    link.dataset.aiAction = "show-matched";
    link.dataset.productIds = products
        .map(getProductId)
        .filter(Boolean)
        .join(",");

    return link;
}

function renderProductCards(products) {
    const container = createElement(
        "div",
        "ai-product-list"
    );

    products.forEach(product => {
        const id = getProductId(product);

        if (!id) {
            return;
        }

        const card = createElement(
            "button",
            "ai-product-card"
        );

        card.type = "button";
        card.dataset.productId = id;
        card.setAttribute(
            "aria-label",
            `Tanyakan tentang ${getProductName(product)}`
        );

        const imageURL = getProductImage(product);

        if (imageURL && isSafeImageURL(imageURL)) {
            const image = document.createElement("img");

            image.src = imageURL;
            image.alt = getProductName(product);
            image.loading = "lazy";
            image.referrerPolicy = "no-referrer";

            image.addEventListener("error", () => {
                image.replaceWith(
                    createProductPlaceholder(getProductName(product))
                );
            }, { once: true });

            card.appendChild(image);
        } else {
            card.appendChild(
                createProductPlaceholder(getProductName(product))
            );
        }

        const information = createElement(
            "span",
            "ai-product-card__info"
        );

        information.appendChild(
            createElement(
                "strong",
                "ai-product-card__name",
                getProductName(product)
            )
        );

        const price = getProductPrice(product);

        information.appendChild(
            createElement(
                "span",
                "ai-product-card__price",
                price === null
                    ? "Harga belum tersedia"
                    : formatRupiah(price)
            )
        );

        card.appendChild(information);

        container.appendChild(card);
    });

    return container;
}

function isSafeImageURL(value) {
    try {
        const url = new URL(
            String(value),
            window.location.origin
        );

        return [
            "https:",
            "http:"
        ].includes(url.protocol);
    } catch {
        return false;
    }
}

function renderTypingIndicator() {
    const { chatBox } = getElements();

    if (!chatBox) {
        return null;
    }

    const indicator = createElement(
        "div",
        "ai-message ai-message--ai ai-message--typing"
    );

    indicator.dataset.aiTyping = "true";

    const bubble = createElement(
        "div",
        "ai-message__bubble",
        `${AI_CONFIG.title} sedang berpikir…`
    );

    indicator.appendChild(bubble);
    chatBox.appendChild(indicator);

    scrollChatToBottom();

    return indicator;
}

function removeTypingIndicator(indicator) {
    if (indicator?.parentNode) {
        indicator.remove();
    }

    const { chatBox } = getElements();

    if (chatBox) {
        chatBox
            .querySelectorAll('[data-ai-typing="true"]')
            .forEach(element => element.remove());
    }
}

function renderInitialGreeting() {
    const { chatBox } = getElements();

    if (!chatBox) {
        return;
    }

    chatBox.replaceChildren();

    if (AIState.history.length > 0) {
        AIState.history.forEach(message => {
            renderMessage(message, {
                skipScroll: true
            });
        });

        scrollChatToBottom();
        return;
    }

    const greetings = AI_CONFIG.greetings;

    const baseGreeting = greetings.length
        ? greetings[
            Math.floor(Math.random() * greetings.length)
        ]
        : "Halo! Ada yang bisa aku bantu?";

    const firstName = String(window.KantoongAssistantContext?.userName || "").split(" ")[0];
    const greeting = firstName ? `Hai ${firstName}! ${baseGreeting}` : baseGreeting;

    const message = addHistoryMessage(
        "ai",
        greeting
    );

    renderMessage(message);
}

/* ============================================================
   07. SARAN PERTANYAAN
   ============================================================ */

function shuffleArray(items) {
    const result = [...items];

    for (let index = result.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(
            Math.random() * (index + 1)
        );

        [result[index], result[randomIndex]] = [
            result[randomIndex],
            result[index]
        ];
    }

    return result;
}

const SUGGESTIONS_PER_VISIT = 5;

/**
 * Aturan saran chat:
 * - Tersembunyi secara default (tidak memenuhi layar).
 * - Muncul HANYA saat pengguna memencet ikon robot (saran chat):
 *   maks. 5 saran dalam satu baris yang digeser ke samping, dengan
 *   tombol acak di depannya.
 * - Hilang lagi saat pengguna memilih salah satu saran, mulai mengetik
 *   sendiri, mengirim pesan, atau memencet ikon robot sekali lagi.
 */
function renderSuggestions() {
    const { suggestions } = getElements();

    if (!suggestions) {
        return;
    }

    suggestions.replaceChildren();
    suggestions.hidden = !AIState.suggestionsOpen;

    emit("suggestions-toggled", { open: AIState.suggestionsOpen });

    if (!AIState.suggestionsOpen) {
        return;
    }

    const pool = AI_CONFIG.suggestions
        .map((item) => String(item ?? "").trim())
        .filter(Boolean);

    const picks = shuffleArray(pool).slice(0, SUGGESTIONS_PER_VISIT);

    if (picks.length === 0) {
        suggestions.hidden = true;
        return;
    }

    const shuffle = createElement(
        "button",
        "kc-icon-btn kc-suggestion-shuffle"
    );

    shuffle.type = "button";
    shuffle.setAttribute("aria-label", "Acak saran lain");
    shuffle.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M17 3l4 4-4 4M3 7h18M7 21l-4-4 4-4M21 17H3"/></svg>';

    shuffle.addEventListener("click", () => renderSuggestions());

    suggestions.appendChild(shuffle);

    picks.forEach((text) => {
        const chip = createElement("button", "ai-suggestion", text);

        chip.type = "button";

        chip.addEventListener("click", () => {
            closeSuggestions();
            sendMessage(text);
        });

        suggestions.appendChild(chip);
    });
}

function closeSuggestions() {
    if (!AIState.suggestionsOpen) {
        return;
    }

    AIState.suggestionsOpen = false;
    renderSuggestions();
}

/** Ikon robot (saran chat): buka/tutup saran. */
function handleShowSuggestions() {
    AIState.suggestionsOpen = !AIState.suggestionsOpen;
    renderSuggestions();
}

/** Pengguna mulai mengetik sendiri: saran disembunyikan. */
function handleInputTyping() {
    const { input } = getElements();

    if (input?.value.trim()) {
        closeSuggestions();
    }
}

/* ============================================================
   08. PENCARIAN PRODUK LOKAL
   ============================================================ */

const STOPWORDS = new Set([
    "aku", "saya", "kamu", "anda", "yang", "dan", "atau",
    "di", "ke", "dari", "untuk", "dengan", "ini", "itu",
    "ada", "apa", "bagaimana", "dong", "deh", "ya", "kah",
    "tolong", "coba", "mau", "ingin", "carikan", "cari",
    "produk", "barang", "jual", "menjual", "tampilkan",
    "lihat", "dong", "nih", "aja", "saja", "paling"
]);

function tokenize(value) {
    return normalizeText(value)
        .split(/\s+/)
        .filter(token =>
            token.length > 1 &&
            !STOPWORDS.has(token)
        );
}

function parseBudget(text) {
    const normalized = normalizeText(text);

    const match = normalized.match(
        /(?:di bawah|dibawah|kurang dari|maximal|maksimal|budget|anggaran|hingga|sampai|under)\s*(?:rp\s*)?(\d+(?:[.,]\d+)?)\s*(juta|jt|ribu|rb|k)?/
    );

    if (!match) {
        return null;
    }

    let amount = Number(
        match[1].replace(",", ".")
    );

    if (!Number.isFinite(amount)) {
        return null;
    }

    const unit = match[2] || "";

    if (["juta", "jt"].includes(unit)) {
        amount *= 1_000_000;
    } else if (["ribu", "rb", "k"].includes(unit)) {
        amount *= 1_000;
    }

    return amount;
}

function scoreProduct(product, queryTokens) {
    if (!queryTokens.length) {
        return 0;
    }

    const name = normalizeText(getProductName(product));
    const category = normalizeText(getProductCategory(product));
    const description = normalizeText(getProductDescription(product));
    const fullText = getProductSearchText(product);

    let score = 0;

    for (const token of queryTokens) {
        if (name === token) {
            score += 12;
        } else if (name.includes(token)) {
            score += 6;
        }

        if (category.includes(token)) {
            score += 4;
        }

        if (description.includes(token)) {
            score += 2;
        }

        if (
            fullText.includes(token) &&
            !name.includes(token) &&
            !category.includes(token) &&
            !description.includes(token)
        ) {
            score += 1;
        }
    }

    const nameTokens = tokenize(name);

    if (
        queryTokens.length > 1 &&
        queryTokens.every(token => nameTokens.includes(token))
    ) {
        score += 5;
    }

    return score;
}

function getAvailableProducts() {
    return getProducts().filter(product => {
        if (product.is_active === false) {
            return false;
        }

        if (product.active === false) {
            return false;
        }

        if (product.is_published === false) {
            return false;
        }

        if (product.published === false) {
            return false;
        }

        return Boolean(getProductId(product));
    });
}

function searchLocalProducts(query, options = {}) {
    const products = getAvailableProducts();

    const tokens = tokenize(query);

    const budget = parseBudget(query);

    const ranked = products
        .map(product => ({
            product,
            score: scoreProduct(product, tokens),
            price: getProductPrice(product)
        }))
        .filter(item => item.score > 0);

    if (budget !== null) {
        return ranked
            .filter(item =>
                item.price !== null &&
                item.price <= budget
            )
            .sort((a, b) =>
                b.score - a.score ||
                a.price - b.price
            )
            .slice(0, options.limit || AI_CONFIG.maxProductsInReply)
            .map(item => item.product);
    }

    return ranked
        .sort((a, b) =>
            b.score - a.score ||
            ((a.price ?? Infinity) - (b.price ?? Infinity))
        )
        .slice(0, options.limit || AI_CONFIG.maxProductsInReply)
        .map(item => item.product);
}

function getCheapestProducts(limit = AI_CONFIG.maxProductsInReply) {
    return getAvailableProducts()
        .filter(product => getProductPrice(product) !== null)
        .sort((a, b) =>
            getProductPrice(a) - getProductPrice(b)
        )
        .slice(0, limit);
}

function getPopularProducts(limit = AI_CONFIG.maxProductsInReply) {
    const products = getAvailableProducts();

    const featuredIds = new Set(
        Array.isArray(getEngineState()?.featured)
            ? getEngineState().featured
                .map(item => typeof item === "object"
                    ? getProductId(item)
                    : String(item))
                .filter(Boolean)
            : []
    );

    return products
        .map(product => {
            const score =
                Number(product.sales_count ?? product.salesCount ?? 0) +
                Number(product.order_count ?? product.orderCount ?? 0) +
                (product.is_featured || product.featured ? 1000 : 0) +
                (featuredIds.has(getProductId(product)) ? 1000 : 0);

            return {
                product,
                score
            };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.product);
}

function detectIntent(text) {
    const query = normalizeText(text);

    if (
        /\b(termurah|paling murah|harga terendah|murah sekali)\b/.test(query)
    ) {
        return "cheapest";
    }

    if (
        /\b(populer|terlaris|best seller|bestseller|produk unggulan)\b/.test(query)
    ) {
        return "popular";
    }

    if (
        /\b(katalog|semua produk|lihat produk|daftar produk)\b/.test(query)
    ) {
        return "catalog";
    }

    if (
        /\b(halo|hai|hello|selamat pagi|selamat siang|selamat malam)\b/.test(query)
    ) {
        return "greeting";
    }

    return "search";
}

/* ============================================================
   09. RESPONS AI LOKAL
   ============================================================ */

function buildLocalReply(text) {
    const intent = detectIntent(text);

    if (intent === "greeting") {
        return {
            reply: "Halo! Aku siap membantu. Kamu ingin mencari produk, melihat rekomendasi, atau mengecek produk berdasarkan anggaran?",
            products: []
        };
    }

    if (intent === "catalog") {
        return {
            reply: "Tentu! Aku akan membantumu melihat katalog produk yang tersedia.",
            products: [],
            action: "show-catalog"
        };
    }

    if (intent === "cheapest") {
        const products = getCheapestProducts();

        return {
            reply: products.length
                ? "Berikut beberapa produk dengan harga paling rendah yang tersedia saat ini."
                : "Aku belum menemukan produk dengan harga yang bisa ditampilkan. Coba periksa data harga produk terlebih dahulu.",
            products
        };
    }

    if (intent === "popular") {
        const products = getPopularProducts();

        return {
            reply: products.length
                ? "Berikut produk unggulan atau populer berdasarkan data yang tersedia di katalog."
                : "Aku belum menemukan produk untuk ditampilkan. Pastikan katalog sudah berhasil dimuat.",
            products
        };
    }

    const budget = parseBudget(text);
    const products = searchLocalProducts(text);

    if (products.length) {
        const reply = budget !== null
            ? `Aku menemukan ${products.length} produk yang sesuai dengan pencarianmu dan anggaran hingga ${formatRupiah(budget)}.`
            : `Aku menemukan ${products.length} produk yang paling relevan dengan pencarianmu.`;

        return {
            reply,
            products
        };
    }

    if (getAvailableProducts().length === 0) {
        return {
            reply: "Katalog produk belum tersedia atau masih dimuat. Coba lagi setelah data produk berhasil dimuat.",
            products: []
        };
    }

    return {
        reply: "Aku belum menemukan produk yang cocok dengan kata kunci itu. Coba sebutkan nama produk, kategori, atau anggaran yang kamu inginkan.",
        products: []
    };
}

/* ============================================================
   10. INTEGRASI API AI BACKEND
   ============================================================ */

/**
 * Kontrak request yang digunakan frontend:
 *
 * POST CFG.ai_endpoint
 * Content-Type: application/json
 *
 * {
 *   "business_id": "...",
 *   "message": "...",
 *   "history": [
 *     { "role": "user", "content": "..." },
 *     { "role": "assistant", "content": "..." }
 *   ],
 *   "context": {
 *     "products": [
 *       { "id": "...", "name": "...", "price": 10000 }
 *     ]
 *   }
 * }
 *
 * Backend harus mengautentikasi pengguna dan memvalidasi
 * business_id. Jangan percaya business_id dari browser saja.
 */

function buildAPIHistory() {
    return AIState.history
        .filter(message =>
            message.who === "user" ||
            message.who === "ai"
        )
        .slice(-AI_CONFIG.maxContextMessages)
        .map(message => ({
            role: message.who === "ai"
                ? "assistant"
                : "user",

            // Pesan dari brand lain diberi tanda agar AI menyebut sumbernya dengan jujur.
            content: message.brand && message.brand !== brandName()
                ? `[di ${message.brand}] ${message.text}`
                : message.text
        }));
}

function buildProductContext() {
    /*
     * Hanya mengirim data ringkas untuk konteks.
     * Data sensitif bisnis tidak boleh dimasukkan di sini.
     */
    return getAvailableProducts()
        .slice(0, 30)
        .map(product => ({
            id: getProductId(product),
            name: getProductName(product),
            category: getProductCategory(product),
            price: getProductPrice(product),
            description: getProductDescription(product).slice(0, 250)
        }));
}

async function requestRemoteAI(message, requestId) {
    if (!AI_CONFIG.endpoint) {
        return null;
    }

    const controller = new AbortController();

    AIState.requestController = controller;

    const timeoutId = setTimeout(
        () => controller.abort(),
        AI_CONFIG.requestTimeoutMs
    );

    try {
        const response = await fetch(AI_CONFIG.endpoint, {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },

            credentials: "same-origin",

            signal: controller.signal,

            body: JSON.stringify({
                business_id: AI_CONFIG.businessId,
                message,
                history: buildAPIHistory(),

                context: {
                    products: buildProductContext(),
                    assistant: assistantContext()
                }
            })
        });

        if (requestId !== AIState.requestSequence) {
            return null;
        }

        if (!response.ok) {
            throw new Error(
                `AI backend mengembalikan HTTP ${response.status}`
            );
        }

        const data = await response.json();

        if (!data || typeof data !== "object") {
            throw new Error("Respons AI backend tidak valid.");
        }

        /*
         * Mendukung beberapa bentuk respons backend:
         * { reply: "..." }
         * { answer: "..." }
         * { message: "..." }
         *
         * Backend disarankan menggunakan { reply, product_ids }.
         */
        const reply = safeText(
            data.reply ??
            data.answer ??
            data.message,
            ""
        );

        if (!reply) {
            throw new Error("AI backend tidak mengirim teks jawaban.");
        }

        const productIds = Array.isArray(data.product_ids)
            ? data.product_ids
            : Array.isArray(data.productIds)
                ? data.productIds
                : [];

        const products = productIds
            .map(findProduct)
            .filter(Boolean)
            .slice(0, AI_CONFIG.maxProductsInReply);

        return {
            reply,
            products,
            action: typeof data.action === "string"
                ? data.action
                : null
        };
    } finally {
        clearTimeout(timeoutId);

        if (AIState.requestController === controller) {
            AIState.requestController = null;
        }
    }
}

/* ============================================================
   11. PEMROSESAN PESAN
   ============================================================ */

function setBusy(busy) {
    AIState.busy = Boolean(busy);

    const { sendButton, input } = getElements();

    if (sendButton) {
        sendButton.disabled = AIState.busy;
        sendButton.setAttribute(
            "aria-busy",
            String(AIState.busy)
        );
    }

    if (input) {
        input.setAttribute(
            "aria-busy",
            String(AIState.busy)
        );
    }
}

function normalizeAIResult(result) {
    if (!result || typeof result !== "object") {
        return {
            reply: "Maaf, aku belum bisa memproses permintaan itu.",
            products: [],
            action: null
        };
    }

    return {
        reply: safeText(
            result.reply,
            "Maaf, aku belum mendapatkan jawaban yang sesuai."
        ),

        products: Array.isArray(result.products)
            ? result.products
                .filter(Boolean)
                .slice(0, AI_CONFIG.maxProductsInReply)
            : [],

        action: result.action || null
    };
}

function publishMatchedProducts(products, query) {
    const safeProducts = Array.isArray(products)
        ? products
        : [];

    /*
     * Mengikuti kontrak event engine:
     * kantoong:matched -> { query, products, count }
     */
    emit("matched", {
        query: String(query || ""),
        products: safeProducts,
        count: safeProducts.length,
        ids: safeProducts
            .map(getProductId)
            .filter(Boolean)
    });

    /*
     * Kabar untuk etalase: produk pilihan AI muncul otomatis di
     * bagian "Pilihan AI untuk kamu" di belakang kotak chat.
     */
    emit("ai-matched", {
        query: String(query || ""),
        products: safeProducts,
        count: safeProducts.length,
        ids: safeProducts
            .map(getProductId)
            .filter(Boolean)
    });
}

function performResultAction(action, result) {
    if (!action) {
        return;
    }

    switch (action) {
        case "show-catalog":
            emit("collapse", {
                reason: "ai-show-catalog"
            });

            emit("show-catalog", {
                source: "ai-brain"
            });
            break;

        case "show-products":
            publishMatchedProducts(
                result.products,
                "ai-recommendation"
            );
            break;

        default:
            /*
             * Action dari backend tidak dieksekusi secara bebas.
             * Hanya action yang masuk daftar allowlist di atas
             * yang boleh memicu event frontend.
             */
            break;
    }
}

export async function sendMessage(rawText) {
    const text = String(rawText ?? "").trim();

    // Lampiran dari kotak ketik (foto, dokumen, video).
    const pendingAttachments =
        window.KantoongChat?.peekAttachments?.() ?? [];

    if ((!text && pendingAttachments.length === 0) || AIState.busy) {
        return;
    }

    const attachments =
        window.KantoongChat?.takeAttachments?.() ?? [];

    const products = attachments.filter((entry) => entry.type === "product");
    const files = attachments.filter((entry) => entry.type !== "product");

    // Yang tampil di gelembung: tulisan pembeli apa adanya.
    const message = (text || (products.length ? "Aku tertarik dengan produk ini." : "(lampiran)"))
        .slice(0, MAX_MESSAGE_LENGTH);

    // Yang dibaca AI: tulisan pembeli + produk yang dilampirkan sebagai konteks.
    const promptForAI = products.length
        ? `${message}\n\n[Produk yang dilampirkan pembeli: ${products
            .map((entry) => `${entry.product.name} (Rp ${Number(entry.product.price || 0).toLocaleString("id-ID")})`)
            .join("; ")}]`.slice(0, MAX_MESSAGE_LENGTH + 400)
        : message;

    const { input } = getElements();

    if (input) {
        input.value = "";

        // Beri tahu kotak ketik agar tingginya dikembalikan.
        input.dispatchEvent(new Event("input", { bubbles: true }));
    }


    const userMessage = addHistoryMessage(
        "user",
        message,
        attachments.length ? { attachments } : {}
    );

    renderMessage(userMessage);

    closeSuggestions();

    const typingIndicator = renderTypingIndicator();

    setBusy(true);

    const requestId = ++AIState.requestSequence;

    try {
        let result = null;

        /*
         * Gunakan AI backend bila endpoint tersedia.
         * Jika gagal dan fallback diizinkan, gunakan pencarian lokal.
         */
        if (AI_CONFIG.endpoint) {
            try {
                result = await requestRemoteAI(
                    promptForAI,
                    requestId
                );
            } catch (error) {
                if (requestId !== AIState.requestSequence) {
                    return;
                }

                console.error(
                    "[KANTOONG AI] Permintaan ke backend gagal:",
                    error
                );

                if (!AI_CONFIG.allowLocalFallback) {
                    throw error;
                }
            }
        }

        if (requestId !== AIState.requestSequence) {
            return;
        }

        if (!result) {
            result = buildLocalReply(products.length ? `${message} ${products.map((entry) => entry.product.name).join(" ")}` : message);
        }

        result = normalizeAIResult(result);

        if (files.length) {
            result.reply +=
                `\n\nLampiranmu (${files.length}) sudah kuterima. ` +
                "Pembacaan lampiran oleh AI belum aktif di versi ini.";
        }

        const productIds = result.products
            .map(getProductId)
            .filter(Boolean);

        const aiMessage = addHistoryMessage(
            "ai",
            result.reply,
            {
                productIds
            }
        );

        removeTypingIndicator(typingIndicator);

        renderMessage(aiMessage);

        if (result.products.length) {
            publishMatchedProducts(
                result.products,
                message
            );
        }

        performResultAction(result.action, result);

        emit("ai-response", {
            text: result.reply,
            product_ids: productIds,
            action: result.action
        });
    } catch (error) {
        removeTypingIndicator(typingIndicator);

        console.error(
            "[KANTOONG AI] Gagal memproses pesan:",
            error
        );

        const fallbackMessage =
            "Maaf, terjadi kendala saat memproses pesanmu. Silakan coba lagi sebentar.";

        const errorMessage = addHistoryMessage(
            "ai",
            fallbackMessage
        );

        renderMessage(errorMessage);

        emit("ai-error", {
            message: "Gagal memproses pesan."
        });
    } finally {
        if (requestId === AIState.requestSequence) {
            setBusy(false);

            const elements = getElements();

            if (elements.input) {
                elements.input.focus();
            }
        }
    }
}

/* ============================================================
   12. EVENT HANDLERS
   ============================================================ */

function handleSendButtonClick() {
    const { input } = getElements();

    if (input) {
        sendMessage(input.value);
    }
}

function handleInputKeydown(event) {
    if (event.key !== "Enter") {
        return;
    }

    if (event.shiftKey || event.isComposing) {
        return;
    }

    event.preventDefault();

    const { input } = getElements();

    if (input) {
        sendMessage(input.value);
    }
}

function handleProductCardClick(event) {
    const catalogLink = event.target.closest(
        "[data-ai-action='show-matched']"
    );

    if (catalogLink) {
        const ids = String(catalogLink.dataset.productIds || "")
            .split(",")
            .filter(Boolean);

        // Etalase menampilkan produk pilihan AI, lalu chat diturunkan.
        emit("ai-matched", {
            query: "",
            ids,
            count: ids.length,
            products: ids.map(findProduct).filter(Boolean)
        });

        emit("collapse");

        return;
    }

    const button = event.target.closest(
        "[data-product-id]"
    );

    if (!button) {
        return;
    }

    const product = findProduct(
        button.dataset.productId
    );

    if (!product) {
        return;
    }

    // Ketuk kartu = buka pop-up produk (sama seperti di etalase), TIDAK
    // mengirim pesan otomatis. Tanya AI = tarik kartu ke atas
    // (chat-product-gestures.js). Di luar toko, kantoong-assistant.js
    // membuka produk di tab toko.
    window.KantoongEngine?.openQuickView?.(getProductId(product));
}

function handleConsultEvent(event) {
    const detail = event?.detail || {};

    const text = safeText(
        detail.text ??
        detail.message ??
        detail.query,
        ""
    );

    if (text) {
        sendMessage(text);
    }
}

function handleProductsReady() {
    /*
     * Riwayat chat bisa tampil sebelum data produk selesai dimuat,
     * sehingga foto produk di pesan lama belum muncul. Setelah produk
     * siap, tampilkan ulang riwayat agar fotonya ikut muncul.
     */
    const needsPhotos = AIState.history.some(
        (message) => Array.isArray(message.productIds) && message.productIds.length
    );

    if (needsPhotos && !AIState.busy) {
        renderInitialGreeting();
    }
}

/* ============================================================
   13. INISIALISASI
   ============================================================ */

export function initAIBrain() {
    if (AIState.initialized) {
        return;
    }

    const elements = getElements();

    /*
     * Jika elemen chat belum ada, modul tetap aman untuk diimpor.
     * Panggil initAIBrain() kembali setelah panel dibuat.
     */
    if (!elements.chatBox) {
        console.info(
            "[KANTOONG AI] Elemen chat belum tersedia. Inisialisasi ditunda."
        );

        return;
    }

    AIState.initialized = true;
    AIState.boundElements = elements;
    AIState.history = readHistory();

    if (elements.sendButton) {
        elements.sendButton.addEventListener(
            "click",
            handleSendButtonClick
        );
    }

    if (elements.input) {
        elements.input.addEventListener(
            "keydown",
            handleInputKeydown
        );

        elements.input.addEventListener(
            "input",
            handleInputTyping
        );
    }

    elements.chatBox.addEventListener(
        "click",
        handleProductCardClick
    );

    /*
     * Event ini kompatibel dengan panel yang mengirim:
     * window.dispatchEvent(
     *   new CustomEvent("kantoong:consult", {
     *     detail: { text: "..." }
     *   })
     * )
     */
    window.addEventListener(
        "kantoong:consult",
        handleConsultEvent
    );

    document.addEventListener(
        "kantoong:consult",
        handleConsultEvent
    );

    window.addEventListener(
        "kantoong:products-ready",
        handleProductsReady
    );

    window.addEventListener(
        "supabase-data-ready",
        handleProductsReady
    );

    // engine.js mengirim nama event dengan awalan "kantoong:".
    window.addEventListener(
        "kantoong:supabase-data-ready",
        handleProductsReady
    );

    document.addEventListener(
        "supabase-data-ready",
        handleProductsReady
    );

    window.addEventListener(
        "kantoong:show-suggestions",
        handleShowSuggestions
    );

    renderInitialGreeting();
    renderSuggestions();

    emit("ai-ready", {
        title: AI_CONFIG.title,
        endpointConfigured: Boolean(AI_CONFIG.endpoint)
    });

    console.info(
        "[KANTOONG AI] AI Brain berhasil diinisialisasi."
    );
}

/* ============================================================
   14. PEMBERSIHAN EVENT
   ============================================================ */

export function destroyAIBrain() {
    if (!AIState.initialized) {
        return;
    }


    const elements = AIState.boundElements;

    if (elements?.sendButton) {
        elements.sendButton.removeEventListener(
            "click",
            handleSendButtonClick
        );
    }

    if (elements?.input) {
        elements.input.removeEventListener(
            "keydown",
            handleInputKeydown
        );

        elements.input.removeEventListener(
            "input",
            handleInputTyping
        );
    }

    if (elements?.chatBox) {
        elements.chatBox.removeEventListener(
            "click",
            handleProductCardClick
        );
    }

    window.removeEventListener(
        "kantoong:consult",
        handleConsultEvent
    );

    window.removeEventListener(
        "kantoong:show-suggestions",
        handleShowSuggestions
    );

    window.removeEventListener(
        "kantoong:supabase-data-ready",
        handleProductsReady
    );

    document.removeEventListener(
        "kantoong:consult",
        handleConsultEvent
    );

    window.removeEventListener(
        "kantoong:products-ready",
        handleProductsReady
    );

    window.removeEventListener(
        "supabase-data-ready",
        handleProductsReady
    );

    document.removeEventListener(
        "supabase-data-ready",
        handleProductsReady
    );

    if (AIState.requestController) {
        AIState.requestController.abort();
        AIState.requestController = null;
    }

    AIState.requestSequence += 1;
    AIState.initialized = false;
    AIState.busy = false;
    AIState.boundElements = null;

    console.info(
        "[KANTOONG AI] Event listener AI Brain telah dibersihkan."
    );
}

/* ============================================================
   15. KOMPATIBILITAS GLOBAL
   ============================================================ */

/*
 * Mempertahankan akses fungsi dari modul lain yang sebelumnya
 * mungkin memanggil window.addMessageToChat(...).
 */

export function addMessageToChat(who, text, extra = {}) {
    const message = addHistoryMessage(
        who === "user" ? "user" : "ai",
        text,
        extra
    );

    renderMessage(message);

    return message;
}

/**
 * Muat ulang riwayat dari penyimpanan (dipakai saat izin memori berubah
 * atau saat riwayat dari server digabungkan). messages opsional: bila
 * diisi, ditulis dulu ke penyimpanan.
 */
export function reloadAssistantHistory(messages = null) {
    if (Array.isArray(messages)) {
        try {
            localStorage.setItem(historyKey(), JSON.stringify(messages.slice(-AI_CONFIG.maxHistoryMessages)));
        } catch {
            // abaikan
        }
    }

    AIState.history = readHistory();
    renderInitialGreeting();
}

window.KantoongAIBrain = Object.freeze({
    init: initAIBrain,
    reload: reloadAssistantHistory,
    getHistory: () => AIState.history.slice(),
    destroy: destroyAIBrain,
    sendMessage,
    addMessageToChat,
    clearHistory: clearAIChatHistory,
    newChat: startNewChat,
    getArchive: () => readArchive().map(entry => ({ ...entry, messages: entry.messages.slice() })),
    openArchived: openArchivedChat,

    /** Nama & foto produk untuk pratinjau riwayat (null bila sudah tidak ada). */
    describeProduct(productId) {
        const product = findProduct(productId);

        return product
            ? { name: getProductName(product), image: getProductImage(product) }
            : null;
    },

    searchProducts: searchLocalProducts,

    getProducts,
    findProduct,

    getConfig() {
        return {
            businessId: AI_CONFIG.businessId,
            endpointConfigured: Boolean(AI_CONFIG.endpoint),
            historyDays: AI_CONFIG.historyDays
        };
    }
});

/*
 * Inisialisasi otomatis ketika DOM siap.
 * Aman dipakai bersama script type="module".
 */
if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initAIBrain,
        { once: true }
    );
} else {
    initAIBrain();
}