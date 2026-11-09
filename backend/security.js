// backend/security.js — GERBANG KEAMANAN BERLAPIS backend Kantoong AI
//
// Melindungi dari manusia jahat DAN bot / AI otomatis:
//   L1  Header keamanan (anti clickjacking, sniffing, bocor referrer)
//   L2  CORS hanya untuk domain sendiri (ALLOWED_ORIGINS)
//   L3  Hanya JSON, ukuran body kecil, batas waktu permintaan
//   L4  Penyaring bot: alat otomatis (curl, python, headless) ditolak di /api/chat
//   L5  Pembatas kecepatan per alamat (per menit) + kuota harian per alamat
//   L6  Anggaran AI global per hari (mencegah "kuras tagihan Gemini" oleh bot)
//   L7  Deteksi banjir pesan kembar (bot mengulang pesan yang sama)
//   L8  Penjaga prompt injection: teks dibersihkan, upaya membajak AI ditandai
//   L9  Penyaring jawaban AI: tautan asing, kunci rahasia & data sensitif dibuang
//   L10 Catatan kejadian keamanan TANPA data pribadi (alamat di-hash harian, isi chat tidak disimpan)
//
// Semua angka bisa diatur lewat backend/.env (lihat .env.example).
// Tanpa library tambahan: lebih sedikit dependensi = lebih kecil celah supply-chain.

const crypto = require('crypto');

const num = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

function settings(env = process.env) {
    return {
        allowedOrigins: String(env.ALLOWED_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173')
            .split(',').map(origin => origin.trim()).filter(Boolean),
        chatPerMinute: num(env.CHAT_PER_MINUTE, 12),
        chatPerDay: num(env.CHAT_PER_DAY, 300),
        aiDailyBudget: num(env.AI_DAILY_BUDGET, 3000),
        translatePerMinute: num(env.TRANSLATE_PER_MINUTE, 30),
        translatePerDay: num(env.TRANSLATE_PER_DAY, 400),
        translateDailyBudget: num(env.TRANSLATE_DAILY_BUDGET, 2000),
        maxBodyBytes: num(env.MAX_BODY_BYTES, 64 * 1024),
        requestTimeoutMs: num(env.REQUEST_TIMEOUT_MS, 25000),
        trustProxy: env.TRUST_PROXY === '1',
    };
}

/* ---------- L1: header keamanan ---------- */
function securityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('Cache-Control', 'no-store');
    res.removeHeader('X-Powered-By');
    next();
}

/* ---------- L2: CORS daftar putih ---------- */
function corsAllowlist(allowed) {
    return (req, res, next) => {
        const origin = req.headers.origin;
        if (origin && allowed.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Vary', 'Origin');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.setHeader('Access-Control-Max-Age', '600');
        }
        if (req.method === 'OPTIONS') return res.status(origin && allowed.includes(origin) ? 204 : 403).end();
        // Browser dari situs lain ditolak (bukan hanya disembunyikan jawabannya).
        if (origin && !allowed.includes(origin)) return reject(res, 403, 'Asal permintaan tidak diizinkan.', 'origin', req);
        next();
    };
}

/* ---------- L3: hanya JSON + batas waktu ---------- */
function requireJson(req, res, next) {
    if (req.method === 'POST' && !String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
        return reject(res, 415, 'Gunakan application/json.', 'content-type', req);
    }
    next();
}

function requestTimeout(ms) {
    return (req, res, next) => {
        res.setTimeout(ms, () => {
            if (!res.headersSent) reject(res, 503, 'Permintaan terlalu lama, coba lagi.', 'timeout', req);
        });
        next();
    };
}

/* ---------- L4: penyaring bot ---------- */
const AUTOMATION_UA = /(curl|wget|python-requests|python-urllib|aiohttp|httpx|go-http-client|okhttp|java\/|libwww|scrapy|headlesschrome|phantomjs|puppeteer|playwright|selenium|axios\/|node-fetch|undici|postmanruntime|insomnia)/i;

/** true bila permintaan jelas datang dari alat otomatis, bukan browser pengunjung. */
function looksAutomated(req) {
    const ua = String(req.headers['user-agent'] || '');
    if (!ua || ua.length < 12) return true;
    if (AUTOMATION_UA.test(ua)) return true;
    // Browser asli selalu mengirim Accept-Language; banyak skrip tidak.
    if (!req.headers['accept-language']) return true;
    return false;
}

function blockAutomation(req, res, next) {
    if (looksAutomated(req)) return reject(res, 403, 'Permintaan otomatis tidak diizinkan.', 'bot', req);
    next();
}

/* ---------- L5–L7: pembatas kecepatan, kuota & banjir pesan ---------- */
function clientKey(req, trustProxy) {
    const forwarded = trustProxy ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '';
    return forwarded || req.socket?.remoteAddress || 'unknown';
}

/** Alamat disimpan sebagai hash harian (tidak bisa dibalik, berganti tiap hari) — sesuai UU PDP. */
const daySalt = () => new Date().toISOString().slice(0, 10) + (process.env.LOG_SALT || 'kantoong');
function hashKey(value) {
    return crypto.createHash('sha256').update(`${daySalt()}|${value}`).digest('hex').slice(0, 16);
}

