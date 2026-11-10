/**
 * KANTOONG ERP — MENERBITKAN & MENGUNDUH DOKUMEN (dipakai modul Dokumen & Agen AI)
 * File: frontend/erp/docs/issue.js
 */

import { getStorefront, loadStorefront } from "../../js/storefront-settings.js";
import CFG from "../../client-config.js";
import { buildDocument, docNumber, fingerprint, nextSeq, verifyUrl } from "../core/documents.js";
import { fileName, saveFile } from "./assets.js";

/** Identitas kop surat: brand (Etalase & Brand) + pengaturan dokumen ERP. */
export async function loadDocBrand(data) {
    let sf = null;
    try {
        await loadStorefront();
        sf = getStorefront();
    } catch {
        sf = null;
    }
    const settings = (await data.getDocSettings?.().catch(() => ({}))) || {};
    const contact = sf?.brand?.contact || {};
    return {
        settings,
        brand: {
            name: sf?.brand?.name || CFG.app_name || "Perusahaan",
            logo: sf?.brand?.logo || "",
            address: settings.address || [contact.address, contact.city].filter(Boolean).join(", "),
            phone: settings.phone || contact.phone || contact.whatsapp || "",
            email: settings.email || contact.email || "",
            website: String(CFG.site_url || "").replace(/^https?:\/\//, ""),
        },
        signer: { name: settings.signer_name || "", title: settings.signer_title || "" },
        city: settings.city || contact.city || "",
    };
}

/**
 * Terbitkan dokumen: nomor urut → model → sidik → simpan register.
 * sign=true → menunggu tanda tangan lewat rantai persetujuan "dokumen".
 */
export async function issueDocument(data, templateId, values, { sign = false, recipient_id = null } = {}) {
    const ident = await loadDocBrand(data);
    const existing = await data.listDocuments().catch(() => []);
    const date = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    const number = docNumber(templateId, nextSeq(existing, templateId, date), date);
    const model = buildDocument(templateId, values, { brand: ident.brand, signer: ident.signer, city: ident.city, number, date });
    const hash = await fingerprint(model);
    const record = await data.createDocument({ model, hash, sign, recipient_id });
    return { record, ident };
}

/** Unduh dokumen yang sudah terdaftar dalam format pilihan. */
export async function downloadDocument(data, record, format = "pdf", ident = null) {
    const id = ident || (await loadDocBrand(data));
    const model = record.model;
    const opts = {
        brand: id.brand,
        // Tanda tangan hanya ditempel bila dokumen benar sudah ditandatangani (rantai selesai / diterbitkan pimpinan).
        signature: record.status === "terbit" && record.signed_at ? id.settings.signature : "",
        verify: { url: verifyUrl(location.origin, record.id, record.hash), code: String(record.hash).slice(0, 12) },
        stamp: record.status === "menunggu" ? "DRAF" : record.status === "dicabut" ? "DICABUT" : record.status === "ditolak" ? "DITOLAK" : "",
    };
    if (format === "pdf") {
        const { renderPdf } = await import("./render-pdf.js");
        saveFile(await renderPdf(model, opts), fileName(model, "pdf"), "application/pdf");
    } else if (format === "docx") {
        const { renderDocx } = await import("./render-office.js");
        saveFile(await renderDocx(model, opts), fileName(model, "docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    } else {
        const { renderXlsx } = await import("./render-office.js");
        saveFile(renderXlsx(model, opts), fileName(model, "xlsx"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    }
}
