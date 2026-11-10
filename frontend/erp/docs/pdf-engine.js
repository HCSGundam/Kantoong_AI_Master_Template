/**
 * KANTOONG ERP — MESIN ALAT PDF (di perangkat, file TIDAK diunggah)
 * File: frontend/erp/docs/pdf-engine.js
 *
 * pdf-lib  = mengubah struktur PDF (gabung, pisah, putar, watermark, nomor, tanda tangan, potong)
 * pdf.js   = menggambar halaman jadi gambar (pratinjau, PDF→JPG, kompres, sensor, teks untuk banding)
 */

import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { strToU8, zipSync } from "fflate";
import { mm, pageLabel, placeText } from "../core/pdf-plan.js";
import { pdfSafe } from "./render-pdf.js";

let pdfjsPromise = null;
async function pdfjs() {
    if (!pdfjsPromise) {
        pdfjsPromise = Promise.all([
            import("pdfjs-dist"),
            import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
        ]).then(([lib, worker]) => {
            lib.GlobalWorkerOptions.workerSrc = worker.default;
            return lib;
        });
    }
    return pdfjsPromise;
}

export async function readFile(file) {
    return new Uint8Array(await file.arrayBuffer());
}

async function open(bytes) {
    try {
        return await PDFDocument.load(bytes, { ignoreEncryption: false });
    } catch (error) {
        if (/encrypt/i.test(error?.message || "")) throw new Error("PDF ini dikunci password. Buka kuncinya dulu.");
        throw new Error("File ini bukan PDF yang valid atau rusak.");
    }
}

export async function pageCount(bytes) {
    return (await open(bytes)).getPageCount();
}

export async function merge(list) {
    const out = await PDFDocument.create();
    for (const bytes of list) {
        const src = await open(bytes);
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
    }
    return out.save();
}

/** groups: [[1,2,3],[5]] (nomor halaman mulai 1) → satu PDF per kelompok. */
export async function split(bytes, groups) {
    const src = await open(bytes);
    const files = [];
    for (const group of groups) {
        const out = await PDFDocument.create();
        const pages = await out.copyPages(src, group.map((n) => n - 1));
        pages.forEach((p) => out.addPage(p));
        files.push({ name: group.length === 1 ? `halaman-${group[0]}.pdf` : `halaman-${group[0]}-${group.at(-1)}.pdf`, bytes: await out.save() });
    }
    return files;
}

/** order: [{ index (0-based), rotate (derajat tambahan) }] — hapus = tidak dicantumkan. */
export async function organize(bytes, order) {
    const src = await open(bytes);
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, order.map((o) => o.index));
    pages.forEach((p, i) => {
        const extra = order[i].rotate || 0;
        if (extra) p.setRotation(degrees((p.getRotation().angle + extra) % 360));
        out.addPage(p);
    });
    return out.save();
}

export async function rotateAll(bytes, angle) {
    const pdf = await open(bytes);
    pdf.getPages().forEach((p) => p.setRotation(degrees((p.getRotation().angle + angle + 360) % 360)));
    return pdf.save();
}

export async function watermark(bytes, { text, opacity = 0.15, size = 54, angle = 35, color = "#b42318" }) {
    const pdf = await open(bytes);
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
    const safe = pdfSafe(text);
    pdf.getPages().forEach((page) => {
        const { width, height } = page.getSize();
        const w = font.widthOfTextAtSize(safe, size);
        const rad = (angle * Math.PI) / 180;
        page.drawText(safe, {
            x: width / 2 - (w / 2) * Math.cos(rad) + (size / 2) * Math.sin(rad),
            y: height / 2 - (w / 2) * Math.sin(rad) - (size / 2) * Math.cos(rad),
            size, font, color: rgb(r, g, b), opacity: Number(opacity), rotate: degrees(angle),
        });
    });
    return pdf.save();
}

export async function pageNumbers(bytes, { position = "bawah-tengah", format = "{n} / {total}", start = 1, size = 10 }) {
    const pdf = await open(bytes);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const pages = pdf.getPages();
    pages.forEach((page, i) => {
        const label = pdfSafe(pageLabel(format, i + Number(start), pages.length + Number(start) - 1));
        const { width, height } = page.getSize();
        const { x, y } = placeText({ position, pageW: width, pageH: height, textW: font.widthOfTextAtSize(label, size), size });
        page.drawText(label, { x, y, size, font, color: rgb(0.2, 0.2, 0.2) });
    });
    return pdf.save();
}

