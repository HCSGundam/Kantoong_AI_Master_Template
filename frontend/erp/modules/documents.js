/**
 * KANTOONG ERP — DOKUMEN (menu "Dokumen & PDF")
 * File: frontend/erp/modules/documents.js
 *
 * Tab:
 *  1. Buat dokumen  — galeri templat → isi (bisa diisi otomatis dari data ERP) →
 *                     terbit langsung / minta tanda tangan berjenjang → unduh PDF/Word/Excel.
 *  2. Kotak Masuk   — Keluar (buatanku), Masuk (ditujukan padaku), Perlu tanda tanganku.
 *  3. Alat PDF      — gabung, pisah, atur, putar, watermark, tanda tangan, dll. (di perangkat).
 *  4. Kop & tanda tangan — penanda tangan, kota, alamat, gambar tanda tangan (owner/direktur).
 */

import { DOC_KINDS, DOC_STATUS, TEMPLATES, defaultValues, parseItems, periodLabel, templateById, validateValues } from "../core/documents.js";
import { currentApprover } from "../core/approval-chain.js";
import { hasRole } from "../core/org.js";
import { dateTime, el, emptyState, formDialog, friendlyError, pageHeader, rupiah, segmented, toast } from "../ui.js";
import { downloadDocument, issueDocument, loadDocBrand } from "../docs/issue.js";
import { renderTools } from "./doc-tools.js";
import monthlyNumbers from "./agent-skills.js";
import { invalidateProData, subRoute } from "./pro-data.js";

const TABS = [
    { value: "buat", label: "Buat dokumen" },
    { value: "kotak", label: "Kotak Masuk" },
    { value: "alat", label: "Alat PDF" },
    { value: "kop", label: "Kop & tanda tangan" },
];
let tab = "buat";
let box = "semua";

const ICON = {
    slip: "M4 5h16v14H4zM8 9h8M8 13h5", invoice: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
    po: "M3 6h18l-2 9H6zM9 20h.01M17 20h.01", penawaran: "M4 4h16v12H8l-4 4zM8 9h8M8 12h5",
    keterangan: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h4", peringatan: "M12 3l9 16H3zM12 10v4M12 17h.01",
    laporan: "M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3",
};
const svgIcon = (d) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "erp-icon");
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d);
    svg.append(p);
    return svg;
};

export async function render(ctx) {
    const routed = subRoute();
    if (TABS.some((t) => t.value === routed)) tab = routed;
    const page = el("div", { class: "erp-page__inner" });
    page.appendChild(pageHeader(
        "Dokumen & PDF",
        "Buat surat & dokumen resmi berkop, minta tanda tangan berjenjang, dan olah PDF — semua di satu tempat, ber-QR keaslian."
    ));
    page.appendChild(segmented(TABS, tab, (value) => {
        tab = value;
        if (location.hash.split("/").length > 2) history.replaceState(null, "", "#/documents");
        ctx.rerender();
    }));

    if (tab === "buat") page.appendChild(gallery(ctx));
    else if (tab === "kotak") page.appendChild(await inbox(ctx));
    else if (tab === "alat") page.appendChild(renderTools(ctx));
    else page.appendChild(await settingsView(ctx));
    return page;
}

/* ---------- 1. Galeri templat ---------- */

function gallery(ctx) {
    const groups = [...new Set(TEMPLATES.map((t) => t.category))];
    return el("div", { class: "erp-stack" },
        el("p", { class: "erp-muted", text: "Pilih templat. Data bisa diisi otomatis dari ERP (karyawan, pemasok, calon pelanggan, penjualan bulan ini)." }),
        groups.map((group) => el("section", { class: "erp-docgrid-wrap" },
            el("h3", { class: "erp-docgrid__group", text: group }),
            el("div", { class: "erp-docgrid" }, TEMPLATES.filter((t) => t.category === group).map((t) =>
                el("button", { class: `erp-doccard erp-doccard--${t.id}`, type: "button", onclick: () => startTemplate(ctx, t.id) },
                    el("span", { class: "erp-doccard__icon" }, svgIcon(ICON[t.id])),
                    el("strong", { text: t.label }),
                    el("small", { text: t.desc })))))));
}

