// ============================================================
// ai-brain.js - Kantoong AI Brain
// Tugas: tampilkan percakapan, pahami permintaan user, cocokkan
// dengan katalog, lalu kabari engine.js lewat event agar etalase
// di atas berganti otomatis.
//
// Saat ini pencocokan berjalan LOKAL (kata kunci, budget, terlaris,
// termurah, nama produk) sehingga template langsung hidup tanpa
// biaya. Jika client-config.js diberi `ai_endpoint` (mis. Netlify
// Function ke Gemini), pesan dikirim ke sana lebih dulu dan
// pencarian lokal menjadi cadangan.
//   POST ai_endpoint  {business_id, message, history}
//   balasan           {reply, product_ids: [], suggestions: []}
//
// SARAN CHAT (3 tombol lonjong): hanya muncul di awal hari. Setelah user
// mengirim pesan pertama hari itu (ketik sendiri ATAU pilih saran), saran
// hilang dan tidak muncul lagi sampai pukul 00:00. Pukul 00:00 chat dimulai
// lagi dari sapaan + 3 saran baru (diacak dari ai_suggestions), sedangkan
// riwayat tetap tersimpan sesuai history_days.
//
// EVENT MASUK : kantoong:consult {text}, supabase-data-ready
// EVENT KELUAR: kantoong:matched {ids}, kantoong:show-catalog,
//               kantoong:collapse (panel.js mengecilkan chat)
// ============================================================

import { KantoongState as S } from './engine.js';

const CFG = (typeof KantoongConfig !== 'undefined') ? KantoongConfig : {};

const chatBox = document.getElementById('chatBox');
const suggestBox = document.getElementById('chatSuggestions');
const sendBtn = document.getElementById('tombolKirim');
const input = document.getElementById('kolomKetik');

// ------------------------------------------------------------
// Helper
// ------------------------------------------------------------
const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const hhmm = (d) => d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
const rupiah = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0);
const findProduct = (id) => S.products.find(p => String(p.id) === String(id));

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text; // textContent: aman dari injeksi HTML
    return node;
}

// ------------------------------------------------------------
// Riwayat chat: disimpan di browser user, otomatis hilang setelah X hari
// ------------------------------------------------------------
const HISTORY_KEY = `kantoong:chat:${CFG.business_id || 'default'}`;
const HISTORY_MS = (Number(CFG.history_days) || 30) * 24 * 60 * 60 * 1000;

const history = {
    read() {
        try {
            return (JSON.parse(localStorage.getItem(HISTORY_KEY)) || []).filter(m => Date.now() - m.t < HISTORY_MS);
        } catch { return []; }
    },
    write(list) {
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(-60))); } catch { /* storage penuh/diblokir */ }
    }
};
let saved = history.read();
const convo = []; // konteks percakapan untuk AI jarak jauh: {role, text}