/** Tanda tangan / stempel gambar PNG di halaman tertentu. x,y,width = pecahan lebar/tinggi halaman (0–1), y dari ATAS. */
export async function stamp(bytes, { png, page = 1, x = 0.6, y = 0.8, width = 0.28, allPages = false }) {
    const pdf = await open(bytes);
    const img = await pdf.embedPng(png);
    const targets = allPages ? pdf.getPages() : [pdf.getPage(Math.min(pdf.getPageCount(), Math.max(1, page)) - 1)];
    targets.forEach((p) => {
        const { width: W, height: H } = p.getSize();
        const w = W * width;
        const h = (img.height / img.width) * w;
        p.drawImage(img, { x: W * x, y: H - H * y - h / 2, width: w, height: h });
    });
    return pdf.save();
}

export async function crop(bytes, { top = 0, right = 0, bottom = 0, left = 0 }) {
    const pdf = await open(bytes);
    pdf.getPages().forEach((p) => {
        const { width, height } = p.getSize();
        const box = { x: mm(left), y: mm(bottom), w: width - mm(left) - mm(right), h: height - mm(top) - mm(bottom) };
        if (box.w < 20 || box.h < 20) throw new Error("Potongan terlalu besar — halaman habis.");
        p.setCropBox(box.x, box.y, box.w, box.h);
        p.setMediaBox(box.x, box.y, box.w, box.h);
    });
    return pdf.save();
}

/** Foto/gambar → PDF. fit "a4" = di tengah A4 dengan margin; "asli" = halaman seukuran gambar. */
export async function imagesToPdf(files, { fit = "a4", margin = 24 } = {}) {
    const pdf = await PDFDocument.create();
    for (const file of files) {
        let bytes = await readFile(file);
        let type = /png/i.test(file.type) ? "png" : /jpe?g/i.test(file.type) ? "jpg" : null;
        if (!type) {
            // HEIC/WebP dll: ubah lewat kanvas jadi JPEG dulu.
            const blob = await toJpeg(file);
            bytes = new Uint8Array(await blob.arrayBuffer());
            type = "jpg";
        }
        const img = type === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
        if (fit === "asli") {
            const page = pdf.addPage([img.width, img.height]);
            page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        } else {
            const landscape = img.width > img.height;
            const [W, H] = landscape ? [841.89, 595.28] : [595.28, 841.89];
            const page = pdf.addPage([W, H]);
            const scale = Math.min((W - margin * 2) / img.width, (H - margin * 2) / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            page.drawImage(img, { x: (W - w) / 2, y: (H - h) / 2, width: w, height: h });
        }
    }
    return pdf.save();
}

async function toJpeg(file, quality = 0.9) {
    const bitmap = await createImageBitmap(file);
    const canvas = Object.assign(document.createElement("canvas"), { width: bitmap.width, height: bitmap.height });
    canvas.getContext("2d").drawImage(bitmap, 0, 0);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/** Gambar halaman → kanvas (pdf.js). */
export async function renderPages(bytes, { scale = 1.5, pages = null, onPage = null } = {}) {
    const lib = await pdfjs();
    const task = lib.getDocument({ data: bytes.slice() });
    const doc = await task.promise;
    const out = [];
    const list = pages || Array.from({ length: doc.numPages }, (_, i) => i + 1);
    for (const n of list) {
        const page = await doc.getPage(n);
        const viewport = page.getViewport({ scale });
        const canvas = Object.assign(document.createElement("canvas"), { width: Math.ceil(viewport.width), height: Math.ceil(viewport.height) });
        const g = canvas.getContext("2d");
        g.fillStyle = "#fff";
        g.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: g, canvas, viewport }).promise;
        out.push({ page: n, canvas, width: viewport.width / scale, height: viewport.height / scale });
        onPage?.(n, doc.numPages);
    }
    await task.destroy(); // pdf.js v6: bebaskan worker lewat loading task
    return out;
}

