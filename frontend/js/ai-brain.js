
 // ============================================================
 // KANTOONG AI
 // File: js/ai-brain.js
 // AI Conversation, Product Matching & Chat History
 //
 // Tanggung jawab:
 // 1. Menampilkan percakapan AI.
 // 2. Menyimpan riwayat percakapan.
 // 3. Menampilkan saran chat harian.
 // 4. Mencocokkan kebutuhan user dengan katalog produk.
 // 5. Menggunakan AI server jika tersedia.
 // 6. Mengirim hasil pencocokan ke engine.js.
 //
 // Integrasi:
 //   engine.js  -> KantoongState
 //   panel.js   -> kantoong:consult / kantoong:collapse
 //   engine.js  <- kantoong:matched { ids: [] }
 //
 // Konfigurasi opsional di client-config.js:
 //   business_id
 //   history_days
 //   ai_title
 //   ai_greetings
 //   ai_suggestions
 //   ai_endpoint
 //
 // Catatan:
 // Modul ini tidak mengambil alih pengaturan gestur panel
 // dan tidak menggantikan fungsi engine.js.
 // ============================================================

import { KantoongState as S } from './engine.js';

// ------------------------------------------------------------
// 1. KONFIGURASI DAN ELEMEN DOM
// ------------------------------------------------------------

const CFG =
    typeof KantoongConfig !== 'undefined'
        ? KantoongConfig
        : {};

const chatBox = document.getElementById('chatBox');
const suggestBox = document.getElementById('chatSuggestions');
const sendBtn = document.getElementById('tombolKirim');
const input = document.getElementById('kolomKetik');

const BUSINESS_ID = String(CFG.business_id || 'default');

const HISTORY_KEY = `kantoong:chat:${BUSINESS_ID}`;
const USED_KEY = `kantoong:chat-used:${BUSINESS_ID}`;

const HISTORY_DAYS = Math.max(
    1,
    Number(CFG.history_days) || 30
);

const HISTORY_MS = HISTORY_DAYS * 24 * 60 * 60 * 1000;
const MAX_SAVED_MESSAGES = 60;
const MAX_CONTEXT_MESSAGES = 12;
const MAX_PRODUCTS_IN_CHAT = 4;

// ------------------------------------------------------------
// 2. HELPER UMUM
// ------------------------------------------------------------

const emit = (name, detail = {}) => {
    window.dispatchEvent(
        new CustomEvent(name, { detail })
    );
};

const sleep = (ms) =>
    new Promise(resolve => setTimeout(resolve, ms));

const hhmm = (date) =>
    `${String(date.getHours()).padStart(2, '0')}:` +
    `${String(date.getMinutes()).padStart(2, '0')}`;

const rupiah = (value) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(Number(value) || 0);

const getProducts = () =>
    Array.isArray(S.products) ? S.products : [];

const findProduct = (id) =>
    getProducts().find(
        product => String(product.id) === String(id)
    );

const getPrice = (product) =>
    Number(product?.price) || 0;

function el(tag, className = '', text = null) {
    const node = document.createElement(tag);

    if (className) {
        node.className = className;
    }

    if (text !== null && text !== undefined) {
        node.textContent = String(text);
    }

    return node;
}

function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

function normalize(text) {
    return String(text ?? '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/(\d)\.(?=\d{3}\b)/g, '$1')
        .replace(/(\d),(\d)/g, '$1.$2')
        .trim();
}

function getDayKey(date = new Date()) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
}

// ------------------------------------------------------------
// 3. PENYIMPANAN RIWAYAT CHAT
// ------------------------------------------------------------

const history = {
    read() {
        try {
            const raw = JSON.parse(
                localStorage.getItem(HISTORY_KEY) || '[]'
            );

            if (!Array.isArray(raw)) {
                return [];
            }

            const now = Date.now();

            return raw.filter(message => {
                if (!message || typeof message !== 'object') {
                    return false;
                }

                if (!Number.isFinite(Number(message.t))) {
                    return false;
                }

                if (now - Number(message.t) > HISTORY_MS) {
                    return false;
                }

                if (!['user', 'ai'].includes(message.who)) {
                    return false;
                }

                return typeof message.text === 'string';
            }).slice(-MAX_SAVED_MESSAGES);
        } catch {
            return [];
        }
    },

    write(messages) {
        try {
            localStorage.setItem(
                HISTORY_KEY,
                JSON.stringify(
                    messages.slice(-MAX_SAVED_MESSAGES)
                )
            );
        } catch (error) {
            console.warn(
                '[Kantoong AI] Riwayat tidak dapat disimpan:',
                error
            );
        }
    }
};