// ------------------------------------------------------------
// Tampilan chat
// ------------------------------------------------------------
export function addMessageToChat(text, sender = 'ai', opts = {}) {
    if (!chatBox) return;
    const { ids = [], persist = true } = opts;
    const now = new Date();

    const wrapper = el('div', `message-wrapper ${sender}`);
    const bubble = el('div', 'bubble');
    bubble.append(el('span', 'bubble-text', text));

    const products = ids.map(findProduct).filter(Boolean);
    if (products.length) {
        const row = el('div', 'chat-products');
        products.forEach(p => {
            const item = el('button', 'chat-product');
            item.type = 'button';
            item.dataset.id = p.id;
            const thumb = el('div', 'chat-product-thumb');
            if (p.image_url) {
                const img = el('img');
                img.src = p.image_url; img.alt = p.name; img.loading = 'lazy';
                thumb.append(img);
            } else {
                thumb.textContent = (p.name || '?').trim().charAt(0).toUpperCase();
            }
            item.append(thumb, el('div', 'chat-product-name', p.name));
            row.append(item);
        });
        const link = el('button', 'chat-catalog-link', 'Lengkapnya bisa lihat di katalog ↑');
        link.type = 'button';
        bubble.append(row, link);
    }

    bubble.append(el('span', 'time-stamp', hhmm(now)));
    wrapper.append(el('div', 'avatar', sender === 'ai' ? 'AI' : 'ANDA'), bubble);
    chatBox.append(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;

    if (persist) {
        saved.push({ t: now.getTime(), who: sender, text, ids });
        history.write(saved);
    }
}

function showTyping() {
    const wrapper = el('div', 'message-wrapper ai');
    const bubble = el('div', 'bubble is-typing');
    bubble.append(el('span', 'typing-dot'), el('span', 'typing-dot'), el('span', 'typing-dot'));
    wrapper.append(el('div', 'avatar', 'AI'), bubble);
    chatBox.append(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;
    return wrapper;
}

function setSuggestions(list = []) {
    if (!suggestBox) return;
    suggestBox.replaceChildren(...list.slice(0, 3).map(text => {
        const chip = el('button', 'suggestion-chip', text);
        chip.type = 'button';
        return chip;
    }));
}

// ---- Saran chat harian ----
const USED_KEY = `kantoong:chat-used:${CFG.business_id || 'default'}`;
const dayKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

let todayKey = dayKey();
let usedToday = false;   // true setelah user mengirim pesan hari ini
let todaysChips = [];    // 3 saran hasil acak untuk kunjungan ini

try { usedToday = localStorage.getItem(USED_KEY) === todayKey; } catch { /* storage diblokir */ }

function markSuggestionsUsed() {
    usedToday = true;
    try { localStorage.setItem(USED_KEY, todayKey); } catch { /* tetap tersimpan di memori halaman */ }
}

// Acak daftar ai_suggestions lalu ambil 3 (Fisher-Yates)
function pickSuggestions() {
    const pool = [...(CFG.ai_suggestions || [])];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 3);
}

// Tampilkan chat untuk HARI INI: pesan hari ini jika ada, jika tidak sapaan pembuka.
// Pesan hari-hari sebelumnya tetap ada di penyimpanan (riwayat), hanya tidak ditampilkan di sini.
function renderToday() {
    if (!chatBox) return;
    chatBox.replaceChildren();
    const startOfDay = new Date().setHours(0, 0, 0, 0);
    const todays = saved.filter(m => m.t >= startOfDay);

    if (todays.length) {
        todays.forEach(m => addMessageToChat(m.text, m.who, { ids: m.ids || [], persist: false }));
        if (todays.some(m => m.who === 'user')) usedToday = true;
    } else {
        const greetings = CFG.ai_greetings || [];
        const line = greetings.length ? greetings[Math.floor(Math.random() * greetings.length)] : 'Ada yang bisa aku bantu cari?';
        addMessageToChat(`${CFG.ai_title || 'Halo Kak!'} ${line}`, 'ai', { persist: false });
    }

    todaysChips = pickSuggestions();
    setSuggestions(usedToday ? [] : todaysChips);
}

// Pergantian hari (00:00): mulai lagi dari awal, saran kembali muncul
function onNewDay() {
    todayKey = dayKey();
    usedToday = false;
    convo.length = 0;
    if (!busy) renderToday();
}

function scheduleMidnight() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    setTimeout(() => { onNewDay(); scheduleMidnight(); }, next - now);
}

// Tab/HP yang tertidur melewati tengah malam: cek lagi saat dibuka kembali
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && dayKey() !== todayKey) onNewDay();
});

// ------------------------------------------------------------
// Otak lokal: memahami kata kunci, budget, dan niat user
// ------------------------------------------------------------
const STOP = new Set(['yang', 'dan', 'untuk', 'dengan', 'saya', 'aku', 'mau', 'ingin', 'cari', 'carikan', 'tolong', 'bantu', 'dong', 'kak',
    'nya', 'ada', 'apa', 'buat', 'sesuai', 'kebutuhan', 'produk', 'rekomendasi', 'pilihkan', 'pilih', 'bawah', 'atas', 'budget', 'harga',
    'maksimal', 'minimal', 'sekitar', 'sampai', 'juta', 'ribu', 'bisa', 'lebih', 'paling', 'tentang', 'ceritakan', 'jelaskan',
    'halo', 'hai', 'hello', 'selamat', 'pagi', 'siang', 'sore', 'malam', 'kamu', 'anda']);

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/(\d)\.(?=\d{3}\b)/g, '$1');
const tokens = (s) => norm(s).split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));

