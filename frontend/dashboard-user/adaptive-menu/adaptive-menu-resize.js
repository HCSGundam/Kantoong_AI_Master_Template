/**
 * KANTOONG CORE — ADAPTIVE MENU: RESIZE
 * File: frontend/dashboard-user/adaptive-menu/adaptive-menu-resize.js
 *
 * Pilihan ukuran kartu (kolom x baris) untuk dashboard.
 * Mobile memakai grid 4 kolom, desktop 10 kolom; tinggi tidak dibatasi
 * oleh grid (kartu dapat dipanjangkan ke bawah).
 *
 * Penarikan pegangan (resize bebas) tetap ada di mode edit; daftar ini
 * adalah jalan pintas supaya mudah dipilih di layar sentuh.
 */

export const SIZE_PRESETS = Object.freeze([
    { width: 2, height: 2 },
    { width: 2, height: 3 },
    { width: 2, height: 4 },
    { width: 2, height: 6 },
    { width: 4, height: 2 },
    { width: 4, height: 3 },
    { width: 4, height: 4 },
    { width: 4, height: 6 },
    { width: 6, height: 2 },
    { width: 6, height: 4 },
    { width: 10, height: 2 },
    { width: 10, height: 4 },
]);

/** Ukuran yang muat pada jumlah kolom grid saat ini. */
export function getSizePresets(columns) {
    return SIZE_PRESETS.filter((preset) => preset.width <= columns);
}

export function formatSize(size) {
    return `${size.width}x${size.height}`;
}

export function parseSize(text) {
    const [width, height] = String(text ?? "")
        .toLowerCase()
        .split("x")
        .map((part) => Number.parseInt(part, 10));

    if (!Number.isInteger(width) || !Number.isInteger(height)) {
        return null;
    }

    if (width < 1 || height < 1) {
        return null;
    }

    return { width, height };
}
