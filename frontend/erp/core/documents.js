/**
 * KANTOONG ERP — MESIN DOKUMEN (murni, dites)
 * File: frontend/erp/core/documents.js
 *
 * Templat → MODEL dokumen netral → dirender jadi PDF / Word / Excel
 * (erp/docs/render-*.js). Model yang sama dipakai untuk sidik keaslian (QR).
 *
 * Model:
 * { kind, title, number, date: "YYYY-MM-DD", to?: { name, lines[] }, subject?,
 *   blocks: [
 *     { type: "heading", text } | { type: "para", text } | { type: "note", text }
 *     { type: "fields", rows: [[label, value], ...] }
 *     { type: "table", columns: [{ label, align?, width? }], rows: [[...]], totals?: [[label, value]] }
 *   ],
 *   sign: { city, signers: [{ name, title }] } }
 */

/* ---------- Angka & teks ---------- */

export const rp = (n) => `Rp${Math.round(Number(n) || 0).toLocaleString("id-ID")}`;
export const num = (n) => Math.round(Number(n) || 0).toLocaleString("id-ID");

const SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];

/** Terbilang bahasa Indonesia (untuk invoice & slip gaji). */
export function terbilang(value) {
    const n = Math.floor(Math.abs(Number(value) || 0));
    const say = (x) => {
        if (x < 12) return SATUAN[x];
        if (x < 20) return `${say(x - 10)} belas`;
        if (x < 100) return `${say(Math.floor(x / 10))} puluh ${say(x % 10)}`;
        if (x < 200) return `seratus ${say(x - 100)}`;
        if (x < 1000) return `${say(Math.floor(x / 100))} ratus ${say(x % 100)}`;
        if (x < 2000) return `seribu ${say(x - 1000)}`;
        if (x < 1e6) return `${say(Math.floor(x / 1000))} ribu ${say(x % 1000)}`;
        if (x < 1e9) return `${say(Math.floor(x / 1e6))} juta ${say(x % 1e6)}`;
        if (x < 1e12) return `${say(Math.floor(x / 1e9))} miliar ${say(x % 1e9)}`;
        return `${say(Math.floor(x / 1e12))} triliun ${say(x % 1e12)}`;
    };
    if (n === 0) return "nol rupiah";
    const words = say(n).replace(/\s+/g, " ").trim();
    return `${words.charAt(0).toUpperCase()}${words.slice(1)} rupiah`;
}

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export function longDate(day) {
    const [y, m, d] = String(day || "").split("-").map(Number);
    if (!y || !m || !d) return "";
    return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function periodLabel(period) {
    const [y, m] = String(period || "").split("-").map(Number);
    return y && m ? `${MONTHS[m - 1]} ${y}` : String(period || "");
}

/* ---------- Nomor dokumen ---------- */

export const DOC_KINDS = Object.freeze({
    slip: { label: "Slip gaji", prefix: "SLIP" },
    invoice: { label: "Invoice", prefix: "INV" },
    po: { label: "Purchase order", prefix: "PO" },
    penawaran: { label: "Surat penawaran", prefix: "SPH" },
    keterangan: { label: "Surat keterangan kerja", prefix: "SKK" },
    peringatan: { label: "Surat peringatan", prefix: "SP" },
    laporan: { label: "Laporan bulanan", prefix: "LAP" },
});

/** "INV/014/XI/2026" — nomor urut per jenis per tahun, bulan romawi (gaya surat Indonesia). */
export function docNumber(kind, seq, day) {
    const [y, m] = String(day).split("-").map(Number);
    const prefix = DOC_KINDS[kind]?.prefix ?? "DOC";
    return `${prefix}/${String(seq).padStart(3, "0")}/${ROMAN[(m || 1) - 1]}/${y}`;
}

/** Nomor urut berikutnya dari dokumen yang sudah ada (jenis & tahun sama). */
export function nextSeq(existing, kind, day) {
    const year = String(day).slice(0, 4);
    const used = (existing || [])
        .filter((d) => d.kind === kind && String(d.issued_on || d.date || "").startsWith(year))
        .map((d) => Number(String(d.number || "").split("/")[1]) || 0);
    return (used.length ? Math.max(...used) : 0) + 1;
}

/* ---------- Baris barang ("Nama | jumlah | harga") ---------- */

/** Teks bebas → baris barang. Satu baris per barang: "Biji kopi 1kg | 10 | 185000". */
export function parseItems(text) {
    return String(text || "")
        .split(/\r?\n/)
        .map((line) => line.split("|").map((part) => part.trim()))
        .filter((parts) => parts[0])
        .map(([name, qty, price]) => ({
            name: name.slice(0, 120),
            qty: Math.max(0, Number(String(qty ?? "1").replace(",", ".")) || 0),
            // Gaya Indonesia: titik = ribuan, koma = desimal ("185.000" = 185000).
            price: Math.max(0, Math.round(Number(String(price ?? "0").replace(/[^\d,]/g, "").replace(",", ".")) || 0)),
        }));
}

export function itemsTotal(items, { discount = 0, taxPct = 0 } = {}) {
    const subtotal = (items || []).reduce((n, it) => n + Math.round(it.qty * it.price), 0);
    const disc = Math.min(subtotal, Math.max(0, Math.round(Number(discount) || 0)));
    const tax = Math.round(((subtotal - disc) * (Number(taxPct) || 0)) / 100);
    return { subtotal, discount: disc, tax, total: subtotal - disc + tax };
}

function itemsTable(items, totals) {
    return {
        type: "table",
        columns: [
            { label: "No", align: "center", width: 0.06 },
            { label: "Uraian", width: 0.46 },
            { label: "Jumlah", align: "right", width: 0.12 },
            { label: "Harga", align: "right", width: 0.17 },
            { label: "Subtotal", align: "right", width: 0.19 },
        ],
        rows: items.map((it, i) => [String(i + 1), it.name, num(it.qty), rp(it.price), rp(it.qty * it.price)]),
        totals,
    };
}

/* ---------- Templat ---------- */

const today = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);

