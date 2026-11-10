// functions/api/[[path]].js — Backend AI Kantoong di Cloudflare Pages
//
// Web online (Cloudflare Pages) memanggil /api/... di DOMAIN YANG SAMA dengan tokonya.
// File ini menjalankan otak AI yang SAMA dengan backend/server.js (Express, dipakai saat
// `npm run dev` di laptop): ai-chat.js, translate.js dan gerbang keamanan security.js
// dipakai ulang apa adanya lewat adaptor kecil di bawah (Request → req/res ala Express).
//
// Kunci GEMINI_API_KEY TIDAK ada di kode: diisi sebagai "secret" di Cloudflare
// (`npx wrangler pages secret put GEMINI_API_KEY`). Browser tidak pernah melihatnya.
//
// Catatan: pembatas kecepatan & anggaran harian disimpan di memori tiap mesin Cloudflare,
// jadi bersifat "per mesin" (cukup untuk demo; untuk produksi besar pindah ke KV/Durable Object).

import security from "../../backend/security.js";
import aiChat from "../../backend/ai-chat.js";
import translate from "../../backend/translate.js";

const config = security.settings();
const chatLimiter = security.createLimiter({ perMinute: config.chatPerMinute, perDay: config.chatPerDay, budget: config.aiDailyBudget });
const translateLimiter = security.createLimiter({ perMinute: config.translatePerMinute, perDay: config.translatePerDay, budget: config.translateDailyBudget });

/** Pindahkan variabel Cloudflare (teks saja) ke process.env yang dibaca modul backend. */
function loadEnv(env) {
    for (const [key, value] of Object.entries(env ?? {})) {
        if (typeof value === "string" && process.env[key] === undefined) process.env[key] = value;
    }
}

function makeRes() {
    const headers = new Headers();
    let body = null;
    const res = {
        statusCode: 200,
        headersSent: false,
        setHeader: (k, v) => headers.set(k, String(v)),
        removeHeader: (k) => headers.delete(k),
        setTimeout: () => res,
        status(code) {
            res.statusCode = code;
            return res;
        },
        json(data) {
            headers.set("Content-Type", "application/json; charset=utf-8");
            body = JSON.stringify(data);
            res.headersSent = true;
            return res;
        },
        end() {
            res.headersSent = true;
            return res;
        },
        toResponse: () => new Response(body, { status: res.statusCode, headers }),
    };
    return res;
}

/** Jalankan rantai middleware ala Express sampai ada yang menjawab. */
async function run(req, res, steps) {
    for (const step of steps) {
        let next = false;
        await step(req, res, () => {
            next = true;
        });
        if (res.headersSent || !next) return;
    }
}

const limit = (limiter, withMessage) => (req, res, next) => {
    const key = security.clientKey(req, false);
    const blocked = limiter.take(key, withMessage ? security.sanitizeInput(req.body?.message, 3000) : "");
    if (blocked) {
        res.setHeader("Retry-After", String(blocked.retryAfter));
        return security.reject(res, blocked.status, blocked.message, blocked.reason, req);
    }
    next();
};

const ROUTES = {
    "GET /api/status": [(req, res) => res.json({ status: "ok", ai: Boolean(process.env.GEMINI_API_KEY) })],
    "POST /api/chat": [security.requireJson, security.blockAutomation, limit(chatLimiter, true), aiChat.handleChat],
    "POST /api/translate": [security.requireJson, security.blockAutomation, limit(translateLimiter, false), translate.handleTranslate],
};

export async function onRequest({ request, env }) {
    loadEnv(env);
    const url = new URL(request.url);
    const headers = Object.fromEntries([...request.headers].map(([k, v]) => [k.toLowerCase(), v]));
    const req = {
        method: request.method,
        path: url.pathname,
        headers,
        body: undefined,
        // Cloudflare sendiri yang mengisi alamat asli pengunjung (tidak bisa dipalsukan pengunjung).
        socket: { remoteAddress: headers["cf-connecting-ip"] || "unknown" },
    };
    const res = makeRes();

    // Domain web ini sendiri (termasuk link pratinjau per versi) selalu diizinkan.
    const allowed = [...config.allowedOrigins, url.origin];
    await run(req, res, [security.securityHeaders, security.corsAllowlist(allowed)]);
    if (res.headersSent) return res.toResponse();

    const route = ROUTES[`${request.method} ${url.pathname}`];
    if (!route) return res.status(404).json({ error: "Tidak ditemukan." }).toResponse();

    if (request.method === "POST") {
        const raw = await request.text();
        if (raw.length > config.maxBodyBytes) return security.reject(res, 413, "Pesan terlalu besar.", "too-large", req).toResponse();
        try {
            req.body = raw ? JSON.parse(raw) : {};
        } catch {
            if (String(headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
                return security.reject(res, 400, "Format JSON tidak valid.", "bad-json", req).toResponse();
            }
            req.body = {};
        }
    }

    try {
        await run(req, res, route);
    } catch (error) {
        console.error("[api] kesalahan:", error?.message);
        if (!res.headersSent) res.status(500).json({ error: "Terjadi kesalahan di server." });
    }
    return res.toResponse();
}