// "500 ribu", "2jt", "1.500.000" -> angka rupiah. Mengembalikan {value, mode} atau null.
function parseBudget(text) {
    const t = norm(text);
    for (const m of t.matchAll(/(\d+(?:,\d+)?)\s*(juta|jt|ribu|rb|k)?\b/g)) {
        let n = parseFloat(m[1].replace(',', '.'));
        const unit = m[2] || '';
        if (unit === 'juta' || unit === 'jt') n *= 1e6;
        else if (unit) n *= 1e3;
        else if (n < 1000) continue; // angka kecil tanpa satuan (mis. "2 lantai") bukan harga
        const mode = /(di atas|lebih dari|minimal|min )/.test(t) ? 'min' : 'max';
        return { value: n, mode };
    }
    return null;
}

function scoreProduct(p, toks) {
    const name = norm(p.name), cat = norm(p.category), rest = norm(`${p.caption || ''} ${p.description || ''}`);
    return toks.reduce((sum, w) => sum + (name.includes(w) ? 3 : 0) + (cat.includes(w) ? 2 : 0) + (rest.includes(w) ? 1 : 0), 0);
}

const bySales = (a, b) => (Number(b.sales_count) || 0) - (Number(a.sales_count) || 0);
const memory = { lastCategory: '' };

function reply(text, products = []) {
    if (products[0]?.category) memory.lastCategory = products[0].category;
    return { text, ids: products.map(p => p.id) };
}

function generateLocalReply(userText) {
    const t = norm(userText);

    if (S.isLoading) return reply('Sebentar ya Kak, katalog sedang dimuat. Coba kirim lagi beberapa detik lagi.');
    if (!S.products.length) return reply('Katalog toko belum terisi. Pemilik toko bisa menambahkan produk lewat dashboard admin.');

    if (/(terima kasih|makasih|thanks|thank you)/.test(t)) {
        return reply('Sama-sama Kak! Kalau masih bingung memilih, tanya saja lagi ya.');
    }
    if (/^(hai|halo|hi|hello|selamat|pagi|siang|sore|malam)\b/.test(t) && tokens(t).length === 0) {
        return reply('Halo Kak! Ceritakan kebutuhan atau budget-mu, nanti aku carikan yang paling cocok.');
    }

    // 1. Menyebut nama produk -> jelaskan produk itu
    const named = S.products.find(p => t.includes(norm(p.name)));
    if (named) {
        const detail = named.description || named.caption || '';
        return reply(
            `${named.name} harganya ${rupiah(named.price)}.${detail ? ' ' + detail : ''} Aku tampilkan di etalase ya. Mau aku carikan yang lebih murah atau pembandingnya?`,
            [named]
        );
    }

    // 2. Terlaris
    if (/(terlaris|paling laris|populer|best ?seller|favorit|paling banyak)/.test(t)) {
        const top = [...S.products].sort(bySales).slice(0, 4);
        return reply(`Ini produk yang paling banyak dipilih: ${top.map(p => p.name).join(', ')}. Mau aku bantu sesuaikan dengan budget?`, top);
    }

    // 3. Termurah / hemat
    if (/(murah|hemat|termurah)/.test(t)) {
        const pool = memory.lastCategory ? S.products.filter(p => p.category === memory.lastCategory) : S.products;
        const cheap = [...(pool.length > 1 ? pool : S.products)].sort((a, b) => a.price - b.price).slice(0, 4);
        return reply(`Pilihan paling terjangkau: ${cheap[0].name} di ${rupiah(cheap[0].price)}. Sisanya sudah aku tampilkan di etalase.`, cheap);
    }

    // 4. Pencarian umum: kata kunci + budget
    const budget = parseBudget(userText);
    const toks = tokens(userText);
    let pool = S.products.filter(p =>
        !budget || (budget.mode === 'max' ? Number(p.price) <= budget.value : Number(p.price) >= budget.value));

    let hits;
    if (toks.length) {
        hits = pool.map(p => ({ p, s: scoreProduct(p, toks) })).filter(x => x.s > 0)
            .sort((a, b) => b.s - a.s || bySales(a.p, b.p)).map(x => x.p);
    } else if (budget) {
        hits = pool.sort(bySales);
    } else {
        return reply('Boleh ceritakan lebih detail? Misalnya untuk apa produknya, dan kira-kira berapa budget-mu?');
    }

    if (!hits.length) {
        return reply(
            budget
                ? `Belum ada yang pas di sekitar ${rupiah(budget.value)} untuk permintaan itu. Mau coba budget lain, atau lihat produk terlaris dulu?`
                : 'Aku belum menemukan yang pas dengan itu. Coba ceritakan fungsi yang kamu butuhkan, atau lihat produk terlaris dulu.',
            []
        );
    }

    const top = hits.slice(0, 4);
    const budgetNote = budget ? ` ${budget.mode === 'max' ? 'di bawah' : 'di atas'} ${rupiah(budget.value)}` : '';
    return reply(
        `Ada ${hits.length} pilihan yang cocok${budgetNote}. Yang paling pas menurutku ${top[0].name} (${rupiah(top[0].price)}). Etalase di atas sudah aku sesuaikan, geser untuk melihat semuanya. Ada preferensi lain?`,
        top
    );
}