/**
 * Field formulir: { name, label, type?: text|number|date|textarea|select|items|month, required?, options?, hint? }
 * build(values, ctx) → model. ctx = { brand, signer, city }.
 */
export const TEMPLATES = Object.freeze([
    {
        id: "slip",
        label: "Slip gaji",
        desc: "Rincian gaji, tunjangan, potongan & terbilang.",
        category: "SDM",
        fields: [
            { name: "employee", label: "Nama karyawan", required: true },
            { name: "position", label: "Jabatan" },
            { name: "period", label: "Periode", type: "month", required: true },
            { name: "base", label: "Gaji pokok", type: "number", required: true },
            { name: "allowance", label: "Tunjangan", type: "number" },
            { name: "commission", label: "Komisi / bonus", type: "number" },
            { name: "overtime", label: "Lembur", type: "number" },
            { name: "deduction", label: "Potongan (BPJS, kasbon, dll)", type: "number" },
            { name: "note", label: "Catatan", type: "textarea" },
        ],
        build(v) {
            const plus = [["Gaji pokok", v.base], ["Tunjangan", v.allowance], ["Komisi / bonus", v.commission], ["Lembur", v.overtime]]
                .filter(([, n]) => Number(n) > 0);
            const gross = plus.reduce((n, [, x]) => n + Math.round(Number(x)), 0);
            const cut = Math.round(Number(v.deduction) || 0);
            const net = gross - cut;
            return {
                title: "SLIP GAJI",
                subject: `Periode ${periodLabel(v.period)}`,
                blocks: [
                    { type: "fields", rows: [["Nama", v.employee], ["Jabatan", v.position || "-"], ["Periode", periodLabel(v.period)]] },
                    {
                        type: "table",
                        columns: [{ label: "Komponen", width: 0.65 }, { label: "Jumlah", align: "right", width: 0.35 }],
                        rows: [...plus.map(([label, x]) => [label, rp(x)]), ...(cut ? [["Potongan", `−${rp(cut)}`]] : [])],
                        totals: [["Penghasilan kotor", rp(gross)], ["GAJI BERSIH", rp(net)]],
                    },
                    { type: "note", text: `Terbilang: ${terbilang(net)}` },
                    v.note ? { type: "para", text: v.note } : null,
                ].filter(Boolean),
                summary: { amount: net, party: v.employee },
            };
        },
    },
    {
        id: "invoice",
        label: "Invoice",
        desc: "Tagihan ke pelanggan, PPN, jatuh tempo & rekening.",
        category: "Keuangan",
        fields: [
            { name: "customer", label: "Ditagihkan kepada", required: true },
            { name: "address", label: "Alamat pelanggan", type: "textarea" },
            { name: "items", label: "Barang/jasa", type: "items", required: true, hint: "Satu baris per barang: Nama | jumlah | harga" },
            { name: "discount", label: "Diskon (Rp)", type: "number" },
            { name: "tax", label: "PPN (%)", type: "number" },
            { name: "due", label: "Jatuh tempo", type: "date", required: true },
            { name: "bank", label: "Pembayaran ke rekening", hint: "contoh: BCA 1234567890 a.n. PT Contoh" },
        ],
        build(v) {
            const items = parseItems(v.items);
            const t = itemsTotal(items, { discount: v.discount, taxPct: v.tax });
            const totals = [["Subtotal", rp(t.subtotal)]];
            if (t.discount) totals.push(["Diskon", `−${rp(t.discount)}`]);
            if (t.tax) totals.push([`PPN ${Number(v.tax)}%`, rp(t.tax)]);
            totals.push(["TOTAL", rp(t.total)]);
            return {
                title: "INVOICE",
                to: { name: v.customer, lines: String(v.address || "").split(/\r?\n/).filter(Boolean) },
                blocks: [
                    itemsTable(items, totals),
                    { type: "note", text: `Terbilang: ${terbilang(t.total)}` },
                    { type: "fields", rows: [["Jatuh tempo", longDate(v.due)], ...(v.bank ? [["Pembayaran", v.bank]] : [])] },
                ],
                summary: { amount: t.total, party: v.customer },
            };
        },
    },
    {
        id: "po",
        label: "Purchase order (PO)",
        desc: "Pesanan pembelian resmi ke pemasok.",
        category: "Pembelian",
        fields: [
            { name: "supplier", label: "Pemasok", required: true },
            { name: "address", label: "Alamat pemasok", type: "textarea" },
            { name: "items", label: "Barang dipesan", type: "items", required: true, hint: "Nama | jumlah | harga" },
            { name: "delivery", label: "Tanggal kirim diminta", type: "date" },
            { name: "terms", label: "Syarat pembayaran", hint: "contoh: Tempo 30 hari setelah barang diterima" },
        ],
        build(v) {
            const items = parseItems(v.items);
            const t = itemsTotal(items);
            return {
                title: "PURCHASE ORDER",
                to: { name: v.supplier, lines: String(v.address || "").split(/\r?\n/).filter(Boolean) },
                blocks: [
                    { type: "para", text: "Dengan hormat, mohon dikirimkan barang-barang berikut sesuai spesifikasi dan harga yang disepakati:" },
                    itemsTable(items, [["TOTAL", rp(t.total)]]),
                    { type: "fields", rows: [["Tanggal kirim", v.delivery ? longDate(v.delivery) : "Secepatnya"], ["Pembayaran", v.terms || "Sesuai kesepakatan"]] },
                ],
                summary: { amount: t.total, party: v.supplier },
            };
        },
    },
    {
        id: "penawaran",
        label: "Surat penawaran harga",
        desc: "Penawaran resmi untuk calon pelanggan (dari pipeline CRM).",
        category: "Penjualan",
        fields: [
            { name: "to", label: "Kepada", required: true },
            { name: "address", label: "Alamat", type: "textarea" },
            { name: "subject", label: "Perihal", required: true },
            { name: "items", label: "Yang ditawarkan", type: "items", required: true, hint: "Nama | jumlah | harga" },
            { name: "valid", label: "Berlaku sampai", type: "date" },
            { name: "body", label: "Kalimat pembuka (opsional)", type: "textarea" },
        ],
        build(v) {
            const items = parseItems(v.items);
            const t = itemsTotal(items);
            return {
                title: "SURAT PENAWARAN HARGA",
                subject: v.subject,
                to: { name: v.to, lines: String(v.address || "").split(/\r?\n/).filter(Boolean) },
                blocks: [
                    { type: "para", text: "Dengan hormat," },
                    { type: "para", text: v.body || "Bersama surat ini kami sampaikan penawaran harga untuk kebutuhan Bapak/Ibu sebagai berikut:" },
                    itemsTable(items, [["TOTAL PENAWARAN", rp(t.total)]]),
                    { type: "para", text: `Penawaran ini berlaku sampai ${v.valid ? longDate(v.valid) : "30 hari sejak tanggal surat"}. Kami berharap dapat bekerja sama dengan Bapak/Ibu. Atas perhatiannya kami ucapkan terima kasih.` },
                ],
                summary: { amount: t.total, party: v.to },
            };
        },
    },
    {
        id: "keterangan",
        label: "Surat keterangan kerja",
        desc: "Untuk KPR, visa, beasiswa, atau melamar kerja.",
        category: "SDM",
        fields: [
            { name: "employee", label: "Nama karyawan", required: true },
            { name: "nik", label: "NIK / No. karyawan" },
            { name: "position", label: "Jabatan", required: true },
            { name: "since", label: "Bekerja sejak", type: "date", required: true },
            { name: "status", label: "Status", type: "select", options: ["Karyawan tetap", "Karyawan kontrak", "Magang", "Pernah bekerja (sudah keluar)"] },
            { name: "purpose", label: "Keperluan", hint: "contoh: pengajuan KPR" },
        ],
        build(v, ctx) {
            const brand = ctx?.brand?.name || "perusahaan kami";
            return {
                title: "SURAT KETERANGAN KERJA",
                blocks: [
                    { type: "para", text: "Yang bertanda tangan di bawah ini menerangkan bahwa:" },
                    { type: "fields", rows: [["Nama", v.employee], ...(v.nik ? [["NIK / No. karyawan", v.nik]] : []), ["Jabatan", v.position], ["Status", v.status || "Karyawan tetap"], ["Bekerja sejak", longDate(v.since)]] },
                    { type: "para", text: `adalah benar ${v.status === "Pernah bekerja (sudah keluar)" ? "pernah bekerja" : "bekerja"} di ${brand}. Selama bekerja, yang bersangkutan menunjukkan dedikasi dan kinerja yang baik.` },
                    { type: "para", text: `Surat keterangan ini dibuat${v.purpose ? ` untuk keperluan ${v.purpose}` : ""} dan dapat dipergunakan sebagaimana mestinya.` },
                ],
                summary: { party: v.employee },
            };
        },
    },
    {
        id: "peringatan",
        label: "Surat peringatan (SP)",
        desc: "SP 1/2/3 sesuai aturan perusahaan.",
        category: "SDM",
        fields: [
            { name: "employee", label: "Nama karyawan", required: true },
            { name: "position", label: "Jabatan" },
            { name: "level", label: "Tingkat", type: "select", options: ["SP 1", "SP 2", "SP 3"], required: true },
            { name: "violation", label: "Pelanggaran", type: "textarea", required: true },
            { name: "months", label: "Berlaku (bulan)", type: "number", hint: "umumnya 6 bulan" },
        ],
        build(v) {
            const months = Math.max(1, Math.round(Number(v.months) || 6));
            return {
                title: `SURAT PERINGATAN (${v.level || "SP 1"})`,
                blocks: [
                    { type: "fields", rows: [["Kepada", v.employee], ["Jabatan", v.position || "-"]] },
                    { type: "para", text: "Sehubungan dengan pelanggaran tata tertib perusahaan yang Saudara lakukan, yaitu:" },
                    { type: "note", text: v.violation },
                    { type: "para", text: `maka dengan ini perusahaan memberikan ${v.level || "SP 1"} kepada Saudara. Surat ini berlaku selama ${months} bulan sejak tanggal diterbitkan. Apabila dalam masa berlaku Saudara kembali melakukan pelanggaran, perusahaan akan mengambil tindakan sesuai peraturan yang berlaku.` },
                    { type: "para", text: "Demikian surat peringatan ini dibuat agar menjadi perhatian dan perbaikan." },
                ],
                sign: { extra: [{ name: v.employee, title: "Yang menerima" }] },
                summary: { party: v.employee },
            };
        },
    },
    {
        id: "laporan",
        label: "Laporan bulanan",
        desc: "Omzet, pesanan, kas & beban — diisi otomatis dari data ERP.",
        category: "Manajemen",
        fields: [
            { name: "period", label: "Periode", type: "month", required: true },
            { name: "omzet", label: "Omzet", type: "number" },
            { name: "orders", label: "Jumlah transaksi", type: "number" },
            { name: "expense", label: "Total beban", type: "number" },
            { name: "rows", label: "Rincian per kategori", type: "items", hint: "Kategori | transaksi | omzet" },
            { name: "notes", label: "Catatan manajemen", type: "textarea" },
        ],
        build(v) {
            const rows = parseItems(v.rows);
            const omzet = Math.round(Number(v.omzet) || 0);
            const expense = Math.round(Number(v.expense) || 0);
            return {
                title: "LAPORAN BULANAN",
                subject: periodLabel(v.period),
                blocks: [
                    { type: "fields", rows: [["Omzet", rp(omzet)], ["Transaksi", num(v.orders)], ["Total beban", rp(expense)], ["Laba operasional (perkiraan)", rp(omzet - expense)]] },
                    rows.length ? {
                        type: "table",
                        columns: [{ label: "Kategori", width: 0.5 }, { label: "Transaksi", align: "right", width: 0.2 }, { label: "Omzet", align: "right", width: 0.3 }],
                        rows: rows.map((r) => [r.name, num(r.qty), rp(r.price)]),
                    } : null,
                    v.notes ? { type: "heading", text: "Catatan manajemen" } : null,
                    v.notes ? { type: "para", text: v.notes } : null,
                ].filter(Boolean),
                summary: { amount: omzet },
            };
        },
    },
]);

