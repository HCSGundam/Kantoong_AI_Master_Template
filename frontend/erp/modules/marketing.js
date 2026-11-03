/**
 * KANTOONG ERP — MARKETING: VOUCHER (Fase 3)
 * File: frontend/erp/modules/marketing.js
 *
 * Voucher dipakai pembeli di checkout toko (semua toko sales). Kuota,
 * masa berlaku, dan minimal belanja diperiksa ulang oleh server.
 */

import { hasRole } from "../core/org.js";
import { VOUCHER_KINDS, checkVoucher, describeVoucher, isValidCode, normalizeCode } from "../core/marketing.js";
import { el, emptyState, formDialog, friendlyError, pageHeader, rupiah, statCard, toast } from "../ui.js";

function statusOf(voucher, now = new Date()) {
    if (!voucher.is_active) return { label: "Nonaktif", tone: "" };
    if (voucher.ends_at && now > new Date(voucher.ends_at)) return { label: "Berakhir", tone: "bad" };
    if (voucher.starts_at && now < new Date(voucher.starts_at)) return { label: "Terjadwal", tone: "" };
    if (voucher.quota && voucher.used >= voucher.quota) return { label: "Kuota habis", tone: "warn" };
    return { label: "Aktif", tone: "good" };
}

const toLocalInput = (iso) => (iso ? new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 10) : "");

export async function render(ctx) {
    const { data, me } = ctx;
    const canEdit = hasRole(me, "marketing");
    const [vouchers, redemptions] = await Promise.all([data.listVouchers(), data.listRedemptions()]);

    const active = vouchers.filter((voucher) => statusOf(voucher).label === "Aktif");
    const discountTotal = redemptions.reduce((sum, row) => sum + Number(row.discount || 0), 0);

    const page = el("div", { class: "erp-page__inner" });
    page.appendChild(pageHeader(
        "Marketing",
        "Voucher berlaku di checkout semua toko sales & toko utama.",
        canEdit ? el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => editVoucher(ctx, {}) }, "+ Voucher") : null
    ));

    page.appendChild(el("div", { class: "erp-stats" },
        statCard({ label: "Voucher aktif", value: String(active.length), sub: `${vouchers.length} voucher total` }),
        statCard({ label: "Dipakai", value: `${redemptions.length}×`, sub: "pesanan memakai voucher" }),
        statCard({ label: "Total potongan diberikan", value: rupiah(discountTotal) })
    ));

    // Simulasi: cek voucher seperti pembeli di checkout.
    const codeInput = el("input", { type: "text", class: "erp-search", placeholder: "Kode voucher", maxlength: 20, "aria-label": "Kode voucher" });
    const totalInput = el("input", { type: "number", class: "erp-search", placeholder: "Total belanja (Rp)", min: 0, step: 1000, "aria-label": "Total belanja" });
    const result = el("p", { class: "erp-muted", text: "Coba kode seperti yang dilihat pembeli di checkout." });

    page.appendChild(el("section", { class: "erp-card" },
        el("h2", { text: "Cek voucher" }),
        el("div", { class: "erp-toolbar" },
            codeInput,
            totalInput,
            el("button", {
                class: "erp-btn", type: "button",
                onclick: async () => {
                    try {
                        const res = await data.checkVoucher(normalizeCode(codeInput.value), Number(totalInput.value) || 0);
                        result.textContent = res.valid ? `✓ Berlaku: potongan ${rupiah(res.discount)} (${describeVoucher(res)})` : `✗ ${res.message}`;
                        result.className = res.valid ? "erp-plus" : "erp-form__error";
                    } catch (error) {
                        result.textContent = friendlyError(error);
                        result.className = "erp-form__error";
                    }
                },
            }, "Cek")
        ),
        result
    ));

    if (!vouchers.length) {
        page.appendChild(emptyState("Belum ada voucher."));
        return page;
    }

    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-table-wrap" }, el("table", { class: "erp-table" },
            el("thead", {}, el("tr", {}, ["Kode", "Keterangan", "Dipakai", "Berlaku", "Status", ""].map((head) => el("th", { text: head })))),
            el("tbody", {}, vouchers.map((voucher) => {
                const status = statusOf(voucher);
                return el("tr", {},
                    el("td", { "data-label": "Kode" }, el("code", { text: voucher.code })),
                    el("td", { "data-label": "Keterangan" }, el("strong", { text: voucher.title }), el("br"), el("small", { class: "erp-muted", text: describeVoucher(voucher) })),
                    el("td", { "data-label": "Dipakai", text: voucher.quota ? `${voucher.used}/${voucher.quota}` : `${voucher.used}×` }),
                    el("td", { "data-label": "Berlaku", text: `${toLocalInput(voucher.starts_at) || "kapan saja"} → ${toLocalInput(voucher.ends_at) || "tanpa batas"}` }),
                    el("td", { "data-label": "Status" }, el("span", { class: `erp-pill ${status.tone ? `erp-pill--${status.tone}` : ""}`, text: status.label })),
                    el("td", {}, canEdit ? el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => editVoucher(ctx, voucher) }, "Ubah") : null)
                );
            }))
        ))
    ));

    return page;
}