// Opsional: AI jarak jauh (Gemini lewat server milikmu). Gagal -> pakai otak lokal.
async function generateRemoteReply(userText) {
    const res = await fetch(CFG.ai_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ business_id: CFG.business_id, message: userText, history: convo.slice(-8) })
    });
    if (!res.ok) throw new Error('AI server ' + res.status);
    const d = await res.json();
    const products = (d.product_ids || []).map(findProduct).filter(Boolean);
    return { text: String(d.reply || ''), ids: products.map(p => p.id) };
}

// ------------------------------------------------------------
// Alur kirim pesan
// ------------------------------------------------------------
let busy = false;

async function handleUserMessage(rawText) {
    const text = String(rawText || '').trim();
    if (!text || busy) return;
    busy = true;

    markSuggestionsUsed();   // sekali kirim (ketik sendiri / pilih saran) -> saran hilang sampai 00:00
    setSuggestions([]);
    addMessageToChat(text, 'user');
    const typing = showTyping();
    const started = Date.now();

    try {
        let answer;
        if (CFG.ai_endpoint && !S.usingDemo) {
            try { answer = await generateRemoteReply(text); }
            catch (err) { console.warn('⚠️ [AI Brain] Server AI gagal, memakai otak lokal:', err.message); }
        }
        answer = answer?.text ? answer : generateLocalReply(text);

        await sleep(Math.max(0, 700 - (Date.now() - started))); // jeda agar terasa natural
        typing.remove();

        addMessageToChat(answer.text, 'ai', { ids: answer.ids });
        convo.push({ role: 'user', text }, { role: 'ai', text: answer.text });
        if (answer.ids.length) emit('kantoong:matched', { ids: answer.ids });
    } catch (err) {
        console.error('❌ [AI Brain]', err);
        typing.remove();
        addMessageToChat('Maaf Kak, ada kendala sebentar. Coba kirim lagi ya.', 'ai', { persist: false });
    } finally {
        busy = false;
        if (dayKey() !== todayKey) onNewDay();
    }
}

// ------------------------------------------------------------
// Pendengar
// ------------------------------------------------------------
function submitFromInput() {
    if (!input) return;
    const text = input.value;
    input.value = '';
    input.style.height = '20px';
    handleUserMessage(text);
}

if (sendBtn) sendBtn.addEventListener('click', submitFromInput);
if (input) {
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            submitFromInput();
        }
    });
}

if (suggestBox) {
    suggestBox.addEventListener('click', (e) => {
        const chip = e.target.closest('.suggestion-chip');
        if (chip) handleUserMessage(chip.textContent);
    });
}

if (chatBox) {
    chatBox.addEventListener('click', (e) => {
        const product = e.target.closest('.chat-product');
        if (product) {
            const p = findProduct(product.dataset.id);
            if (p) handleUserMessage(`Ceritakan tentang ${p.name}`);
            return;
        }
        if (e.target.closest('.chat-catalog-link')) {
            emit('kantoong:collapse');
            emit('kantoong:show-catalog');
        }
    });
}

// Tombol "Konsultasi AI" / "Tanyakan produk ini" dari etalase
window.addEventListener('kantoong:consult', (e) => {
    const text = e.detail?.text;
    if (text) handleUserMessage(text);
});

// Data siap: tampilkan chat hari ini (atau sapaan + saran untuk awal hari)
window.addEventListener('supabase-data-ready', () => {
    if (!chatBox || chatBox.childElementCount) return;
    renderToday();
});

scheduleMidnight();