let saved = history.read();

// Format konteks untuk AI server: { role, text }
const convo = [];

function rebuildConversationContext(messages) {
    convo.length = 0;

    messages.slice(-MAX_CONTEXT_MESSAGES).forEach(message => {
        convo.push({
            role: message.who === 'user' ? 'user' : 'assistant',
            text: message.text
        });
    });
}

function persistMessage(message) {
    saved.push(message);

    // Buang pesan yang sudah melewati batas retensi.
    const now = Date.now();

    saved = saved.filter(item =>
        Number.isFinite(Number(item.t)) &&
        now - Number(item.t) <= HISTORY_MS
    );

    saved = saved.slice(-MAX_SAVED_MESSAGES);

    history.write(saved);
}

// ------------------------------------------------------------
// 4. RENDER PESAN CHAT
// ------------------------------------------------------------

export function addMessageToChat(
    text,
    sender = 'ai',
    options = {}
) {
    if (!chatBox) return;

    const ids = safeArray(options.ids);
    const persist = options.persist !== false;
    const now = new Date();

    const wrapper = el(
        'div',
        `message-wrapper ${sender === 'user' ? 'user' : 'ai'}`
    );

    const bubble = el('div', 'bubble');

    bubble.append(
        el('span', 'bubble-text', text)
    );

    // Kartu produk yang cocok dengan pesan AI.
    const products = ids
        .map(findProduct)
        .filter(Boolean)
        .slice(0, MAX_PRODUCTS_IN_CHAT);

    if (products.length) {
        const row = el('div', 'chat-products');

        products.forEach(product => {
            const item = el('button', 'chat-product');

            item.type = 'button';
            item.dataset.id = String(product.id);
            item.setAttribute(
                'aria-label',
                `Tanyakan tentang ${product.name || 'produk'}`
            );

            const thumb = el('div', 'chat-product-thumb');

            if (product.image_url) {
                const img = el('img');

                img.src = product.image_url;
                img.alt = product.name || 'Foto produk';
                img.loading = 'lazy';

                thumb.append(img);
            } else {
                thumb.textContent =
                    String(product.name || '?')
                        .trim()
                        .charAt(0)
                        .toUpperCase();
            }

            item.append(
                thumb,
                el('div', 'chat-product-name', product.name || 'Produk')
            );

            row.append(item);
        });

        const catalogLink = el(
            'button',
            'chat-catalog-link',
            'Lihat produk di katalog ↑'
        );

        catalogLink.type = 'button';

        bubble.append(row, catalogLink);
    }

    bubble.append(
        el('span', 'time-stamp', hhmm(now))
    );

    wrapper.append(
        el('div', 'avatar', sender === 'user' ? 'ANDA' : 'AI'),
        bubble
    );

    chatBox.append(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;

    if (persist) {
        persistMessage({
            t: now.getTime(),
            who: sender === 'user' ? 'user' : 'ai',
            text: String(text),
            ids
        });
    }
}

function showTyping() {
    if (!chatBox) return null;

    const wrapper = el('div', 'message-wrapper ai');
    const bubble = el('div', 'bubble is-typing');

    bubble.append(
        el('span', 'typing-dot'),
        el('span', 'typing-dot'),
        el('span', 'typing-dot')
    );

    wrapper.append(
        el('div', 'avatar', 'AI'),
        bubble
    );

    chatBox.append(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;

    return wrapper;
}

// ------------------------------------------------------------
// 5. SARAN CHAT HARIAN
// ------------------------------------------------------------

let todayKey = getDayKey();
let usedToday = false;
let todaysChips = [];

try {
    usedToday = localStorage.getItem(USED_KEY) === todayKey;
} catch {
    usedToday = false;
}

function markSuggestionsUsed() {
    usedToday = true;

    try {
        localStorage.setItem(USED_KEY, todayKey);
    } catch {
        // Status tetap berlaku selama halaman masih aktif.
    }

    setSuggestions([]);
}

function pickSuggestions() {
    const pool = safeArray(CFG.ai_suggestions)
        .filter(value => typeof value === 'string' && value.trim())
        .map(value => value.trim());

    // Fisher-Yates shuffle.
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    return pool.slice(0, 3);
}

function setSuggestions(list = []) {
    if (!suggestBox) return;

    const chips = safeArray(list)
        .filter(value => typeof value === 'string' && value.trim())
        .slice(0, 3)
        .map(text => {
            const chip = el('button', 'suggestion-chip', text);

            chip.type = 'button';
            return chip;
        });

    suggestBox.replaceChildren(...chips);
}

function renderToday() {
    if (!chatBox) return;

    chatBox.replaceChildren();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todaysMessages = saved.filter(
        message => Number(message.t) >= startOfDay.getTime()
    );

    rebuildConversationContext(todaysMessages);

    if (todaysMessages.length) {
        todaysMessages.forEach(message => {
            addMessageToChat(
                message.text,
                message.who,
                {
                    ids: safeArray(message.ids),
                    persist: false
                }
            );
        });

        if (todaysMessages.some(message => message.who === 'user')) {
            usedToday = true;

            try {
                localStorage.setItem(USED_KEY, todayKey);
            } catch {
                // Tetap gunakan status di memori.
            }
        }
    } else {
        const greetings = safeArray(CFG.ai_greetings)
            .filter(value => typeof value === 'string' && value.trim());

        const greeting = greetings.length
            ? greetings[Math.floor(Math.random() * greetings.length)]
            : 'Ada yang bisa aku bantu cari?';

        const title = CFG.ai_title || 'Halo Kak!';

        addMessageToChat(
            `${title} ${greeting}`,
            'ai',
            { persist: false }
        );
    }

    todaysChips = pickSuggestions();

    setSuggestions(
        usedToday ? [] : todaysChips
    );
}

let busy = false;

function onNewDay() {
    const nextDay = getDayKey();

    if (nextDay === todayKey) return;

    todayKey = nextDay;
    usedToday = false;
    convo.length = 0;
    todaysChips = pickSuggestions();

    try {
        localStorage.removeItem(USED_KEY);
    } catch {
        // Tidak mengganggu sesi aktif.
    }

    if (!busy) {
        renderToday();
    } else {
        setSuggestions([]);
    }
}

let midnightTimer = null;

function scheduleMidnight() {
    if (midnightTimer !== null) {
        clearTimeout(midnightTimer);
    }

    const now = new Date();

    const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0, 0, 1
    );

    midnightTimer = setTimeout(() => {
        onNewDay();
        scheduleMidnight();
    }, Math.max(1000, nextMidnight.getTime() - now.getTime()));
}

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && getDayKey() !== todayKey) {
        onNewDay();
    }
);

