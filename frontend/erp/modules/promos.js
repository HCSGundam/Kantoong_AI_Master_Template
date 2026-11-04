/**
 * KANTOONG ERP — PROMO & MEMBER (Tahap 4 POS Pro)
 * File: frontend/erp/modules/promos.js
 *
 * Untuk owner, manajer & keuangan. Lapisan Zero-to-One:
 *   - PROMO YANG MEMBUKTIKAN DIRINYA SENDIRI: tiap promo dinilai untung / impas / boncos
 *     dari omzet bersih di jamnya, dibanding periode yang sama sebelum promo.
 *   - SARAN PROMO DARI DATA: jam sepi & stok lambat laku (bukan ikut kompetitor).
 *   - RADAR PELANGGAN MENGHILANG: member yang sudah lewat jauh dari jadwal datangnya.
 *     Kontak WhatsApp hanya untuk member yang mengizinkan promo (UU PDP).
 */

import { hasRole } from "../core/org.js";
import { DAY_NAMES, PROMO_KINDS, promoActive, promoReport, scheduleText, suggestPromos } from "../core/promo.js";
import { churnRadar, loyaltySummary } from "../core/loyalty.js";
import { saleCogs } from "../core/recipe.js";
import { confirmDialog, dateTime, el, emptyState, formDialog, friendlyError, pageHeader, rupiah, statCard, toast } from "../ui.js";

const DAY = 86400000;