export async function thumbnails(bytes, width = 160) {
    const rendered = await renderPages(bytes, { scale: 0.35 });
    return rendered.map((r) => ({ page: r.page, src: r.canvas.toDataURL("image/jpeg", 0.7), ratio: r.height / r.width, width }));
}

const canvasBlob = (canvas, type = "image/jpeg", q = 0.85) => new Promise((resolve) => canvas.toBlob(resolve, type, q));

export async function toImages(bytes, { scale = 2, quality = 0.9, onPage } = {}) {
    const rendered = await renderPages(bytes, { scale, onPage });
    const files = [];
    for (const r of rendered) files.push({ name: `halaman-${r.page}.jpg`, bytes: new Uint8Array(await (await canvasBlob(r.canvas, "image/jpeg", quality)).arrayBuffer()) });
    return files;
}

/** Bangun PDF baru dari kanvas (dipakai kompres & sensor). */
async function canvasesToPdf(rendered, quality, keep = null, original = null) {
    const out = await PDFDocument.create();
    const src = original ? await open(original) : null;
    for (const r of rendered) {
        if (keep?.has(r.page) && src) {
            const [p] = await out.copyPages(src, [r.page - 1]);
            out.addPage(p);
            continue;
        }
        const jpg = await out.embedJpg(new Uint8Array(await (await canvasBlob(r.canvas, "image/jpeg", quality)).arrayBuffer()));
        const page = out.addPage([r.width, r.height]);
        page.drawImage(jpg, { x: 0, y: 0, width: r.width, height: r.height });
    }
    return out.save();
}

/** Kompres: halaman digambar ulang sebagai JPEG. level "ringan"|"sedang"|"kuat". */
export async function compress(bytes, level = "sedang", onPage) {
    const preset = { ringan: [1.6, 0.8], sedang: [1.25, 0.65], kuat: [1, 0.45] }[level] || [1.25, 0.65];
    const rendered = await renderPages(bytes, { scale: preset[0], onPage });
    const out = await canvasesToPdf(rendered, preset[1]);
    return out.length < bytes.length ? out : bytes;
}

/**
 * Sensor PERMANEN: halaman yang diberi kotak digambar ulang jadi gambar
 * (teks di bawah kotak benar-benar hilang, tidak bisa disalin). boxes: { [page]: [{x,y,w,h} pecahan] }
 */
export async function redact(bytes, boxes) {
    const pages = Object.keys(boxes).map(Number).filter((n) => boxes[n]?.length);
    if (!pages.length) throw new Error("Belum ada area yang disensor.");
    const all = await pageCount(bytes);
    const rendered = await renderPages(bytes, { scale: 2 });
    rendered.forEach((r) => {
        (boxes[r.page] || []).forEach((b) => {
            const g = r.canvas.getContext("2d");
            g.fillStyle = "#000";
            g.fillRect(b.x * r.canvas.width, b.y * r.canvas.height, b.w * r.canvas.width, b.h * r.canvas.height);
        });
    });
    const keep = new Set(Array.from({ length: all }, (_, i) => i + 1).filter((n) => !pages.includes(n)));
    return canvasesToPdf(rendered, 0.9, keep, bytes);
}

/** Teks per baris (untuk banding dokumen). */
export async function extractLines(bytes) {
    const lib = await pdfjs();
    const task = lib.getDocument({ data: bytes.slice() });
    const doc = await task.promise;
    const lines = [];
    for (let n = 1; n <= doc.numPages; n += 1) {
        const content = await (await doc.getPage(n)).getTextContent();
        let row = "";
        let lastY = null;
        content.items.forEach((item) => {
            const y = Math.round(item.transform?.[5] ?? 0);
            if (lastY != null && Math.abs(y - lastY) > 2) {
                if (row.trim()) lines.push(row.trim());
                row = "";
            }
            row += item.str + (item.hasEOL ? "" : "");
            lastY = y;
        });
        if (row.trim()) lines.push(row.trim());
    }
    await task.destroy(); // pdf.js v6: bebaskan worker lewat loading task
    return lines;
}

export function zipFiles(files) {
    return zipSync(Object.fromEntries(files.map((f) => [f.name, f.bytes instanceof Uint8Array ? f.bytes : strToU8(String(f.bytes))])));
}
