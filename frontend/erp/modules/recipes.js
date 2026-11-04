/**
 * KANTOONG ERP — RESEP & HPP (Tahap 5 POS Pro)
 * File: frontend/erp/modules/recipes.js
 *
 * Untuk owner, manajer, staf produk/gudang & keuangan. Pertanyaan terbalik:
 * "Kenapa kafe ramai tapi tetap rugi, dan bagaimana bahan hilang tanpa ketahuan?"
 *   - HPP & laba per menu (termasuk varian) + kelas menu (bintang/kuda kerja/teka-teki/beban)
 *   - HARGA OJOL AMAN?: laba setelah komisi aplikasi vs jual di toko
 *   - PERINGATAN BELANJA: bahan habis dalam berapa hari, beli berapa
 *   - BAHAN YANG HILANG: selisih hitung stok + bahan dibuang, dalam rupiah + dugaan penyebab
 *   - HITUNG STOK BUTA: angka catatan sistem tidak ditampilkan saat menghitung (jujur)
 */

import { hasRole } from "../core/org.js";
import { posSettings } from "../core/pos-pro.js";
import {
    MENU_CLASSES, UNITS, WASTE_REASONS, burnForecast, formatRecipeLines, grossSummary, lossReport, menuCosting, parseRecipeLines,
    safeOnlineMarkup, salesUsage,
} from "../core/recipe.js";
import { dateTime, el, emptyState, formDialog, friendlyError, pageHeader, rupiah, segmented, statCard, toast } from "../ui.js";

const DAY = 86400000;
const view = { outlet: null, showAll: false };
const dec = (value) => Number(value).toLocaleString("id-ID");
const qtyText = (value, unit) => `${(Math.round(Number(value) * 10) / 10).toLocaleString("id-ID")} ${unit}`;

