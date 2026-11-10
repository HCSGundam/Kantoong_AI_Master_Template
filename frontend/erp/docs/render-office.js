/**
 * KANTOONG ERP — MODEL DOKUMEN → WORD (.docx) & EXCEL (.xlsx), di perangkat
 * File: frontend/erp/docs/render-office.js
 *
 * Word: kop surat, isi, tabel, tanda tangan, QR keaslian (bisa diedit lanjut).
 * Excel: info dokumen + tabel; rupiah jadi ANGKA asli (bisa dijumlah di Excel).
 */

import { AlignmentType, BorderStyle, Document, ImageRun, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { strToU8, zipSync } from "fflate";
import { longDate } from "../core/documents.js";
import { loadImage, qrPng } from "./assets.js";

const FONT = "Calibri";
const run = (text, opts = {}) => new TextRun({ text: String(text ?? ""), font: FONT, size: opts.size ?? 21, bold: opts.bold, italics: opts.italic, color: opts.color });
const para = (children, opts = {}) => new Paragraph({ children: [].concat(children), alignment: opts.align, spacing: { after: opts.after ?? 120 }, border: opts.border });

function imageRun(img, width, height) {
    if (!img) return null;
    return new ImageRun({ type: img.type === "png" ? "png" : "jpg", data: img.bytes, transformation: { width, height } });
}

const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };

export async function renderDocx(model, opts = {}) {
    const [logo, signature, qr] = await Promise.all([
        loadImage(opts.brand?.logo),
        loadImage(opts.signature),
        opts.verify?.url ? qrPng(opts.verify.url) : null,
    ]);
    const children = [];

    // Kop surat
    const contact = [opts.brand?.address, [opts.brand?.phone, opts.brand?.email, opts.brand?.website].filter(Boolean).join("  ·  ")].filter(Boolean);
    children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: NO_BORDERS,
        rows: [new TableRow({ children: [
            ...(logo ? [new TableCell({ width: { size: 18, type: WidthType.PERCENTAGE }, borders: NO_BORDERS, children: [para(imageRun(logo, 80, 80 * 0.6), { after: 0 })] })] : []),
            new TableCell({ borders: NO_BORDERS, children: [
                para(run(opts.brand?.name || "", { bold: true, size: 32 }), { after: 40 }),
                ...contact.map((line) => para(run(line, { size: 17, color: "6B675F" }), { after: 0 })),
            ] }),
        ] })],
    }));
    children.push(para(run(""), { after: 200, border: { bottom: { style: BorderStyle.DOUBLE, size: 6, color: "C9A227" } } }));

    children.push(para(run(model.title, { bold: true, size: 30 }), { align: AlignmentType.CENTER, after: 40 }));
    children.push(para(run(`Nomor: ${model.number}`, { size: 19, color: "6B675F" }), { align: AlignmentType.CENTER, after: model.subject ? 40 : 200 }));
    if (model.subject) children.push(para(run(model.subject, { italic: true, size: 19, color: "6B675F" }), { align: AlignmentType.CENTER, after: 200 }));
    children.push(para(run(`${model.sign?.city ? `${model.sign.city}, ` : ""}${longDate(model.date)}`), { align: AlignmentType.RIGHT, after: 240 }));

    if (model.to?.name) {
        children.push(para(run("Kepada Yth.", { color: "6B675F" }), { after: 40 }));
        children.push(para(run(model.to.name, { bold: true }), { after: 40 }));
        (model.to.lines || []).forEach((line) => children.push(para(run(line), { after: 20 })));
        children.push(para(run(""), { after: 120 }));
    }

    for (const block of model.blocks) {
        if (block.type === "heading") children.push(para(run(block.text, { bold: true, size: 24 }), { after: 100 }));
        else if (block.type === "para") children.push(para(run(block.text)));
        else if (block.type === "note") children.push(para(run(block.text, { italic: true }), { border: { left: { style: BorderStyle.SINGLE, size: 18, color: "C9A227", space: 8 } } }));
        else if (block.type === "fields") {
            children.push(new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: NO_BORDERS,
                rows: block.rows.map(([label, value]) => new TableRow({ children: [
                    new TableCell({ width: { size: 32, type: WidthType.PERCENTAGE }, borders: NO_BORDERS, children: [para(run(label, { color: "6B675F" }), { after: 60 })] }),
                    new TableCell({ borders: NO_BORDERS, children: [para(run(`: ${value ?? "-"}`, { bold: /total|bersih/i.test(label) }), { after: 60 })] }),
                ] })),
            }));
            children.push(para(run(""), { after: 80 }));
        } else if (block.type === "table") {
            const cols = block.columns;
            const align = (c) => (c.align === "right" ? AlignmentType.RIGHT : c.align === "center" ? AlignmentType.CENTER : AlignmentType.LEFT);
            const cell = (text, c, head) => new TableCell({
                width: { size: Math.round((c.width ?? 1 / cols.length) * 100), type: WidthType.PERCENTAGE },
                shading: head ? { type: ShadingType.CLEAR, fill: "F2EFE8", color: "auto" } : undefined,
                margins: { top: 60, bottom: 60, left: 90, right: 90 },
                children: [para(run(text, { bold: head, size: head ? 18 : 20, color: head ? "6B675F" : undefined }), { align: align(c), after: 0 })],
            });
            const rows = [
                new TableRow({ tableHeader: true, children: cols.map((c) => cell(c.label, c, true)) }),
                ...block.rows.map((row) => new TableRow({ children: row.map((v, i) => cell(v, cols[i], false)) })),
            ];
            children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
            (block.totals || []).forEach(([label, value], i, all) => {
                const last = i === all.length - 1;
                children.push(para([run(`${label}   `, { color: "6B675F", bold: last }), run(value, { bold: last, size: last ? 23 : 21 })], { align: AlignmentType.RIGHT, after: 40 }));
            });
            children.push(para(run(""), { after: 120 }));
        }
    }

    const signers = model.sign?.signers || [];
    if (signers.length) {
        const signCell = (s, i) => new TableCell({ borders: NO_BORDERS, children: [
            para(run(i === 0 ? "Hormat kami," : s.title || ""), { align: AlignmentType.CENTER, after: 60 }),
            i === 0 && signature ? para(imageRun(signature, 130, 60), { align: AlignmentType.CENTER, after: 40 }) : para(run(""), { after: 700 }),
            para(run(s.name, { bold: true }), { align: AlignmentType.CENTER, after: 20 }),
            i === 0 ? para(run(s.title || "", { color: "6B675F", size: 19 }), { align: AlignmentType.CENTER }) : para(run("")),
        ] });
        const list = signers.slice(0, 2);
        children.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            rows: [new TableRow({ children: list.length === 2 ? [signCell(list[1], 1), signCell(list[0], 0)] : [new TableCell({ borders: NO_BORDERS, children: [para(run(""))] }), signCell(list[0], 0)] })],
        }));
    }

    if (qr) {
        children.push(para(run(""), { after: 200 }));
        children.push(new Table({
            borders: NO_BORDERS,
            rows: [new TableRow({ children: [
                new TableCell({ borders: NO_BORDERS, width: { size: 1500, type: WidthType.DXA }, children: [para(imageRun(qr, 80, 80), { after: 0 })] }),
                new TableCell({ borders: NO_BORDERS, children: [
                    para(run("Pindai untuk cek keaslian", { bold: true, size: 17 }), { after: 20 }),
                    para(run(`Kode: ${String(opts.verify.code || "").toUpperCase()}`, { size: 17, color: "6B675F" }), { after: 20 }),
                    para(run("Versi Word dapat diedit; keaslian mengacu pada isi yang terdaftar.", { size: 15, color: "6B675F" }), { after: 0 }),
                ] }),
            ] })],
        }));
    }

    const doc = new Document({
        creator: opts.brand?.name || "Kantoong ERP",
        title: `${model.title} ${model.number}`,
        styles: { default: { document: { run: { font: FONT } } } },
        sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children }],
    });
    return Packer.toBlob(doc);
}

