/**
 * KANTOONG ERP — KASIR POS (Fase 2)
 * File: frontend/erp/modules/pos.js
 *
 * Kasir toko offline / F&B. Harga diambil dari katalog master,
 * stok outlet berkurang otomatis, dan jurnal penjualan tercatat.
 * Transaksi masuk ke data & laporan yang sama dengan toko online.
 */

import { hasRole } from "../core/org.js";
import { PAY_METHODS, priceCart, quickCash, settle } from "../core/pos.js";
import { periodStart } from "../core/metrics.js";
import { dateTime, el, emptyState, friendlyError, pageHeader, rupiah, segmented, statCard, toast } from "../ui.js";
import { scanBarcode } from "./catalog.js";

const pos = {
    cart: new Map(),     // product_id -> qty
    outlet: null,
    method: "tunai",
    discount: 0,
    paid: "",
    query: "",
};

export async function render(ctx) {
    const { data, me } = ctx;

    const [warehouses, levels, products, sales] = await Promise.all([
        data.listWarehouses(),
        data.listStockLevels(),
        data.listProducts(),
        data.listPosSales({ since: periodStart("day") }),
    ]);

    const outlets = warehouses.filter((entry) => entry.kind === "outlet" && entry.is_active !== false);
    if (!outlets.some((entry) => entry.id === pos.outlet)) pos.outlet = outlets[0]?.id || null;

    const page = el("div", { class: "erp-page__inner" });

    if (!outlets.length) {
        page.append(
            pageHeader("Kasir POS", "Belum ada outlet."),
            emptyState("Buat outlet dulu di menu Gudang & Stok (jenis: Outlet).")
        );
        return page;
    }

    const stockAt = (productId) =>
        levels.find((level) => level.warehouse_id === pos.outlet && String(level.product_id) === String(productId))?.qty || 0;

    const mine = sales.filter((sale) => sale.cashier_id === me.id && sale.status !== "batal");
    const mineTotal = mine.reduce((sum, sale) => sum + Number(sale.total), 0);

    page.appendChild(pageHeader(
        "Kasir POS",
        "Harga mengikuti katalog master. Stok outlet & jurnal keuangan terisi otomatis.",
        outlets.length > 1
            ? segmented(outlets.map((entry) => ({ value: entry.id, label: entry.name })), pos.outlet, (value) => {
                pos.outlet = value;
                pos.cart.clear();
                ctx.rerender();
            })
            : el("span", { class: "erp-pill", text: `🏪 ${outlets[0].name}` })
    ));

    page.appendChild(el("div", { class: "erp-stats" },
        statCard({ label: "Penjualanku hari ini", value: rupiah(mineTotal), sub: `${mine.length} transaksi` }),
        statCard({ label: "Rata-rata struk", value: rupiah(mine.length ? Math.round(mineTotal / mine.length) : 0) })
    ));

    // ---------- Produk ----------
    const grid = el("div", { class: "erp-pos__grid" });
    const search = el("input", { type: "search", class: "erp-search erp-search--wide", placeholder: "Cari / ketik kode barang…", "aria-label": "Cari produk kasir" });
    search.value = pos.query;

    const drawGrid = () => {
        const q = pos.query.trim().toLowerCase();
        const list = products.filter((product) => !q || `${product.name} ${product.sku || ""} ${product.barcode || ""}`.toLowerCase().includes(q));

        grid.replaceChildren(...(list.length ? list.map((product) => {
            const stock = stockAt(product.id) - (pos.cart.get(String(product.id)) || 0);
            return el("button", {
                class: "erp-pos__item",
                type: "button",
                disabled: stock <= 0,
                onclick: () => add(product.id),
            },
                product.image_url ? el("img", { src: product.image_url, alt: "", loading: "lazy" }) : el("span", { class: "erp-pos__ph", text: product.name.charAt(0) }),
                el("strong", { text: product.name }),
                el("span", { text: rupiah(product.price) }),
                el("small", { text: stock > 0 ? `Stok ${stock}` : "Stok habis" })
            );
        }) : [emptyState("Produk tidak ditemukan.")]));
    };

    search.addEventListener("input", () => {
        pos.query = search.value;
        drawGrid();
    });

    // Enter pada kotak cari = tambah produk yang kodenya cocok persis (alat scan USB mengetik + Enter).
    search.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        const code = search.value.trim();
        const hit = products.find((product) => product.barcode === code || product.sku === code.toUpperCase());
        if (hit) {
            add(hit.id);
            pos.query = "";
            search.value = "";
            drawGrid();
        }
    });

    const scan = el("button", { class: "erp-btn", type: "button" }, "📷 Scan");
    scan.addEventListener("click", async () => {
        const code = await scanBarcode();
        if (!code) return;
        const hit = products.find((product) => product.barcode === code || product.sku === code);
        if (hit) add(hit.id);
        else toast(`Barcode ${code} tidak ada di katalog.`, "error");
    });

    // ---------- Keranjang ----------
    const cartBox = el("div", { class: "erp-pos__cart" });

    function add(productId) {
        const key = String(productId);
        const next = (pos.cart.get(key) || 0) + 1;
        if (next > stockAt(key)) {
            toast("Stok outlet tidak cukup.", "error");
            return;
        }
        pos.cart.set(key, next);
        drawGrid();
        drawCart();
    }

    function setQty(productId, qty) {
        const key = String(productId);
        if (qty <= 0) pos.cart.delete(key);
        else pos.cart.set(key, Math.min(qty, stockAt(key)));
        drawGrid();
        drawCart();
    }

    function drawCart() {
        const priced = priceCart([...pos.cart].map(([product_id, qty]) => ({ product_id, qty })), products, pos.discount);
        const payment = settle(priced.total, pos.method, pos.paid);

        const discountInput = el("input", { type: "number", min: 0, step: 500, class: "erp-input-sm", "aria-label": "Diskon (Rp)", placeholder: "0" });
        discountInput.value = pos.discount || "";
        discountInput.addEventListener("change", () => {
            pos.discount = Math.max(0, Number(discountInput.value) || 0);
            drawCart();
        });

        const paidInput = el("input", { type: "number", min: 0, step: 1000, class: "erp-input-sm", "aria-label": "Uang diterima", placeholder: "Uang diterima" });
        paidInput.value = pos.paid;
        paidInput.addEventListener("input", () => {
            pos.paid = paidInput.value;
            changeText.textContent = rupiah(settle(priced.total, pos.method, pos.paid).change);
            pay.disabled = !priced.items.length || !settle(priced.total, pos.method, pos.paid).ok;
        });

        const changeText = el("strong", { text: rupiah(payment.change) });

        const pay = el("button", {
            class: "erp-btn erp-btn--primary erp-btn--block erp-pos__pay",
            type: "button",
            disabled: !priced.items.length || !payment.ok,
        }, priced.items.length ? `Bayar ${rupiah(priced.total)}` : "Keranjang kosong");

        pay.addEventListener("click", async () => {
            pay.disabled = true;
            try {
                const receipt = await ctx.data.posCheckout({
                    outlet_id: pos.outlet,
                    method: pos.method,
                    paid: pos.method === "tunai" ? Number(pos.paid) || 0 : priced.total,
                    discount: pos.discount,
                    items: priced.items.map((item) => ({ product_id: item.product_id, qty: item.qty })),
                });
                pos.cart.clear();
                pos.discount = 0;
                pos.paid = "";
                showReceipt(receipt, outlets.find((entry) => entry.id === pos.outlet), me);
                ctx.rerender();
            } catch (error) {
                toast(friendlyError(error), "error");
                pay.disabled = false;
            }
        });

        cartBox.replaceChildren(
            el("div", { class: "erp-card__head" },
                el("h2", { text: "Keranjang" }),
                priced.items.length ? el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => { pos.cart.clear(); drawGrid(); drawCart(); } }, "Kosongkan") : null
            ),
            priced.items.length
                ? el("ul", { class: "erp-pos__lines" }, priced.items.map((item) => el("li", {},
                    el("span", { class: "erp-pos__line-name" }, el("strong", { text: item.name }), el("small", { text: rupiah(item.price) })),
                    el("span", { class: "erp-qty" },
                        el("button", { type: "button", "aria-label": `Kurangi ${item.name}`, onclick: () => setQty(item.product_id, item.qty - 1) }, "−"),
                        el("span", { text: String(item.qty) }),
                        el("button", { type: "button", "aria-label": `Tambah ${item.name}`, onclick: () => setQty(item.product_id, item.qty + 1) }, "+")
                    ),
                    el("strong", { class: "erp-pos__line-total", text: rupiah(item.line_total) })
                )))
                : emptyState("Ketuk produk atau scan barcode."),
            el("dl", { class: "erp-pos__sum" },
                el("dt", { text: "Subtotal" }), el("dd", { text: rupiah(priced.subtotal) }),
                el("dt", {}, el("label", { text: "Diskon (Rp)" })), el("dd", {}, discountInput),
                el("dt", { class: "erp-pos__total", text: "Total" }), el("dd", { class: "erp-pos__total", text: rupiah(priced.total) })
            ),
            segmented(Object.entries(PAY_METHODS).map(([value, label]) => ({ value, label })), pos.method, (value) => {
                pos.method = value;
                drawCart();
            }),
            pos.method === "tunai"
                ? el("div", { class: "erp-pos__cash" },
                    paidInput,
                    el("div", { class: "erp-pos__quick" }, quickCash(priced.total).map((amount) =>
                        el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => { pos.paid = String(amount); drawCart(); } }, amount === priced.total ? "Uang pas" : rupiah(amount))
                    )),
                    el("p", { class: "erp-pos__change" }, "Kembalian: ", changeText)
                )
                : el("p", { class: "erp-muted", text: `Pembayaran ${PAY_METHODS[pos.method]} dianggap pas sesuai total.` }),
            pay
        );
    }

    page.appendChild(el("div", { class: "erp-pos" },
        el("section", { class: "erp-card" }, el("div", { class: "erp-toolbar" }, search, scan), grid),
        el("section", { class: "erp-card erp-pos__side" }, cartBox)
    ));

    drawGrid();
    drawCart();

    // ---------- Struk hari ini ----------
    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" }, el("h2", { text: "Transaksiku hari ini" })),
        mine.length
            ? el("div", { class: "erp-table-wrap" }, el("table", { class: "erp-table" },
                el("thead", {}, el("tr", {}, ["Struk", "Waktu", "Barang", "Bayar", "Total"].map((head) => el("th", { text: head })))),
                el("tbody", {}, mine.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).map((sale) => el("tr", {},
                    el("td", { "data-label": "Struk" }, el("code", { text: sale.receipt_no })),
                    el("td", { "data-label": "Waktu", text: dateTime(sale.created_at) }),
                    el("td", { "data-label": "Barang", text: `${sale.items.reduce((sum, item) => sum + item.qty, 0)} item` }),
                    el("td", { "data-label": "Bayar", text: PAY_METHODS[sale.method] || sale.method }),
                    el("td", { "data-label": "Total", text: rupiah(sale.total) })
                )))
            ))
            : emptyState(hasRole(me, "kasir") ? "Belum ada transaksi hari ini." : "Kamu bukan kasir; transaksi akan ditolak.")
    ));

    return page;
}

