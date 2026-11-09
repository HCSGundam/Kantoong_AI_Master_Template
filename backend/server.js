// backend/server.js — Sasis Backend Kantoong AI (dengan gerbang keamanan berlapis)
//
// Tugas backend SAAT INI hanya satu: meneruskan chat ke Gemini tanpa membocorkan
// kunci API. Semua data bisnis (produk, pesanan, ERP, kasir) ada di Supabase dan
// dilindungi RLS + fungsi database — BUKAN di sini.
//
// Dihapus demi keamanan (Nov 2026): /api/admin/login & /api/admin/products lama
// yang hanya mencocokkan email kiriman pengguna (siapa pun bisa mengaku admin)
// dan tidak dipakai web lagi. Pengelolaan produk ada di ERP › Katalog Master.

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const { handleChat } = require('./ai-chat');
const { handleTranslate } = require('./translate');
const security = require('./security');

const config = security.settings();
const app = express();
const PORT = Number(process.env.PORT) || 5000;
// Bawaan hanya mendengarkan komputer sendiri; server produksi isi HOST=0.0.0.0 di belakang proxy.
const HOST = process.env.HOST || '127.0.0.1';

app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', 1);

app.use(security.securityHeaders);
app.use(security.corsAllowlist(config.allowedOrigins));
app.use(security.requestTimeout(config.requestTimeoutMs));
app.use(express.json({ limit: config.maxBodyBytes, strict: true }));

// Status singkat (tanpa membocorkan versi, kunci, atau konfigurasi).
app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', ai: Boolean(process.env.GEMINI_API_KEY) });
});

const chatLimiter = security.createLimiter({
    perMinute: config.chatPerMinute,
    perDay: config.chatPerDay,
    budget: config.aiDailyBudget,
});

app.post('/api/chat',
    security.requireJson,
    security.blockAutomation,
    (req, res, next) => {
        const key = security.clientKey(req, config.trustProxy);
        const message = security.sanitizeInput(req.body?.message, 3000);
        const blocked = chatLimiter.take(key, message);
        if (blocked) {
            res.setHeader('Retry-After', String(blocked.retryAfter));
            return security.reject(res, blocked.status, blocked.message, blocked.reason, req);
        }
        next();
    },
    handleChat
);

// Multi bahasa: terjemahan teks halaman. Batas terpisah dari chat (satu halaman = beberapa paket),
// tetap ikut anggaran AI harian supaya biaya tidak bisa dibobol.
const translateLimiter = security.createLimiter({
    perMinute: config.translatePerMinute,
    perDay: config.translatePerDay,
    budget: config.translateDailyBudget,
});

app.post('/api/translate',
    security.requireJson,
    security.blockAutomation,
    (req, res, next) => {
        const key = security.clientKey(req, config.trustProxy);
        const blocked = translateLimiter.take(key);
        if (blocked) {
            res.setHeader('Retry-After', String(blocked.retryAfter));
            return security.reject(res, blocked.status, blocked.message, blocked.reason, req);
        }
        next();
    },
    handleTranslate
);

// Selain rute di atas: tidak ada.
app.use((req, res) => res.status(404).json({ error: 'Tidak ditemukan.' }));

// Kesalahan: pesan umum saja (tidak ada stack trace / detail internal ke publik).
app.use((error, req, res, next) => {
    if (error?.type === 'entity.too.large') return security.reject(res, 413, 'Pesan terlalu besar.', 'too-large', req);
    if (error?.type === 'entity.parse.failed') return security.reject(res, 400, 'Format JSON tidak valid.', 'bad-json', req);
    console.error('[server] kesalahan:', error?.message);
    if (res.headersSent) return next(error);
    res.status(500).json({ error: 'Terjadi kesalahan di server.' });
});

if (require.main === module) {
    app.listen(PORT, HOST, () => {
        console.log(`Server Kantoong AI berjalan di http://${HOST}:${PORT}`);
        console.log(`Asal yang diizinkan: ${config.allowedOrigins.join(', ')}`);
    });
}

module.exports = app;
