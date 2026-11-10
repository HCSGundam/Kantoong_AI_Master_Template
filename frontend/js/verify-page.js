/**
 * KANTOONG — HALAMAN CEK KEASLIAN DOKUMEN (tujuan QR)
 * File: frontend/js/verify-page.js
 *
 * verify.html?d=<id dokumen>&k=<12 huruf sidik SHA-256>
 * - Data asli: fungsi publik erp_verify_document (db/erp-docs.sql) — hanya
 *   judul, nomor, tanggal, penerbit & status. Isi dokumen TIDAK ditampilkan.
 * - Dokumen demo (id "doc-…"): dicek dari data demo di perangkat ini.
 */

import { applyTheme } from "./theme.js";
import CFG from "../client-config.js";
import { supabase } from "./supabase-client.js";

const KIND_LABEL = {
    slip: "Slip gaji", invoice: "Invoice", po: "Purchase order", penawaran: "Surat penawaran harga",
    keterangan: "Surat keterangan kerja", peringatan: "Surat peringatan", laporan: "Laporan bulanan",
};

const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
};

const longDate = (day) => (day ? new Date(`${day}T00:00:00+07:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }) : "-");

async function lookup(id, code) {
    if (/^doc-[a-z0-9]+$/i.test(id)) {
        try {
            const db = JSON.parse(localStorage.getItem("kantoong_erp_demo_v1") || "null");
            const doc = db?.docs?.documents?.find((d) => d.id === id);
            if (!doc) return { found: false, demo: true };
            const issuer = db.members?.find((m) => m.id === doc.created_by)?.full_name || "";
            return { found: true, demo: true, match: String(doc.hash).startsWith(code.toLowerCase()), status: doc.status, kind: doc.kind, title: doc.title, number: doc.number, issued_on: doc.issued_on, issuer, signed: Boolean(doc.signed_at) };
        } catch {
            return { found: false, demo: true };
        }
    }
    if (!/^[0-9a-f-]{36}$/i.test(id)) return { found: false };
    const { data, error } = await supabase.rpc("erp_verify_document", { p_id: id, p_code: code });
    if (error) throw error;
    return data || { found: false };
}

function render(result) {
    const root = document.getElementById("verifyRoot");
    const brand = CFG.app_name || "Kantoong";
    const ok = result.found && result.match && result.status === "terbit";
    const tone = ok ? "ok" : result.found && result.match && result.status === "menunggu" ? "wait" : "bad";
    const head = {
        ok: ["✓", "Dokumen ASLI", `Dokumen ini benar diterbitkan oleh ${brand} dan isinya tidak diubah.`],
        wait: ["…", "Belum ditandatangani", "Dokumen terdaftar, tetapi masih menunggu tanda tangan pejabat berwenang."],
        bad: ["!", "Dokumen TIDAK dapat dipastikan", result.found
            ? (result.match ? (result.status === "dicabut" ? "Dokumen ini sudah DICABUT oleh penerbit dan tidak berlaku lagi." : "Dokumen ini ditolak dan tidak berlaku.") : "Kode keaslian tidak cocok. Isi dokumen kemungkinan telah DIUBAH.")
            : "Dokumen tidak ditemukan di register kami. Hati-hati: kemungkinan dokumen palsu."],
    }[tone];

    const card = el("section", `vf__card vf__card--${tone}`);
    card.append(
        el("span", "vf__badge", head[0]),
        el("h1", "vf__title", head[1]),
        el("p", "vf__lead", head[2]),
    );
    if (result.found) {
        const list = el("dl", "vf__facts");
        [
            ["Jenis", KIND_LABEL[result.kind] || result.kind],
            ["Judul", result.title],
            ["Nomor", result.number],
            ["Tanggal terbit", longDate(result.issued_on)],
            ["Diterbitkan oleh", result.issuer ? `${result.issuer} · ${brand}` : brand],
            ["Tanda tangan", result.signed ? "Sudah ditandatangani" : "Tanpa tanda tangan"],
        ].forEach(([k, v]) => list.append(el("dt", "", k), el("dd", "", v || "-")));
        card.append(list);
    }
    if (result.demo) card.append(el("p", "vf__note", "Mode demo: pemeriksaan memakai data contoh di perangkat ini."));
    card.append(el("p", "vf__note", "Halaman ini hanya menampilkan data pendaftaran dokumen, bukan isinya. Bandingkan nomor & tanggal dengan dokumen yang Anda pegang."));

    const foot = el("footer", "vf__foot");
    foot.append(el("span", "", `${brand} · Sistem dokumen Kantoong ERP`));
    root.replaceChildren(card, foot);
    document.title = `${head[1]} · ${brand}`;
}

async function main() {
    applyTheme("store");
    const params = new URLSearchParams(location.search);
    const id = String(params.get("d") || "").trim().slice(0, 60);
    const code = String(params.get("k") || "").replace(/[^0-9a-f]/gi, "").slice(0, 12);
    if (!id || code.length < 8) {
        render({ found: false });
        return;
    }
    try {
        render(await lookup(id, code));
    } catch {
        const root = document.getElementById("verifyRoot");
        root.replaceChildren(el("p", "vf__loading", "Tidak bisa terhubung ke server. Periksa sinyal lalu muat ulang halaman."));
    }
}

main();
