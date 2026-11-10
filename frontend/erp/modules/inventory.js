/**
 * KANTOONG ERP — GUDANG & STOK (Fase 2)
 * File: frontend/erp/modules/inventory.js
 *
 * Saldo stok per gudang/outlet, peringatan stok menipis, dan mutasi:
 * barang masuk, keluar, retur, transfer antar-gudang, stock opname.
 * Setiap mutasi tercatat (siapa, kapan) dan stok tidak bisa minus.
 */

import { hasRole } from "../core/org.js";
import { MOVE_LABELS, stockStatus } from "../core/inventory.js";
import { dateTime, el, emptyState, formDialog, friendlyError, pageHeader, segmented, shortRupiah, statCard, toast } from "../ui.js";
import { scanBarcode } from "./catalog.js";
import { INVENTORY_PRO_TABS, inventoryProView } from "./inventory-pro.js";
import { subRoute } from "./pro-data.js";

let view = "stok";

let warehouseFilter = "all";
let query = "";

const STATUS_PILL = { habis: "erp-pill--bad", menipis: "erp-pill--warn", aman: "erp-pill--good" };
const STATUS_TEXT = { habis: "Habis", menipis: "Menipis", aman: "Aman" };

export async function render(ctx) {
    const { data, me } = ctx;
    const canEdit = hasRole(me, "gudang");

    const [warehouses, levels, products, moves, members] = await Promise.all([
        data.listWarehouses(),
        data.listStockLevels(),
        data.listProducts(),
        data.listStockMoves({ limit: 40 }),
        data.listMembers(),
    ]);

    if (warehouseFilter !== "all" && !warehouses.some((entry) => entry.id === warehouseFilter)) warehouseFilter = "all";

    const shown = warehouses.filter((entry) => entry.is_active !== false && (warehouseFilter === "all" || entry.id === warehouseFilter));
    const shownIds = new Set(shown.map((entry) => entry.id));
    const levelRows = levels.filter((level) => shownIds.has(level.warehouse_id));
    const productOf = (id) => products.find((product) => String(product.id) === String(id));

    const units = levelRows.reduce((sum, level) => sum + level.qty, 0);
    const value = levelRows.reduce((sum, level) => sum + level.qty * (Number(productOf(level.product_id)?.price) || 0), 0);
    const alerts = levelRows.filter((level) => stockStatus(level.qty, level.min_qty) !== "aman");

    const page = el("div", { class: "erp-page__inner" });

    page.appendChild(pageHeader(
        "Gudang & Stok",
        "Stok per gudang & outlet. Semua toko sales dan kasir memakai stok yang sama.",
        canEdit ? el("button", { class: "erp-btn", type: "button", onclick: () => editWarehouse(ctx, {}) }, "+ Gudang/outlet") : null,
        canEdit ? el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => moveDialog(ctx, { warehouses, products, levels }) }, "Catat mutasi") : null
    ));

    // Pro Max: Saran belanja & Kedaluwarsa (tautan langsung #/inventory/saran).
    const routed = subRoute();
    if (INVENTORY_PRO_TABS.some((t) => t.value === routed)) view = routed;
    page.appendChild(segmented(INVENTORY_PRO_TABS, view, (next) => {
        view = next;
        if (location.hash.split("/").length > 2) history.replaceState(null, "", "#/inventory");
        ctx.rerender();
    }));
    if (view !== "stok") {
        page.appendChild(await inventoryProView(ctx, view, { warehouses, levels, products }));
        return page;
    }

    page.appendChild(segmented(
        [{ value: "all", label: "Semua" }].concat(warehouses.filter((entry) => entry.is_active !== false).map((entry) => ({
            value: entry.id, label: `${entry.kind === "outlet" ? "🏪" : "📦"} ${entry.name}`,
        }))),
        warehouseFilter,
        (next) => {
            warehouseFilter = next;
            ctx.rerender();
        }
    ));

    page.appendChild(el("div", { class: "erp-stats" },
        statCard({ label: "Total unit", value: units.toLocaleString("id-ID"), sub: `${new Set(levelRows.map((level) => level.product_id)).size} produk` }),
        statCard({ label: "Nilai stok", value: shortRupiah(value), sub: "dihitung dengan harga jual" }),
        statCard({ label: "Perlu perhatian", value: String(alerts.length), sub: "stok menipis / habis", tone: alerts.length ? "alert" : "" }),
        statCard({ label: "Lokasi", value: String(shown.length), sub: shown.map((entry) => entry.name).join(", ") })
    ));

    // ---------- Tabel saldo stok ----------
    const searchInput = el("input", { type: "search", class: "erp-search erp-search--wide", placeholder: "Cari produk, kode barang, barcode…", "aria-label": "Cari stok" });
    searchInput.value = query;
    const table = el("div");

    const draw = () => {
        const q = query.trim().toLowerCase();
        const rows = products
            .filter((product) => !q || `${product.name} ${product.sku || ""} ${product.barcode || ""}`.toLowerCase().includes(q))
            .flatMap((product) => shown.map((warehouse) => {
                const level = levels.find((entry) => entry.warehouse_id === warehouse.id && String(entry.product_id) === String(product.id))
                    || { qty: 0, min_qty: 0 };
                return { product, warehouse, level, status: stockStatus(level.qty, level.min_qty) };
            }))
            .sort((a, b) => ["habis", "menipis", "aman"].indexOf(a.status) - ["habis", "menipis", "aman"].indexOf(b.status) || a.product.name.localeCompare(b.product.name, "id"));

        if (!rows.length) {
            table.replaceChildren(emptyState(shown.length ? "Tidak ada produk yang cocok." : "Belum ada gudang. Tambahkan dulu."));
            return;
        }

        table.replaceChildren(el("div", { class: "erp-table-wrap" },
            el("table", { class: "erp-table" },
                el("thead", {}, el("tr", {}, ["Produk", "Lokasi", "Stok", "Minimum", "Status", ""].map((head) => el("th", { text: head })))),
                el("tbody", {}, rows.map(({ product, warehouse, level, status }) => el("tr", {},
                    el("td", {}, el("div", { class: "erp-person" },
                        product.image_url ? el("img", { class: "erp-thumb", src: product.image_url, alt: "", loading: "lazy" }) : el("span", { class: "erp-thumb erp-thumb--empty", text: product.name.charAt(0) }),
                        el("span", {}, el("strong", { text: product.name }), el("small", { text: product.sku || "tanpa kode" }))
                    )),
                    el("td", { "data-label": "Lokasi", text: warehouse.name }),
                    el("td", { "data-label": "Stok" }, el("strong", { text: String(level.qty) })),
                    el("td", { "data-label": "Minimum", text: String(level.min_qty || 0) }),
                    el("td", { "data-label": "Status" }, el("span", { class: `erp-pill ${STATUS_PILL[status]}`, text: STATUS_TEXT[status] })),
                    el("td", {}, canEdit ? el("div", { class: "erp-row-actions" },
                        el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => moveDialog(ctx, { warehouses, products, levels }, { warehouse_id: warehouse.id, product_id: product.id }) }, "Mutasi"),
                        el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => editMin(ctx, warehouse, product, level) }, "Min")
                    ) : null)
                )))
            )
        ));
    };

    searchInput.addEventListener("input", () => {
        query = searchInput.value;
        draw();
    });

    const scan = el("button", { class: "erp-btn", type: "button" }, "📷 Scan");
    scan.addEventListener("click", async () => {
        const code = await scanBarcode();
        if (!code) return;
        query = code;
        searchInput.value = code;
        draw();
    });

    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-toolbar" }, searchInput, scan),
        table
    ));
    draw();

    // ---------- Riwayat mutasi ----------
    const nameOf = (id) => members.find((member) => member.id === id)?.full_name || "Sistem";
    const whName = (id) => warehouses.find((entry) => entry.id === id)?.name || "-";

    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" }, el("h2", { text: "Riwayat mutasi terbaru" })),
        moves.length
            ? el("div", { class: "erp-table-wrap" }, el("table", { class: "erp-table" },
                el("thead", {}, el("tr", {}, ["Waktu", "Jenis", "Produk", "Lokasi", "Jumlah", "Oleh"].map((head) => el("th", { text: head })))),
                el("tbody", {}, moves.map((move) => el("tr", {},
                    el("td", { "data-label": "Waktu", text: dateTime(move.created_at) }),
                    el("td", { "data-label": "Jenis", text: MOVE_LABELS[move.kind] || move.kind }),
                    el("td", { "data-label": "Produk", text: productOf(move.product_id)?.name || move.product_id }),
                    el("td", { "data-label": "Lokasi", text: whName(move.warehouse_id) }),
                    el("td", { "data-label": "Jumlah" }, el("strong", { class: move.qty > 0 ? "erp-plus" : "erp-minus", text: `${move.qty > 0 ? "+" : ""}${move.qty}` })),
                    el("td", { "data-label": "Oleh", text: nameOf(move.actor_id) })
                )))
            ))
            : emptyState("Belum ada mutasi.")
    ));

    return page;
}

