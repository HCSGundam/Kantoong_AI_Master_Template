/**
 * KANTOONG ERP — PERENCANAAN ALAT PDF (murni, dites)
 * File: frontend/erp/core/pdf-plan.js
 *
 * Bagian yang bisa dites tanpa browser: rentang halaman, teks nomor halaman,
 * posisi, dan perbandingan teks dua dokumen.
 */

/** "1-3, 5, 8-" (total 10) → [[1,2,3],[5],[8,9,10]]. Halaman di luar jangkauan dibuang. */
export function parseRanges(text, total) {
    const groups = [];
    String(text || "").split(/[,;]+/).map((p) => p.trim()).filter(Boolean).forEach((part) => {
        const m = part.match(/^(\d*)\s*-\s*(\d*)$/);
        let from;
        let to;
        if (m) {
            from = m[1] ? Number(m[1]) : 1;
            to = m[2] ? Number(m[2]) : total;
        } else if (/^\d+$/.test(part)) {
            from = Number(part);
            to = from;
        } else {
            throw new Error(`Rentang "${part}" tidak dikenal. Contoh: 1-3, 5, 8-`);
        }
        if (from > to) [from, to] = [to, from];
        const pages = [];
        for (let p = Math.max(1, from); p <= Math.min(total, to); p += 1) pages.push(p);
        if (pages.length) groups.push(pages);
    });
    if (!groups.length) throw new Error("Tidak ada halaman yang cocok dengan rentang itu.");
    return groups;
}

/** Pecah tiap N halaman: total 7, N 3 → [[1,2,3],[4,5,6],[7]]. */
export function chunkPages(total, every) {
    const n = Math.max(1, Math.floor(Number(every) || 1));
    const out = [];
    for (let p = 1; p <= total; p += n) out.push(Array.from({ length: Math.min(n, total - p + 1) }, (_, i) => p + i));
    return out;
}

/** Format nomor halaman: "{n}", "{n} / {total}", "Halaman {n} dari {total}". */
export function pageLabel(format, n, total) {
    return String(format || "{n}").replace(/\{n\}/g, String(n)).replace(/\{total\}/g, String(total));
}

/** Posisi teks di halaman (titik PDF, asal kiri bawah). */
export function placeText({ position = "bawah-tengah", pageW, pageH, textW, size, margin = 28 }) {
    const [v, h] = String(position).split("-");
    const x = h === "kiri" ? margin : h === "kanan" ? pageW - margin - textW : (pageW - textW) / 2;
    const y = v === "atas" ? pageH - margin - size : margin;
    return { x, y };
}

/** Milimeter → titik PDF. */
export const mm = (value) => (Number(value) || 0) * 2.834645669;

/**
 * Bandingkan baris teks dua dokumen (LCS). Hasil: [{ type: "sama"|"hapus"|"tambah", text }].
 * Dibatasi 1500 baris per sisi agar tetap ringan di HP.
 */
export function diffLines(a, b) {
    const A = a.slice(0, 1500);
    const B = b.slice(0, 1500);
    const n = A.length;
    const m = B.length;
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i -= 1) {
        for (let j = m - 1; j >= 0; j -= 1) {
            dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }
    const out = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        if (A[i] === B[j]) {
            out.push({ type: "sama", text: A[i] });
            i += 1;
            j += 1;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            out.push({ type: "hapus", text: A[i] });
            i += 1;
        } else {
            out.push({ type: "tambah", text: B[j] });
            j += 1;
        }
    }
    while (i < n) out.push({ type: "hapus", text: A[i++] });
    while (j < m) out.push({ type: "tambah", text: B[j++] });
    return out;
}

export function diffSummary(diff) {
    return {
        added: diff.filter((d) => d.type === "tambah").length,
        removed: diff.filter((d) => d.type === "hapus").length,
        same: diff.filter((d) => d.type === "sama").length,
    };
}
