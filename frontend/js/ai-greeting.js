/**
 * SAPAAN AI YANG SELALU BARU (Kantoong)
 *
 * Saat chat dibuka di sesi baru, AI menyapa duluan dengan pertanyaan yang
 * dibuat dari jejak pengunjung DI PERANGKAT INI (tanpa fingerprinting):
 * kunjungan ke-berapa, kapan terakhir datang, produk yang dilihat, isi keranjang,
 * favorit, dan kata yang pernah dicari. Teks dibuat oleh AI (backend, mode
 * "greeting"); bila AI tidak bisa dihubungi, sapaan cadangan disusun dari
 * potongan kalimat acak + jejak yang sama, sehingga tidak pernah persis sama.
 *
 * Bagian murni (collectActivity, localGreeting, nextVisit) dites di
 * test/ai-greeting.test.js.
 */

export const VISIT_KEY = "kantoong:visit";
export const SEEN_KEY = "kantoong:seen";
export const SESSION_KEY = "kantoong:chat-session";
const SEEN_DAYS = 30;
const DAY = 86400000;

const read = (storage, key, fallback) => {
    try {
        const raw = storage?.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
};
const write = (storage, key, value) => {
    try {
        storage?.setItem(key, JSON.stringify(value));
    } catch {
        // Penyimpanan diblokir: sapaan tetap jalan, hanya tanpa ingatan.
    }
};
const clean = (value, max = 60) => String(value ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max);

/** Catat kunjungan (sekali per sesi tab). Mengembalikan {count, last, prev}. */
export function nextVisit(visit, now = Date.now()) {
    const count = Math.max(0, Number(visit?.count) || 0) + 1;
    return { count, last: now, prev: Number(visit?.last) || 0 };
}

/** Ingat produk yang dilihat (30 hari, maks 20) — dipanggil saat halaman produk dibuka. */
export function rememberSeen(id, { storage = globalThis.localStorage, now = Date.now() } = {}) {
    const key = clean(id, 80);
    if (!key) return;
    const list = (Array.isArray(read(storage, SEEN_KEY, [])) ? read(storage, SEEN_KEY, []) : [])
        .filter((v) => v && v.id !== key && now - Number(v.at) < SEEN_DAYS * DAY);
    list.push({ id: key, at: now });
    write(storage, SEEN_KEY, list.slice(-20));
}

const partOfDay = (hour) => (hour < 4 ? "dini hari" : hour < 11 ? "pagi" : hour < 15 ? "siang" : hour < 19 ? "sore" : "malam");

/**
 * Ringkasan jejak pengunjung (hanya nama produk/kategori & angka, tanpa data pribadi).
 * sources: { visit, seen, trail, cart, wishlist, searches, products, page, userName, now }
 */
export function collectActivity(sources = {}) {
    const now = sources.now ?? Date.now();
    const byId = new Map((sources.products || []).map((p) => [String(p.id), p]));
    const nameOf = (id) => clean(byId.get(String(id))?.name, 50);
    const catOf = (id) => clean(byId.get(String(id))?.category, 40);
    const seenIds = [...(sources.trail || []), ...(sources.seen || [])]
        .filter((v) => v && v.id)
        .sort((a, b) => Number(b.at) - Number(a.at))
        .map((v) => String(v.id));
    const uniq = [...new Set(seenIds)];
    const counts = seenIds.reduce((m, id) => m.set(id, (m.get(id) || 0) + 1), new Map());
    const mostViewed = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const visit = sources.visit || { count: 1, prev: 0 };
    const daysAway = visit.prev ? Math.floor((now - visit.prev) / DAY) : null;
    const hour = new Date(now).getHours();
    return {
        first_visit: (visit.count || 1) <= 1 && !uniq.length,
        visit_count: visit.count || 1,
        days_since_last: daysAway,
        part_of_day: partOfDay(hour),
        page: clean(sources.page, 40),
        name: clean(String(sources.userName || "").split(" ")[0], 24),
        viewed: uniq.map(nameOf).filter(Boolean).slice(0, 5),
        viewed_categories: [...new Set(uniq.map(catOf).filter(Boolean))].slice(0, 3),
        most_viewed: mostViewed && mostViewed[1] > 1 ? nameOf(mostViewed[0]) : "",
        cart: (sources.cart || []).map((it) => clean(it?.name, 50)).filter(Boolean).slice(0, 3),
        wishlist: (sources.wishlist || []).map(nameOf).filter(Boolean).slice(0, 3),
        searches: (sources.searches || []).map((q) => clean(q, 40)).filter(Boolean).slice(0, 3),
    };
}

const pick = (list, rand) => list[Math.floor(rand() * list.length) % list.length];

/** Sapaan cadangan (tanpa AI): susunan acak + jejak, jadi selalu berbeda. */
export function localGreeting(a, rand = Math.random) {
    const hi = a.name
        ? pick([`Hai ${a.name}!`, `Halo ${a.name} 👋`, `Eh, ${a.name}!`, `Hai lagi, ${a.name}!`], rand)
        : pick(["Hai, Kak!", "Halo Kak 👋", "Hai hai!", "Halo!"], rand);
    const time = pick([`Selamat ${a.part_of_day}.`, `Gimana ${a.part_of_day} ini?`, ""], rand);
    let q;
    if (a.cart.length) {
        q = pick([
            `${a.cart[0]} masih nunggu di keranjang nih. Mau aku bantu cek ongkirnya atau cari yang cocok dipaduin?`,
            `Kemarin ${a.cart[0]} udah masuk keranjang. Masih jadi, atau mau bandingin dulu sama yang lain?`,
            `Keranjangmu ada ${a.cart[0]}. Ada yang mau ditanyain sebelum lanjut?`,
        ], rand);
    } else if (a.most_viewed) {
        q = pick([
            `Kayaknya kamu lagi kepikiran ${a.most_viewed} 👀 Mau aku jelasin bedanya sama yang lain?`,
            `${a.most_viewed} udah kamu lihat berkali-kali. Masih ragu di bagian mana?`,
            `Masih naksir ${a.most_viewed}? Ceritain buat apa, nanti aku bantu yakinin.`,
        ], rand);
    } else if (a.viewed.length) {
        q = pick([
            `Terakhir kamu lihat ${a.viewed[0]}. Mau cari yang mirip, atau lagi butuh yang lain?`,
            `Tadi sempat mampir ke ${a.viewed[0]} ya. Ada yang bikin penasaran?`,
            `Lanjut dari ${a.viewed[0]}, mau aku carikan pilihan yang pas buat kamu?`,
        ], rand);
    } else if (a.searches.length) {
        q = `Kamu pernah cari "${a.searches[0]}". Mau aku bantu temukan yang paling cocok?`;
    } else if (a.days_since_last != null && a.days_since_last >= 3) {
        q = pick([`Udah ${a.days_since_last} hari nggak mampir, kangen juga 😄 Lagi butuh apa sekarang?`, "Lama nggak ketemu! Ada yang lagi kamu cari?"], rand);
    } else if (a.first_visit) {
        q = pick([
            "Baru pertama mampir ya? Ceritain kebutuhanmu, nanti aku pilihin yang paling pas.",
            "Selamat datang! Mau aku kenalin produk andalan di sini, atau langsung cari sesuatu?",
            "Pertama kali ke sini? Bilang aja lagi cari apa, aku temenin milih.",
        ], rand);
    } else {
        q = pick([
            "Lagi cari sesuatu yang spesifik, atau mau lihat-lihat dulu?",
            "Ada rencana apa hari ini? Siapa tahu aku bisa bantu cariin.",
            "Mau aku rekomendasiin yang lagi rame dibeli orang?",
        ], rand);
    }
    return [hi, time, q].filter(Boolean).join(" ");
}

/** Efek mengetik per huruf (seperti di video pameran). Mengembalikan fungsi batal. */
export function typewrite(el, text, { speed = 22, onDone, onStep } = {}) {
    if (!el) return () => {};
    const chars = [...String(text ?? "")];
    let i = 0;
    let timer = 0;
    el.textContent = "";
    el.classList.add("is-typing");
    const reduce = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const finish = () => {
        el.textContent = chars.join("");
        el.classList.remove("is-typing");
        onDone?.();
    };
    if (reduce) {
        finish();
        return () => {};
    }
    const step = () => {
        i += 1;
        el.textContent = chars.slice(0, i).join("");
        if (i % 6 === 0) onStep?.();
        if (i >= chars.length) {
            finish();
            return;
        }
        // jeda sedikit lebih lama setelah tanda baca, agar terasa seperti mengetik sungguhan
        const prev = chars[i - 1];
        timer = setTimeout(step, /[.,!?]/.test(prev) ? speed * 6 : speed + Math.random() * speed * 0.6);
    };
    timer = setTimeout(step, speed);
    return () => {
        clearTimeout(timer);
        finish();
    };
}

/** Ambil sapaan dari AI (mode greeting); null bila gagal/terlalu lama. */
export async function fetchAIGreeting(endpoint, activity, { businessId = "", lang = "id", timeoutMs = 7000 } = {}) {
    if (!endpoint) return null;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            credentials: "same-origin",
            signal: ctrl.signal,
            body: JSON.stringify({ mode: "greeting", business_id: businessId, lang, message: "(sapaan pembuka)", activity }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const text = clean(data?.reply, 240);
        return text || null;
    } catch {
        return null;
    } finally {
        clearTimeout(t);
    }
}

/** Kunjungan & sesi: true bila tab ini baru dibuka (chat lama diarsip, mulai chat baru). */
export function beginSession({ storage = globalThis.localStorage, session = globalThis.sessionStorage, now = Date.now() } = {}) {
    let fresh = true;
    try {
        fresh = !session?.getItem(SESSION_KEY);
        session?.setItem(SESSION_KEY, String(now));
    } catch {
        fresh = true;
    }
    let visit = read(storage, VISIT_KEY, null);
    if (fresh || !visit) {
        visit = nextVisit(visit, now);
        write(storage, VISIT_KEY, visit);
    }
    return { fresh, visit };
}