async function moveDialog(ctx, { warehouses, products, levels }, preset = {}) {
    const active = warehouses.filter((entry) => entry.is_active !== false);
    if (!active.length) {
        toast("Buat gudang/outlet dulu.", "error");
        return;
    }

    const values = await formDialog({
        title: "Catat mutasi stok",
        submitLabel: "Simpan mutasi",
        fields: [
            {
                name: "kind", label: "Jenis", type: "select", value: "masuk",
                options: [
                    { value: "masuk", label: "Barang masuk (dari supplier/produksi)" },
                    { value: "keluar", label: "Barang keluar (rusak/sampel/dll)" },
                    { value: "retur", label: "Retur dari pembeli" },
                    { value: "transfer", label: "Transfer ke gudang/outlet lain" },
                    { value: "opname", label: "Stock opname (hitung fisik)" },
                ],
            },
            { name: "warehouse_id", label: "Lokasi", type: "select", value: preset.warehouse_id || active[0].id, options: active.map((entry) => ({ value: entry.id, label: entry.name })) },
            { name: "product_id", label: "Produk", type: "select", value: String(preset.product_id || products[0]?.id || ""), options: products.map((product) => ({ value: String(product.id), label: `${product.name}${product.sku ? ` (${product.sku})` : ""}` })) },
            { name: "qty", label: "Jumlah", type: "number", min: 0, step: 1, value: 1, hint: "Untuk stock opname, isi kolom \"Hasil hitung fisik\" di bawah." },
            { name: "to_warehouse_id", label: "Tujuan (khusus transfer)", type: "select", value: "", options: [{ value: "", label: "—" }].concat(active.map((entry) => ({ value: entry.id, label: entry.name }))) },
            { name: "counted", label: "Hasil hitung fisik (khusus opname)", type: "number", min: 0, step: 1 },
            { name: "note", label: "Catatan", max: 300, placeholder: "contoh: kiriman supplier PT Contoh" },
        ],
    });

    if (!values) return;

    if (values.kind === "opname" && values.counted === "") {
        toast("Isi hasil hitung fisik untuk stock opname.", "error");
        return;
    }

    try {
        const result = await ctx.data.stockMove({
            kind: values.kind,
            warehouse_id: values.warehouse_id,
            to_warehouse_id: values.to_warehouse_id || null,
            product_id: values.product_id,
            qty: Number(values.qty) || 0,
            counted: values.counted === "" ? null : Number(values.counted),
            note: values.note.trim() || null,
        });
        toast(values.kind === "opname"
            ? (result?.difference ? `Opname disimpan, selisih ${result.difference > 0 ? "+" : ""}${result.difference}.` : "Opname cocok, tidak ada selisih.")
            : "Mutasi stok disimpan.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

async function editMin(ctx, warehouse, product, level) {
    const values = await formDialog({
        title: `Stok minimum — ${product.name}`,
        fields: [{ name: "min", label: `Peringatan bila stok di ${warehouse.name} ≤`, type: "number", min: 0, step: 1, value: level.min_qty || 0 }],
    });
    if (!values) return;

    try {
        await ctx.data.setMinQty(warehouse.id, product.id, values.min);
        toast("Stok minimum disimpan.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

async function editWarehouse(ctx, warehouse) {
    const values = await formDialog({
        title: "Tambah gudang / outlet",
        fields: [
            { name: "name", label: "Nama", required: true, max: 60, value: warehouse.name || "" },
            { name: "kind", label: "Jenis", type: "select", value: warehouse.kind || "gudang", options: [{ value: "gudang", label: "Gudang" }, { value: "outlet", label: "Outlet / toko offline (punya kasir)" }] },
            { name: "address", label: "Alamat", max: 200, value: warehouse.address || "" },
        ],
    });
    if (!values) return;

    try {
        await ctx.data.saveWarehouse({ ...(warehouse.id ? { id: warehouse.id } : {}), name: values.name.trim(), kind: values.kind, address: values.address.trim() || null });
        toast("Lokasi disimpan.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

