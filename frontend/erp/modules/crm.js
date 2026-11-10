/**
 * KANTOONG ERP — CRM PELANGGAN (Fase 3)
 * File: frontend/erp/modules/crm.js
 *
 * Daftar pelanggan otomatis dari pesanan. CS/marketing/atasan melihat
 * semua; sales melihat pelanggannya sendiri. Kontak lengkap untuk
 * marketing hanya bila pelanggan memberi izin (UU PDP).
 */

import { SEGMENTS, segmentOf } from "../core/crm.js";
import { dateTime, el, emptyState, formDialog, friendlyError, pageHeader, rupiah, segmented, statCard, toast } from "../ui.js";

import { CRM_PRO_TABS, pipelineView } from "./crm-pro.js";
import { subRoute } from "./pro-data.js";

let view = "pelanggan";
let segment = "all";
let query = "";

export async function render(ctx) {
    const { data, me } = ctx;
    const own = me.job_role === "sales" && me.level < 3;

    const page = el("div", { class: "erp-page__inner" });
    page.appendChild(pageHeader(
        own ? "Pelangganku" : "CRM Pelanggan",
        own ? "Pembeli dari tokomu. Catat kebiasaan mereka untuk penawaran berikutnya." : "Semua pembeli dari seluruh toko, otomatis dari pesanan."
    ));

    // Pro Max: pipeline calon pelanggan (tautan langsung #/crm/pipeline).
    const routed = subRoute();
    if (CRM_PRO_TABS.some((t) => t.value === routed)) view = routed;
    page.appendChild(segmented(CRM_PRO_TABS, view, (next) => {
        view = next;
        if (location.hash.split("/").length > 2) history.replaceState(null, "", "#/crm");
        ctx.rerender();
    }));
    if (view === "pipeline") {
        page.appendChild(await pipelineView(ctx));
        return page;
    }

    const customers = (await data.listCustomers()).map((customer) => ({ ...customer, segment: segmentOf(customer) }));

    const count = (key) => customers.filter((customer) => customer.segment === key).length;
    page.appendChild(el("div", { class: "erp-stats" },
        statCard({ label: "Pelanggan", value: String(customers.length) }),
        statCard({ label: "Loyal", value: String(count("loyal")), sub: "≥ 3 pesanan dibayar" }),
        statCard({ label: "Baru (30 hari)", value: String(count("baru")) }),
        statCard({ label: "Izin pemasaran", value: String(customers.filter((customer) => customer.marketing_consent).length), sub: "boleh dihubungi promo" })
    ));

    const search = el("input", { type: "search", class: "erp-search erp-search--wide", placeholder: "Cari nama, kota, tag…", "aria-label": "Cari pelanggan" });
    search.value = query;
    const list = el("div");

    const draw = () => {
        const q = query.trim().toLowerCase();
        const rows = customers
            .filter((customer) => segment === "all" || customer.segment === segment)
            .filter((customer) => !q || `${customer.name} ${customer.city || ""} ${(customer.tags || []).join(" ")}`.toLowerCase().includes(q));

        list.replaceChildren(rows.length
            ? el("ul", { class: "erp-members" }, rows.slice(0, 200).map((customer) => {
                const seg = SEGMENTS[customer.segment];
                return el("li", { class: "erp-member erp-member--crm" },
                    el("div", { class: "erp-member__main" },
                        el("strong", { text: customer.name }),
                        el("small", { text: [customer.phone, customer.city].filter(Boolean).join(" · ") }),
                        el("small", { class: "erp-muted", text: `${customer.orders_count} pesanan · ${rupiah(customer.total_spent)} · terakhir ${dateTime(customer.last_order)}` }),
                        customer.tags?.length || customer.note
                            ? el("div", { class: "erp-chips erp-chips--sm" },
                                (customer.tags || []).map((tag) => el("span", { class: "erp-tag", text: tag })),
                                customer.note ? el("small", { class: "erp-muted", text: `📝 ${customer.note}` }) : null)
                            : null
                    ),
                    el("div", { class: "erp-crm__side" },
                        el("span", { class: `erp-pill ${seg.tone ? `erp-pill--${seg.tone}` : ""}`, text: seg.label }),
                        customer.marketing_consent ? el("span", { class: "erp-pill erp-pill--good", text: "✓ Izin promo" }) : null,
                        // Nomor disamarkan (tanpa izin) tidak bisa dipakai sebagai kunci catatan.
                        String(customer.phone_key).includes("*")
                            ? null
                            : el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => editProfile(ctx, customer) }, "Catatan")
                    )
                );
            }))
            : emptyState(customers.length ? "Tidak ada pelanggan yang cocok." : "Belum ada pelanggan. Data muncul otomatis dari pesanan.")
        );
    };

    search.addEventListener("input", () => {
        query = search.value;
        draw();
    });

    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-toolbar" },
            search,
            segmented([{ value: "all", label: "Semua" }].concat(Object.entries(SEGMENTS).map(([value, entry]) => ({ value, label: entry.label }))), segment, (value) => {
                segment = value;
                ctx.rerender();
            })
        ),
        list,
        el("p", { class: "erp-muted erp-note", text: "🔒 UU PDP: hubungi pelanggan untuk promo HANYA bila kolom izin promo dicentang atas persetujuan pelanggan." })
    ));

    draw();
    return page;
}

async function editProfile(ctx, customer) {
    const values = await formDialog({
        title: `Catatan — ${customer.name}`,
        fields: [
            { name: "tags", label: "Tag (pisahkan dengan koma)", max: 200, value: (customer.tags || []).join(", "), placeholder: "reseller, suka cokelat" },
            { name: "note", label: "Catatan", type: "textarea", max: 500, value: customer.note || "" },
            { name: "consent", label: "Izin pemasaran", type: "select", value: customer.marketing_consent ? "1" : "0", options: [{ value: "0", label: "Belum / tidak setuju dihubungi promo" }, { value: "1", label: "Setuju dihubungi untuk promo" }], hint: "Ubah hanya bila pelanggan sendiri yang menyatakan." },
        ],
    });
    if (!values) return;

    try {
        await ctx.data.saveCrmProfile(customer.phone_key, {
            tags: values.tags.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean).slice(0, 10),
            note: values.note.trim(),
            marketing_consent: values.consent === "1",
        });
        toast("Catatan pelanggan disimpan.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}
