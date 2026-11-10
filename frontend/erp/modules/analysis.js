/**
 * KANTOONG ERP — ANACHRONOS ANALYSIS (add-on berbayar, di luar paket)
 * File: frontend/erp/modules/analysis.js
 *
 * Satu dashboard, dua gaya tampilan:
 *  - Kerja      : irisan sesuai divisi (sales / marketing / CS) atau semua (owner/manajer)
 *  - Presentasi : angka besar + "dari mana data ini & bagaimana privasi dijaga"
 *                 (untuk dosen, investor, pameran)
 * Data anonim dari chat AI, kasir, dan pesanan. Tidak ada nama/HP/email/isi chat.
 */

import { ADDON_NAME, DIVISION_VIEWS, buildAnalysis, viewFor } from "../core/analysis.js";
import { el, pageHeader, segmented } from "../ui.js";

let days = 30;
let mode = "work";
let pickedView = null;

const rupiah = (n) => `Rp ${Math.round(Number(n) || 0).toLocaleString("id-ID")}`;

function funnelBlock(a) {
    const top = Math.max(1, a.funnel[0]?.value ?? 1);
    return el("section", { class: "an-card an-funnel" },
        el("h3", { text: "Corong belanja" }),
        el("p", { class: "erp-muted", text: "Dari yang mengobrol dengan AI sampai masuk keranjang. Garis merah = tahap paling bocor." }),
        el("ol", { class: "an-funnel__list" }, a.funnel.map((s) => {
            const row = el("li", { class: `an-funnel__step${a.leak?.key === s.key ? " is-leak" : ""}` },
                el("span", { class: "an-funnel__bar" }),
                el("span", { class: "an-funnel__label", text: s.label }),
                el("strong", { class: "an-funnel__value", text: String(s.value) }),
                el("small", { text: `${s.pctOfTop}%${s.dropFromPrev ? ` · −${s.dropFromPrev}` : ""}` }));
            row.style.setProperty("--w", `${Math.max(4, (s.value / top) * 100)}%`);
            return row;
        })),
        el("p", { class: "an-funnel__paid" }, "Pesanan dibayar (semua kanal, ", String(a.days), " hari): ", el("strong", { text: String(a.totals.paid) }),
            el("small", { text: " — tidak dihubungkan ke sesi chat, demi privasi." })));
}

function listBlock(title, hint, rows, empty) {
    return el("section", { class: "an-card" },
        el("h3", { text: title }),
        hint ? el("p", { class: "erp-muted", text: hint }) : null,
        rows.length ? el("ol", { class: "an-list" }, rows) : el("p", { class: "erp-muted", text: empty }));
}

const row = (label, value, note = "") => el("li", {}, el("span", { text: label }), el("strong", { text: value }), note ? el("small", { text: note }) : null);

function needsBlock(a) {
    return listBlock("Kebutuhan pembeli", "Apa yang dicari — termasuk produk yang diminati tapi jarang dibeli (peluang).",
        [...a.needs.map((n) => row(n.label, `${n.count}×`)), ...a.unmet.map((u) => row(`${u.name}`, `${u.count}× dilirik`, `hanya ${u.carts} masuk keranjang`)), ...a.keywords.slice(0, 5).map((k) => row(`"${k.word}"`, `${k.count}×`, "kata yang sering dicari"))],
        "Belum ada data kebutuhan. Data muncul begitu pembeli mengobrol dengan AI.");
}

function reasonsBlock(a) {
    return listBlock("Alasan tidak beli", "Dari chat AI (kata umum) & kasir (penjualan yang hilang). Marketplace biasa tidak pernah tahu ini.",
        a.reasons.map((r) => row(r.label, `${r.count}×`, r.source)),
        "Belum ada alasan tercatat.");
}

function hoursBlock(a) {
    const max = Math.max(1, ...a.hours);
    return el("section", { class: "an-card" },
        el("h3", { text: "Jam ramai bertanya" }),
        el("div", { class: "an-hours" }, a.hours.map((v, h) => {
            const bar = el("span", { class: `an-hours__bar${h === a.peakHour ? " is-peak" : ""}`, title: `${String(h).padStart(2, "0")}.00 · ${v}` });
            bar.style.setProperty("--h", `${Math.max(3, (v / max) * 100)}%`);
            return bar;
        })),
        el("p", { class: "erp-muted", text: a.peakHour === null ? "Belum ada data." : `Puncak sekitar pukul ${String(a.peakHour).padStart(2, "0")}.00 WIB — waktu terbaik untuk promo & stok siap.` }));
}

function productsBlock(a) {
    return listBlock("Paling diminati lewat AI", "", a.topProducts.slice(0, 6).map((p) => row(p.name, `${p.count}×`, `${p.carts} ke keranjang`)), "Belum ada.");
}