/** Sumber isian otomatis per templat. */
async function prefillOptions(ctx, templateId) {
    const { data } = ctx;
    if (["slip", "keterangan", "peringatan"].includes(templateId)) {
        const members = (await data.listMembers().catch(() => [])).filter((m) => m.is_active !== false);
        return {
            label: "Karyawan",
            options: members.map((m) => ({ value: m.id, label: `${m.full_name} · ${m.position_title}` })),
            async apply(id) {
                const m = members.find((x) => x.id === id);
                const salary = await data.getSalary?.(id).catch(() => null);
                return { employee: m.full_name, position: m.position_title, base: salary?.base_salary || "" };
            },
        };
    }
    if (templateId === "po") {
        const suppliers = await data.listSuppliers?.().catch(() => []) ?? [];
        return {
            label: "Pemasok",
            options: suppliers.map((s) => ({ value: s.id, label: s.name })),
            async apply(id) {
                const s = suppliers.find((x) => x.id === id);
                return { supplier: s.name, address: [s.address, s.city, s.phone].filter(Boolean).join("\n") };
            },
        };
    }
    if (templateId === "penawaran" || templateId === "invoice") {
        const deals = await data.listDeals?.().catch(() => []) ?? [];
        return {
            label: "Calon pelanggan (pipeline CRM)",
            options: deals.filter((d) => d.stage !== "kalah").map((d) => ({ value: d.id, label: `${d.customer} · ${d.title}` })),
            async apply(id) {
                const d = deals.find((x) => x.id === id);
                const item = `${d.title} | 1 | ${d.value}`;
                return templateId === "penawaran" ? { to: d.customer, subject: d.title, items: item } : { customer: d.customer, items: item };
            },
        };
    }
    if (templateId === "laporan") {
        return { auto: true, apply: () => monthlyNumbers(ctx) };
    }
    return null;
}

async function startTemplate(ctx, templateId) {
    const template = templateById(templateId);
    let preset = {};
    try {
        const source = await prefillOptions(ctx, templateId);
        if (source?.auto) {
            preset = await source.apply();
            toast(`Angka ${periodLabel(preset.period)} diisi otomatis dari ERP. Periksa sebelum terbit.`);
        } else if (source?.options?.length) {
            const pick = await formDialog({
                title: `${template.label}: isi otomatis?`,
                submitLabel: "Lanjut",
                fields: [{ name: "src", label: `Ambil data dari ${source.label}`, type: "select", options: [{ value: "", label: "— Isi manual —" }, ...source.options] }],
            });
            if (!pick) return;
            if (pick.src) preset = await source.apply(pick.src);
        }
    } catch (error) {
        toast(friendlyError(error), "error");
    }
    fillAndIssue(ctx, template, defaultValues(template, preset));
}

