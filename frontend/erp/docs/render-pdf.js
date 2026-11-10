/**
 * KANTOONG ERP — MODEL DOKUMEN → PDF (pdf-lib, di perangkat)
 * File: frontend/erp/docs/render-pdf.js
 *
 * A4, kop surat brand (logo + alamat + garis emas), isi, tanda tangan,
 * QR keaslian di kiri bawah, nomor halaman di kaki.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { longDate } from "../core/documents.js";
import { loadImage, qrPng } from "./assets.js";

const A4 = [595.28, 841.89];
const M = 52; // margin
const INK = rgb(0.07, 0.067, 0.06);
const MUTED = rgb(0.42, 0.4, 0.37);
const GOLD = rgb(0.79, 0.64, 0.15);
const SOFT = rgb(0.95, 0.94, 0.91);

const MAP = { "−": "-", "≤": "<=", "≥": ">=", "→": "->", "✓": "v", "•": "•", " ": " " };
/** Font standar PDF (WinAnsi) tidak punya semua huruf: ganti/bersihkan yang tidak didukung. */
export function pdfSafe(text) {
    return String(text ?? "")
        .replace(/[−≤≥→✓ ]/g, (c) => MAP[c])
        .replace(/[^\x20-\x7E\xA0-\xFF–—‘’“”•…€\n]/g, "");
}

function wrap(text, font, size, width) {
    const lines = [];
    String(text).split("\n").forEach((para) => {
        let line = "";
        para.split(/\s+/).forEach((word) => {
            const next = line ? `${line} ${word}` : word;
            if (font.widthOfTextAtSize(next, size) <= width) {
                line = next;
            } else {
                if (line) lines.push(line);
                // Kata yang lebih panjang dari baris: potong paksa.
                let rest = word;
                while (font.widthOfTextAtSize(rest, size) > width && rest.length > 1) {
                    let cut = rest.length - 1;
                    while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut -= 1;
                    lines.push(rest.slice(0, cut));
                    rest = rest.slice(cut);
                }
                line = rest;
            }
        });
        lines.push(line);
    });
    return lines;
}

/**
 * model: dari core/documents.buildDocument
 * opts: { brand: { name, logo, address, phone, email, website }, verify: { url, code }, signature: dataURL, stamp?: "DRAF" }
 */