function createLimiter({ perMinute, perDay, budget, now = () => Date.now() }) {
    const minute = new Map();   // kunci -> [stempel waktu]
    const day = new Map();      // kunci -> { day, count }
    const repeats = new Map();  // kunci -> { hash, count, at }
    const global = { day: '', count: 0 };
    const today = () => new Date(now()).toISOString().slice(0, 10);

    function sweep() {
        const cutoff = now() - 60000;
        for (const [key, hits] of minute) {
            const kept = hits.filter(at => at > cutoff);
            if (kept.length) minute.set(key, kept); else minute.delete(key);
        }
        if (day.size > 50000) day.clear();
        if (repeats.size > 50000) repeats.clear();
    }

    /** Cek & catat satu permintaan. Mengembalikan null (boleh) atau { status, message, reason }. */
    function take(key, messageText = '') {
        const t = now();
        if (Math.random() < 0.01) sweep();

        const hits = (minute.get(key) || []).filter(at => at > t - 60000);
        if (hits.length >= perMinute) {
            return { status: 429, message: 'Terlalu cepat. Tunggu sebentar ya.', reason: 'rate-minute', retryAfter: 60 };
        }

        const d = today();
        const daily = day.get(key);
        const used = daily && daily.day === d ? daily.count : 0;
        if (used >= perDay) {
            return { status: 429, message: 'Batas obrolan harian tercapai. Coba lagi besok.', reason: 'rate-day', retryAfter: 3600 };
        }

        if (global.day !== d) Object.assign(global, { day: d, count: 0 });
        if (global.count >= budget) {
            return { status: 503, message: 'AI sedang istirahat (kuota harian). Jawaban cadangan dipakai.', reason: 'budget', retryAfter: 3600 };
        }

        // Banjir pesan kembar: pesan sama > 4× dalam 2 menit dari alamat yang sama.
        if (messageText) {
            const hash = crypto.createHash('sha1').update(messageText.toLowerCase().replace(/\s+/g, ' ')).digest('hex');
            const last = repeats.get(key);
            const count = last && last.hash === hash && t - last.at < 120000 ? last.count + 1 : 1;
            repeats.set(key, { hash, count, at: t });
            if (count > 4) return { status: 429, message: 'Pesan yang sama dikirim berulang-ulang.', reason: 'repeat', retryAfter: 120 };
        }

        hits.push(t);
        minute.set(key, hits);
        day.set(key, { day: d, count: used + 1 });
        global.count += 1;
        return null;
    }

    return { take, stats: () => ({ keys: minute.size, aiToday: global.count }) };
}

/* ---------- L8: penjaga prompt injection ---------- */
const INJECTION_PATTERNS = [
    /ignore (all |any )?(previous|prior|above) (instructions|prompts?)/i,
    /disregard (the |all )?(system|previous) (prompt|instructions)/i,
    /(abaikan|lupakan|hapus) (semua )?(instruksi|perintah|aturan)( sebelumnya| di atas| sistem)?/i,
    /(system prompt|prompt sistem|developer mode|mode pengembang|jailbreak|\bDAN\b mode)/i,
    /(tampilkan|bocorkan|reveal|print|show).{0,30}(system prompt|instruksi rahasia|api key|kunci api|secret)/i,
    /you are now|kamu sekarang adalah (bukan|admin|developer|sistem)/i,
    /<\/?(system|assistant|instruction)>/i,
];

/** Bersihkan teks masuk: karakter kontrol & tak terlihat (dipakai menyelundupkan perintah) dibuang. */
function sanitizeInput(value, maxLength) {
    return String(value ?? '')
        .normalize('NFKC')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .replace(/[​-‏‪-‮⁠-⁤﻿]/g, '')
        .replace(/(.)\1{30,}/g, '$1$1$1')
        .trim()
        .slice(0, maxLength);
}

function detectInjection(text) {
    return INJECTION_PATTERNS.some(pattern => pattern.test(String(text || '')));
}

/* ---------- L9: penyaring jawaban AI ---------- */
const SECRET_LIKE = /(AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{20,}|sb_secret_[A-Za-z0-9_-]{10,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/g;

/**
 * Jawaban AI dibersihkan sebelum dikirim ke browser:
 * kunci rahasia & token disensor, tautan ke domain asing dibuang (anti phishing),
 * tag HTML dihapus (frontend juga memakai textContent — lapisan ganda).
 */
function sanitizeOutput(text, { allowedHosts = [] } = {}) {
    return String(text ?? '')
        .replace(SECRET_LIKE, '[disensor]')
        .replace(/<[^>]{1,200}>/g, '')
        .replace(/\bhttps?:\/\/[^\s)]+/gi, (url) => {
            try {
                const host = new URL(url).hostname;
                return allowedHosts.some(allowed => host === allowed || host.endsWith(`.${allowed}`)) ? url : '[tautan dihapus]';
            } catch {
                return '[tautan dihapus]';
            }
        })
        .replace(/\b(?:\d[ -]?){13,19}\b/g, '[nomor disensor]');
}

/* ---------- L10: catatan kejadian keamanan (tanpa data pribadi) ---------- */
const events = [];
function logSecurity(reason, req) {
    const entry = { at: new Date().toISOString(), reason, path: req?.path || '', who: hashKey(clientKey(req || {}, settings().trustProxy)) };
    events.push(entry);
    if (events.length > 500) events.shift();
    if (process.env.NODE_ENV !== 'test') console.warn('[keamanan]', entry.reason, entry.path, entry.who);
}

function reject(res, status, message, reason, req) {
    logSecurity(reason, req);
    return res.status(status).json({ error: message });
}

module.exports = {
    settings,
    securityHeaders,
    corsAllowlist,
    requireJson,
    requestTimeout,
    looksAutomated,
    blockAutomation,
    clientKey,
    hashKey,
    createLimiter,
    sanitizeInput,
    detectInjection,
    sanitizeOutput,
    logSecurity,
    reject,
    securityEvents: () => events.slice(),
};