export async function render(ctx) {
    const { data, me } = ctx;
    const page = el("div", { class: "erp-page__inner" });
    const canEdit = me.level >= 4 || hasRole(me, "marketing");

    // listPromos lebih dulu: data demo lama mendapat data member & promo contoh.
    const promos = await data.listPromos();
    const [sales, products, members, ledger, memberSales, levels, warehouses, book] = await Promise.all([
        data.listPosSales({ since: new Date(Date.now() - 56 * DAY).toISOString() }),
        data.listProducts(),
        data.listPosMembers(),
        data.listPointsLedger(),
        data.listMemberSales(),
        data.listStockLevels(),
        data.listWarehouses(),
        data.getRecipes ? data.getRecipes() : { recipes: {}, optionRecipes: {} },
    ]);
    // HPP untuk laba kotor promo (Tahap 5). Bahan dari outlet pertama (harga modal sama untuk semua outlet).
    const firstOutlet = warehouses.find((entry) => entry.kind === "outlet");
    const ingredients = firstOutlet && data.listIngredients ? await data.listIngredients(firstOutlet.id) : [];
    const costContext = { recipes: book.recipes, optionRecipes: book.optionRecipes, ingredients };
    const hasCosts = ingredients.some((entry) => entry.cost !== null) && Object.keys(book.recipes).length > 0;
    const gross = hasCosts ? (sale) => Number(sale.total) - Number(sale.service || 0) - Number(sale.tax || 0) - saleCogs(sale, costContext) : null;

    const outlets = new Set(warehouses.filter((entry) => entry.kind === "outlet").map((entry) => entry.id));
    const stock = {};
    for (const level of levels) {
        if (outlets.has(level.warehouse_id)) stock[String(level.product_id)] = (stock[String(level.product_id)] || 0) + Number(level.qty || 0);
    }

    const summary = loyaltySummary({ members, sales, ledger });
    const pointValue = 100;
    const promoCost = sales
        .filter((sale) => sale.status !== "batal" && new Date(sale.created_at).getTime() >= Date.now() - 28 * DAY)
        .reduce((sum, sale) => sum + (Number(sale.promo_discount) || 0), 0);

    page.append(
        pageHeader(
            "Promo & Member",
            "Promo yang membuktikan dirinya sendiri · Kasir yang Ingat · Radar pelanggan menghilang",
            canEdit ? el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => editPromo(ctx, products) }, "+ Promo baru") : null
        ),
        el("div", { class: "erp-stats" },
            statCard({ label: "Member terdaftar", value: String(summary.members), sub: `${summary.consentPromo} mengizinkan promo` }),
            statCard({ label: "Transaksi oleh member", value: `${summary.memberShare}%`, sub: "30 hari terakhir" }),
            statCard({
                label: "Rata-rata struk member vs tamu",
                value: rupiah(summary.memberAvg),
                sub: `tamu ${rupiah(summary.guestAvg)}${summary.guestAvg ? ` · ${summary.memberAvg >= summary.guestAvg ? "+" : ""}${Math.round(((summary.memberAvg - summary.guestAvg) / summary.guestAvg) * 100)}%` : ""}`,
                tone: summary.memberAvg > summary.guestAvg ? "good" : "",
            }),
            statCard({ label: "Poin beredar", value: `${summary.pointsOutstanding} poin`, sub: `≈ ${rupiah(summary.pointsOutstanding * pointValue)} kewajiban ke member` }),
            statCard({ label: "Diskon promo 28 hari", value: rupiah(promoCost), sub: "uang yang \"dibelanjakan\" untuk promo" })
        )
    );

    // ---------- Promo & buktinya ----------
    const now = new Date();
    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" }, el("h2", { text: "Promo & buktinya" })),
        el("p", { class: "erp-muted", text: "Tiap promo dibandingkan dengan jam & hari yang sama SEBELUM promo dimulai. Omzet dihitung setelah diskon, jadi angka naik/turun adalah hasil BERSIH. Promo tidak berlaku untuk pesanan ojol." }),
        promos.length
            ? el("ul", { class: "erp-promo-list" }, promos.map((promo) => promoCard(ctx, promo, promoReport(promo, sales, now, { gross }), products, canEdit)))
            : emptyState("Belum ada promo. Lihat saran di bawah, atau buat promo baru.")
    ));

    // ---------- Saran promo dari data ----------
    const suggestions = suggestPromos({ sales, products, stock, promos, now });
    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" }, el("h2", { text: "💡 Saran promo dari datamu" })),
        el("p", { class: "erp-muted", text: "Bukan ikut-ikutan kompetitor: saran dibuat dari jam sepi & stok lambat laku di tokomu sendiri." }),
        suggestions.length
            ? el("div", { class: "erp-suggest" }, suggestions.map((suggestion) => el("article", {},
                el("h3", { text: suggestion.title }),
                el("p", { text: suggestion.reason }),
                canEdit ? el("div", {}, el("button", { class: "erp-btn erp-btn--sm erp-btn--primary", type: "button", onclick: () => editPromo(ctx, products, suggestion.draft) }, "Pakai saran ini")) : null
            )))
            : emptyState("Belum ada saran: data penjualan masih sedikit, atau promo yang ada sudah menutup jam sepi.")
    ));

    // ---------- Radar pelanggan menghilang ----------
    const radar = churnRadar(members, memberSales, now);
    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" }, el("h2", { text: `📡 Radar pelanggan menghilang (${radar.length})` })),
        el("p", { class: "erp-muted", text: "Member setia yang sudah jauh melewati jadwal datang biasanya. POS biasa baru sadar setelah mereka pindah ke kafe lain. Hubungi hanya yang mengizinkan promo." }),
        radar.length
            ? el("div", { class: "erp-table-wrap" }, el("table", { class: "erp-table" },
                el("thead", {}, el("tr", {}, ...["Member", "Biasanya datang", "Terakhir datang", "Total belanja", "Favorit", "Sapa"].map((head) => el("th", { text: head })))),
                el("tbody", {}, radar.map(({ member, profile, usual }) => el("tr", {},
                    el("td", {}, el("strong", { text: member.name }), el("br"), el("small", { class: "erp-muted", text: `${profile.visits}× kunjungan` })),
                    el("td", { text: `tiap ±${Math.round(usual)} hari` }),
                    el("td", { class: "erp-tone-late", text: `${profile.lastDays} hari lalu` }),
                    el("td", { text: rupiah(profile.spent) }),
                    el("td", { text: profile.favorites[0] ? `${profile.favorites[0].name}${profile.favorites[0].options.length ? ` (${profile.favorites[0].options.map((option) => option.name).filter(Boolean).join(", ")})` : ""}` : "—" }),
                    el("td", {}, contactCell(member, profile))
                )))
            ))
            : emptyState("Tidak ada member setia yang menghilang. Mantap!")
    ));

    // ---------- Daftar member ----------
    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" }, el("h2", { text: `Member (${members.length})` })),
        el("p", { class: "erp-muted", text: "Pendaftaran & hapus data dilakukan di kasir (atas permintaan member). Nomor lengkap hanya tampil untuk member yang mengizinkan promo." }),
        members.length
            ? el("div", { class: "erp-table-wrap" }, el("table", { class: "erp-table" },
                el("thead", {}, el("tr", {}, ...["Nama", "Nomor HP", "Poin", "Izin riwayat", "Izin promo", "Bergabung"].map((head) => el("th", { text: head })))),
                el("tbody", {}, members.slice().sort((a, b) => b.points - a.points).map((member) => el("tr", {},
                    el("td", { text: member.name }),
                    el("td", { text: member.phone || member.phone_masked }),
                    el("td", { text: String(member.points) }),
                    el("td", { text: member.consent_history ? "✅" : "—" }),
                    el("td", { text: member.consent_promo ? "✅" : "🔕" }),
                    el("td", { text: dateTime(member.joined_at) })
                )))
            ))
            : emptyState("Belum ada member. Daftarkan dari kasir: cukup nama + nomor HP.")
    ));

    return page;
}