export async function renderPdf(model, opts = {}) {
    const pdf = await PDFDocument.create();
    pdf.setTitle(pdfSafe(`${model.title} ${model.number}`));
    pdf.setAuthor(pdfSafe(opts.brand?.name || "Kantoong"));
    pdf.setCreator("Kantoong ERP");
    pdf.setProducer("Kantoong ERP");
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

    const embed = async (img) => {
        if (!img) return null;
        try {
            return img.type === "png" ? await pdf.embedPng(img.bytes) : await pdf.embedJpg(img.bytes);
        } catch {
            return null;
        }
    };
    const logo = await embed(await loadImage(opts.brand?.logo));
    const signature = await embed(await loadImage(opts.signature));
    const qr = opts.verify?.url ? await embed(await qrPng(opts.verify.url)) : null;

    const W = A4[0] - M * 2;
    let page;
    let y;
    const pages = [];

    const text = (str, x, yy, { f = font, size = 10, color = INK, align = "left", width = W } = {}) => {
        const s = pdfSafe(str);
        let xx = x;
        if (align !== "left") {
            const tw = f.widthOfTextAtSize(s, size);
            xx = align === "right" ? x + width - tw : x + (width - tw) / 2;
        }
        page.drawText(s, { x: xx, y: yy, size, font: f, color });
    };

    const newPage = (first = false) => {
        page = pdf.addPage(A4);
        pages.push(page);
        y = A4[1] - M;
        if (first) {
            // Kop surat
            let x = M;
            if (logo) {
                const h = 46;
                const w = Math.min(120, (logo.width / logo.height) * h);
                page.drawImage(logo, { x, y: y - h + 6, width: w, height: h });
                x += w + 14;
            }
            text(opts.brand?.name || "", x, y - 10, { f: bold, size: 16 });
            const contact = [opts.brand?.address, [opts.brand?.phone, opts.brand?.email, opts.brand?.website].filter(Boolean).join("  ·  ")].filter(Boolean);
            contact.forEach((line, i) => {
                wrap(pdfSafe(line), font, 8.5, W - (x - M)).slice(0, 2).forEach((l, j) => text(l, x, y - 26 - (i * 2 + j) * 11, { size: 8.5, color: MUTED }));
            });
            y -= 62;
            page.drawRectangle({ x: M, y, width: W, height: 1.6, color: GOLD });
            page.drawRectangle({ x: M, y: y - 3, width: W, height: 0.4, color: INK });
            y -= 30;
        } else {
            text(`${model.title} · ${model.number}`, M, y - 4, { size: 8.5, color: MUTED });
            y -= 26;
        }
        if (opts.stamp) {
            page.drawText(pdfSafe(opts.stamp), { x: 120, y: 360, size: 96, font: bold, color: rgb(0.85, 0.2, 0.15), opacity: 0.08, rotate: { type: "degrees", angle: 35 } });
        }
    };

    const ensure = (h) => {
        if (y - h < M + 92) newPage(false); // sisakan ruang QR & kaki
    };

    newPage(true);

    // Judul, nomor, tanggal
    text(model.title, M, y, { f: bold, size: 15, align: "center" });
    y -= 16;
    text(`Nomor: ${model.number}`, M, y, { size: 9.5, color: MUTED, align: "center" });
    y -= 12;
    if (model.subject) {
        text(model.subject, M, y, { f: italic, size: 9.5, color: MUTED, align: "center" });
        y -= 12;
    }
    y -= 10;
    text(`${model.sign?.city ? `${model.sign.city}, ` : ""}${longDate(model.date)}`, M, y, { size: 10, align: "right" });
    y -= 20;

    if (model.to?.name) {
        text("Kepada Yth.", M, y, { size: 10, color: MUTED });
        y -= 14;
        text(model.to.name, M, y, { f: bold, size: 10.5 });
        y -= 13;
        (model.to.lines || []).forEach((line) => {
            wrap(pdfSafe(line), font, 10, W * 0.6).forEach((l) => {
                text(l, M, y, { size: 10 });
                y -= 13;
            });
        });
        y -= 10;
    }

    for (const block of model.blocks) {
        if (block.type === "heading") {
            ensure(30);
            y -= 4;
            text(block.text, M, y, { f: bold, size: 11.5 });
            y -= 18;
        } else if (block.type === "para" || block.type === "note") {
            const f = block.type === "note" ? italic : font;
            const lines = wrap(pdfSafe(block.text), f, 10.5, block.type === "note" ? W - 20 : W);
            ensure(lines.length * 15 + 8);
            if (block.type === "note") page.drawRectangle({ x: M, y: y - lines.length * 15 + 9, width: 2.5, height: lines.length * 15, color: GOLD });
            lines.forEach((l) => {
                ensure(15);
                text(l, block.type === "note" ? M + 12 : M, y, { f, size: 10.5 });
                y -= 15;
            });
            y -= 8;
        } else if (block.type === "fields") {
            const labelW = 150;
            for (const [label, value] of block.rows) {
                const lines = wrap(pdfSafe(value ?? "-"), font, 10.5, W - labelW - 14);
                ensure(lines.length * 14 + 4);
                text(label, M, y, { size: 10.5, color: MUTED });
                text(":", M + labelW, y, { size: 10.5, color: MUTED });
                lines.forEach((l, i) => text(l, M + labelW + 10, y - i * 14, { size: 10.5, f: i === 0 && /total|bersih/i.test(label) ? bold : font }));
                y -= lines.length * 14 + 4;
            }
            y -= 8;
        } else if (block.type === "table") {
            const cols = block.columns;
            const widths = cols.map((c) => (c.width ?? 1 / cols.length) * W);
            const pad = 6;
            const drawRow = (cells, { head = false } = {}) => {
                const f = head ? bold : font;
                const size = head ? 9 : 9.5;
                const wrapped = cells.map((cell, i) => wrap(pdfSafe(cell), f, size, widths[i] - pad * 2));
                const h = Math.max(...wrapped.map((w) => w.length)) * 12 + pad * 2 - 2;
                ensure(h + 4);
                if (head) page.drawRectangle({ x: M, y: y - h + 10, width: W, height: h, color: SOFT });
                let x = M;
                wrapped.forEach((lines, i) => {
                    lines.forEach((l, j) => text(l, x + pad, y - j * 12, { f, size, color: head ? MUTED : INK, align: cols[i].align === "right" ? "right" : cols[i].align === "center" ? "center" : "left", width: widths[i] - pad * 2 }));
                    x += widths[i];
                });
                y -= h;
                page.drawRectangle({ x: M, y: y + 9, width: W, height: 0.4, color: rgb(0.85, 0.83, 0.79) });
            };
            drawRow(cols.map((c) => c.label), { head: true });
            block.rows.forEach((row) => drawRow(row));
            (block.totals || []).forEach(([label, value], i, all) => {
                ensure(18);
                const last = i === all.length - 1;
                text(label, M + W * 0.45, y, { f: last ? bold : font, size: last ? 11 : 10, width: W * 0.3, align: "right", color: last ? INK : MUTED });
                text(value, M, y, { f: last ? bold : font, size: last ? 11 : 10, align: "right" });
                y -= last ? 18 : 15;
            });
            y -= 10;
        }
    }

    // Tanda tangan (kanan; penanda tangan kedua di kiri)
    const signers = model.sign?.signers || [];
    if (signers.length) {
        ensure(120);
        y -= 10;
        const slotW = 190;
        signers.slice(0, 2).forEach((s, i) => {
            const x = i === 0 ? M + W - slotW : M;
            text(i === 0 ? "Hormat kami," : s.title || "", x, y, { size: 10, width: slotW, align: "center" });
            if (i === 0 && signature) {
                const h = 54;
                const w = Math.min(slotW - 20, (signature.width / signature.height) * h);
                page.drawImage(signature, { x: x + (slotW - w) / 2, y: y - 66, width: w, height: h });
            }
            text(s.name, x, y - 82, { f: bold, size: 10.5, width: slotW, align: "center" });
            page.drawRectangle({ x: x + 25, y: y - 86, width: slotW - 50, height: 0.6, color: INK });
            if (i === 0) text(s.title || "", x, y - 98, { size: 9.5, color: MUTED, width: slotW, align: "center" });
        });
        y -= 110;
    }

    // QR keaslian (halaman terakhir, kiri bawah) + kaki tiap halaman
    if (qr) {
        const size = 74;
        const last = pages[pages.length - 1];
        last.drawImage(qr, { x: M, y: M + 4, width: size, height: size });
        page = last;
        text("Pindai untuk cek keaslian", M + size + 10, M + 50, { f: bold, size: 8.5 });
        text(`Kode: ${String(opts.verify.code || "").toUpperCase()}`, M + size + 10, M + 38, { size: 8.5, color: MUTED });
        text("Dokumen yang diubah tidak akan cocok.", M + size + 10, M + 26, { size: 8, color: MUTED });
    }
    pages.forEach((p, i) => {
        page = p;
        text(`${opts.brand?.name || ""} · ${model.number}`, M, 26, { size: 7.5, color: MUTED });
        text(`Halaman ${i + 1} dari ${pages.length}`, M, 26, { size: 7.5, color: MUTED, align: "right" });
    });

    return pdf.save();
}
