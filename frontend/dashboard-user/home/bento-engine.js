/**
 * KANTOONG — MESIN GRID BENTO (murni, tanpa DOM, dites)
 * File: frontend/dashboard-user/home/bento-engine.js
 *
 * Konsep: kartu disusun MENURUT URUTAN (seperti layar HP), bukan
 * koordinat bebas. Setiap kartu punya ukuran (kolom x baris). Mesin
 * mengisi grid dari kiri-atas dan otomatis menambal lubang kosong.
 *
 * Karena posisi selalu dihitung ulang dari urutan + ukuran:
 * - geser kartu  = ubah urutan  -> kartu lain ikut bergeser rapi;
 * - ubah ukuran  = ubah ukuran  -> kartu lain ikut menyesuaikan;
 * - tidak pernah ada kartu bertumpuk atau lubang aneh.
 */

/** Batas ukuran kartu: lebar 1..jumlah kolom, tinggi 1..MAX_H sel. */
export const MAX_H = 6;
export const MAX_W = 8;
export const DEFAULT_SIZE = "2x2";

/** "4x3" -> { w: 4, h: 3 }. Ukuran tidak sah -> null. */
export function parseSize(id) {
    const m = /^(\d+)x(\d+)$/.exec(String(id ?? ""));
    if (!m) return null;
    const w = Number(m[1]);
    const h = Number(m[2]);
    if (w < 1 || h < 1 || w > MAX_W || h > MAX_H) return null;
    return { w, h };
}

export const isValidSize = (id) => parseSize(id) !== null;

/**
 * Tata letak isi kartu menurut ukurannya:
 * icon (1 kolom) · pill (1 baris) · row (lebar) · tall (tinggi) · box (biasa).
 */
export function modeFor(w, h) {
    if (w === 1) return "icon";
    if (h === 1) return "pill";
    if (w >= h * 2) return "row";
    if (h >= 3) return "tall";
    return "box";
}

/** Kolom grid menurut lebar wadah grid (dalam px). */
export function columnsFor(width) {
    if (width >= 900) return 8;
    if (width >= 560) return 6;
    return 4;
}

export function sizeOf(id) {
    return parseSize(id) ?? parseSize(DEFAULT_SIZE);
}

/** Ukuran dibatasi jumlah kolom (kartu 4 kolom di grid 4 = penuh). */
export function fitSize(id, columns) {
    const s = sizeOf(id);
    return { w: Math.min(s.w, columns), h: s.h };
}

/**
 * Ukuran dari hasil tarikan pegangan (dalam sel, boleh pecahan):
 * dibulatkan ke sel terdekat. Bebas: 1..kolom x 1..MAX_H.
 */
export function nearestSize(wCells, hCells, columns) {
    const w = Math.min(Math.max(1, Math.round(wCells)), Math.max(1, Math.min(columns, MAX_W)));
    const h = Math.min(Math.max(1, Math.round(hCells)), MAX_H);
    return `${w}x${h}`;
}

/**
 * Susun kartu: setiap kartu ditaruh di posisi kosong pertama
 * (baris demi baris, kiri ke kanan) sesuai urutan.
 * items: [{ id, size }]  ->  [{ id, x, y, w, h }]
 */
export function packLayout(items, columns) {
    const cols = Math.max(1, Math.floor(columns));
    const filled = [];
    const isFree = (x, y, w, h) => {
        for (let yy = y; yy < y + h; yy++) {
            const row = filled[yy];
            if (!row) continue;
            for (let xx = x; xx < x + w; xx++) if (row[xx]) return false;
        }
        return true;
    };
    const mark = (x, y, w, h) => {
        for (let yy = y; yy < y + h; yy++) {
            filled[yy] = filled[yy] || [];
            for (let xx = x; xx < x + w; xx++) filled[yy][xx] = true;
        }
    };

    return items.map((item) => {
        const { w, h } = fitSize(item.size, cols);
        for (let y = 0; ; y++) {
            for (let x = 0; x + w <= cols; x++) {
                if (isFree(x, y, w, h)) {
                    mark(x, y, w, h);
                    return { id: item.id, x, y, w, h };
                }
            }
        }
    });
}