export async function render(ctx) {
    const { data, me } = ctx;
    const page = el("div", { class: "erp-page__inner" });
    const warehouses = await data.listWarehouses();
    const outlets = warehouses.filter((entry) => entry.kind === "outlet" && entry.is_active !== false);
    if (!outlets.some((entry) => entry.id === view.outlet)) view.outlet = outlets[0]?.id || null;
    if (!outlets.length) {
        page.append(pageHeader("Resep & HPP", "Belum ada outlet."), emptyState("Buat outlet dulu di menu Gudang & Stok (jenis: Outlet)."));
        return page;
    }

    const [settingsRaw, ingredients, book, products, sales, moves, groups, restocks, staff] = await Promise.all([
        data.getPosSettings(view.outlet),
        data.listIngredients(view.outlet),
        data.getRecipes(),
        data.listProducts(),
        data.listPosSales({ since: new Date(Date.now() - 28 * DAY).toISOString() }),
        data.listIngredientMoves({ outletId: view.outlet, days: 14 }),
        data.listPosModifiers(),
        data.listRestockRequests ? data.listRestockRequests({ outletId: view.outlet }) : [],
        data.listMembers(),
    ]);
    const staffName = (id) => staff.find((member) => member.id === id)?.full_name || "Kasir";
    const settings = posSettings(settingsRaw);
    const { recipes, optionRecipes } = book;
    const context = { recipes, optionRecipes, ingredients };
    const outletSales = sales.filter((sale) => sale.outlet_id === view.outlet);
    const stock = Object.fromEntries(ingredients.map((entry) => [entry.id, entry.stock]));
    const now = Date.now();
    const canEdit = hasRole(me, "produk");
    const canStock = hasRole(me, "produk", "gudang") || me.level >= 3;

    const week = grossSummary(outletSales, context, { from: now - 7 * DAY, to: now + 1 });
    const forecast = burnForecast({ ingredients, stock, sales: outletSales, recipes, optionRecipes, now });
    const loss = lossReport({ moves, ingredients, usage: salesUsage(outletSales, context, { from: now - 14 * DAY, to: now + 1 }) });
    const costing = menuCosting({ products, recipes, optionRecipes, ingredients, settings, sales: outletSales });
    const critical = forecast.filter((row) => row.tone === "late");
    const outlet = outlets.find((entry) => entry.id === view.outlet);

    page.append(
        pageHeader(
            "Resep & HPP",
            `${outlet.name} · HPP otomatis per varian · bahan habis otomatis · bahan yang hilang`,
            outlets.length > 1 ? segmented(outlets.map((entry) => ({ value: entry.id, label: `🏪 ${entry.name}` })), view.outlet, (value) => { view.outlet = value; ctx.rerender(); }) : null,
            canStock ? el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => buyDialog(ctx, view.outlet, ingredients) }, "🛒 Catat belanja") : null,
            canStock ? el("button", { class: "erp-btn", type: "button", onclick: () => countDialog(ctx, view.outlet, ingredients) }, "🧮 Hitung stok") : null,
            el("button", { class: "erp-btn", type: "button", onclick: () => wasteDialog(ctx, view.outlet, ingredients) }, "🗑️ Bahan dibuang"),
            canEdit ? el("button", { class: "erp-btn", type: "button", onclick: () => editIngredient(ctx) }, "+ Bahan") : null
        ),
        el("div", { class: "erp-stats" },
            statCard({
                label: "HPP dari penjualan (7 hari)",
                value: `${dec(week.foodCost)}%`,
                sub: `target ${settings.target_food_cost}% · HPP ${rupiah(week.cogs)}`,
                tone: week.foodCost > settings.target_food_cost ? "alert" : "good",
            }),
            statCard({ label: "Laba kotor 7 hari", value: rupiah(week.gross), sub: `dari penjualan bersih ${rupiah(week.revenue)}` }),
            statCard({
                label: "Bahan hilang & terbuang (14 hari)",
                value: rupiah(loss.lostValue + loss.wasteValue),
                sub: `hilang tanpa catatan ${rupiah(loss.lostValue)} · dibuang ${rupiah(loss.wasteValue)}`,
                tone: loss.lostValue ? "alert" : "",
            }),
            statCard({ label: "Bahan kritis", value: String(critical.length), sub: critical.length ? critical.map((row) => row.ingredient.name).slice(0, 3).join(", ") : "semua aman", tone: critical.length ? "alert" : "good" })
        )
    );

    // ---------- Permintaan restok dari kasir (menu habis) ----------
    if (restocks.length) {
        page.appendChild(el("section", { class: "erp-card erp-restock" },
            el("div", { class: "erp-card__head" }, el("h2", { text: `📣 Permintaan restok dari kasir (${restocks.length})` })),
            el("p", { class: "erp-muted", text: "Menu sedang HABIS di kasir. Catat belanja bahannya → permintaan selesai otomatis & menu langsung bisa dijual lagi." }),
            el("ul", { class: "erp-restock__list" }, restocks.map((row) => el("li", {},
                el("div", {},
                    el("strong", { text: row.name }),
                    el("small", { text: `${row.ingredient_name ? `Bahan: ${row.ingredient_name} · ` : ""}diminta ${staffName(row.requested_by)} ${dateTime(row.last_at)}${row.count > 1 ? ` · ${row.count}× diminta` : ""}` })),
                el("div", { class: "erp-restock__actions" },
                    canStock && row.ingredient_id ? el("button", { class: "erp-btn erp-btn--sm erp-btn--primary", type: "button", onclick: () => buyDialog(ctx, view.outlet, ingredients, row.ingredient_id) }, "🛒 Catat belanja") : null,
                    canStock ? el("button", {
                        class: "erp-btn erp-btn--sm", type: "button",
                        onclick: () => run(ctx, () => ctx.data.resolveRestock(row.id, "Ditandai selesai"), "Permintaan restok ditandai selesai."),
                    }, "Tandai selesai") : null)
            )))
        ));
    }

    // ---------- Peringatan belanja ----------
    const shown = view.showAll ? forecast : forecast.filter((row) => row.tone !== "ok").slice(0, 10);
    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" },
            el("h2", { text: "🛒 Peringatan belanja bahan" }),
            el("button", { class: "erp-link", type: "button", onclick: () => { view.showAll = !view.showAll; ctx.rerender(); } }, view.showAll ? "Hanya yang perlu dibeli" : "Lihat semua bahan")),
        el("p", { class: "erp-muted", text: "Dihitung dari kecepatan pemakaian nyata 14 hari terakhir (resep × penjualan), bukan tebakan. Saran beli = cukup untuk 7 hari." }),
        shown.length
            ? el("div", { class: "erp-table-wrap" }, el("table", { class: "erp-table" },
                el("thead", {}, el("tr", {}, ...["Bahan", "Stok", "Pakai/hari", "Habis dalam", "Saran beli"].map((head) => el("th", { text: head })))),
                el("tbody", {}, shown.map((row) => el("tr", {},
                    el("td", {}, el("strong", { text: row.ingredient.name })),
                    el("td", { class: row.stock <= 0 ? "erp-tone-late" : null, text: qtyText(row.stock, row.ingredient.unit) }),
                    el("td", { text: row.perDay ? qtyText(row.perDay, row.ingredient.unit) : "—" }),
                    el("td", { class: row.tone === "late" ? "erp-tone-late" : row.tone === "warn" ? "erp-tone-warn" : null, text: row.stock <= 0 ? "Sudah habis" : row.daysLeft === null ? "tidak terpakai" : `${dec(row.daysLeft)} hari` }),
                    el("td", { text: row.buyQty ? `${qtyText(row.buyQty, row.ingredient.unit)}${row.buyValue ? ` · ±${rupiah(row.buyValue)}` : ""}` : "—" })
                )))
            ))
            : emptyState("Semua bahan aman untuk beberapa hari ke depan.")
    ));

    // ---------- Bahan yang hilang ----------
    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" }, el("h2", { text: `🕳️ Bahan yang hilang (14 hari): ${rupiah(loss.lostValue + loss.wasteValue)}` })),
        el("p", { class: "erp-muted", text: "POS biasa hanya tahu yang terjual. Di sini: selisih saat hitung stok (hilang tanpa catatan) + bahan yang dicatat dibuang, dibanding pemakaian menurut resep." }),
        loss.rows.length
            ? el("div", { class: "erp-table-wrap" }, el("table", { class: "erp-table" },
                el("thead", {}, el("tr", {}, ...["Bahan", "Hilang tanpa catatan", "Dibuang", "% dari pemakaian", "Dugaan & saran"].map((head) => el("th", { text: head })))),
                el("tbody", {}, loss.rows.map((row) => el("tr", {},
                    el("td", {}, el("strong", { text: row.ingredient.name })),
                    el("td", { class: row.lostQty ? "erp-tone-late" : null, text: row.lostQty ? `${qtyText(row.lostQty, row.ingredient.unit)} · ${rupiah(row.lostValue)}` : "—" }),
                    el("td", { text: row.wasteQty ? `${qtyText(row.wasteQty, row.ingredient.unit)} · ${rupiah(row.wasteValue)}` : "—" }),
                    el("td", { text: row.rate === null ? "—" : `${dec(row.rate)}%` }),
                    el("td", { class: "erp-wrap", text: row.hint })
                )))
            ))
            : emptyState("Belum ada selisih. Lakukan \"Hitung stok\" rutin (mis. tiap Senin) supaya bahan yang hilang terlihat.")
    ));

    // ---------- Harga ojol aman? ----------
    const safe = safeOnlineMarkup(settings.online_commission);
    const losing = costing.filter((row) => row.online.vsStore < 0);
    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" }, el("h2", { text: "📲 Harga ojol aman?" })),
        el("p", { class: `erp-verdict ${settings.online_markup >= safe ? "erp-verdict--good" : "erp-verdict--late"}`,
            text: settings.online_markup >= safe
                ? `Aman: harga ojol naik ${settings.online_markup}%, minimal yang dibutuhkan ${safe}% untuk komisi ${settings.online_commission}%. Laba per menu di aplikasi sama atau lebih besar dari jual di toko.`
                : `Belum aman: komisi aplikasi ${settings.online_commission}% butuh kenaikan harga minimal ${safe}%, sekarang baru ${settings.online_markup}%. Tiap menu ojol untungnya LEBIH KECIL dari jual di toko (${losing.length} menu). Ubah di Kasir › Pengaturan.` }),
        losing.length
            ? el("p", { class: "erp-muted", text: `Contoh: ${losing.slice(0, 3).map((row) => `${row.product.name} ${rupiah(row.online.vsStore)}/porsi`).join(" · ")}` })
            : null
    ));

    // ---------- HPP & laba per menu ----------
    const withoutRecipe = products.filter((product) => !(recipes[String(product.id)] || []).length);
    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" }, el("h2", { text: "HPP & laba per menu" })),
        el("p", { class: "erp-muted", text: `Harga dasar (varian dihitung saat dijual). Kelas menu dari penjualan 28 hari: laris = terjual ≥ 70% rata-rata, untung besar = laba/porsi ≥ rata-rata. Target HPP ${settings.target_food_cost}%.` }),
        costing.length
            ? el("div", { class: "erp-table-wrap" }, el("table", { class: "erp-table" },
                el("thead", {}, el("tr", {}, ...["Menu", "Harga", "HPP", "HPP %", "Laba/porsi", "Terjual", "Kelas", "Laba ojol", "Saran harga", ""].map((head) => el("th", { text: head })))),
                el("tbody", {}, costing.map((row) => el("tr", {},
                    el("td", {}, el("strong", { text: row.product.name })),
                    el("td", { text: rupiah(row.price) }),
                    el("td", { text: rupiah(row.cost) }),
                    el("td", { class: row.foodCost > settings.target_food_cost ? "erp-tone-late" : "erp-tone-good", text: `${dec(row.foodCost)}%` }),
                    el("td", { text: rupiah(row.profit) }),
                    el("td", { text: String(row.sold) }),
                    el("td", { title: MENU_CLASSES[row.klass].advice, text: MENU_CLASSES[row.klass].label }),
                    el("td", { class: row.online.vsStore < 0 ? "erp-tone-late" : null, text: `${rupiah(row.online.profit)} (${row.online.vsStore >= 0 ? "+" : "−"}${rupiah(Math.abs(row.online.vsStore))})` }),
                    el("td", { text: row.suggestedPrice ? rupiah(row.suggestedPrice) : "—" }),
                    el("td", {}, canEdit ? el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => editRecipe(ctx, row.product, recipes, ingredients) }, "Resep") : null)
                )))
            ))
            : emptyState("Belum ada menu dengan resep."),
        el("ul", { class: "erp-legend" }, Object.values(MENU_CLASSES).map((entry) => el("li", {}, el("strong", { text: entry.label }), ` — ${entry.advice}`))),
        withoutRecipe.length
            ? el("div", { class: "erp-chips" },
                el("small", { class: "erp-muted", text: "Belum ada resep (dijual dari stok barang jadi): " }),
                withoutRecipe.map((product) => el("button", { class: "erp-chip", type: "button", disabled: !canEdit, onclick: () => editRecipe(ctx, product, recipes, ingredients) }, `+ ${product.name}`)))
            : null
    ));

    // ---------- Resep varian ----------
    const options = groups.flatMap((group) => group.options.map((option) => ({ key: `${group.id}:${option.id}`, label: `${group.name}: ${option.name}` })));
    if (options.length) {
        page.appendChild(el("section", { class: "erp-card" },
            el("div", { class: "erp-card__head" }, el("h2", { text: "Resep varian & topping" })),
            el("p", { class: "erp-muted", text: "Tambahan/pengurangan bahan saat varian dipilih. Boleh minus (mis. Less sugar: Gula cair = -7)." }),
            el("div", { class: "erp-table-wrap" }, el("table", { class: "erp-table" },
                el("thead", {}, el("tr", {}, ...["Varian", "Penyesuaian bahan", ""].map((head) => el("th", { text: head })))),
                el("tbody", {}, options.map((option) => el("tr", {},
                    el("td", { text: option.label }),
                    el("td", { class: "erp-wrap", text: (optionRecipes[option.key] || []).map((item) => `${ingredients.find((entry) => entry.id === item.ingredient_id)?.name || "?"} ${item.qty > 0 ? "+" : ""}${item.qty}`).join(", ") || "—" }),
                    el("td", {}, canEdit ? el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => editOptionRecipe(ctx, option, optionRecipes, ingredients) }, "Ubah") : null)
                )))
            ))
        ));
    }

    // ---------- Bahan baku ----------
    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" }, el("h2", { text: `Bahan baku (${ingredients.length})` })),
        el("div", { class: "erp-table-wrap" }, el("table", { class: "erp-table" },
            el("thead", {}, el("tr", {}, ...["Bahan", "Satuan", "Stok", "Batas minimum", "Harga modal / satuan", ""].map((head) => el("th", { text: head })))),
            el("tbody", {}, ingredients.map((entry) => el("tr", {},
                el("td", { text: entry.name }),
                el("td", { text: entry.unit }),
                el("td", { class: entry.stock <= entry.min_stock ? "erp-tone-late" : null, text: qtyText(entry.stock, entry.unit) }),
                el("td", { text: qtyText(entry.min_stock, entry.unit) }),
                el("td", { text: entry.cost === null ? "—" : rupiah(entry.cost) }),
                el("td", {}, canEdit ? el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => editIngredient(ctx, entry) }, "Ubah") : null)
            )))
        ))
    ));

    return page;
}