// ------------------------------------------------------------
// 6. PENCARIAN PRODUK LOKAL
// ------------------------------------------------------------

const STOP_WORDS = new Set([
    'yang', 'dan', 'untuk', 'dengan', 'saya', 'aku',
    'mau', 'ingin', 'cari', 'carikan', 'tolong', 'bantu',
    'dong', 'kak', 'nya', 'ada', 'apa', 'buat', 'sesuai',
    'kebutuhan', 'produk', 'rekomendasi', 'pilihkan', 'pilih',
    'bawah', 'atas', 'budget', 'harga', 'maksimal', 'minimal',
    'sekitar', 'sampai', 'juta', 'ribu', 'bisa', 'lebih',
    'paling', 'tentang', 'ceritakan', 'jelaskan', 'halo',
    'hai', 'hello', 'selamat', 'pagi', 'siang', 'sore',
    'malam', 'kamu', 'anda', 'dong', 'nih', 'itu', 'ini'
]);

function tokenize(text) {
    return normalize(text)
        .split(/[^a-z0-9]+/)
        .filter(word =>
            word.length > 2 &&
            !STOP_WORDS.has(word) &&
            !/^\d+$/.test(word)
        );
}

// Memahami contoh:
// "500 ribu", "2jt", "1.500.000", "maksimal 750rb".
function parseBudget(text) {
    const normalized = normalize(text);

    const matches = [
        ...normalized.matchAll(
            /(\d+(?:\.\d+)?)\s*(juta|jt|miliar|m|ribu|rb|k)?\b/g
        )
    ];

    for (const match of matches) {
        let amount = Number(match[1]);

        if (!Number.isFinite(amount)) continue;

        const unit = match[2] || '';

        if (['juta', 'jt', 'miliar', 'm'].includes(unit)) {
            amount *= unit === 'miliar' || unit === 'm'
                ? 1_000_000_000
                : 1_000_000;
        } else if (['ribu', 'rb', 'k'].includes(unit)) {
            amount *= 1000;
        } else if (amount < 1000) {
            // Hindari menganggap angka kecil sebagai harga.
            continue;
        }

        const minimumIntent =
            /\b(di atas|lebih dari|minimal|paling sedikit|setidaknya)\b/
                .test(normalized);

        const maximumIntent =
            /\b(di bawah|kurang dari|maksimal|paling banyak|hingga|sampai)\b/
                .test(normalized);

        const mode =
            minimumIntent && !maximumIntent
                ? 'min'
                : 'max';

        return { value: amount, mode };
    }

    return null;
}