async function editVoucher(ctx, voucher) {
    const values = await formDialog({
        title: voucher.id ? `Ubah voucher ${voucher.code}` : "Voucher baru",
        fields: [
            { name: "code", label: "Kode (huruf besar & angka)", required: true, max: 20, value: voucher.code || "", placeholder: "HEMAT10" },
            { name: "title", label: "Nama promo", required: true, max: 80, value: voucher.title || "" },
            { name: "kind", label: "Jenis", type: "select", value: voucher.kind || "persen", options: Object.entries(VOUCHER_KINDS).map(([value, label]) => ({ value, label })) },
            { name: "value", label: "Besar potongan (% atau Rp)", type: "number", min: 1, step: 1, required: true, value: voucher.value ?? "" },
            { name: "max_discount", label: "Potongan maksimal (Rp, khusus %)", type: "number", min: 0, step: 1000, value: voucher.max_discount ?? "" },
            { name: "min_purchase", label: "Minimal belanja (Rp)", type: "number", min: 0, step: 1000, value: voucher.min_purchase ?? 0 },
            { name: "quota", label: "Kuota pemakaian (kosong = tanpa batas)", type: "number", min: 1, step: 1, value: voucher.quota ?? "" },
            { name: "starts_at", label: "Mulai berlaku", type: "date", value: toLocalInput(voucher.starts_at) },
            { name: "ends_at", label: "Berakhir", type: "date", value: toLocalInput(voucher.ends_at) },
            { name: "is_active", label: "Status", type: "select", value: voucher.is_active === false ? "0" : "1", options: [{ value: "1", label: "Aktif" }, { value: "0", label: "Nonaktif" }] },
        ],
    });
    if (!values) return;

    const code = normalizeCode(values.code);
    const value = Number(values.value);
    if (!isValidCode(code)) return toast("Kode 3–20 huruf besar/angka, tanpa spasi.", "error");
    if (!(value > 0) || (values.kind === "persen" && value > 100)) return toast("Besar potongan tidak valid.", "error");

    const preview = checkVoucher({ kind: values.kind, value, max_discount: Number(values.max_discount) || null, min_purchase: 0, is_active: true }, 100000);

    try {
        await ctx.data.saveVoucher({
            ...(voucher.id ? { id: voucher.id } : {}),
            code,
            title: values.title.trim(),
            kind: values.kind,
            value,
            max_discount: values.kind === "persen" && Number(values.max_discount) > 0 ? Math.round(Number(values.max_discount)) : null,
            min_purchase: Math.max(0, Math.round(Number(values.min_purchase) || 0)),
            quota: Number(values.quota) > 0 ? Math.floor(Number(values.quota)) : null,
            starts_at: values.starts_at ? new Date(`${values.starts_at}T00:00:00+07:00`).toISOString() : null,
            ends_at: values.ends_at ? new Date(`${values.ends_at}T23:59:59+07:00`).toISOString() : null,
            is_active: values.is_active === "1",
        });
        toast(`Voucher disimpan. Contoh: belanja Rp 100.000 dapat potongan ${rupiah(preview.discount)}.`);
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}