async function fillAndIssue(ctx, template, values) {
    const members = await ctx.data.listMembers().catch(() => []);
    const filled = await formDialog({
        title: template.label,
        submitLabel: "Lanjut ke terbitkan →",
        fields: [
            ...template.fields.map((f) => ({
                name: f.name,
                label: f.label + (f.required ? " *" : ""),
                type: f.type === "items" ? "textarea" : f.type === "select" ? "select" : f.type || "text",
                value: values[f.name] ?? "",
                hint: f.hint,
                max: f.type === "items" || f.type === "textarea" ? 2000 : 200,
                step: f.type === "number" ? 1 : undefined,
                min: f.type === "number" ? 0 : undefined,
                options: f.type === "select" ? f.options.map((o) => ({ value: o, label: o })) : undefined,
            })),
            { name: "__sign", label: "Penerbitan", type: "select", value: ctx.me.level >= 4 ? "langsung" : "ttd",
                options: [
                    { value: "ttd", label: "Minta tanda tangan (berjenjang: atasan → owner)" },
                    { value: "langsung", label: ctx.me.level >= 4 ? "Terbitkan & tanda tangani sekarang" : "Terbitkan tanpa tanda tangan" },
                ] },
            { name: "__to", label: "Kirim ke Kotak Masuk (opsional)", type: "select", value: "", options: [{ value: "", label: "— Tidak —" }, ...members.filter((m) => m.id !== ctx.me.id && m.is_active !== false).map((m) => ({ value: m.id, label: m.full_name }))] },
            { name: "__fmt", label: "Unduh sebagai", type: "select", value: "pdf", options: [{ value: "pdf", label: "PDF (resmi, ber-QR)" }, { value: "docx", label: "Word (.docx, bisa diedit)" }, { value: "xlsx", label: "Excel (.xlsx)" }, { value: "", label: "Jangan unduh dulu" }] },
        ],
    });
    if (!filled) return;
    const { __sign, __to, __fmt, ...clean } = filled;
    const problem = validateValues(template, clean);
    if (problem) {
        toast(problem, "error");
        return fillAndIssue(ctx, template, filled);
    }
    if (template.fields.some((f) => f.type === "items") && template.fields.filter((f) => f.type === "items" && f.required).some((f) => !parseItems(clean[f.name]).length)) {
        toast("Isi minimal satu baris barang: Nama | jumlah | harga", "error");
        return fillAndIssue(ctx, template, filled);
    }
    try {
        const { record, ident } = await issueDocument(ctx.data, template.id, clean, { sign: __sign === "ttd", recipient_id: __to || null });
        invalidateProData();
        toast(record.status === "terbit" ? `${record.number} terbit.` : `${record.number} dibuat — menunggu tanda tangan. Pantau di Persetujuan.`);
        if (__fmt) await downloadDocument(ctx.data, record, __fmt, ident);
        tab = "kotak";
        box = "keluar";
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

/* ---------- 2. Kotak Masuk ---------- */

async function inbox(ctx) {
    const { data, me } = ctx;
    const [docs, approvals, members] = await Promise.all([
        data.listDocuments().catch(() => []),
        data.listApprovals().catch(() => []),
        data.listMembers().catch(() => []),
    ]);
    const nameOf = (id) => members.find((m) => m.id === id)?.full_name || "—";
    const needMe = approvals.filter((a) => a.kind === "dokumen" && a.status === "menunggu" && (currentApprover(a) ?? a.approver_id) === me.id);
    const needIds = new Set(needMe.map((a) => a.document_id));
    const lists = {
        semua: docs,
        ttd: docs.filter((d) => needIds.has(d.id)),
        keluar: docs.filter((d) => d.created_by === me.id),
        masuk: docs.filter((d) => d.recipient_id === me.id),
    };
    const wrap = el("div", { class: "erp-stack" });
    wrap.appendChild(segmented([
        { value: "semua", label: `Semua (${docs.length})` },
        { value: "ttd", label: `Perlu tanda tanganku${needMe.length ? ` (${needMe.length})` : ""}` },
        { value: "keluar", label: "Keluar" },
        { value: "masuk", label: "Masuk" },
    ], box, (v) => {
        box = v;
        ctx.rerender();
    }));

    const list = lists[box] || docs;
    if (box === "ttd" && needMe.length) {
        wrap.appendChild(el("p", { class: "erp-muted", text: "Buka dokumennya (unduh PDF bertanda DRAF), periksa, lalu setujui di menu Persetujuan. Begitu rantai selesai, dokumen terbit dengan tanda tangan & QR keaslian." }));
    }
    if (!list.length) {
        wrap.appendChild(emptyState(box === "ttd" ? "Tidak ada dokumen yang menunggu tanda tanganmu." : "Belum ada dokumen. Mulai dari tab Buat dokumen."));
        return wrap;
    }
    const ident = await loadDocBrand(data);
    wrap.appendChild(el("ul", { class: "erp-docs" }, list.map((d) => {
        const status = DOC_STATUS[d.status] || DOC_STATUS.draf;
        const canRevoke = d.status !== "dicabut" && (d.created_by === me.id || me.level >= 4);
        return el("li", { class: "erp-docrow" },
            el("span", { class: "erp-docrow__icon" }, svgIcon(ICON[d.kind] || ICON.keterangan)),
            el("div", { class: "erp-docrow__main" },
                el("strong", { text: `${DOC_KINDS[d.kind]?.label || d.kind}${d.party ? ` · ${d.party}` : ""}` }),
                el("small", { text: `${d.number} · ${dateTime(d.created_at)} · oleh ${nameOf(d.created_by)}${d.recipient_id ? ` → ${nameOf(d.recipient_id)}` : ""}${d.amount ? ` · ${rupiah(d.amount)}` : ""}` })),
            el("span", { class: `erp-pill ${status.tone ? `erp-pill--${status.tone}` : ""}`, text: status.label }),
            el("div", { class: "erp-docrow__actions" },
                ["pdf", "docx", "xlsx"].map((fmt) => el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: async (ev) => {
                    ev.currentTarget.disabled = true;
                    try {
                        await downloadDocument(data, d, fmt, ident);
                    } catch (error) {
                        toast(friendlyError(error), "error");
                    } finally {
                        ev.currentTarget.disabled = false;
                    }
                } }, { pdf: "PDF", docx: "Word", xlsx: "Excel" }[fmt])),
                needIds.has(d.id) ? el("a", { class: "erp-btn erp-btn--sm erp-btn--primary", href: "#/approvals" }, "Tanda tangani →") : null,
                el("a", { class: "erp-btn erp-btn--sm", href: `/verify.html?d=${encodeURIComponent(d.id)}&k=${String(d.hash).slice(0, 12)}`, target: "_blank", rel: "noopener" }, "Cek QR"),
                canRevoke ? el("button", { class: "erp-btn erp-btn--sm erp-btn--ghost", type: "button", onclick: async () => {
                    const values = await formDialog({ title: `Cabut ${d.number}?`, submitLabel: "Cabut dokumen", fields: [{ name: "reason", label: "Alasan (tercatat; QR akan menampilkan DICABUT)", required: true, max: 200 }] });
                    if (!values) return;
                    try {
                        await data.revokeDocument(d.id, values.reason);
                        toast("Dokumen dicabut. Pemindaian QR kini menampilkan DICABUT.");
                        ctx.rerender();
                    } catch (error) {
                        toast(friendlyError(error), "error");
                    }
                } }, "Cabut") : null));
    })));
    return wrap;
}