function productSearchText(product) {
    return normalize([
        product.name,
        product.category,
        product.caption,
        product.description
    ].filter(Boolean).join(' '));
}

function scoreProduct(product, words) {
    const name = normalize(product.name);
    const category = normalize(product.category);
    const description = normalize(
        `${product.caption || ''} ${product.description || ''}`
    );

    return words.reduce((score, word) => {
        return score +
            (name.includes(word) ? 3 : 0) +
            (category.includes(word) ? 2 : 0) +
            (description.includes(word) ? 1 : 0);
    }, 0);
}

const bySales = (a, b) =>
    (Number(b.sales_count) || 0) -
    (Number(a.sales_count) || 0);

const memory = {
    lastCategory: ''
};

function makeReply(text, products = []) {
    const validProducts = safeArray(products).filter(Boolean);

    if (validProducts[0]?.category) {
        memory.lastCategory = validProducts[0].category;
    }

    return {
        text,
        ids: validProducts.map(product => product.id)
    };
}

function generateLocalReply(userText) {
    const text = normalize(userText);
    const products = getProducts();

    if (S.isLoading) {
        return makeReply(
            'Sebentar ya Kak, katalog sedang dimuat. Coba kirim lagi beberapa detik lagi.'
        );
    }

    if (!products.length) {
        return makeReply(
            'Katalog toko belum tersedia. Coba lagi setelah produk toko dimuat.'
        );
    }

    if (/(terima kasih|makasih|thanks|thank you)/.test(text)) {
        return makeReply(
            'Sama-sama Kak! Kalau masih bingung memilih, tanya saja lagi ya.'
        );
    }

    if (
        /^(hai|halo|hi|hello|selamat|pagi|siang|sore|malam)\b/.test(text) &&
        tokenize(text).length === 0
    ) {
        return makeReply(
            'Halo Kak! Ceritakan kebutuhan atau budget-mu, nanti aku bantu carikan produk yang cocok.'
        );
    }

    // A. Pencarian nama produk.
    const named = products.find(product => {
        const name = normalize(product.name);
        return name.length > 0 && text.includes(name);
    });

    if (named) {
        const detail = named.description || named.caption || '';

        return makeReply(
            `${named.name} harganya ${rupiah(getPrice(named))}.` +
            (detail ? ` ${detail}` : '') +
            ' Aku tampilkan produknya di etalase ya.',
            [named]
        );
    }

    // B. Produk terlaris.
    if (
        /(terlaris|paling laris|populer|best ?seller|favorit|paling banyak)/.test(text)
    ) {
        const top = [...products]
            .sort(bySales)
            .slice(0, MAX_PRODUCTS_IN_CHAT);

        return makeReply(
            `Ini beberapa produk terlaris: ${top.map(p => p.name).join(', ')}. Mau aku bantu pilih sesuai budget?`,
            top
        );
    }

    // C. Produk termurah atau hemat.
    if (/(murah|hemat|termurah|paling terjangkau)/.test(text)) {
        const categoryProducts = memory.lastCategory
            ? products.filter(
                product => product.category === memory.lastCategory
            )
            : [];

        const pool = categoryProducts.length
            ? categoryProducts
            : products;

        const cheapest = [...pool]
            .sort((a, b) => getPrice(a) - getPrice(b))
            .slice(0, MAX_PRODUCTS_IN_CHAT);

        if (!cheapest.length) {
            return makeReply('Belum ada produk yang bisa dibandingkan.');
        }

        return makeReply(
            `Pilihan paling terjangkau adalah ${cheapest[0].name} seharga ${rupiah(getPrice(cheapest[0]))}. Aku tampilkan beberapa pilihan untuk dibandingkan.`,
            cheapest
        );
    }

    // D. Pencarian berdasarkan kata kunci dan budget.
    const budget = parseBudget(userText);
    const words = tokenize(userText);

    let pool = [...products];

    if (budget) {
        pool = pool.filter(product => {
            const price = getPrice(product);

            return budget.mode === 'min'
                ? price >= budget.value
                : price <= budget.value;
        });
    }

    let hits = [];

    if (words.length) {
        hits = pool
            .map(product => ({
                product,
                score: scoreProduct(product, words)
            }))
            .filter(item => item.score > 0)
            .sort((a, b) =>
                b.score - a.score ||
                bySales(a.product, b.product)
            )
            .map(item => item.product);
    } else if (budget) {
        hits = pool.sort(bySales);
    } else {
        return makeReply(
            'Boleh ceritakan lebih detail, Kak? Misalnya produk yang dicari, kegunaannya, atau kisaran budget-mu.'
        );
    }

    if (!hits.length) {
        return makeReply(
            budget
                ? `Belum ada produk yang cocok dengan kata kunci dan batas harga ${rupiah(budget.value)}. Mau coba budget lain atau melihat produk terlaris?`
                : 'Aku belum menemukan produk yang cocok. Coba sebutkan kegunaan atau kategori produk yang kamu butuhkan.'
        );
    }

    const top = hits.slice(0, MAX_PRODUCTS_IN_CHAT);

    const budgetNote = budget
        ? ` sesuai batas harga ${rupiah(budget.value)}`
        : '';

    return makeReply(
        `Aku menemukan ${hits.length} pilihan${budgetNote}. Salah satu yang cocok adalah ${top[0].name} (${rupiah(getPrice(top[0]))}). Aku sudah menyesuaikan etalase di atas. Ada preferensi lain?`,
        top
    );
}