function showReceipt(receipt, outlet, cashier) {
    const dialog = el("dialog", { class: "erp-dialog erp-receipt" },
        el("div", { class: "erp-receipt__paper", id: "erpReceipt" },
            el("p", { class: "erp-receipt__brand", text: outlet?.name || "Outlet" }),
            el("p", { class: "erp-muted", text: `${receipt.receipt_no} · ${dateTime(receipt.created_at)}` }),
            el("p", { class: "erp-muted", text: `Kasir: ${cashier.full_name}` }),
            el("ul", {}, receipt.items.map((item) => el("li", {},
                el("span", { text: `${item.qty}× ${item.name}` }),
                el("span", { text: rupiah(item.price * item.qty) })
            ))),
            el("dl", {},
                el("dt", { text: "Subtotal" }), el("dd", { text: rupiah(receipt.subtotal) }),
                Number(receipt.discount) ? [el("dt", { text: "Diskon" }), el("dd", { text: `−${rupiah(receipt.discount)}` })] : null,
                el("dt", { class: "erp-pos__total", text: "Total" }), el("dd", { class: "erp-pos__total", text: rupiah(receipt.total) }),
                el("dt", { text: PAY_METHODS[receipt.method] || receipt.method }), el("dd", { text: rupiah(receipt.paid) }),
                el("dt", { text: "Kembalian" }), el("dd", { text: rupiah(receipt.change) })
            ),
            el("p", { class: "erp-receipt__thanks", text: "Terima kasih!" })
        ),
        el("div", { class: "erp-form__actions" },
            el("span", { class: "erp-spacer" }),
            el("button", { class: "erp-btn", type: "button", onclick: () => window.print() }, "Cetak"),
            el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => dialog.close() }, "Transaksi baru")
        )
    );

    dialog.addEventListener("close", () => dialog.remove());
    document.body.appendChild(dialog);
    dialog.showModal();
    toast(`Lunas: ${rupiah(receipt.total)}`);
}