function contactCell(member, profile) {
    if (!member.consent_promo || !member.phone) return el("small", { class: "erp-muted", text: "🔕 Tidak mengizinkan promo — sapa saat ia datang" });
    const favorite = profile.favorites[0]?.name;
    const text = `Halo Kak ${member.name.split(" ")[0]}, sudah lama nggak mampir nih${favorite ? `. ${favorite} favoritmu masih ada` : ""}. Ditunggu ya!`;
    const digits = member.phone.replace(/\D/g, "").replace(/^0/, "62");
    return el("a", { class: "erp-btn erp-btn--sm", href: `https://wa.me/${digits}?text=${encodeURIComponent(text)}`, target: "_blank", rel: "noopener" }, "💬 WhatsApp");
}

function promoCard(ctx, promo, report, products, canEdit) {
    const nameOf = (id) => products.find((product) => String(product.id) === String(id))?.name || "Menu";
    const running = promoActive(promo, new Date());
    const target = promo.kind === "bundle"
        ? `Paket: ${promo.bundle_ids.map(nameOf).join(" + ")} · potong ${rupiah(promo.bundle_amount)} per paket`
        : `Diskon ${promo.percent}% · ${promo.product_ids.length ? `${promo.product_ids.length} menu` : promo.categories.length ? promo.categories.join(", ") : "semua menu"}`;
    const arrow = (before, after, format) => `${format(before)} → ${format(after)}`;

    return el("li", { class: `erp-promo${promo.is_active === false ? " is-off" : ""}` },
        el("div", { class: "erp-promo__head" },
            el("h3", {}, `${promo.kind === "bundle" ? "📦" : "⏰"} ${promo.name} `,
                el("span", { class: `erp-badge${running ? " erp-badge--good" : ""}`, text: promo.is_active === false ? "Nonaktif" : running ? "Sedang berjalan" : "Terjadwal" })),
            el("small", { class: "erp-muted", text: PROMO_KINDS[promo.kind]?.label || "" })),
        el("p", { class: "erp-promo__meta", text: `${target} · ${scheduleText(promo)}${promo.members_only ? " · khusus member" : ""}${promo.starts_on ? ` · mulai ${promo.starts_on}` : ""}${promo.ends_on ? ` s/d ${promo.ends_on}` : ""}` }),
        el("dl", { class: "erp-promo__nums" },
            el("div", {}, el("dt", { text: "Dipakai" }), el("dd", { text: `${report.uses}×` })),
            el("div", {}, el("dt", { text: "Biaya diskon" }), el("dd", { text: rupiah(report.cost) })),
            el("div", {}, el("dt", { text: "Omzet/hari di jam promo" }), el("dd", { text: arrow(report.avgBefore, report.avgAfter, rupiah) })),
            el("div", {}, el("dt", { text: "Transaksi/hari di jam promo" }), el("dd", { text: arrow(report.txBefore, report.txAfter, String) })),
            report.grossAfter !== null ? el("div", {}, el("dt", { text: "Laba kotor/hari (setelah HPP)" }), el("dd", { text: arrow(report.grossBefore, report.grossAfter, rupiah) })) : null,
            el("div", {},
                el("dt", { text: report.verdict.key === "bukan" ? "Selisih omzet (belum tentu dari promo)" : "Selisih bersih" }),
                el("dd", {
                    class: report.verdict.key === "bukan" ? null : report.lift >= 0 ? "erp-tone-good" : "erp-tone-late",
                    text: `${report.lift >= 0 ? "+" : "−"}${rupiah(Math.abs(report.lift))}`,
                }))
        ),
        el("p", { class: `erp-verdict${report.verdict.tone ? ` erp-verdict--${report.verdict.tone}` : ""}`, text: report.verdict.text }),
        el("p", { class: "erp-promo__meta", text: `Dibanding ${report.daysBefore} hari sebelum promo vs ${report.daysAfter} hari sesudah.${report.grossLift !== null ? ` Laba kotor (setelah HPP bahan) ${report.grossLift >= 0 ? "naik" : "turun"} ${rupiah(Math.abs(report.grossLift))} — ini angka yang paling jujur.` : ""}` }),
        canEdit
            ? el("div", { class: "erp-promo__actions" },
                el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => editPromo(ctx, products, promo) }, "Ubah"),
                el("button", {
                    class: "erp-btn erp-btn--sm", type: "button",
                    onclick: async () => {
                        try {
                            await ctx.data.savePromo({ ...promo, is_active: promo.is_active === false });
                            toast(promo.is_active === false ? "Promo diaktifkan." : "Promo dihentikan.");
                            ctx.rerender();
                        } catch (error) {
                            toast(friendlyError(error), "error");
                        }
                    },
                }, promo.is_active === false ? "Aktifkan" : "Hentikan"),
                el("button", {
                    class: "erp-btn erp-btn--sm", type: "button",
                    onclick: async () => {
                        if (!(await confirmDialog(`Hapus promo "${promo.name}"? Struk lama tetap mencatat potongannya.`))) return;
                        try {
                            await ctx.data.deletePromo(promo.id);
                            ctx.rerender();
                        } catch (error) {
                            toast(friendlyError(error), "error");
                        }
                    },
                }, "Hapus"))
            : null
    );
}

