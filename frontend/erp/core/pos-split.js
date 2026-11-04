/**
 * KANTOONG ERP — SPLIT BILL & ANTRIAN OFFLINE (Tahap 6 POS Pro) — logika murni, dites otomatis
 * File: frontend/erp/core/pos-split.js
 *
 * SPLIT BILL — "kenapa bayar patungan selalu ribet?"
 *   - per item: tiap orang memilih yang ia makan, dapat struk SENDIRI (pajak & service dihitung ulang)
 *   - bagi rata: total dibagi N orang, sisa pembulatan masuk orang terakhir
 * ANTRIAN OFFLINE — "apa yang terjadi kalau internet mati?"
 *   - kasir tetap berjualan; transaksi disimpan di perangkat lalu disinkronkan
 *   - yang ditolak server TIDAK hilang diam-diam: ditandai untuk dicek supervisor
 */

/** Bagi rata: N bagian, dibulatkan ke atas per bagian, sisa (lebih kecil) di orang terakhir. */
export function equalShares(total, people, rounding = 100) {
    const amount = Math.max(0, Math.round(Number(total) || 0));
    const count = Math.min(Math.max(Math.floor(Number(people) || 1), 1), 20);
    if (count === 1) return [amount];
    const step = Math.max(1, Number(rounding) || 1);
    let share = Math.ceil(amount / count / step) * step;
    if (share * (count - 1) > amount) share = Math.floor(amount / count / step) * step;
    return [...Array(count - 1).fill(share), amount - share * (count - 1)];
}

/**
 * Pisahkan pesanan. picks = { [lineKey]: qty untuk bagian ini }.
 * Mengembalikan { part, rest } — keduanya baris keranjang (qty > 0).
 */
export function splitLines(lines = [], picks = {}) {
    const part = [];
    const rest = [];
    for (const line of lines) {
        const take = Math.min(Math.max(Math.floor(Number(picks[line.key]) || 0), 0), line.qty);
        if (take > 0) part.push({ ...line, qty: take });
        if (line.qty - take > 0) rest.push({ ...line, qty: line.qty - take });
    }
    return { part, rest };
}

/* ---------- Antrian offline (penyimpanan disuntikkan: localStorage / tiruan saat tes) ---------- */

export const OFFLINE_KEY = "kantoong:pos-offline-queue";

export function readQueue(storage) {
    try {
        const list = JSON.parse(storage?.getItem(OFFLINE_KEY) || "[]");
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

function writeQueue(storage, list) {
    try {
        storage?.setItem(OFFLINE_KEY, JSON.stringify(list));
        return true;
    } catch {
        return false;
    }
}

/** Simpan transaksi offline. Nomor struk sementara: OFF-<tanggal>-<urut>. */
export function enqueue(storage, payload, preview, now = new Date()) {
    const list = readQueue(storage);
    const day = new Date(new Date(now).getTime() + 7 * 3600000).toISOString().slice(2, 10).replace(/-/g, "");
    const serial = list.filter((entry) => entry.id.startsWith(`OFF-${day}`)).length + 1;
    const entry = {
        id: `OFF-${day}-${String(serial).padStart(3, "0")}`,
        payload: { ...payload, offline_at: new Date(now).toISOString() },
        preview,
        queued_at: new Date(now).toISOString(),
        error: null,
    };
    list.push(entry);
    if (!writeQueue(storage, list)) throw new Error("Penyimpanan perangkat penuh/terblokir: transaksi offline tidak bisa disimpan.");
    return entry;
}

export function removeFromQueue(storage, id) {
    writeQueue(storage, readQueue(storage).filter((entry) => entry.id !== id));
}

/** Gangguan jaringan (bukan penolakan server). */
export function isNetworkError(error) {
    const text = String(error?.message || error || "");
    return error?.name === "TypeError" && /fetch|network|load failed/i.test(text)
        || /Failed to fetch|NetworkError|network request failed|ERR_INTERNET|offline/i.test(text);
}

/**
 * Kirim antrian satu per satu (urutan waktu). Berhasil = dihapus; gangguan jaringan = berhenti;
 * ditolak server = tetap disimpan dengan pesan kesalahan (untuk dicek supervisor).
 */
export async function syncQueue(storage, send) {
    const result = { synced: [], failed: [], remaining: 0, stopped: false };
    for (const entry of readQueue(storage)) {
        try {
            const sale = await send(entry.payload);
            removeFromQueue(storage, entry.id);
            result.synced.push({ id: entry.id, sale });
        } catch (error) {
            if (isNetworkError(error)) {
                result.stopped = true;
                break;
            }
            const list = readQueue(storage).map((row) => (row.id === entry.id ? { ...row, error: String(error?.message || error) } : row));
            writeQueue(storage, list);
            result.failed.push({ id: entry.id, error: String(error?.message || error) });
        }
    }
    result.remaining = readQueue(storage).length;
    return result;
}