/* ---------- Excel (.xlsx) tanpa library berat: XML + zip ---------- */

const esc = (s) => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const colName = (i) => {
    let s = "";
    for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
};

/** "Rp1.234.500" / "−Rp5.000" → angka; selain itu null. */
export function rupiahToNumber(text) {
    const m = String(text ?? "").trim().match(/^([−-])?Rp\s?([\d.]+)$/);
    if (!m) return null;
    return (m[1] ? -1 : 1) * Number(m[2].replace(/\./g, ""));
}

/** Baris → XML lembar kerja. Gaya: 0 biasa, 1 tebal, 2 rupiah, 3 rupiah tebal, 4 judul. */
export function sheetXml(rows) {
    const body = rows.map((cells, r) => `<row r="${r + 1}">${cells.map((cell, c) => {
        if (cell == null || cell === "") return "";
        const ref = `${colName(c)}${r + 1}`;
        const value = typeof cell === "object" ? cell.v : cell;
        const style = typeof cell === "object" ? cell.s ?? 0 : 0;
        const money = rupiahToNumber(value);
        if (money != null) return `<c r="${ref}" s="${style === 1 || style === 3 ? 3 : 2}"><v>${money}</v></c>`;
        if (typeof value === "number") return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
        return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
    }).join("")}</row>`).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="34" customWidth="1"/><col min="2" max="8" width="20" customWidth="1"/></cols><sheetData>${body}</sheetData></worksheet>`;
}

export function modelToRows(model, brandName = "") {
    const rows = [[{ v: brandName, s: 4 }], [{ v: model.title, s: 1 }], ["Nomor", model.number], ["Tanggal", longDate(model.date)]];
    if (model.subject) rows.push(["Perihal", model.subject]);
    if (model.to?.name) rows.push(["Kepada", model.to.name]);
    rows.push([]);
    model.blocks.forEach((block) => {
        if (block.type === "fields") block.rows.forEach(([label, value]) => rows.push([label, value]));
        else if (block.type === "table") {
            rows.push(block.columns.map((c) => ({ v: c.label, s: 1 })));
            block.rows.forEach((row) => rows.push(row.map((cell) => (/^\d+([.,]\d+)?$/.test(String(cell).replace(/\./g, "")) && !/Rp/.test(cell) ? Number(String(cell).replace(/\./g, "").replace(",", ".")) : cell))));
            (block.totals || []).forEach(([label, value]) => {
                const pad = Array(Math.max(0, block.columns.length - 2)).fill("");
                rows.push([...pad, { v: label, s: 1 }, { v: value, s: 1 }]);
            });
        } else if (block.type === "heading") rows.push([{ v: block.text, s: 1 }]);
        else rows.push([block.text]);
        rows.push([]);
    });
    (model.sign?.signers || []).forEach((s) => rows.push(["Penanda tangan", `${s.name}${s.title ? ` (${s.title})` : ""}`]));
    return rows;
}

export function renderXlsx(model, opts = {}) {
    const files = {
        "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
        "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
        "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(String(model.kind || "Dokumen").slice(0, 28))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
        "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
        "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;Rp&quot;#,##0"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="15"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`,
        "xl/worksheets/sheet1.xml": sheetXml(modelToRows(model, opts.brand?.name || "")),
    };
    const zipped = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));
    return new Blob([zipped], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