const SECTIONS = { funnel: funnelBlock, needs: needsBlock, reasons: reasonsBlock, hours: hoursBlock, products: productsBlock };

function presentation(a, brand) {
    const big = (label, value, sub) => el("div", { class: "an-pres__stat" }, el("strong", { text: value }), el("span", { text: label }), sub ? el("small", { text: sub }) : null);
    return el("div", { class: "an-pres" },
        el("p", { class: "an-pres__eyebrow", text: `${ADDON_NAME} · ${brand}` }),
        el("h2", { class: "an-pres__title", text: "Apa yang sebenarnya dipikirkan pembeli" }),
        el("div", { class: "an-pres__stats" },
            big("pembeli mengobrol dengan AI", String(a.totals.sessions), `${a.days} hari terakhir`),
            big("masuk keranjang", `${a.totals.conversion}%`, "dari yang mengobrol"),
            big("alasan tidak beli terekam", String(a.reasons.reduce((s, r) => s + r.count, 0)), "chat + kasir"),
            big("penjualan hilang di kasir", rupiah(a.totals.lostValue), "dicatat 1 ketukan")),
        a.sentences.length ? el("ul", { class: "an-pres__insights" }, a.sentences.map((t) => el("li", { text: t }))) : null,
        el("div", { class: "an-pres__method" },
            el("section", {}, el("h4", { text: "Dari mana data ini" }),
                el("p", { text: "Setiap interaksi dengan asisten AI, kasir, dan pesanan online dicatat sebagai PERISTIWA anonim (bertanya, melihat produk, masuk keranjang, alasan batal). Kata kunci hanya kata katalog, kebutuhan, dan keberatan umum." })),
            el("section", {}, el("h4", { text: "Bagaimana privasi dijaga (UU PDP 27/2022)" }),
                el("p", { text: "Tanpa nama, nomor HP, email, atau isi chat. Pengunjung hanya \"Tamu #n\". Dihapus otomatis 90 hari. Tiap brand hanya melihat datanya sendiri; divisi hanya melihat irisan yang berhadapan dengan pembeli." })),
            el("section", {}, el("h4", { text: "Kenapa ini sulit ditiru" }),
                el("p", { text: "Alasan tidak beli hanya bisa didapat bila pembeli MENGOBROL — dan mereka mengobrol karena asistennya membantu. Semakin banyak dipakai, semakin tajam datanya." }))));
}

export async function render(ctx) {
    const { data, me } = ctx;
    const view = pickedView && (viewFor(me) === "owner") ? pickedView : viewFor(me);
    const page = el("div", { class: "erp-page__inner an-page" });

    const [raw, products, brands] = await Promise.all([
        data.analysisData?.({ days }) ?? { events: [], lost: [], orders: [] },
        data.listProducts?.().catch(() => []) ?? [],
        data.researchBrands?.().catch(() => []) ?? [],
    ]);
    const brand = brands?.[0]?.name || "Brand";
    const a = buildAnalysis({ events: raw.events, products, lost: raw.lost, orders: raw.orders, days });

    const modeSwitch = segmented([{ value: "work", label: "Kerja" }, { value: "present", label: "Mode Presentasi" }], mode, (v) => {
        mode = v;
        ctx.rerender();
    });
    page.append(pageHeader(ADDON_NAME, `Add-on · ${DIVISION_VIEWS[view]?.label ?? ""} · data anonim ${days} hari terakhir`, modeSwitch));

    if (!view) {
        page.append(el("p", { class: "erp-muted", text: "Menu ini untuk owner, manajer, dan divisi yang berhadapan dengan pembeli (sales, marketing, CS)." }));
        return page;
    }

    const controls = el("div", { class: "an-controls" },
        segmented([{ value: 7, label: "7 hari" }, { value: 30, label: "30 hari" }, { value: 90, label: "90 hari" }], days, (v) => {
            days = v;
            ctx.rerender();
        }),
        viewFor(me) === "owner" ? segmented(Object.entries(DIVISION_VIEWS).map(([value, v]) => ({ value, label: v.label })), view, (v) => {
            pickedView = v;
            ctx.rerender();
        }) : null);
    page.append(controls);

    if (mode === "present") {
        page.append(presentation(a, brand));
        return page;
    }

    if (a.sentences.length) page.append(el("section", { class: "an-card an-story" }, el("h3", { text: "Ringkasan" }), el("ul", {}, a.sentences.map((t) => el("li", { text: t })))));
    page.append(el("div", { class: "an-grid" }, DIVISION_VIEWS[view].sections.map((key) => SECTIONS[key](a))));
    page.append(el("p", { class: "erp-muted an-privacy", text: "🔒 Anonim: tanpa nama/HP/email/isi chat. Hanya data brand ini. Dihapus otomatis 90 hari." }));
    return page;
}