// ------------------------------------------------------------
// 7. AI SERVER OPSIONAL
// ------------------------------------------------------------

async function generateRemoteReply(userText) {
    if (!CFG.ai_endpoint) {
        throw new Error('ai_endpoint belum dikonfigurasi.');
    }

    const controller = new AbortController();

    const timeoutId = setTimeout(
        () => controller.abort(),
        20000
    );

    try {
        const response = await fetch(CFG.ai_endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            signal: controller.signal,
            body: JSON.stringify({
                business_id: CFG.business_id || null,
                message: userText,
                history: convo.slice(-MAX_CONTEXT_MESSAGES)
            })
        });

        if (!response.ok) {
            throw new Error(`AI server merespons ${response.status}.`);
        }

        const data = await response.json();

        const replyText = String(data.reply || '').trim();

        if (!replyText) {
            throw new Error('AI server tidak memberikan balasan.');
        }

        const ids = safeArray(data.product_ids)
            .map(id => findProduct(id))
            .filter(Boolean)
            .map(product => product.id);

        return {
            text: replyText,
            ids
        };
    } finally {
        clearTimeout(timeoutId);
    }
}

// ------------------------------------------------------------
// 8. ALUR KIRIM PESAN
// ------------------------------------------------------------

async function handleUserMessage(rawText) {
    const text = String(rawText || '').trim();

    if (!text || busy) return;

    busy = true;

    markSuggestionsUsed();

    addMessageToChat(text, 'user');

    convo.push({
        role: 'user',
        text
    });

    const typing = showTyping();
    const startedAt = Date.now();

    try {
        let answer = null;

        // AI server dipakai hanya jika endpoint tersedia.
        // Saat memakai katalog demo, pencarian lokal tetap dipakai.
        if (CFG.ai_endpoint && !S.usingDemo) {
            try {
                answer = await generateRemoteReply(text);
            } catch (error) {
                console.warn(
                    '[Kantoong AI] AI server gagal; beralih ke pencarian lokal:',
                    error.message
                );
            }
        }

        if (!answer || !answer.text) {
            answer = generateLocalReply(text);
        }

        // Jeda minimum agar indikator mengetik tidak berkedip terlalu cepat.
        const elapsed = Date.now() - startedAt;
        const minimumDelay = Math.max(0, 500 - elapsed);

        if (minimumDelay) {
            await sleep(minimumDelay);
        }

        typing?.remove();

        const replyText = String(
            answer.text || 'Maaf Kak, aku belum bisa menemukan jawaban yang sesuai.'
        );

        const ids = safeArray(answer.ids);

        addMessageToChat(replyText, 'ai', { ids });

        convo.push({
            role: 'assistant',
            text: replyText
        });

        // Batasi konteks yang dikirim ke AI server.
        if (convo.length > MAX_CONTEXT_MESSAGES) {
            convo.splice(
                0,
                convo.length - MAX_CONTEXT_MESSAGES
            );
        }

        // Sinkronkan produk yang cocok dengan engine.js.
        if (ids.length) {
            emit('kantoong:matched', { ids });
        }
    } catch (error) {
        console.error('[Kantoong AI] Gagal memproses pesan:', error);

        typing?.remove();

        addMessageToChat(
            'Maaf Kak, ada kendala saat memproses pesan. Coba kirim lagi ya.',
            'ai',
            { persist: false }
        );
    } finally {
        busy = false;

        if (getDayKey() !== todayKey) {
            onNewDay();
        }
    }
}

