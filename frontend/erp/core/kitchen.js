/**
 * KANTOONG ERP — DAPUR & ANTRIAN (Tahap 2 POS Pro) — logika murni, dites otomatis
 * File: frontend/erp/core/kitchen.js
 *
 * Fondasi (sama seperti aplikasi lain): tiket otomatis ke BAR / DAPUR,
 * status Baru → Dibuat → Siap → Diambil, nomor antrian.
 *
 * Lapisan Zero-to-One (pertanyaan terbalik):
 *   1. ETA JUJUR — "Kenapa pelanggan kesal? Bukan karena lama, tapi karena
 *      TIDAK TAHU berapa lama." Perkiraan siap dihitung dari antrian nyata
 *      dan waktu pembuatan yang DIPELAJARI dari tiket sebelumnya (bukan
 *      angka tebakan). Dicetak di struk & tampil di layar antrian.
 *   2. DAPUR PREDIKTIF — "Kenapa dapur selalu kelabakan? Karena hanya
 *      bereaksi." Dapur diberi tahu apa yang perlu disiapkan 30 menit ke
 *      depan dari pola jam yang sama di hari-hari sebelumnya + produk yang
 *      sedang ramai ditanyakan di chat AI Kantoong (sinyal yang tidak
 *      dimiliki POS lain).
 */

export const DRINK_PATTERN = /miloat|kopi|coffee|teh|tea|latte|milk|susu|choco|coklat|cokelat|matcha|jus|juice|minum|drink|grass|frambo|boba|soda|(?:^|\s)es(?:\s|$)/i;

export const STATIONS = Object.freeze({
    bar: { label: "Bar", icon: "🥤", prep: 3 },
    dapur: { label: "Dapur", icon: "🍳", prep: 7 },
});

export const TICKET_STATUS = Object.freeze({
    baru: "Baru",
    dibuat: "Sedang dibuat",
    siap: "Siap diambil",
    diambil: "Sudah diambil",
});

const MINUTE = 60000;

/** Minuman ke bar, selain itu ke dapur. */
export function stationOf(product) {
    return DRINK_PATTERN.test(`${product?.name || ""} ${product?.category || ""}`) ? "bar" : "dapur";
}

/** Nomor antrian harian: A-001, A-002, ... */
export function queueCode(serial) {
    return `A-${String(Math.max(1, Math.floor(serial))).padStart(3, "0")}`;
}

/**
 * Item pesanan (hasil priceOrder) -> tiket per station.
 * Hanya yang perlu dibuat; tiap tiket membawa nama, jumlah, pilihan & catatan.
 */
export function splitTickets(items = [], products = []) {
    const byStation = {};
    for (const item of items) {
        const product = products.find((entry) => String(entry.id) === String(item.product_id)) || { name: item.name };
        const station = stationOf(product);
        (byStation[station] ||= []).push({
            product_id: String(item.product_id),
            name: item.name,
            qty: item.qty,
            options: (item.options || []).map((option) => option.name),
            note: item.note || "",
        });
    }
    return Object.entries(byStation).map(([station, lines]) => ({ station, items: lines }));
}

const median = (values) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Belajar waktu pembuatan dari tiket yang sudah selesai.
 * Per produk (tiket satu produk, ≥3 contoh) → per station (≥3 contoh) → bawaan.
 */
export function learnPrepTimes(tickets = []) {
    const perProduct = {};
    const perStation = {};
    for (const ticket of tickets) {
        if (!ticket.ready_at) continue;
        const start = new Date(ticket.started_at || ticket.created_at).getTime();
        const minutes = (new Date(ticket.ready_at).getTime() - start) / MINUTE;
        if (!(minutes > 0 && minutes < 120)) continue;
        const units = ticket.items.reduce((sum, item) => sum + item.qty, 0);
        const single = minutes - 0.4 * Math.max(0, units - 1);
        (perStation[ticket.station] ||= []).push(single);
        const products = new Set(ticket.items.map((item) => item.product_id));
        if (products.size === 1) (perProduct[[...products][0]] ||= []).push(single);
    }
    const product = {};
    for (const [id, values] of Object.entries(perProduct)) if (values.length >= 3) product[id] = median(values);
    const station = {};
    for (const [id, values] of Object.entries(perStation)) if (values.length >= 3) station[id] = median(values);
    const samples = Object.values(perStation).reduce((sum, values) => sum + values.length, 0);
    return { product, station, samples };
}

/** Lama membuat satu tiket (menit): item terlama + 0,4 menit per porsi tambahan. */
export function ticketMinutes(ticket, prep = { product: {}, station: {} }) {
    const base = STATIONS[ticket.station]?.prep || 5;
    const stationTime = prep.station?.[ticket.station] ?? base;
    let longest = 0;
    let units = 0;
    for (const item of ticket.items) {
        longest = Math.max(longest, prep.product?.[item.product_id] ?? stationTime);
        units += item.qty;
    }
    return Math.max(1, longest + 0.4 * Math.max(0, units - 1));
}