/* ---------- 4. Kop & tanda tangan ---------- */

async function settingsView(ctx) {
    const { data, me } = ctx;
    const ident = await loadDocBrand(data);
    const s = ident.settings;
    const canEdit = me.level >= 4;
    const preview = el("div", { class: "erp-sigpreview" });
    const drawPreview = (src) => preview.replaceChildren(src ? el("img", { src, alt: "Tanda tangan" }) : el("span", { class: "erp-muted", text: "Belum ada gambar tanda tangan." }));
    drawPreview(s.signature);

    return el("div", { class: "erp-stack" },
        el("section", { class: "erp-card" },
            el("div", { class: "erp-card__head" },
                el("div", {},
                    el("h2", { text: "Kop surat" }),
                    el("p", { class: "erp-muted", text: "Nama & logo diambil dari Etalase & Brand. Alamat/telepon di bawah menimpa kontak toko khusus untuk dokumen." }))),
            el("dl", { class: "erp-kv" },
                el("dt", { text: "Nama brand" }), el("dd", { text: ident.brand.name }),
                el("dt", { text: "Logo" }), el("dd", {}, ident.brand.logo ? el("img", { src: ident.brand.logo, alt: "Logo", class: "erp-kv__logo" }) : el("span", { class: "erp-muted", text: "Belum ada (atur di Etalase & Brand)" })),
                el("dt", { text: "Alamat" }), el("dd", { text: ident.brand.address || "-" }),
                el("dt", { text: "Kontak" }), el("dd", { text: [ident.brand.phone, ident.brand.email].filter(Boolean).join(" · ") || "-" }),
                el("dt", { text: "Penanda tangan" }), el("dd", { text: s.signer_name ? `${s.signer_name} — ${s.signer_title || ""}` : "-" }),
                el("dt", { text: "Kota" }), el("dd", { text: ident.city || "-" })),
            canEdit ? el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: async () => {
                const values = await formDialog({
                    title: "Kop & penanda tangan",
                    fields: [
                        { name: "signer_name", label: "Nama penanda tangan", value: s.signer_name || "", max: 80 },
                        { name: "signer_title", label: "Jabatan", value: s.signer_title || "", max: 80 },
                        { name: "city", label: "Kota (di tanggal surat)", value: s.city || "", max: 40 },
                        { name: "address", label: "Alamat di kop (opsional)", value: s.address || "", max: 200 },
                        { name: "phone", label: "Telepon di kop (opsional)", value: s.phone || "", max: 40 },
                        { name: "email", label: "Email di kop (opsional)", value: s.email || "", max: 80 },
                    ],
                });
                if (!values) return;
                try {
                    await data.saveDocSettings({ ...s, ...values });
                    toast("Kop surat disimpan.");
                    ctx.rerender();
                } catch (error) {
                    toast(friendlyError(error), "error");
                }
            } }, "Ubah kop & penanda tangan") : el("p", { class: "erp-muted", text: "Hanya owner/direktur yang bisa mengubah." })),
        el("section", { class: "erp-card" },
            el("h2", { text: "Tanda tangan digital" }),
            el("p", { class: "erp-muted", text: "Ditempel otomatis HANYA pada dokumen yang sudah disetujui rantai tanda tangan. Disimpan sebagai gambar, tidak pernah dikirim ke luar." }),
            preview,
            canEdit ? el("div", { class: "erp-row-actions erp-row-actions--start" },
                el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: async () => {
                    const png = await signaturePad();
                    if (!png) return;
                    try {
                        await data.saveDocSettings({ ...s, signature: png });
                        toast("Tanda tangan disimpan.");
                        ctx.rerender();
                    } catch (error) {
                        toast(friendlyError(error), "error");
                    }
                } }, "Gambar tanda tangan"),
                s.signature ? el("button", { class: "erp-btn", type: "button", onclick: async () => {
                    await data.saveDocSettings({ ...s, signature: "" });
                    ctx.rerender();
                } }, "Hapus") : null) : null));
}