// ------------------------------------------------------------
// 9. INPUT CHAT DAN TOMBOL KIRIM
// ------------------------------------------------------------

function submitFromInput() {
    if (!input || busy) return;

    const text = input.value.trim();

    if (!text) return;

    input.value = '';
    input.style.height = '20px';
    input.style.overflowY = 'hidden';

    // Kembalikan ukuran input sebelum pesan diproses.
    input.dispatchEvent(new Event('input', { bubbles: true }));

    handleUserMessage(text);
}

sendBtn?.addEventListener('click', submitFromInput);

input?.addEventListener('keydown', event => {
    if (
        event.key === 'Enter' &&
        !event.shiftKey &&
        !event.isComposing
    ) {
        event.preventDefault();
        submitFromInput();
    }
});

// ------------------------------------------------------------
// 10. KLIK SARAN CHAT
// ------------------------------------------------------------

suggestBox?.addEventListener('click', event => {
    const chip = event.target.closest('.suggestion-chip');

    if (!chip || !suggestBox.contains(chip)) return;

    handleUserMessage(chip.textContent);
});

// ------------------------------------------------------------
// 11. INTERAKSI KARTU PRODUK DI DALAM CHAT
// ------------------------------------------------------------

chatBox?.addEventListener('click', event => {
    const productButton = event.target.closest('.chat-product');

    if (productButton) {
        const product = findProduct(productButton.dataset.id);

        if (product) {
            handleUserMessage(
                `Ceritakan lebih lanjut tentang ${product.name}`
            );
        }

        return;
    }

    if (event.target.closest('.chat-catalog-link')) {
        emit('kantoong:collapse');
        emit('kantoong:show-catalog');
    }
});

// ------------------------------------------------------------
// 12. INTEGRASI EVENT KONSULTASI DARI ENGINE
// ------------------------------------------------------------

// panel.js menangani pembukaan panel.
// Modul ini menangani pengiriman teks jika event membawa pesan.
window.addEventListener('kantoong:consult', event => {
    const text = event.detail?.text;

    if (typeof text === 'string' && text.trim()) {
        handleUserMessage(text);
    }
});

// ------------------------------------------------------------
// 13. DATA KATALOG SIAP
// ------------------------------------------------------------

window.addEventListener('supabase-data-ready', () => {
    // Render hanya jika area chat masih kosong agar pesan yang
    // sedang dilihat user tidak terhapus ketika katalog diperbarui.
    if (chatBox && chatBox.childElementCount === 0) {
        renderToday();
    }
});

// ------------------------------------------------------------
// 14. INISIALISASI
// ------------------------------------------------------------

// Tampilkan sapaan dan saran ketika halaman siap.
renderToday();

// Pantau pergantian hari agar saran dapat muncul kembali.
scheduleMidnight();

console.info('[Kantoong AI] Chat brain siap.');