/* ---------- Dialog ---------- */

const ingredientOptions = (ingredients) => ingredients.filter((entry) => entry.is_active !== false).map((entry) => ({ value: entry.id, label: `${entry.name} (${entry.unit})` }));

async function run(ctx, action, message) {
    try {
        const result = await action();
        if (message) toast(typeof message === "function" ? message(result) : message);
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

async function editIngredient(ctx, entry = null) {
    const values = await formDialog({
        title: entry ? `Ubah bahan · ${entry.name}` : "Bahan baru",
        fields: [
            { name: "name", label: "Nama bahan", required: true, max: 60, value: entry?.name || "" },
            { name: "unit", label: "Satuan", type: "select", value: entry?.unit || "gram", options: Object.keys(UNITS).map((unit) => ({ value: unit, label: unit })) },
            { name: "cost", label: "Harga modal per satuan (Rp)", type: "number", min: 0, step: 0.01, value: entry?.cost ?? "", hint: "Contoh: susu Rp 22.000 per liter = Rp 22 per ml. Berubah otomatis saat mencatat belanja." },
            { name: "min_stock", label: "Batas minimum stok", type: "number", min: 0, step: 1, value: entry?.min_stock ?? 0 },
        ],
    });
    if (!values) return;
    run(ctx, () => ctx.data.saveIngredient({ ...entry, ...values, stock: undefined }), "Bahan disimpan.");
}

async function editRecipe(ctx, product, recipes, ingredients) {
    const values = await formDialog({
        title: `Resep · ${product.name}`,
        fields: [{
            name: "lines", label: "Bahan per 1 porsi (satu baris: Nama bahan = jumlah)", type: "textarea",
            value: formatRecipeLines(recipes[String(product.id)] || [], ingredients),
            hint: `Bahan tersedia: ${ingredients.map((entry) => `${entry.name} (${entry.unit})`).join(", ")}. Kosongkan = jual dari stok barang jadi.`,
        }],
        submitLabel: "Simpan resep",
    });
    if (!values) return;
    const { items, unknown } = parseRecipeLines(values.lines, ingredients);
    if (unknown.length) {
        toast(`Baris tidak dikenali: ${unknown.join(", ")}. Tulis nama bahan persis & jumlah lebih dari 0.`, "error");
        return;
    }
    run(ctx, () => ctx.data.saveRecipe(product.id, items), items.length ? "Resep disimpan. HPP & stok bahan langsung dihitung ulang." : "Resep dihapus.");
}

async function editOptionRecipe(ctx, option, optionRecipes, ingredients) {
    const values = await formDialog({
        title: `Resep varian · ${option.label}`,
        fields: [{
            name: "lines", label: "Penyesuaian bahan (boleh minus)", type: "textarea",
            value: formatRecipeLines(optionRecipes[option.key] || [], ingredients),
            hint: "Contoh: Susu segar = 60 (Large) atau Gula cair = -7 (Less sugar).",
        }],
    });
    if (!values) return;
    const { items, unknown } = parseRecipeLines(values.lines, ingredients, { allowNegative: true });
    if (unknown.length) {
        toast(`Baris tidak dikenali: ${unknown.join(", ")}.`, "error");
        return;
    }
    run(ctx, () => ctx.data.saveOptionRecipe(option.key, items), "Resep varian disimpan.");
}

async function buyDialog(ctx, outletId, ingredients, preselect = null) {
    const values = await formDialog({
        title: "Catat belanja bahan",
        fields: [
            { name: "ingredient_id", label: "Bahan", type: "select", value: preselect || undefined, options: ingredientOptions(ingredients) },
            { name: "qty", label: "Jumlah dibeli (dalam satuan bahan)", type: "number", min: 0, step: 0.01, required: true, hint: "Contoh: 6 liter susu = 6000 (ml)." },
            { name: "total", label: "Total harga (Rp)", type: "number", min: 0, step: 100, required: true },
            { name: "pay", label: "Dibayar dengan", type: "select", value: "tunai", options: [{ value: "tunai", label: "Kas tunai" }, { value: "transfer", label: "Transfer bank" }, { value: "utang", label: "Utang ke pemasok" }] },
        ],
        submitLabel: "Catat belanja",
    });
    if (!values) return;
    run(ctx, () => ctx.data.ingredientMove({ outlet_id: outletId, kind: "beli", ...values }), "Belanja dicatat. Harga modal bahan diperbarui (rata-rata).");
}

/** HITUNG STOK BUTA: angka catatan sistem sengaja tidak ditampilkan. */
async function countDialog(ctx, outletId, ingredients) {
    const values = await formDialog({
        title: "Hitung stok bahan (buta)",
        fields: [
            { name: "ingredient_id", label: "Bahan", type: "select", options: ingredientOptions(ingredients) },
            { name: "qty", label: "Hasil hitung / timbang sekarang", type: "number", min: 0, step: 0.01, required: true, hint: "Angka catatan sistem sengaja tidak ditampilkan supaya hasil hitung jujur. Selisihnya muncul di \"Bahan yang hilang\"." },
        ],
        submitLabel: "Simpan hasil hitung",
    });
    if (!values) return;
    const unit = ingredients.find((entry) => entry.id === values.ingredient_id)?.unit || "";
    run(ctx, () => ctx.data.ingredientMove({ outlet_id: outletId, kind: "opname", ...values }),
        (result) => (result?.delta ? `Tercatat. Selisih ${result.delta > 0 ? "+" : ""}${result.delta} ${unit} dibanding catatan sistem.` : "Cocok dengan catatan sistem. Mantap!"));
}

/** Catat bahan dibuang — dipakai juga di layar Dapur & Bar. */
export async function wasteDialog(ctx, outletId, ingredients = null) {
    const list = ingredients || await ctx.data.listIngredients(outletId);
    if (!list.length) {
        toast("Belum ada bahan baku.", "error");
        return;
    }
    const values = await formDialog({
        title: "Catat bahan dibuang",
        fields: [
            { name: "ingredient_id", label: "Bahan", type: "select", options: ingredientOptions(list) },
            { name: "qty", label: "Jumlah dibuang", type: "number", min: 0, step: 0.01, required: true },
            { name: "reason", label: "Alasan", type: "select", value: "tumpah", options: Object.entries(WASTE_REASONS).map(([value, label]) => ({ value, label })), hint: "Jujur mencatat itu dihargai: yang TIDAK dicatat akan muncul sebagai \"hilang tanpa catatan\"." },
        ],
        submitLabel: "Catat",
    });
    if (!values) return;
    run(ctx, () => ctx.data.ingredientMove({ outlet_id: outletId, kind: "buang", ...values }), "Bahan dibuang tercatat. Terima kasih sudah jujur!");
}