/** Kanvas tanda tangan (jari / mouse / pena). Mengembalikan PNG data URL (latar transparan). */
export function signaturePad() {
    return new Promise((resolve) => {
        const canvas = el("canvas", { class: "erp-sigpad", width: 900, height: 360, "aria-label": "Area tanda tangan" });
        const g = canvas.getContext("2d");
        g.lineWidth = 5;
        g.lineCap = "round";
        g.lineJoin = "round";
        g.strokeStyle = "#12110f";
        let drawing = false;
        let drawn = false;
        const pos = (e) => {
            const r = canvas.getBoundingClientRect();
            return [((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height];
        };
        canvas.addEventListener("pointerdown", (e) => {
            drawing = true;
            canvas.setPointerCapture(e.pointerId);
            g.beginPath();
            g.moveTo(...pos(e));
        });
        canvas.addEventListener("pointermove", (e) => {
            if (!drawing) return;
            g.lineTo(...pos(e));
            g.stroke();
            drawn = true;
        });
        const end = () => {
            drawing = false;
        };
        canvas.addEventListener("pointerup", end);
        canvas.addEventListener("pointercancel", end);

        const dialog = el("dialog", { class: "erp-dialog erp-sigdialog" },
            el("h2", { class: "erp-dialog__title", text: "Tanda tangan di sini" }),
            el("p", { class: "erp-muted", text: "Pakai jari, pena, atau mouse." }),
            canvas,
            el("div", { class: "erp-form__actions" },
                el("button", { class: "erp-btn", type: "button", onclick: () => {
                    g.clearRect(0, 0, canvas.width, canvas.height);
                    drawn = false;
                } }, "Ulangi"),
                el("span", { class: "erp-spacer" }),
                el("button", { class: "erp-btn", type: "button", onclick: () => dialog.close() }, "Batal"),
                el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => {
                    if (!drawn) return toast("Tanda tangannya masih kosong.", "error");
                    dialog.returnValue = canvas.toDataURL("image/png");
                    dialog.close();
                } }, "Simpan")));
        dialog.addEventListener("close", () => {
            resolve(dialog.returnValue?.startsWith("data:image/png") ? dialog.returnValue : null);
            dialog.remove();
        });
        document.body.append(dialog);
        dialog.showModal();
    });
}

/** Untuk Agen AI: terbitkan dokumen tanpa dialog. */
export { issueDocument };
export const canIssue = (me, kind) => !(["slip", "keterangan", "peringatan"].includes(kind) && !hasRole(me, "hr") && me.level < 3);