async function editPromo(ctx, products, draft = {}) {
    let kind = draft.kind;
    if (!kind) {
        const chosen = await formDialog({
            title: "Promo baru",
            fields: [{ name: "kind", label: "Jenis promo", type: "select", value: "happy_hour", options: Object.entries(PROMO_KINDS).map(([value, entry]) => ({ value, label: `${entry.label} — ${entry.hint}` })) }],
            submitLabel: "Lanjut",
        });
        if (!chosen) return;
        kind = chosen.kind;
    }

    const menu = products.map((product) => ({ value: String(product.id), label: product.name }));
    const categories = [...new Set(products.map((product) => product.category || "Umum"))].map((category) => ({ value: category, label: category }));
    const days = DAY_NAMES.map((label, index) => ({ value: String(index), label }));
    const yesNo = [{ value: "tidak", label: "Semua pelanggan" }, { value: "ya", label: "Khusus member" }];

    const fields = [{ name: "name", label: "Nama promo", required: true, max: 60, value: draft.name || "" }];
    if (kind === "happy_hour") {
        fields.push(
            { name: "percent", label: "Diskon (%)", type: "number", min: 1, max: 90, step: 1, required: true, value: draft.percent || 15 },
            { name: "product_ids", label: "Menu yang didiskon", type: "checkboxes", options: menu, value: (draft.product_ids || []).map(String), hint: "Kosongkan menu & kategori = semua menu." },
            { name: "categories", label: "…atau per kategori", type: "checkboxes", options: categories, value: draft.categories || [] }
        );
    } else {
        fields.push(
            { name: "bundle_ids", label: "Menu dalam paket (2–5)", type: "checkboxes", options: menu, value: (draft.bundle_ids || []).map(String) },
            { name: "bundle_amount", label: "Potongan per paket (Rp)", type: "number", min: 500, step: 500, required: true, value: draft.bundle_amount || 5000 }
        );
    }
    fields.push(
        { name: "days", label: "Hari", type: "checkboxes", options: days, value: (draft.days || []).map(String), hint: "Kosongkan = setiap hari." },
        { name: "start_time", label: "Jam mulai (WIB)", type: "time", value: draft.start_time || "", hint: "Kosongkan jam mulai & selesai = sepanjang hari." },
        { name: "end_time", label: "Jam selesai (WIB)", type: "time", value: draft.end_time || "" },
        { name: "members_only", label: "Berlaku untuk", type: "select", value: draft.members_only ? "ya" : "tidak", options: yesNo },
        { name: "starts_on", label: "Mulai tanggal", type: "date", value: draft.starts_on || "" },
        { name: "ends_on", label: "Sampai tanggal (opsional)", type: "date", value: draft.ends_on || "" }
    );

    const values = await formDialog({ title: draft.id ? `Ubah promo · ${draft.name}` : `${PROMO_KINDS[kind].label} baru`, fields, submitLabel: "Simpan promo" });
    if (!values) return;
    try {
        await ctx.data.savePromo({
            ...draft,
            ...values,
            kind,
            days: (values.days || []).map(Number),
            members_only: values.members_only === "ya",
            starts_on: values.starts_on || null,
            ends_on: values.ends_on || null,
            is_active: draft.is_active !== false,
        });
        toast("Promo disimpan. Kasir langsung memakainya sesuai jadwal.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}