export function templateById(id) {
    return TEMPLATES.find((t) => t.id === id) || null;
}

/** Nilai awal formulir (tanggal hari ini, periode bulan ini). */
export function defaultValues(template, preset = {}) {
    const out = {};
    template.fields.forEach((f) => {
        if (f.type === "month") out[f.name] = today().slice(0, 7);
        else if (f.type === "date") out[f.name] = "";
        else if (f.type === "select") out[f.name] = f.options[0];
        else out[f.name] = "";
    });
    return { ...out, ...preset };
}

export function validateValues(template, values) {
    for (const f of template.fields) {
        const v = values[f.name];
        if (f.required && !String(v ?? "").trim()) return `${f.label} wajib diisi.`;
        if (f.type === "number" && String(v ?? "").trim() && !Number.isFinite(Number(v))) return `${f.label} harus angka.`;
        if (f.type === "items" && f.required && !parseItems(v).length) return `${f.label} minimal satu baris.`;
    }
    return null;
}

/** Bangun model lengkap. ctx = { brand: {name,...}, signer: {name,title}, city, number, date }. */
export function buildDocument(templateId, values, ctx = {}) {
    const template = templateById(templateId);
    if (!template) throw new Error("Templat tidak dikenal.");
    const problem = validateValues(template, values);
    if (problem) throw new Error(problem);
    const date = ctx.date || today();
    const body = template.build(values, ctx);
    const signers = [
        ...(ctx.signer?.name ? [{ name: ctx.signer.name, title: ctx.signer.title || "" }] : []),
        ...(body.sign?.extra || []),
    ];
    return {
        kind: templateId,
        title: body.title,
        subject: body.subject || "",
        number: ctx.number || docNumber(templateId, 1, date),
        date,
        to: body.to || null,
        blocks: body.blocks,
        sign: { city: ctx.city || "", signers },
        summary: body.summary || {},
    };
}

/* ---------- Sidik keaslian ---------- */

/** Bentuk kanonik (urutan kunci tetap) → bahan hash. */
export function canonical(value) {
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (value && typeof value === "object") {
        return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
    }
    return JSON.stringify(value ?? null);
}

export async function fingerprint(model) {
    const core = { kind: model.kind, number: model.number, date: model.date, title: model.title, to: model.to, blocks: model.blocks, signers: model.sign?.signers };
    const bytes = new TextEncoder().encode(canonical(core));
    const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Alamat yang ditanam di QR. Kode pendek (12 huruf hash) cukup untuk mencocokkan. */
export function verifyUrl(origin, docId, hash) {
    return `${String(origin).replace(/\/$/, "")}/verify.html?d=${encodeURIComponent(docId)}&k=${String(hash).slice(0, 12)}`;
}

export const DOC_STATUS = Object.freeze({
    draf: { label: "Draf", tone: "" },
    menunggu: { label: "Menunggu tanda tangan", tone: "warn" },
    terbit: { label: "Terbit", tone: "good" },
    ditolak: { label: "Ditolak", tone: "bad" },
    dicabut: { label: "Dicabut", tone: "bad" },
});
