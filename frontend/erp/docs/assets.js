/**
 * KANTOONG ERP — ASET DOKUMEN (gambar, QR, unduh)
 * File: frontend/erp/docs/assets.js
 */

import QRCode from "qrcode";

/** data:/http(s) gambar → { bytes, type: "png"|"jpg" } atau null (SVG/gagal = dilewati). */
export async function loadImage(src) {
    if (!src) return null;
    try {
        if (String(src).startsWith("data:")) {
            const [head, b64] = String(src).split(",");
            const type = /png/i.test(head) ? "png" : /jpe?g/i.test(head) ? "jpg" : null;
            if (!type || !/;base64/i.test(head)) return null;
            const bin = atob(b64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
            return { bytes, type };
        }
        const res = await fetch(src, { mode: "cors" });
        if (!res.ok) return null;
        const ct = res.headers.get("content-type") || "";
        const type = /png/i.test(ct) ? "png" : /jpe?g/i.test(ct) ? "jpg" : null;
        if (!type) return null;
        return { bytes: new Uint8Array(await res.arrayBuffer()), type };
    } catch {
        return null;
    }
}

/** QR (PNG) untuk alamat verifikasi. */
export async function qrPng(text) {
    const url = await QRCode.toDataURL(text, { errorCorrectionLevel: "M", margin: 1, width: 360, color: { dark: "#12110f", light: "#ffffff" } });
    return loadImage(url);
}

export function saveFile(bytes, filename, mime) {
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Nama file aman: "INV-014-XI-2026 Kafe Senja.pdf". */
export function fileName(model, ext) {
    const base = `${String(model.number || model.title).replace(/[\\/:*?"<>|]+/g, "-")} ${model.summary?.party || ""}`.trim().slice(0, 90);
    return `${base}.${ext}`;
}