/**
 * Tampilan saja (bukan mode atur): kartu melebar ke kanan mengisi sel kosong di
 * barisnya, supaya tidak ada "lubang" di HP (mis. 1x1 + 2x2 di 4 kolom).
 * Ukuran tersimpan pengguna TIDAK berubah.
 */
export function fillGaps(placed, columns) {
    const cols = Math.max(1, Math.floor(columns));
    const grid = [];
    const taken = (x, y) => grid[y]?.[x];
    placed.forEach((p) => {
        for (let yy = p.y; yy < p.y + p.h; yy++) {
            grid[yy] = grid[yy] || [];
            for (let xx = p.x; xx < p.x + p.w; xx++) grid[yy][xx] = true;
        }
    });
    return placed.map((p) => {
        let w = p.w;
        const free = (x) => {
            for (let yy = p.y; yy < p.y + p.h; yy++) if (taken(x, yy)) return false;
            return true;
        };
        while (p.x + w < cols && free(p.x + w)) {
            for (let yy = p.y; yy < p.y + p.h; yy++) grid[yy][p.x + w] = true;
            w += 1;
        }
        return w === p.w ? p : { ...p, w };
    });
}

/** Jumlah baris yang terpakai. */
export function rowsUsed(placed) {
    return placed.reduce((max, p) => Math.max(max, p.y + p.h), 0);
}

/** Pindahkan kartu ke urutan baru (dipakai saat menggeser). */
export function moveItem(items, id, toIndex) {
    const from = items.findIndex((it) => it.id === id);
    if (from < 0) return items.slice();
    const next = items.slice();
    const [moved] = next.splice(from, 1);
    const at = Math.max(0, Math.min(next.length, toIndex));
    next.splice(at, 0, moved);
    return next;
}

/**
 * Urutan tujuan dari posisi jari/kursor (dalam sel).
 * Kartu yang sedang digeser diabaikan; kursor jatuh "di atas" kartu
 * lain = kartu digeser masuk ke urutan kartu itu.
 */
export function indexAtCell(placed, draggedId, cellX, cellY) {
    const others = placed.filter((p) => p.id !== draggedId);
    for (let i = 0; i < others.length; i++) {
        const p = others[i];
        if (cellX >= p.x && cellX < p.x + p.w && cellY >= p.y && cellY < p.y + p.h) {
            // Separuh kiri/atas kartu = sebelum, separuh kanan/bawah = sesudah.
            const after = (cellX - p.x) / p.w + (cellY - p.y) / p.h > 1;
            return after ? i + 1 : i;
        }
    }
    // Di ruang kosong: cari kartu terakhir sebelum titik itu.
    let index = 0;
    for (let i = 0; i < others.length; i++) {
        const p = others[i];
        if (p.y < cellY || (p.y === cellY && p.x <= cellX)) index = i + 1;
    }
    return index;
}

/* ---------- Simpan / muat ---------- */

export function sanitizeState(raw, activeIds, defaults = {}) {
    const ids = [...activeIds].map(String);
    const known = new Set(ids);
    const order = Array.isArray(raw?.order)
        ? raw.order.map(String).filter((id, i, arr) => known.has(id) && arr.indexOf(id) === i)
        : [];
    ids.forEach((id) => {
        if (!order.includes(id)) order.push(id);
    });
    const sizes = {};
    order.forEach((id) => {
        const wanted = raw?.sizes?.[id] ?? defaults[id] ?? DEFAULT_SIZE;
        sizes[id] = isValidSize(wanted) ? wanted : DEFAULT_SIZE;
    });
    return { order, sizes };
}

export function toItems(state) {
    return state.order.map((id) => ({ id, size: state.sizes[id] ?? DEFAULT_SIZE }));
}