/**
 * Perkiraan siap tiap tiket aktif (Baru / Sedang dibuat), per station,
 * dengan sejumlah pekerja (capacity). Mengembalikan { [ticketId]: waktuSiapMs }.
 */
export function estimateReady(tickets = [], prep, now = Date.now(), capacity = { bar: 1, dapur: 1 }) {
    const result = {};
    const stations = [...new Set(tickets.map((ticket) => ticket.station))];
    for (const station of stations) {
        const workers = Array.from({ length: Math.max(1, Number(capacity[station]) || 1) }, () => now);
        const active = tickets
            .filter((ticket) => ticket.station === station && (ticket.status === "baru" || ticket.status === "dibuat"))
            .sort((a, b) => (a.status === "dibuat" ? 0 : 1) - (b.status === "dibuat" ? 0 : 1) || a.created_at.localeCompare(b.created_at));

        for (const ticket of active) {
            const minutes = ticketMinutes(ticket, prep);
            workers.sort((a, b) => a - b);
            let finish;
            if (ticket.status === "dibuat") {
                const started = new Date(ticket.started_at || ticket.created_at).getTime();
                // Sudah lewat perkiraan: anggap selesai sebentar lagi (jujur, tidak berpura-pura tepat).
                finish = Math.max(started + minutes * MINUTE, now + MINUTE);
            } else {
                finish = Math.max(workers[0], now) + minutes * MINUTE;
            }
            workers[0] = finish;
            result[ticket.id] = finish;
        }
    }
    return result;
}

/** Perkiraan siap satu pesanan (gabungan semua tiketnya). */
export function orderReadyAt(queueNo, tickets, etaMap) {
    const times = tickets.filter((ticket) => ticket.queue_no === queueNo && etaMap[ticket.id]).map((ticket) => etaMap[ticket.id]);
    return times.length ? Math.max(...times) : null;
}

/** Warna antrian: hijau < 8 menit, kuning < 15, merah selebihnya. */
export function slaTone(createdAt, now = Date.now()) {
    const minutes = (now - new Date(createdAt).getTime()) / MINUTE;
    return minutes < 8 ? "ok" : minutes < 15 ? "warn" : "late";
}

/* ---------- Dapur prediktif ---------- */

const minuteOfDayWib = (date) => {
    const local = new Date(new Date(date).getTime() + 7 * 3600000);
    return local.getUTCHours() * 60 + local.getUTCMinutes();
};
const dayWib = (date) => new Date(new Date(date).getTime() + 7 * 3600000).toISOString().slice(0, 10);

/**
 * Perkiraan permintaan `windowMin` menit ke depan dari hari-hari sebelumnya
 * pada jam yang sama (rata-rata per hari yang punya data), ditambah tanda
 * 🔥 untuk produk yang sedang ramai ditanyakan di chat AI (aiEvents 2 jam terakhir).
 */
export function forecastPrep(sales = [], now = new Date(), { windowMin = 30, lookbackDays = 28, aiEvents = [], products = [] } = {}) {
    const today = dayWib(now);
    const start = minuteOfDayWib(now);
    const end = start + windowMin;
    const since = new Date(now).getTime() - lookbackDays * 86400000;
    const inWindow = (minute) => (end <= 1440 ? minute >= start && minute < end : minute >= start || minute < end - 1440);

    const days = new Set();
    const qty = {};
    const names = {};
    for (const sale of sales) {
        const at = new Date(sale.created_at).getTime();
        if (at < since || dayWib(sale.created_at) === today || sale.status === "batal") continue;
        days.add(dayWib(sale.created_at));
        if (!inWindow(minuteOfDayWib(sale.created_at))) continue;
        for (const item of sale.items || []) {
            const id = String(item.product_id);
            qty[id] = (qty[id] || 0) + (Number(item.qty) || 0);
            names[id] = item.name;
        }
    }

    // Sinyal unik: minat di chat AI 2 jam terakhir, dicocokkan ke produk lewat nama.
    const hot = {};
    const recent = new Date(now).getTime() - 2 * 3600000;
    for (const event of aiEvents) {
        if (new Date(event.at).getTime() < recent || !event.product_name) continue;
        const product = products.find((entry) => entry.name === event.product_name || String(entry.id) === String(event.product_id));
        if (product) hot[String(product.id)] = (hot[String(product.id)] || 0) + 1;
    }

    const dayCount = Math.max(1, days.size);
    const ids = new Set([...Object.keys(qty), ...Object.keys(hot)]);
    return [...ids]
        .map((id) => {
            const expected = (qty[id] || 0) / dayCount;
            const product = products.find((entry) => String(entry.id) === id);
            return {
                product_id: id,
                name: names[id] || product?.name || id,
                station: stationOf(product || { name: names[id] }),
                expected: Math.round(expected * 10) / 10,
                suggest: Math.max(hot[id] >= 3 ? 1 : 0, Math.round(expected)),
                hot: hot[id] || 0,
            };
        })
        .filter((row) => row.suggest > 0)
        .sort((a, b) => b.suggest - a.suggest || b.hot - a.hot)
        .slice(0, 8)
        .map((row) => ({ ...row, basis: dayCount }));
}
