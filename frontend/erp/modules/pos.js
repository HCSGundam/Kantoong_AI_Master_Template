/**
 * KANTOONG ERP — KASIR POS PRO (Tahap 1)
 * File: frontend/erp/modules/pos.js
 *
 * Kasir untuk kafe, restoran & toko offline:
 *   - tipe pesanan / channel (dine-in, bawa pulang, delivery, GoFood/Grab/Shopee
 *     dengan harga ojol otomatis) + nomor meja & nama pemesan
 *   - varian & tambahan (ukuran, level gula, es, topping berbayar) + catatan
 *   - service charge, pajak resto (PB1), pembulatan — diatur per outlet
 *   - bayar campuran (mis. QRIS + tunai), kembalian otomatis
 *   - bill terbuka: pesan dulu, bayar nanti
 *   - struk thermal 58/80 mm + cetak ulang
 * Tahap 2 (lapisan Zero-to-One):
 *   - pesanan otomatis jadi tiket BAR / DAPUR (hanya tambahan, tanpa dobel)
 *   - nomor antrian + ETA JUJUR di struk (dipelajari dari waktu pembuatan nyata)
 *   - PENJUALAN YANG HILANG: menu habis yang tetap diminta & alasan batal (1 ketukan)
 * Tahap 3 (kontrol uang, pertanyaan terbalik "bagaimana kasir bisa curang?"):
 *   - jualan wajib shift aktif; kas masuk/keluar dengan alasan
 *   - tutup shift BUTA (kasir tidak melihat angka "seharusnya") + laporan Z
 *   - void wajib PIN atasan + alasan; diskon besar wajib PIN atasan
 * Tahap 4 (pelanggan & promo, pertanyaan terbalik "kenapa member & promo gagal?"):
 *   - member cukup nama + HP dengan 2 izin terpisah (UU PDP), bisa minta dihapus
 *   - KASIR YANG INGAT: sapaan + pesanan favorit lengkap dengan varian, 1 ketukan
 *   - poin langsung ditukar di kasir; promo otomatis (jam hemat & paket hemat)
 * Tahap 5 (resep & HPP):
 *   - menu ber-resep: "bisa dibuat N porsi" dari stok bahan, HABIS OTOMATIS bila satu bahan habis
 *   - bahan dipotong sesuai resep + varian saat bayar; HPP tercatat (tidak ditampilkan ke kasir)
 * Tahap 6:
 *   - SPLIT BILL per item (struk sendiri-sendiri) & bagi rata N orang
 *   - MODE OFFLINE: internet mati = tetap jualan, transaksi diantrikan & disinkron (jam aslinya)
 *   - LAYAR PELANGGAN (#/pos/layar) + kepuasan 1 ketukan, sinkron lewat BroadcastChannel
 * Harga dari katalog master; stok outlet & jurnal keuangan otomatis.
 * Harga final dihitung ulang di server (erp_pos_checkout_v2).
 */

import { hasRole } from "../core/org.js";
import { quickCash } from "../core/pos.js";
import {
    CHANNELS, LOST_REASONS, PAY_METHODS, channelPrice, formatOptionLines, groupsFor, lineKey, markSent, methodLabel, orderLabel,
    parseOptionLines, posSettings, priceOrder, settlePayments, summarizeLost, unsentLines, validateSelection,
} from "../core/pos-pro.js";
import { estimateReady, learnPrepTimes, orderReadyAt, splitTickets } from "../core/kitchen.js";
import { CASH_MOVES, DENOMINATIONS, VOID_REASONS, countDrawer, needsDiscountApproval, shiftSummary } from "../core/cash-control.js";
import { periodStart } from "../core/metrics.js";
import { promoActive, scheduleText } from "../core/promo.js";
import { greetingText, pointsRedeemable } from "../core/loyalty.js";
import { capacity, hasRecipe, orderUsage, sellOutAt } from "../core/recipe.js";
import { enqueue, equalShares, isNetworkError, readQueue, removeFromQueue, splitLines, syncQueue } from "../core/pos-split.js";
import { RATING_FACES } from "../core/pos-report.js";
import { DISPLAY_CHANNEL, render as renderCustomerDisplay } from "./customer-display.js";
import { confirmDialog, dateTime, el, emptyState, formDialog, friendlyError, pageHeader, rupiah, segmented, statCard, toast } from "../ui.js";
import { scanBarcode } from "./catalog.js";

const pos = {
    outlet: null,
    channel: "dine_in",
    table: "",
    customer: "",
    lines: [],            // [{ key, product_id, qty, options: [{ group_id, option_id }], note }]
    discount: 0,
    payments: [{ method: "tunai", amount: "" }],
    split: false,
    query: "",
    category: "all",
    billId: null,
    queueNo: null,        // nomor antrian pesanan ini (A-023)
    sent: {},             // { [lineKey]: qty } yang sudah dikirim ke dapur
    removed: null,        // item yang baru dibatalkan: tanya alasannya (penjualan hilang)
    member: null,         // { member, profile } — Tahap 4 (Kasir yang Ingat)
    redeem: 0,            // poin yang ingin ditukar
    splitRest: null,      // Tahap 6: sisa pesanan yang belum dibayar (pisah per item)
    splitNo: 0,
    equal: null,          // bagian bagi rata (untuk layar pelanggan)
    orderFilter: "all",   // filter strip "Pesanan berjalan"
};

/** Mode offline: simulasi (untuk presentasi demo) & status sinkron. Bertahan antar render. */
const net = { simulate: false, syncing: false };

function resetOrder() {
    Object.assign(pos, {
        table: "", customer: "", lines: [], discount: 0, billId: null,
        payments: [{ method: "tunai", amount: "" }], split: false,
        queueNo: null, sent: {}, removed: null, member: null, redeem: 0,
        splitRest: null, splitNo: 0, equal: null,
    });
}

/** Gabungkan kembali baris yang dipisah (kunci sama = jumlah ditambah). */
function mergeLines(a = [], b = []) {
    const merged = a.map((line) => ({ ...line }));
    for (const line of b) {
        const same = merged.find((entry) => entry.key === line.key);
        if (same) same.qty += line.qty;
        else merged.push({ ...line });
    }
    return merged;
}

export async function render(ctx) {
    const { data, me } = ctx;
    if (location.hash.split("/")[2] === "layar") return renderCustomerDisplay(ctx);

    const [warehouses, levels, products, sales, groups] = await Promise.all([
        data.listWarehouses(),
        data.listStockLevels(),
        data.listProducts(),
        data.listPosSales({ since: periodStart("day") }),
        data.listPosModifiers(),
    ]);

    const outlets = warehouses.filter((entry) => entry.kind === "outlet" && entry.is_active !== false);
    if (!outlets.some((entry) => entry.id === pos.outlet)) {
        pos.outlet = outlets[0]?.id || null;
        resetOrder();
    }

    const page = el("div", { class: "erp-page__inner" });

    if (!outlets.length) {
        page.append(
            pageHeader("Kasir POS", "Belum ada outlet."),
            emptyState("Buat outlet dulu di menu Gudang & Stok (jenis: Outlet).")
        );
        return page;
    }

    const [settings, bills, lostToday, shift, promos, ingredients, recipeBook, restocks, liveTickets] = await Promise.all([
        data.getPosSettings(pos.outlet),
        data.listOpenBills(pos.outlet),
        data.listLostSales({ outletId: pos.outlet, since: periodStart("day") }),
        data.getMyShift(pos.outlet),
        data.listPromos ? data.listPromos() : [],
        data.listIngredients ? data.listIngredients(pos.outlet) : [],
        data.getRecipes ? data.getRecipes() : { recipes: {}, optionRecipes: {} },
        data.listRestockRequests ? data.listRestockRequests({ outletId: pos.outlet }) : [],
        data.listKitchenTickets ? data.listKitchenTickets({ outletId: pos.outlet, days: 1 }).catch(() => []) : [],
    ]);
    const { recipes, optionRecipes } = recipeBook;
    const ingredientStock = Object.fromEntries(ingredients.map((entry) => [entry.id, entry.stock]));
    const cooked = (productId) => hasRecipe(productId, recipes);
    /** Bahan yang kurang bila keranjang menjadi nextLines (hanya bahan yang bertambah dipakai). */
    const missingIngredient = (nextLines) => {
        const now = orderUsage(pos.lines, recipes, optionRecipes);
        for (const [id, qty] of orderUsage(nextLines, recipes, optionRecipes)) {
            if (qty > (now.get(id) || 0) && qty > (Number(ingredientStock[id]) || 0) + 1e-9) {
                return ingredients.find((entry) => entry.id === id)?.name || "bahan";
            }
        }
        return null;
    };

    // ---------- Layar pelanggan (Tahap 6) ----------
    const display = typeof BroadcastChannel === "function" ? new BroadcastChannel(DISPLAY_CHANNEL) : null;
    let lastCart = null;
    const publish = (message) => {
        try {
            display?.postMessage(message);
        } catch {
            // Layar pelanggan opsional.
        }
    };
    if (display) {
        display.onmessage = (event) => {
            const message = event.data || {};
            if (message.type === "hello" && lastCart) publish(lastCart);
            if (message.type === "rated") {
                toast(`Pelanggan menilai ${RATING_FACES[message.score] || ""} untuk ${message.receipt_no}`);
                if (message.sale_id && !message.offline) ctx.data.rateSale?.(message.sale_id, message.score).catch(() => {});
            }
        };
    }

    // ---------- Mode offline (Tahap 6) ----------
    const storage = (() => {
        try {
            return window.localStorage;
        } catch {
            return null;
        }
    })();
    const isOffline = () => net.simulate || (typeof navigator !== "undefined" && navigator.onLine === false);
    const queue = readQueue(storage).filter((entry) => entry.payload.outlet_id === pos.outlet);
    async function syncNow() {
        if (isOffline() || net.syncing) return;
        net.syncing = true;
        try {
            const result = await syncQueue(storage, (payload) => ctx.data.posCheckoutPro(payload));
            if (result.synced.length) toast(`${result.synced.length} transaksi offline tersinkron. Nomor struk resmi: ${result.synced.map((row) => row.sale.receipt_no).join(", ")}`);
            if (result.failed.length) toast(`${result.failed.length} transaksi offline ditolak server — cek daftar di atas kasir.`, "error");
        } finally {
            net.syncing = false;
        }
        ctx.rerender();
    }
    const onOnline = () => syncNow();
    window.addEventListener("online", onOnline);
    ctx.onCleanup(() => {
        window.removeEventListener("online", onOnline);
        display?.close();
    });
    if (!isOffline() && queue.some((entry) => !entry.error)) setTimeout(() => syncNow(), 300);
    const shiftMoves = shift ? await data.listCashMoves({ shiftIds: [shift.id] }) : [];
    const lost = summarizeLost(lostToday);
    const outlet = outlets.find((entry) => entry.id === pos.outlet);
    const isCashier = hasRole(me, "kasir");

    const stockAt = (productId) =>
        levels.find((level) => level.warehouse_id === pos.outlet && String(level.product_id) === String(productId))?.qty || 0;
    const inCart = (productId) => pos.lines.filter((line) => line.product_id === String(productId)).reduce((sum, line) => sum + line.qty, 0);

    const todaySales = sales.filter((sale) => sale.cashier_id === me.id || hasRole(me, "keuangan"));
    const mine = todaySales.filter((sale) => sale.status !== "batal");
    const mineTotal = mine.reduce((sum, sale) => sum + Number(sale.total), 0);

    // ---------- Kepala halaman ----------
    page.appendChild(pageHeader(
        "Kasir POS",
        `${outlet.name} · ${CHANNELS[pos.channel].label}${settings.tax_enabled ? ` · PB1 ${settings.tax_rate}%` : ""}${settings.service_enabled ? ` · Service ${settings.service_rate}%` : ""}`,
        outlets.length > 1
            ? segmented(outlets.map((entry) => ({ value: entry.id, label: `🏪 ${entry.name}` })), pos.outlet, (value) => {
                pos.outlet = value;
                resetOrder();
                ctx.rerender();
            })
            : null,
        el("button", { class: "erp-btn", type: "button", onclick: () => openBills() }, `📋 Bill terbuka (${bills.length})`),
        el("button", {
            class: "erp-btn", type: "button", title: "Buka di monitor/tablet yang menghadap pelanggan",
            onclick: () => window.open(`${location.pathname}#/pos/layar`, "kantoong-layar-pelanggan", "popup,width=1024,height=720"),
        }, "🖥️ Layar pelanggan"),
        settings.kitchen_enabled ? el("a", { class: "erp-btn", href: "#/kitchen" }, "🍳 Layar dapur") : null,
        hasRole(me, "produk") ? el("button", { class: "erp-btn", type: "button", onclick: () => manageModifiers(ctx, products) }, "🧩 Varian") : null,
        me.level >= 4 ? el("button", { class: "erp-btn", type: "button", onclick: () => editSettings(ctx, outlet, settings) }, "⚙️ Pengaturan") : null
    ));

    page.appendChild(el("div", { class: "erp-stats" },
        statCard({ label: hasRole(me, "keuangan") ? "Penjualan outlet hari ini" : "Penjualanku hari ini", value: rupiah(mineTotal), sub: `${mine.length} transaksi` }),
        statCard({ label: "Rata-rata struk", value: rupiah(mine.length ? Math.round(mineTotal / mine.length) : 0) }),
        statCard({ label: "Bill terbuka", value: String(bills.length), sub: bills.length ? "menunggu dibayar" : "semua sudah lunas", tone: bills.length ? "alert" : "" }),
        statCard({
            label: "Penjualan yang hilang hari ini",
            value: rupiah(lost.value),
            sub: lost.count ? lost.byReason.map(([reason, value]) => `${LOST_REASONS[reason]} ${rupiah(value)}`).join(" · ") : "belum ada — bagus!",
            tone: lost.value ? "alert" : "",
        })
    ));

    // ---------- Kiri: tipe pesanan + produk ----------
    const channelBox = el("div", { class: "erp-pos__channels" });
    const categoryBox = el("div", { class: "erp-pos__cats", role: "tablist", "aria-label": "Kategori menu" });
    const grid = el("div", { class: "erp-pos__grid" });
    const search = el("input", { type: "search", class: "erp-search erp-search--wide", placeholder: "Cari / ketik kode barang…", "aria-label": "Cari produk kasir" });
    search.value = pos.query;

    const categories = ["all", ...new Set(products.map((product) => product.category || "Umum"))];

    const drawChannels = () => {
        channelBox.replaceChildren(segmented(
            Object.entries(CHANNELS).map(([value, channel]) => ({ value, label: `${channel.icon} ${channel.label}` })),
            pos.channel,
            (value) => {
                pos.channel = value;
                if (!CHANNELS[value].table) pos.table = "";
                drawAll();
            }
        ));
    };

    const drawCategories = () => {
        const tile = (category) => {
            const list = category === "all" ? products : products.filter((product) => (product.category || "Umum") === category);
            const cover = list.find((product) => product.image_url);
            return el("button", {
                type: "button",
                class: "erp-pos__cat",
                role: "tab",
                "aria-selected": String(pos.category === category),
                onclick: () => {
                    pos.category = category;
                    drawCategories();
                    drawGrid();
                },
            },
                el("span", { class: "erp-pos__cat-img" },
                    category === "all"
                        ? el("span", { class: "erp-pos__cat-all", "aria-hidden": "true", text: "✦" })
                        : cover ? el("img", { src: cover.image_url, alt: "", loading: "lazy" }) : el("span", { class: "erp-pos__cat-all", text: category.charAt(0) })),
                el("span", { class: "erp-pos__cat-text" },
                    el("strong", { text: category === "all" ? "Semua menu" : category }),
                    el("small", { text: `${list.length} menu` })));
        };
        categoryBox.replaceChildren(...categories.map(tile));
    };

    const drawGrid = () => {
        const q = pos.query.trim().toLowerCase();
        const list = products.filter((product) =>
            (pos.category === "all" || (product.category || "Umum") === pos.category)
            && (!q || `${product.name} ${product.sku || ""} ${product.barcode || ""}`.toLowerCase().includes(q)));

        grid.replaceChildren(...(list.length ? list.map((product) => productCard(product)) : [emptyState("Produk tidak ditemukan.")]));
    };

    /* ---------- Kartu menu "Etalase Malam" ----------
       Tersedia  : kartu biasa.
       Menipis   : cincin amber "bernapas" + "Sisa N" + prediksi "± habis 16.20" dari kecepatan jual hari ini.
       HABIS     : kartu tidur — gelap pekat, garis emas, kilau emas pelan, "— HABIS —",
                   berapa pelanggan menunggu hari ini & status permintaan restok ke gudang. */
    const clock = (date) => new Date(date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).replace(":", ".");
    const todaySold = (productId) => sales
        .filter((sale) => sale.status !== "batal")
        .reduce((sum, sale) => sum + (sale.items || []).filter((item) => String(item.product_id) === String(productId)).reduce((total, item) => total + (Number(item.qty) || 0), 0), 0);
    const openedAt = shift?.opened_at || sales.map((sale) => sale.created_at).sort()[0] || null;
    const waitingFor = (productId) => lostToday
        .filter((entry) => entry.reason === "habis" && String(entry.product_id) === String(productId))
        .reduce((sum, entry) => sum + (Number(entry.qty) || 1), 0);
    const restockOf = (productId) => restocks.find((entry) => String(entry.product_id) === String(productId) && entry.status === "baru");

    function productCard(product) {
        const { left: stock, made } = availability(product);
        const out = stock <= 0;
        const low = !out && stock <= 3;
        const hasOptions = groupsFor(product, groups).length > 0;
        const waiting = out ? waitingFor(product.id) : 0;
        const restock = out ? restockOf(product.id) : null;
        const eta = low ? sellOutAt({ left: stock, soldToday: todaySold(product.id), openedAt, now: new Date() }) : null;

        const qty = inCart(product.id);
        const open = () => (out ? soldOutDialog(product, made) : pick(product));
        const stepper = !out && isCashier
            ? el("span", { class: "erp-pos__step", onclick: (event) => event.stopPropagation() },
                el("button", { type: "button", "aria-label": `Kurangi ${product.name}`, disabled: !qty, onclick: () => decreaseProduct(product) }, "−"),
                el("span", { class: "erp-pos__step-n", text: String(qty) }),
                el("button", { type: "button", "aria-label": `Tambah ${product.name}`, onclick: () => increaseProduct(product) }, "+"))
            : null;
        return el("div", {
            class: `erp-pos__item${out ? " is-out" : ""}${low ? " is-low" : ""}${qty ? " is-picked" : ""}`,
            role: "button",
            tabindex: 0,
            "aria-label": out ? `${product.name}: HABIS, tidak bisa dipesan` : low ? `${product.name}: sisa ${stock}` : product.name,
            onclick: open,
            onkeydown: (event) => {
                if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
                event.preventDefault();
                open();
            },
        },
            el("span", { class: "erp-pos__media" },
                product.image_url ? el("img", { src: product.image_url, alt: "", loading: "lazy" }) : el("span", { class: "erp-pos__ph", text: product.name.charAt(0) }),
                out
                    ? el("span", { class: "erp-pos__night" },
                        el("span", { class: "erp-pos__night-label", text: "Habis" }),
                        el("span", { class: "erp-pos__night-sub", text: waiting ? `${waiting} pelanggan menunggu` : "ketuk untuk opsi" }))
                    : null,
                low ? el("span", { class: "erp-pos__left" }, el("i", { "aria-hidden": "true" }), `Sisa ${stock}`) : null),
            el("small", { class: "erp-pos__cat-label", text: product.category || "Umum" }),
            el("strong", { text: product.name }),
            el("span", { class: "erp-pos__buy" },
                el("span", { class: "erp-pos__price", text: rupiah(channelPrice(product.price, pos.channel, settings)) }),
                stepper),
            el("span", { class: "erp-pos__meta" },
                out
                    ? el("small", { class: `erp-pos__restock${restock ? " is-asked" : ""}` },
                        restock ? `⟳ Restok diminta ${clock(restock.last_at)}${restock.count > 1 ? ` · ${restock.count}×` : ""}` : (made?.name ? `Bahan habis: ${made.name}` : "Stok habis"))
                    : low
                        ? el("small", { class: "erp-pos__eta", text: eta ? `± habis ${clock(eta)}` : made?.name ? `${made.name} menipis` : "Stok menipis" })
                        : el("small", { text: made ? (stock >= 999 ? "Tersedia" : `Bisa ${stock} porsi`) : `Stok ${stock}` }),
                hasOptions && !out ? el("em", { class: "erp-pos__tag", text: "+ varian" }) : null)
        );
    }

    /** + di kartu: menu tanpa varian = tambah 1; menu bervarian = pilih varian dulu. */
    function increaseProduct(product) {
        const plain = !groupsFor(product, groups).length;
        const line = pos.lines.slice().reverse().find((entry) => entry.product_id === String(product.id) && (!plain || !(entry.options || []).length));
        if (plain && line) setQty(line.key, line.qty + 1);
        else pick(product);
    }

    /** − di kartu: kurangi baris terakhir menu ini. */
    function decreaseProduct(product) {
        const line = pos.lines.slice().reverse().find((entry) => entry.product_id === String(product.id));
        if (line) setQty(line.key, line.qty - 1);
    }

    /** Sisa porsi/stok yang masih bisa dijual (sudah dikurangi isi keranjang). */
    function availability(product) {
        if (cooked(product.id)) {
            const made = capacity({ product_id: product.id, options: [] }, { recipes, optionRecipes, stock: ingredientStock, reserved: orderUsage(pos.lines, recipes, optionRecipes), ingredients });
            return { left: made.portions, made };
        }
        return { left: stockAt(product.id) - inCart(product.id), made: null };
    }

    /**
     * Menu HABIS diketuk: lembar gelap yang tidak mungkin disalahpahami — menu TIDAK masuk pesanan,
     * tawarkan pengganti (kartu mini bergambar), minta restok ke gudang, catat permintaan pelanggan.
     */
    function soldOutDialog(product, made) {
        if (!isCashier) return;
        const alternatives = products
            .filter((entry) => entry.id !== product.id && (entry.category || "Umum") === (product.category || "Umum"))
            .map((entry) => ({ entry, left: availability(entry).left }))
            .filter((row) => row.left > 0)
            .slice(0, 3);
        const waiting = waitingFor(product.id);
        const restock = restockOf(product.id);
        const dialog = el("dialog", { class: "erp-dialog erp-soldout" });
        const close = () => dialog.close();
        const record = async () => {
            const value = channelPrice(product.price, pos.channel, settings);
            const ok = await logLost(product, 1, value, "habis");
            if (ok) toast(`Tercatat: ${product.name} diminta tapi habis. TIDAK masuk pesanan.`);
            return ok;
        };
        const askRestock = async () => {
            try {
                await ctx.data.requestRestock({
                    outlet_id: pos.outlet, product_id: product.id, name: product.name,
                    ingredient_id: made?.limiting || null, ingredient_name: made?.name || "",
                });
                close();
                toast(restock ? `Gudang diingatkan lagi untuk restok ${product.name}.` : `Permintaan restok ${product.name} terkirim ke gudang/owner.`);
                ctx.rerender();
            } catch (error) {
                toast(friendlyError(error), "error");
            }
        };

        dialog.append(
            el("div", { class: "erp-soldout__hero" },
                product.image_url ? el("img", { src: product.image_url, alt: "" }) : null,
                el("div", { class: "erp-soldout__veil" },
                    el("span", { class: "erp-pos__night-label", text: "Habis" }),
                    el("h2", { class: "erp-soldout__title", text: product.name }))),
            el("div", { class: "erp-soldout__body" },
                el("p", { class: "erp-soldout__lead" }, el("strong", { text: "Tidak masuk pesanan." }), " Sampaikan ke pelanggan sekarang — sebelum membayar."),
                el("dl", { class: "erp-soldout__facts" },
                    el("div", {}, el("dt", { text: "Penyebab" }), el("dd", { text: made?.name ? `Bahan "${made.name}" habis` : "Stok barang habis" })),
                    el("div", {}, el("dt", { text: "Diminta hari ini" }), el("dd", { text: waiting ? `${waiting} pelanggan` : "belum ada" })),
                    el("div", {}, el("dt", { text: "Restok" }), el("dd", { class: restock ? "is-asked" : "", text: restock ? `Diminta ${clock(restock.last_at)}${restock.count > 1 ? ` · ${restock.count}×` : ""}` : "Belum diminta" }))),
                alternatives.length
                    ? el("div", { class: "erp-soldout__alt" },
                        el("p", { text: "Tawarkan pengganti — 1 ketukan masuk pesanan" }),
                        el("div", { class: "erp-soldout__cards" }, alternatives.map(({ entry, left }) => el("button", {
                            type: "button", class: "erp-soldout__card",
                            onclick: async () => {
                                close();
                                await record();
                                pick(entry);
                            },
                        },
                            entry.image_url ? el("img", { src: entry.image_url, alt: "" }) : el("span", { class: "erp-pos__ph", text: entry.name.charAt(0) }),
                            el("strong", { text: entry.name }),
                            el("small", { text: `${rupiah(channelPrice(entry.price, pos.channel, settings))}${left <= 3 ? ` · sisa ${left}` : ""}` })))))
                    : el("p", { class: "erp-soldout__none", text: "Tidak ada menu sejenis yang tersedia." }),
                el("div", { class: "erp-soldout__actions" },
                    el("button", { class: "erp-soldout__gold", type: "button", onclick: askRestock }, restock ? "⟳ Ingatkan gudang lagi" : "⟳ Minta restok ke gudang"),
                    el("button", {
                        class: "erp-soldout__ghost", type: "button",
                        onclick: async () => {
                            close();
                            if (await record()) ctx.rerender();
                        },
                    }, "Catat: pelanggan minta"),
                    el("button", { class: "erp-soldout__ghost", type: "button", onclick: close }, "Tutup")))
        );
        dialog.addEventListener("close", () => dialog.remove());
        document.body.appendChild(dialog);
        dialog.showModal();
    }

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
            pick(hit);
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
        if (hit) pick(hit);
        else toast(`Barcode ${code} tidak ada di katalog.`, "error");
    });

    // ---------- Penjualan yang hilang ----------
    async function logLost(product, qty, value, reason) {
        try {
            await ctx.data.recordLostSale({ outlet_id: pos.outlet, product_id: product.id, name: product.name, qty, value, reason });
            return true;
        } catch (error) {
            toast(friendlyError(error), "error");
            return false;
        }
    }

    /** Item dibatalkan: simpan sebentar, kasir cukup 1 ketukan memilih alasannya. */
    function noteRemoved(entries) {
        const valid = entries.filter((entry) => entry.qty > 0);
        pos.removed = valid.length ? { entries: valid, at: Date.now() } : null;
    }

    // ---------- Member & Kasir yang Ingat (Tahap 4) ----------
    const memberRef = () => (pos.member && !CHANNELS[pos.channel].online ? { points: pos.member.member.points } : null);

    async function attachMember(memberId) {
        try {
            pos.member = await ctx.data.getMemberCard(memberId);
            pos.redeem = 0;
            if (!pos.customer.trim()) pos.customer = pos.member.member.name;
            drawCart();
        } catch (error) {
            toast(friendlyError(error), "error");
        }
    }

    async function registerMember(prefill = "") {
        const digits = /\d{6,}/.test(prefill) ? prefill.replace(/[^\d+]/g, "") : "";
        const values = await formDialog({
            title: "Daftar member (10 detik)",
            fields: [
                { name: "name", label: "Nama panggilan", required: true, max: 60, value: digits ? "" : prefill },
                { name: "phone", label: "Nomor HP", required: true, max: 20, value: digits, hint: "Dipakai sebagai kartu member. Tidak perlu email, tanggal lahir, atau alamat." },
                {
                    name: "consent", label: "Izin pelanggan (tanyakan langsung)", type: "checkboxes", value: ["history"],
                    options: [
                        { value: "history", label: "Setuju riwayat belanja & poin disimpan (wajib untuk jadi member)" },
                        { value: "promo", label: "Boleh dikirimi info promo lewat WhatsApp (boleh tidak)" },
                    ],
                    hint: "UU PDP: pelanggan bisa minta datanya dihapus kapan saja di kasir.",
                },
            ],
            submitLabel: "Daftarkan",
        });
        if (!values) return;
        try {
            const member = await ctx.data.saveMember({
                name: values.name, phone: values.phone,
                consent_history: values.consent.includes("history"), consent_promo: values.consent.includes("promo"),
            });
            toast(`Member terdaftar: ${member.name}`);
            await attachMember(member.id);
        } catch (error) {
            toast(friendlyError(error), "error");
        }
    }

    async function forgetMember() {
        const { member } = pos.member;
        if (!(await confirmDialog(`Hapus SEMUA data member ${member.name}? Poin (${member.points}) hangus, riwayat favorit hilang, struk lama tetap ada tanpa nama. Lakukan hanya atas permintaan member.`))) return;
        try {
            await ctx.data.forgetMember(member.id);
            if (pos.customer === member.name) pos.customer = "";
            pos.member = null;
            pos.redeem = 0;
            toast("Data member dihapus sesuai permintaannya (UU PDP).");
            drawCart();
        } catch (error) {
            toast(friendlyError(error), "error");
        }
    }

    function addFavorite(favorite) {
        const product = products.find((entry) => String(entry.id) === String(favorite.product_id));
        if (!product) {
            toast("Menu favorit ini sudah tidak ada di katalog.", "error");
            return;
        }
        if (!cooked(product.id) && stockAt(product.id) - inCart(product.id) <= 0) {
            soldOutDialog(product, null);
            return;
        }
        addLine(product, { options: favorite.options.map(({ group_id, option_id }) => ({ group_id, option_id })), note: favorite.note || "", qty: 1 });
        toast(`Ditambahkan: ${product.name} (pesanan biasanya)`);
    }

    function memberBox(priced) {
        if (!settings.loyalty_enabled || CHANNELS[pos.channel].online || !isCashier) return null;
        if (pos.member) {
            const { member, profile } = pos.member;
            const remaining = priced.subtotal - priced.promo_discount - priced.discount;
            const max = pointsRedeemable({ requested: member.points, balance: member.points, remaining, settings }).points;
            const redeem = el("input", { type: "checkbox", "aria-label": "Tukar poin" });
            redeem.checked = pos.redeem > 0;
            redeem.disabled = !max;
            redeem.addEventListener("change", () => {
                pos.redeem = redeem.checked ? member.points : 0;
                drawCart();
            });
            return el("div", { class: "erp-member" },
                el("div", { class: "erp-member__head" },
                    el("div", {},
                        el("strong", { text: `👤 ${member.name}` }),
                        el("small", { text: ` ${member.phone_masked} · ${member.points} poin` })),
                    el("button", { class: "erp-link", type: "button", onclick: () => { pos.member = null; pos.redeem = 0; drawCart(); } }, "Lepas")),
                profile
                    ? el("p", { class: "erp-member__hint", text: `🧠 ${greetingText(profile)}` })
                    : el("p", { class: "erp-muted", text: "Riwayat tidak disimpan (member tidak mengizinkan)." }),
                profile?.favorites.length
                    ? el("div", { class: "erp-chips erp-member__fav", role: "group", "aria-label": "Pesanan favorit" }, profile.favorites.map((favorite) =>
                        el("button", { type: "button", class: "erp-chip", title: `Dipesan ${favorite.count}× — ketuk untuk menambah`, onclick: () => addFavorite(favorite) },
                            `↻ ${favorite.name}${favorite.options.length ? ` · ${favorite.options.map((option) => option.name).filter(Boolean).join(", ")}` : ""}`)))
                    : null,
                member.points
                    ? el("label", { class: "erp-member__redeem" }, redeem,
                        max ? ` Tukar poin: maks ${max} poin = ${rupiah(max * settings.point_value)}` : " Poin belum bisa ditukar untuk pesanan ini")
                    : null,
                el("p", { class: "erp-member__foot" },
                    el("span", { text: member.consent_promo ? "✅ Mau menerima promo" : "🔕 Tidak menerima promo" }),
                    el("button", { class: "erp-link erp-link--danger", type: "button", onclick: () => forgetMember() }, "Hapus data saya"))
            );
        }

        const input = el("input", { type: "search", class: "erp-input-sm", placeholder: "Member? Cari HP / nama", "aria-label": "Cari member" });
        const results = el("div", { class: "erp-chips erp-member__results" });
        let timer = null;
        input.addEventListener("input", () => {
            clearTimeout(timer);
            timer = setTimeout(async () => {
                const text = input.value.trim();
                const list = text.length >= 3 ? await ctx.data.findMembers(text) : [];
                results.replaceChildren(
                    ...list.map((member) => el("button", { type: "button", class: "erp-chip", onclick: () => attachMember(member.id) }, `👤 ${member.name} · ${member.phone_masked} · ${member.points} poin`)),
                    ...(text.length >= 3 && !list.length ? [el("small", { class: "erp-muted", text: "Belum terdaftar." })] : [])
                );
            }, 250);
        });
        return el("div", { class: "erp-member erp-member--empty" },
            el("div", { class: "erp-member__search" }, input,
                el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => registerMember(input.value.trim()) }, "+ Member baru")),
            results);
    }

    // ---------- Keranjang ----------
    const cartBox = el("div", { class: "erp-pos__cart" });

    async function pick(product) {
        const productGroups = groupsFor(product, groups);
        if (!productGroups.length) {
            addLine(product, { options: [], note: "", qty: 1 });
            return;
        }
        const chosen = await itemDialog({ product, groups: productGroups, channel: pos.channel, settings });
        if (chosen) addLine(product, chosen);
    }

    function addLine(product, { options, note, qty }, replaceKey = null) {
        const id = String(product.id);
        const others = inCart(id) - (replaceKey ? pos.lines.find((line) => line.key === replaceKey)?.qty || 0 : 0);
        const key = lineKey(id, options, note);
        const existing = pos.lines.find((line) => line.key === key && line.key !== replaceKey);
        if (cooked(id)) {
            const next = pos.lines.filter((line) => line.key !== replaceKey).map((line) => ({ ...line }));
            const same = next.find((line) => line.key === key);
            if (same) same.qty += qty;
            else next.push({ key, product_id: id, qty, options, note });
            const lacking = missingIngredient(next);
            if (lacking) {
                const others = pos.lines.filter((line) => line.key !== replaceKey);
                const can = capacity({ product_id: id, options }, { recipes, optionRecipes, stock: ingredientStock, reserved: orderUsage(others, recipes, optionRecipes), ingredients });
                const already = others.filter((line) => line.key === key).reduce((sum, line) => sum + line.qty, 0);
                const room = Math.max(0, (can?.portions ?? 0) - already);
                toast(room > 0
                    ? `Hanya cukup untuk ${room} porsi lagi (bahan "${lacking}"). Sampaikan ke pelanggan SEBELUM bayar.`
                    : `${product.name} dengan pilihan ini HABIS (bahan "${lacking}"). Sampaikan ke pelanggan & tawarkan pengganti.`, "error");
                return;
            }
        } else if (others + qty > stockAt(id)) {
            const room = Math.max(0, stockAt(id) - others);
            toast(room > 0 ? `Stok hanya cukup ${room} lagi. Sampaikan ke pelanggan SEBELUM bayar.` : `${product.name} HABIS. Sampaikan ke pelanggan.`, "error");
            return;
        }
        if (replaceKey) pos.lines = pos.lines.filter((line) => line.key !== replaceKey);
        if (existing) existing.qty += qty;
        else pos.lines.push({ key, product_id: id, qty, options, note });
        drawGrid();
        drawCart();
    }

    function setQty(key, qty) {
        const line = pos.lines.find((entry) => entry.key === key);
        if (!line) return;
        if (qty <= 0) {
            const unit = priceOrder({ lines: [line], products, groups, channel: pos.channel, settings: { ...settings, service_enabled: false, tax_enabled: false, rounding: 0 } }).items[0];
            noteRemoved([{ product_id: line.product_id, name: unit?.name || "", qty: line.qty, value: unit?.line_total || 0 }]);
            pos.lines = pos.lines.filter((entry) => entry.key !== key);
        }
        else if (cooked(line.product_id)) {
            const lacking = missingIngredient(pos.lines.map((entry) => (entry.key === key ? { ...entry, qty } : entry)));
            if (lacking) toast(`Maksimal ${line.qty} porsi: bahan "${lacking}" tidak cukup lagi. Sampaikan ke pelanggan SEBELUM bayar.`, "error");
            else line.qty = qty;
        }
        else if (inCart(line.product_id) - line.qty + qty > stockAt(line.product_id)) toast(`Maksimal ${line.qty}: stok habis. Sampaikan ke pelanggan SEBELUM bayar.`, "error");
        else line.qty = qty;
        drawGrid();
        drawCart();
    }

    /** Baris ini sudah mencapai porsi/stok maksimal? (tombol + dimatikan) */
    function atMax(key) {
        const line = pos.lines.find((entry) => entry.key === key);
        if (!line) return false;
        if (cooked(line.product_id)) return Boolean(missingIngredient(pos.lines.map((entry) => (entry.key === key ? { ...entry, qty: entry.qty + 1 } : entry))));
        return inCart(line.product_id) + 1 > stockAt(line.product_id);
    }

    async function editLine(line) {
        const product = products.find((entry) => String(entry.id) === line.product_id);
        if (!product) return;
        const chosen = await itemDialog({ product, groups: groupsFor(product, groups), channel: pos.channel, settings, existing: line });
        if (chosen) addLine(product, chosen, line.key);
    }

    /** Pembayaran yang dipakai: satu metode (non-tunai = pas) atau campuran. */
    const effectivePayments = (total) => {
        if (pos.split) return pos.payments;
        const [first] = pos.payments;
        return first.method === "tunai" ? [first] : [{ method: first.method, amount: total }];
    };

    function drawCart() {
        const priced = priceOrder({
            lines: pos.lines, products, groups, channel: pos.channel, discount: pos.discount, settings,
            promos, now: new Date(), member: memberRef(), redeem_points: pos.redeem,
        });
        const running = CHANNELS[pos.channel].online ? [] : promos.filter((promo) => promoActive(promo, new Date()) && (!promo.members_only || pos.member));
        const channel = CHANNELS[pos.channel];
        const payment = settlePayments(priced.total, effectivePayments(priced.total));
        const current = bills.find((bill) => bill.id === pos.billId);

        // Meja & nama pemesan
        const tableInput = el("input", { class: "erp-input-sm", placeholder: "No. meja", "aria-label": "Nomor meja", maxlength: 10 });
        tableInput.value = pos.table;
        tableInput.addEventListener("input", () => { pos.table = tableInput.value; });
        const nameInput = el("input", {
            class: "erp-input-sm",
            placeholder: channel.online ? "Nama di aplikasi ojol" : "Nama pemesan (opsional)",
            "aria-label": "Nama pemesan",
            maxlength: 40,
        });
        nameInput.value = pos.customer;
        nameInput.addEventListener("input", () => { pos.customer = nameInput.value; });

        const discountInput = el("input", { type: "number", min: 0, step: 500, class: "erp-input-sm", "aria-label": "Diskon (Rp)", placeholder: "0" });
        discountInput.value = pos.discount || "";
        discountInput.addEventListener("change", () => {
            pos.discount = Math.max(0, Number(discountInput.value) || 0);
            drawCart();
        });

        const pay = el("button", {
            class: "erp-btn erp-btn--primary erp-btn--block erp-pos__pay",
            type: "button",
            disabled: !priced.items.length || !payment.ok,
        }, priced.items.length ? `Bayar ${rupiah(priced.total)}` : "Keranjang kosong");

        pay.addEventListener("click", async () => {
            if (!shift) {
                toast("Buka shift dulu sebelum berjualan.", "error");
                return;
            }
            // Diskon besar = rawan "diskon untuk teman": wajib PIN atasan.
            let approvalPin = null;
            if (needsDiscountApproval(priced.subtotal, priced.discount, settings.discount_pin_percent)) {
                approvalPin = await askPin(ctx, `Diskon ${rupiah(priced.discount)} melebihi ${settings.discount_pin_percent}% dari subtotal`);
                if (!approvalPin) return;
            }
            const partial = Boolean(pos.splitRest?.length);
            const payload = {
                outlet_id: pos.outlet,
                channel: pos.channel,
                table_no: pos.table,
                customer_name: pos.customer,
                discount: pos.discount,
                lines: pos.lines.map(({ product_id, qty, options, note }) => ({ product_id, qty, options, note })),
                payments: effectivePayments(priced.total).map((row) => ({ method: row.method, amount: Number(row.amount) || 0 })),
                bill_id: partial ? null : pos.billId,
                queue_no: pos.queueNo,
                approval_pin: approvalPin,
                member_id: memberRef() ? pos.member.member.id : null,
                redeem_points: priced.points_used,
            };

            /** Offline: simpan di perangkat, struk sementara, sinkron nanti (jam asli dipakai). */
            const saveOffline = () => {
                if (approvalPin) throw new Error("Diskon besar butuh PIN atasan yang dicek server: tidak bisa saat offline.");
                if (priced.points_used) throw new Error("Tukar poin butuh internet. Lepas centang \"Tukar poin\" dulu.");
                const preview = {
                    id: null, receipt_no: "", created_at: new Date().toISOString(), channel: priced.channel,
                    table_no: pos.table, customer_name: pos.customer, queue_no: pos.queueNo || "",
                    items: priced.items.map(({ product_id, name, qty, unit_price, options, note }) => ({ product_id, name, qty, price: unit_price, options, note })),
                    subtotal: priced.subtotal, promos: priced.promos, promo_discount: priced.promo_discount, discount: priced.discount,
                    points_used: 0, points_value: 0, points_earned: priced.points_earned,
                    service: priced.service, tax: priced.tax, rounding: priced.rounding, total: priced.total,
                    payments: payment.applied, paid: payment.paid, change: payment.change, offline_pending: true,
                };
                const entry = enqueue(storage, payload, preview);
                return { ...preview, receipt_no: entry.id };
            };

            pay.disabled = true;
            try {
                let sale;
                let readyAt = null;
                if (isOffline()) {
                    sale = saveOffline();
                } else {
                    if (settings.kitchen_enabled && !pos.queueNo) pos.queueNo = await ctx.data.nextQueueNo(pos.outlet);
                    payload.queue_no = pos.queueNo;
                    const pending = settings.kitchen_enabled ? unsentLines(pos.lines, pos.sent) : [];
                    try {
                        sale = await ctx.data.posCheckoutPro(payload);
                    } catch (error) {
                        if (!isNetworkError(error)) throw error;
                        sale = saveOffline(); // internet putus tepat saat bayar
                    }
                    // Lunas: sisa pesanan yang belum ke dapur dikirim, lalu ETA jujur dihitung untuk struk.
                    if (settings.kitchen_enabled && !sale.offline_pending) {
                        if (pending.length) await sendLines(pending, sale.receipt_no);
                        readyAt = await honestEta(sale.queue_no || pos.queueNo);
                    }
                }
                if (sale.offline_pending) toast("📴 Offline: transaksi disimpan di perangkat & akan disinkron. Sampaikan pesanan ke dapur langsung.");

                const memberName = pos.member?.member.name || null;
                const balance = pos.member && !sale.offline_pending ? pos.member.member.points - (sale.points_used || 0) + (sale.points_earned || 0) : null;
                publish({
                    type: "paid", sale_id: sale.id, receipt_no: sale.receipt_no, total: sale.total, change: sale.change,
                    queue_no: sale.queue_no, points: sale.points_earned || 0, offline: Boolean(sale.offline_pending),
                    ready: readyAt ? new Date(readyAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : null,
                });

                if (partial) {
                    // Split bill: bagian ini lunas, sisa pesanan kembali ke layar (meja, antrian & bill tetap).
                    const keep = { channel: pos.channel, table: pos.table, customer: pos.customer, billId: pos.billId, queueNo: pos.queueNo, sent: pos.sent, splitNo: pos.splitNo + 1 };
                    const rest = pos.splitRest;
                    resetOrder();
                    Object.assign(pos, keep, { lines: rest });
                    if (keep.billId && !sale.offline_pending) {
                        await ctx.data.saveOpenBill({
                            id: keep.billId, outlet_id: pos.outlet, channel: keep.channel, table_no: keep.table, customer_name: keep.customer, discount: 0,
                            lines: rest.map(({ product_id, qty, options, note }) => ({ product_id, qty, options, note })), queue_no: keep.queueNo, sent: keep.sent,
                        });
                    }
                } else {
                    resetOrder();
                }
                showReceipt(sale, outlet, me, settings, false, readyAt, memberName ? { name: memberName, balance } : null);
                ctx.rerender();
            } catch (error) {
                toast(friendlyError(error), "error");
                pay.disabled = false;
            }
        });

        // ---------- Split bill ----------
        const totalUnits = priced.items.reduce((sum, item) => sum + item.qty, 0);
        const splitTools = priced.items.length && isCashier
            ? el("div", { class: "erp-pos__split-tools" },
                el("button", {
                    class: "erp-btn erp-btn--sm", type: "button", disabled: totalUnits < 2 || isOffline(),
                    title: isOffline() ? "Pisah per item butuh internet (bill & dapur)" : "Tiap orang bayar item yang ia pesan, struk sendiri-sendiri",
                    onclick: () => splitByItem(),
                }, "✂️ Pisah per item"),
                el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => splitEqual(priced.total) }, "➗ Bagi rata"))
            : null;

        // ---------- Kirim ke layar pelanggan ----------
        const firstName = (name) => String(name || "").trim().split(/\s+/)[0];
        lastCart = {
            type: "cart",
            channel: CHANNELS[pos.channel]?.label,
            label: pos.table ? `Meja ${pos.table}` : "",
            items: priced.items.map((item) => ({
                name: item.name, qty: item.qty, total: item.line_total,
                options: item.options.map((option) => option.name).join(", ") + (item.note ? ` · ${item.note}` : ""),
            })),
            subtotal: priced.subtotal,
            lines: [
                ...priced.promos.map((row) => ({ label: `🎉 ${row.name}`, value: `−${rupiah(row.amount)}`, good: true })),
                ...(priced.discount ? [{ label: "Diskon", value: `−${rupiah(priced.discount)}`, good: true }] : []),
                ...(priced.points_value ? [{ label: `Tukar ${priced.points_used} poin`, value: `−${rupiah(priced.points_value)}`, good: true }] : []),
                ...(priced.service ? [{ label: `Service ${settings.service_rate}%`, value: rupiah(priced.service) }] : []),
                ...(priced.tax ? [{ label: `PB1 ${settings.tax_rate}%`, value: rupiah(priced.tax) }] : []),
                ...(priced.rounding ? [{ label: "Pembulatan", value: `${priced.rounding > 0 ? "+" : "−"}${rupiah(Math.abs(priced.rounding))}` }] : []),
            ],
            total: priced.total,
            member: memberRef() ? { name: firstName(pos.member.member.name), points: pos.member.member.points, earn: priced.points_earned } : null,
            split: pos.split && pos.equal ? pos.equal : null,
        };
        publish(lastCart);

        const saveBill = el("button", {
            class: "erp-btn erp-btn--block",
            type: "button",
            disabled: !priced.items.length,
            onclick: async () => {
                try {
                    if (!pos.table.trim() && !pos.customer.trim()) throw new Error("Isi nomor meja atau nama pemesan dulu.");
                    const kitchen = await sendNewToKitchen(null);
                    const saved = await ctx.data.saveOpenBill({
                        id: pos.billId, outlet_id: pos.outlet, channel: pos.channel,
                        table_no: pos.table, customer_name: pos.customer, discount: pos.discount,
                        lines: pos.lines.map(({ product_id, qty, options, note }) => ({ product_id, qty, options, note })),
                        queue_no: pos.queueNo, sent: pos.sent, member_id: pos.member?.member.id || null,
                    });
                    toast(`Bill disimpan: ${orderLabel(saved)}${kitchen ? ` · ${kitchen} tiket ke dapur/bar · antrian ${pos.queueNo}` : ""}`);
                    resetOrder();
                    ctx.rerender();
                } catch (error) {
                    toast(friendlyError(error), "error");
                }
            },
        }, current ? "💾 Perbarui bill" : "💾 Simpan bill (bayar nanti)");

        // Elemen kosong (null) dibuang: replaceChildren mencetak null sebagai teks "null".
        cartBox.replaceChildren(...[
            el("div", { class: "erp-card__head" },
                el("h2", { text: current ? `Bill · ${orderLabel(current)}` : "Pesanan" }),
                priced.items.length || current
                    ? el("button", {
                        class: "erp-btn erp-btn--sm", type: "button",
                        onclick: () => {
                            const cancelled = current ? [] : priced.items.map((item) => ({ product_id: item.product_id, name: item.name, qty: item.qty, value: item.line_total }));
                            resetOrder();
                            noteRemoved(cancelled);
                            drawAll();
                        },
                    }, current ? "Tutup bill" : "Kosongkan")
                    : null
            ),
            el("div", { class: "erp-pos__who" }, channel.table ? tableInput : null, nameInput),
            pos.queueNo ? el("p", { class: "erp-pos__queue" }, "Nomor antrian ", el("strong", { text: pos.queueNo })) : null,
            running.length ? el("p", { class: "erp-pos__promo" }, "🎉 Promo berjalan: ", running.map((promo) => `${promo.name} (${scheduleText(promo)})`).join(" · ")) : null,
            memberBox(priced),
            pos.splitRest?.length
                ? el("div", { class: "erp-pos__splitnote" },
                    el("span", { text: `✂️ Bagian ${pos.splitNo + 1}: bayar item di bawah dulu. Sisa ${pos.splitRest.reduce((sum, line) => sum + line.qty, 0)} item menunggu bagian berikutnya.` }),
                    el("button", { class: "erp-link", type: "button", onclick: () => { pos.lines = mergeLines(pos.lines, pos.splitRest); pos.splitRest = null; drawAll(); } }, "Gabung lagi"))
                : null,
            removedPrompt(),
            priced.items.length
                ? el("ul", { class: "erp-pos__lines" }, priced.items.map((item) => el("li", {},
                    el("button", { type: "button", class: "erp-pos__line-name", title: "Ubah varian / catatan", onclick: () => editLine(pos.lines.find((line) => line.key === item.key)) },
                        el("strong", { text: item.name }),
                        item.options.length ? el("small", { text: item.options.map((option) => (option.price ? `${option.name} +${rupiah(option.price)}` : option.name)).join(" · ") }) : null,
                        item.note ? el("small", { class: "erp-pos__note", text: `📝 ${item.note}` }) : null,
                        el("small", { text: `${rupiah(item.unit_price)} / item · ✎ ubah` })
                    ),
                    el("span", { class: "erp-qty" },
                        el("button", { type: "button", "aria-label": `Kurangi ${item.name}`, onclick: () => setQty(item.key, item.qty - 1) }, "−"),
                        el("span", { text: String(item.qty) }),
                        el("button", {
                            type: "button", "aria-label": `Tambah ${item.name}`, disabled: atMax(item.key),
                            title: atMax(item.key) ? "Sudah maksimal: stok/bahan tidak cukup lagi" : null,
                            onclick: () => setQty(item.key, item.qty + 1),
                        }, "+"),
                        atMax(item.key) ? el("small", { class: "erp-qty__max", text: "maks" }) : null
                    ),
                    el("strong", { class: "erp-pos__line-total", text: rupiah(item.line_total) })
                )))
                : emptyState("Ketuk produk atau scan barcode."),
            el("dl", { class: "erp-pos__sum" },
                el("dt", { text: "Subtotal" }), el("dd", { text: rupiah(priced.subtotal) }),
                priced.promos.flatMap((row) => [el("dt", { class: "erp-pos__promo-line", text: `🎉 ${row.name}` }), el("dd", { class: "erp-pos__promo-line", text: `−${rupiah(row.amount)}` })]),
                el("dt", {}, el("label", { text: "Diskon (Rp)" })), el("dd", {}, discountInput),
                priced.points_value ? [el("dt", { text: `Tukar ${priced.points_used} poin` }), el("dd", { text: `−${rupiah(priced.points_value)}` })] : null,
                priced.service ? [el("dt", { text: `Service ${settings.service_rate}%` }), el("dd", { text: rupiah(priced.service) })] : null,
                priced.tax ? [el("dt", { text: `PB1 ${settings.tax_rate}%` }), el("dd", { text: rupiah(priced.tax) })] : null,
                priced.rounding ? [el("dt", { text: "Pembulatan" }), el("dd", { text: `${priced.rounding > 0 ? "+" : "−"}${rupiah(Math.abs(priced.rounding))}` })] : null,
                el("dt", { class: "erp-pos__total", text: "Total" }), el("dd", { class: "erp-pos__total", text: rupiah(priced.total) })
            ),
            pos.member && priced.points_earned ? el("p", { class: "erp-muted erp-pos__hint", text: `⭐ ${pos.member.member.name} dapat +${priced.points_earned} poin dari pesanan ini.` }) : null,
            channel.online ? el("p", { class: "erp-muted erp-pos__hint", text: `Harga ${channel.label} = harga toko +${settings.online_markup}% (dibulatkan). Pajak & service sudah termasuk di aplikasi.` }) : null,
            splitTools,
            isCashier && !pos.splitRest?.length ? saveBill : null,
            paymentBox(priced, payment, drawCart),
            pay
        ].filter(Boolean));
    }

    /** Kirim baris (sudah dihitung harganya) ke BAR / DAPUR. Mengembalikan jumlah tiket. */
    async function sendLines(lines, ref) {
        const priced = priceOrder({ lines, products, groups, channel: pos.channel, settings });
        if (!priced.items.length) return 0;
        const tickets = splitTickets(priced.items, products);
        await ctx.data.sendToKitchen({
            outlet_id: pos.outlet, queue_no: pos.queueNo,
            label: orderLabel({ channel: pos.channel, table_no: pos.table, customer_name: pos.customer }),
            channel: pos.channel, ref, tickets,
        });
        pos.sent = markSent(pos.lines, pos.sent);
        return tickets.length;
    }

    /** Bill disimpan = pesanan baru/tambahan langsung ke dapur (bayar belakangan). */
    async function sendNewToKitchen(ref) {
        if (!settings.kitchen_enabled) return 0;
        const pending = unsentLines(pos.lines, pos.sent);
        if (!pending.length) return 0;
        if (!pos.queueNo) pos.queueNo = await ctx.data.nextQueueNo(pos.outlet);
        return sendLines(pending, ref);
    }

    /** ETA JUJUR: antrian nyata + waktu pembuatan yang dipelajari dari tiket sebelumnya. */
    async function honestEta(queueNo) {
        if (!queueNo) return null;
        try {
            const tickets = await ctx.data.listKitchenTickets({ outletId: pos.outlet, days: 14 });
            const eta = estimateReady(tickets, learnPrepTimes(tickets), Date.now(), { bar: settings.bar_staff, dapur: settings.dapur_staff });
            return orderReadyAt(queueNo, tickets, eta);
        } catch {
            return null;
        }
    }

    /** "Kenapa dibatalkan?" — 1 ketukan, atau lewati. */
    function removedPrompt() {
        if (!pos.removed || !isCashier || Date.now() - pos.removed.at > 60000) return null;
        const { entries } = pos.removed;
        const value = entries.reduce((sum, entry) => sum + entry.value, 0);
        const choose = async (reason) => {
            const done = pos.removed;
            pos.removed = null;
            if (reason) {
                for (const entry of done.entries) {
                    await logLost({ id: entry.product_id, name: entry.name }, entry.qty, entry.value, reason);
                }
                toast(`Tercatat sebagai penjualan hilang: ${rupiah(value)} (${LOST_REASONS[reason]}).`);
                ctx.rerender();
                return;
            }
            drawCart();
        };
        return el("div", { class: "erp-pos__lost", role: "group", "aria-label": "Alasan pembatalan" },
            el("p", {}, `Dibatalkan: ${entries.map((entry) => `${entry.qty}× ${entry.name}`).join(", ")} (${rupiah(value)}). Kenapa?`),
            el("div", { class: "erp-chips" },
                ["harga", "lama", "ganti", "batal"].map((reason) => el("button", { type: "button", class: "erp-chip", onclick: () => choose(reason) }, LOST_REASONS[reason])),
                el("button", { type: "button", class: "erp-chip erp-chip--ghost", onclick: () => choose(null) }, "Lewati"))
        );
    }

    /** Pisah per item: pilih jumlah tiap baris untuk bagian ini; sisanya dibayar berikutnya. */
    async function splitByItem() {
        const priced = priceOrder({ lines: pos.lines, products, groups, channel: pos.channel, settings });
        const values = await formDialog({
            title: "Pisah bill per item",
            fields: priced.items.map((item) => ({
                name: item.key, type: "number", min: 0, max: item.qty, step: 1, value: 0,
                label: `${item.name}${item.options.length ? ` (${item.options.map((option) => option.name).join(", ")})` : ""} — ada ${item.qty}`,
            })),
            submitLabel: "Bayar bagian ini dulu",
        });
        if (!values) return;
        const picks = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number(value) || 0]));
        const { part, rest } = splitLines(pos.lines, picks);
        if (!part.length) {
            toast("Pilih minimal 1 item untuk bagian ini.", "error");
            return;
        }
        if (!rest.length) {
            toast("Itu semua item — bayar biasa saja tanpa pisah.", "error");
            return;
        }
        try {
            // Semua pesanan dikirim ke dapur dulu (sekali), supaya pembayaran per bagian tidak dobel tiket.
            await sendNewToKitchen(null);
        } catch (error) {
            toast(friendlyError(error), "error");
            return;
        }
        Object.assign(pos, { lines: part, splitRest: rest, discount: 0, redeem: 0, split: false, equal: null, payments: [{ method: "tunai", amount: "" }] });
        drawAll();
    }

    /** Bagi rata N orang: jadi bayar campuran dengan N baris (metode tiap orang bisa diganti). */
    async function splitEqual(total) {
        const values = await formDialog({
            title: "Bagi rata",
            fields: [{ name: "people", label: "Jumlah orang", type: "number", min: 2, max: 20, step: 1, value: 2, required: true }],
            submitLabel: "Bagi",
        });
        if (!values) return;
        const shares = equalShares(total, Number(values.people) || 2, settings.rounding || 100);
        Object.assign(pos, { split: true, equal: shares, payments: shares.map((amount) => ({ method: "qris", amount: String(amount) })) });
        toast(`Masing-masing ${shares.map((amount) => rupiah(amount)).join(" · ")}. Ganti metode tiap orang bila perlu.`);
        drawCart();
    }

    function drawAll() {
        drawChannels();
        drawGrid();
        drawCart();
    }

    // ---------- Pembayaran (satu metode / campuran) ----------
    function paymentBox(priced, payment, redraw) {
        const total = priced.total;

        if (!pos.split) {
            const [first] = pos.payments;
            const paidInput = el("input", { type: "number", min: 0, step: 1000, class: "erp-input-sm", "aria-label": "Uang diterima", placeholder: "Uang diterima" });
            paidInput.value = first.amount;
            const changeText = el("strong", { text: rupiah(payment.change) });
            paidInput.addEventListener("input", () => {
                first.amount = paidInput.value;
                const next = settlePayments(total, [{ method: "tunai", amount: Number(first.amount) || 0 }]);
                changeText.textContent = rupiah(next.change);
                const pay = cartBox.querySelector(".erp-pos__pay");
                if (pay) pay.disabled = !priced.items.length || !next.ok;
            });

            return el("div", { class: "erp-pos__payments" },
                segmented(Object.entries(PAY_METHODS).map(([value, label]) => ({ value, label })), first.method, (value) => {
                    first.method = value;
                    first.amount = "";
                    redraw();
                }),
                first.method === "tunai"
                    ? el("div", { class: "erp-pos__cash" },
                        paidInput,
                        el("div", { class: "erp-pos__quick" }, quickCash(total).map((amount) =>
                            el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => { first.amount = String(amount); redraw(); } }, amount === total ? "Uang pas" : rupiah(amount))
                        )),
                        el("p", { class: "erp-pos__change" }, "Kembalian: ", changeText)
                    )
                    : el("p", { class: "erp-muted", text: `Pembayaran ${PAY_METHODS[first.method]} dianggap pas sesuai total.` }),
                el("button", {
                    class: "erp-link erp-pos__split-toggle",
                    type: "button",
                    disabled: !priced.items.length,
                    onclick: () => {
                        pos.split = true;
                        pos.payments = [{ method: "qris", amount: "" }, { method: "tunai", amount: "" }];
                        redraw();
                    },
                }, "Bayar campuran (mis. QRIS + tunai)")
            );
        }

        return el("div", { class: "erp-pos__payments" },
            el("p", { class: "erp-pos__split-title" }, el("strong", { text: "Bayar campuran" }),
                el("button", { class: "erp-link", type: "button", onclick: () => { pos.split = false; pos.equal = null; pos.payments = [{ method: "tunai", amount: "" }]; redraw(); } }, "Batal")),
            ...pos.payments.map((row, index) => {
                const method = el("select", { class: "erp-input-sm", "aria-label": `Metode ${index + 1}` },
                    Object.entries(PAY_METHODS).map(([value, label]) => el("option", { value, selected: value === row.method }, label)));
                method.addEventListener("change", () => { row.method = method.value; redraw(); });
                const amount = el("input", { type: "number", min: 0, step: 1000, class: "erp-input-sm", "aria-label": `Nominal ${index + 1}`, placeholder: "Nominal" });
                amount.value = row.amount;
                amount.addEventListener("change", () => { row.amount = amount.value; redraw(); });
                return el("div", { class: "erp-pos__pay-row" }, method, amount,
                    el("button", {
                        class: "erp-btn erp-btn--sm", type: "button", title: "Isi dengan sisa tagihan",
                        onclick: () => {
                            const others = pos.payments.filter((entry) => entry !== row).reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
                            row.amount = String(Math.max(0, total - others));
                            redraw();
                        },
                    }, "Sisa"),
                    pos.payments.length > 2
                        ? el("button", { class: "erp-btn erp-btn--sm", type: "button", "aria-label": "Hapus metode", onclick: () => { pos.payments.splice(index, 1); redraw(); } }, "✕")
                        : null);
            }),
            pos.payments.length < 4
                ? el("button", { class: "erp-link", type: "button", onclick: () => { pos.payments.push({ method: "tunai", amount: "" }); redraw(); } }, "+ Tambah metode")
                : null,
            el("p", { class: "erp-pos__change" },
                payment.problem && payment.paid ? el("span", { class: "erp-form__error", text: payment.problem }) : null,
                ` Sisa tagihan: ${rupiah(payment.remaining)} · Kembalian: `, el("strong", { text: rupiah(payment.change) }))
        );
    }

    // ---------- Bill terbuka ----------
    async function openBills() {
        const dialog = el("dialog", { class: "erp-dialog erp-pos__bills" });
        const close = () => dialog.close();
        const body = bills.length
            ? el("ul", { class: "erp-pos__bill-list" }, bills.slice().sort((a, b) => a.updated_at.localeCompare(b.updated_at)).map((bill) => {
                const priced = priceOrder({ lines: bill.lines, products, groups, channel: bill.channel, discount: bill.discount, settings, promos, now: new Date() });
                const minutes = Math.max(0, Math.round((Date.now() - new Date(bill.updated_at).getTime()) / 60000));
                return el("li", {},
                    el("div", {},
                        el("strong", { text: `${CHANNELS[bill.channel]?.icon || ""} ${orderLabel(bill)}` }),
                        el("small", { text: `${CHANNELS[bill.channel]?.label || ""} · ${priced.items.reduce((sum, item) => sum + item.qty, 0)} item · ${minutes} menit lalu` })
                    ),
                    el("strong", { text: rupiah(priced.total) }),
                    el("button", {
                        class: "erp-btn erp-btn--sm erp-btn--primary", type: "button",
                        onclick: async () => {
                            if (pos.lines.length && pos.billId !== bill.id && !(await confirmDialog("Pesanan di layar akan diganti dengan bill ini. Lanjut?"))) return;
                            Object.assign(pos, {
                                billId: bill.id, channel: bill.channel, table: bill.table_no || "", customer: bill.customer_name || "",
                                queueNo: bill.queue_no || null, sent: bill.sent || {}, removed: null,
                                discount: bill.discount || 0, split: false, payments: [{ method: "tunai", amount: "" }],
                                lines: bill.lines.map((line) => ({ ...line, product_id: String(line.product_id), key: lineKey(String(line.product_id), line.options || [], line.note || "") })),
                            });
                            close();
                            drawAll();
                            if (bill.member_id) attachMember(bill.member_id);
                        },
                    }, "Buka"),
                    el("button", {
                        class: "erp-btn erp-btn--sm", type: "button", "aria-label": `Hapus bill ${orderLabel(bill)}`,
                        onclick: async () => {
                            if (!(await confirmDialog(`Hapus bill ${orderLabel(bill)}? Pesanan ini belum dibayar.`))) return;
                            try {
                                await ctx.data.deleteOpenBill(bill.id);
                                if (pos.billId === bill.id) resetOrder();
                                close();
                                ctx.rerender();
                            } catch (error) {
                                toast(friendlyError(error), "error");
                            }
                        },
                    }, "Hapus")
                );
            }))
            : emptyState("Belum ada bill terbuka. Isi pesanan, lalu klik \"Simpan bill\".");

        dialog.append(
            el("h2", { class: "erp-dialog__title", text: `Bill terbuka · ${outlet.name}` }),
            el("p", { class: "erp-muted", text: "Pesanan yang sudah dicatat tapi belum dibayar (pesan dulu, bayar nanti)." }),
            body,
            el("div", { class: "erp-form__actions" }, el("span", { class: "erp-spacer" }), el("button", { class: "erp-btn", type: "button", onclick: close }, "Tutup"))
        );
        dialog.addEventListener("close", () => dialog.remove());
        document.body.appendChild(dialog);
        dialog.showModal();
    }

    if (isCashier) page.appendChild(shiftBar());
    const offlineInfo = offlineBar();
    if (offlineInfo) page.appendChild(offlineInfo);

    /* ---------- Status offline & antrian sinkron ---------- */
    function offlineBar() {
        const demo = ctx.data.mode === "demo";
        if (!isOffline() && !queue.length && !demo) return null;
        const failed = queue.filter((entry) => entry.error);
        const waiting = queue.length - failed.length;
        const toggle = demo && isCashier
            ? el("button", {
                class: `erp-btn erp-btn--sm${net.simulate ? " erp-btn--primary" : ""}`, type: "button",
                onclick: () => {
                    net.simulate = !net.simulate;
                    toast(net.simulate ? "Simulasi internet mati: transaksi disimpan di perangkat." : "Internet kembali: menyinkronkan…");
                    ctx.rerender();
                },
            }, net.simulate ? "📶 Nyalakan internet lagi" : "📴 Simulasi offline")
            : null;
        if (!isOffline() && !queue.length) {
            return el("div", { class: "erp-offline erp-offline--ok" }, el("span", { text: "🟢 Online · transaksi langsung tersimpan di server." }), toggle);
        }
        return el("section", { class: `erp-offline${isOffline() ? " is-down" : ""}` },
            el("div", { class: "erp-offline__row" },
                el("strong", { text: isOffline() ? "📴 Offline — kasir tetap bisa jualan" : "🟢 Online kembali" }),
                el("span", { text: waiting ? `${waiting} transaksi menunggu sinkron` : "" }),
                !isOffline() && queue.length ? el("button", { class: "erp-btn erp-btn--sm erp-btn--primary", type: "button", disabled: net.syncing, onclick: () => syncNow() }, "Sinkronkan sekarang") : null,
                toggle),
            isOffline() ? el("p", { class: "erp-muted", text: "Struk diberi nomor sementara (OFF-…). Layar dapur, tukar poin & diskon ber-PIN menunggu internet. Jam transaksi asli tetap tercatat." }) : null,
            failed.length
                ? el("ul", { class: "erp-offline__failed" }, failed.map((entry) => el("li", {},
                    el("span", { text: `${entry.id} · ${rupiah(entry.preview?.total)} — ditolak: ${entry.error}` }),
                    me.level >= 3
                        ? el("button", {
                            class: "erp-btn erp-btn--sm", type: "button",
                            onclick: async () => {
                                if (!(await confirmDialog(`Hapus ${entry.id} dari antrian? Uangnya sudah diterima: catat manual (kas masuk) supaya laci tetap cocok.`))) return;
                                removeFromQueue(storage, entry.id);
                                ctx.rerender();
                            },
                        }, "Hapus (catat manual)")
                        : el("small", { class: "erp-muted", text: "Minta supervisor memeriksa." }))))
                : null
        );
    }

    page.appendChild(el("div", { class: `erp-pos${isCashier && !shift ? " is-locked" : ""}` },
        el("section", { class: "erp-card" }, channelBox, el("div", { class: "erp-toolbar" }, search, scan), categoryBox, grid),
        el("section", { class: "erp-card erp-pos__side" }, cartBox)
    ));

    /* ---------- Shift kasir: buka, kas masuk/keluar, tutup BUTA ---------- */
    function shiftBar() {
        if (!shift) {
            const opening = el("input", { type: "number", min: 0, step: 1000, class: "erp-input-sm", placeholder: "Modal awal laci (Rp)", "aria-label": "Modal awal laci" });
            opening.value = "300000";
            return el("section", { class: "erp-card erp-shift erp-shift--closed" },
                el("div", {},
                    el("h2", { text: "🔒 Shift belum dibuka" }),
                    el("p", { class: "erp-muted", text: "Hitung uang kembalian di laci, isi modal awal, lalu buka shift. Semua transaksi & uang laci tercatat atas namamu sampai shift ditutup." })),
                el("div", { class: "erp-shift__actions" },
                    opening,
                    el("button", {
                        class: "erp-btn erp-btn--primary", type: "button",
                        onclick: async () => {
                            try {
                                await ctx.data.openShift({ outlet_id: pos.outlet, opening_cash: Number(opening.value) || 0 });
                                toast("Shift dibuka. Selamat bekerja!");
                                ctx.rerender();
                            } catch (error) {
                                toast(friendlyError(error), "error");
                            }
                        },
                    }, "Buka shift"))
            );
        }

        const summary = shiftSummary({ shift, sales, moves: shiftMoves, refunds: sales.filter((sale) => sale.refund_shift_id) });
        return el("section", { class: "erp-card erp-shift" },
            el("div", {},
                el("h2", {}, "🟢 Shift aktif ", el("small", { text: `sejak ${dateTime(shift.opened_at)}` })),
                el("p", { class: "erp-muted", text: `Modal ${rupiah(shift.opening_cash)} · ${summary.transactions} transaksi · Non-tunai ${rupiah(summary.nonCash)}${summary.cashIn ? ` · Kas masuk ${rupiah(summary.cashIn)}` : ""}${summary.cashOut ? ` · Kas keluar ${rupiah(summary.cashOut)}` : ""}` })),
            el("div", { class: "erp-shift__actions" },
                el("button", { class: "erp-btn", type: "button", onclick: () => cashMove() }, "± Kas masuk/keluar"),
                el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => closeShiftDialog() }, "Tutup shift"))
        );
    }

    async function cashMove() {
        const values = await formDialog({
            title: "Kas masuk / keluar laci",
            fields: [
                { name: "kind", label: "Jenis", type: "select", value: "keluar", options: Object.entries(CASH_MOVES).map(([value, label]) => ({ value, label })) },
                { name: "amount", label: "Nominal (Rp)", type: "number", min: 0, step: 500, required: true },
                { name: "reason", label: "Alasan (wajib)", max: 80, required: true, placeholder: "mis. beli es batu, tambah uang receh" },
            ],
        });
        if (!values) return;
        try {
            await ctx.data.addCashMove({ shift_id: shift.id, ...values });
            toast("Kas dicatat.");
            ctx.rerender();
        } catch (error) {
            toast(friendlyError(error), "error");
        }
    }

    /** Tutup BUTA: angka "seharusnya" TIDAK ditampilkan sebelum kasir menghitung. */
    function closeShiftDialog() {
        if (readQueue(storage).length) {
            toast("Sinkronkan transaksi offline dulu sebelum tutup shift (supaya laci cocok).", "error");
            return;
        }
        const dialog = el("dialog", { class: "erp-dialog erp-pos__bills" });
        const counts = {};
        const total = el("input", { type: "number", min: 0, step: 100, class: "erp-input-sm", "aria-label": "Total uang di laci", placeholder: "Total uang di laci" });
        const message = el("p", { class: "erp-form__error", hidden: true });
        const recount = () => { total.value = String(countDrawer(counts)); };
        const grid = el("div", { class: "erp-shift__denoms" }, DENOMINATIONS.map((value) => {
            const input = el("input", { type: "number", min: 0, step: 1, class: "erp-input-sm", "aria-label": `Lembar/keping ${rupiah(value)}`, placeholder: "0" });
            input.addEventListener("input", () => { counts[value] = input.value; recount(); });
            return el("label", {}, el("span", { text: rupiah(value) }), input);
        }));
        const note = el("input", { class: "erp-input-sm", maxlength: 200, placeholder: "Catatan (opsional)", "aria-label": "Catatan" });

        dialog.append(
            el("h2", { class: "erp-dialog__title", text: "Tutup shift" }),
            el("p", { class: "erp-muted", text: "Hitung SEMUA uang tunai di laci. Sistem baru menunjukkan angka seharusnya setelah kamu mengisi hitunganmu (tutup buta), supaya hitungan jujur." }),
            el("p", { class: "erp-shift__hint", text: "Bantu hitung per pecahan (opsional):" }),
            grid,
            el("label", { class: "erp-field" }, el("span", { text: "Total uang di laci (Rp)" }), total),
            note,
            message,
            el("div", { class: "erp-form__actions" },
                el("span", { class: "erp-spacer" }),
                el("button", { class: "erp-btn", type: "button", onclick: () => dialog.close() }, "Batal"),
                el("button", {
                    class: "erp-btn erp-btn--primary", type: "button",
                    onclick: async () => {
                        if (total.value === "") {
                            message.textContent = "Isi total uang di laci.";
                            message.hidden = false;
                            return;
                        }
                        try {
                            const result = await ctx.data.closeShift({ shift_id: shift.id, counted_cash: Number(total.value), note: note.value });
                            dialog.close();
                            showZReport(result, outlet, me);
                            ctx.rerender();
                        } catch (error) {
                            message.textContent = friendlyError(error);
                            message.hidden = false;
                        }
                    },
                }, "Tutup shift"))
        );
        dialog.addEventListener("close", () => dialog.remove());
        document.body.appendChild(dialog);
        dialog.showModal();
    }

    /* ---------- Void (batal transaksi) wajib PIN atasan ---------- */
    async function voidDialog(sale) {
        const values = await formDialog({
            title: `Batalkan transaksi ${sale.receipt_no}`,
            fields: [
                { name: "reason", label: "Alasan", type: "select", value: "salah_input", options: Object.entries(VOID_REASONS).map(([value, label]) => ({ value, label })) },
                { name: "note", label: "Keterangan", max: 200, placeholder: "Ceritakan singkat" },
                { name: "pin", label: "PIN atasan (supervisor / manajer / owner)", type: "password", required: true, max: 6, hint: ctx.data.mode === "demo" ? "Mode demo: PIN atasan = 1234" : "Atasan memasukkan PIN-nya sendiri." },
            ],
            submitLabel: "Batalkan transaksi",
        });
        if (!values) return;
        try {
            const result = await ctx.data.voidSale({ sale_id: sale.id, ...values });
            toast(`Transaksi ${result.receipt_no} dibatalkan. Stok kembali${Number(result.refund_cash) ? `, kembalikan tunai ${rupiah(result.refund_cash)}` : ""}.`);
            ctx.rerender();
        } catch (error) {
            toast(friendlyError(error), "error");
        }
    }

    drawCategories();
    drawAll();

    // ---------- Pesanan berjalan (bill terbuka & tiket dapur hari ini) ----------
    const orderLine = buildOrderLine();
    const gridSection = page.querySelector(".erp-pos");
    if (orderLine && gridSection) gridSection.before(orderLine);

    function buildOrderLine() {
        const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
        const wibDay = (at) => new Date(new Date(at).getTime() + 7 * 3600000).toISOString().slice(0, 10);
        const orders = new Map();
        for (const ticket of liveTickets || []) {
            if (!ticket.queue_no || ticket.label === "Riwayat" || wibDay(ticket.created_at) !== today) continue;
            const row = orders.get(ticket.queue_no) || { key: ticket.queue_no, queue: ticket.queue_no, label: ticket.label, channel: ticket.channel, items: 0, at: ticket.created_at, statuses: [] };
            row.items += (ticket.items || []).reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
            row.statuses.push(ticket.status);
            if (ticket.created_at < row.at) row.at = ticket.created_at;
            orders.set(ticket.queue_no, row);
        }
        for (const bill of bills) {
            const key = bill.queue_no || bill.id;
            const row = orders.get(key) || { key, queue: bill.queue_no || "", label: orderLabel(bill), channel: bill.channel, items: 0, at: bill.updated_at, statuses: [] };
            row.bill = bill;
            row.label = orderLabel(bill);
            row.items = Math.max(row.items, bill.lines.reduce((sum, line) => sum + line.qty, 0));
            orders.set(key, row);
        }
        const stateOf = (row) => {
            if (row.statuses.length && row.statuses.every((status) => status === "diambil")) return row.bill ? "unpaid" : "done";
            if (row.statuses.length && row.statuses.filter((status) => status !== "diambil").every((status) => status === "siap")) return "ready";
            if (row.statuses.includes("dibuat")) return "cooking";
            if (row.statuses.includes("baru")) return "queued";
            return "unpaid";
        };
        const LABELS = { queued: "Antre di dapur", cooking: "Sedang dibuat", ready: "Siap diambil", unpaid: "Belum dibayar" };
        const list = [...orders.values()].map((row) => ({ ...row, state: stateOf(row) })).filter((row) => row.state !== "done")
            .sort((a, b) => String(b.at).localeCompare(String(a.at)));
        if (!list.length) return null;
        const counts = {
            all: list.length,
            kitchen: list.filter((row) => row.state === "queued" || row.state === "cooking").length,
            ready: list.filter((row) => row.state === "ready").length,
            unpaid: list.filter((row) => row.bill).length,
        };
        const filters = { all: "Semua", kitchen: "Di dapur", ready: "Siap", unpaid: "Belum dibayar" };
        pos.orderFilter = filters[pos.orderFilter] ? pos.orderFilter : "all";
        const shown = list.filter((row) => pos.orderFilter === "all"
            || (pos.orderFilter === "kitchen" && (row.state === "queued" || row.state === "cooking"))
            || (pos.orderFilter === "ready" && row.state === "ready")
            || (pos.orderFilter === "unpaid" && row.bill));
        const minutes = (at) => Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 60000));
        const track = el("div", { class: "erp-orderline__track" }, shown.map((row) => el("button", {
            type: "button",
            class: `erp-orderline__card is-${row.state}`,
            title: row.bill ? "Buka bill ini di kasir" : "Lihat di layar dapur",
            onclick: () => (row.bill ? openBill(row.bill) : (location.hash = "#/kitchen")),
        },
            el("span", { class: "erp-orderline__top" },
                el("strong", { text: row.queue || "Bill" }),
                el("span", { text: row.label || CHANNELS[row.channel]?.label || "" })),
            el("span", { class: "erp-orderline__items", text: `${row.items} item` }),
            el("span", { class: "erp-orderline__foot" },
                el("small", { text: minutes(row.at) ? `${minutes(row.at)} menit lalu` : "baru saja" }),
                el("em", { text: row.bill && row.state !== "unpaid" ? `${LABELS[row.state]} · belum bayar` : LABELS[row.state] })))));
        const scrollBy = (dir) => track.scrollBy({ left: dir * 320, behavior: "smooth" });
        return el("section", { class: "erp-orderline", "aria-label": "Pesanan berjalan" },
            el("div", { class: "erp-orderline__head" },
                el("h2", { text: "Pesanan berjalan" }),
                el("div", { class: "erp-orderline__tabs", role: "tablist" }, Object.entries(filters).map(([key, label]) => el("button", {
                    type: "button", role: "tab", "aria-selected": String(pos.orderFilter === key),
                    onclick: () => { pos.orderFilter = key; ctx.rerender(); },
                }, label, el("b", { text: String(counts[key]) })))),
                el("div", { class: "erp-orderline__nav" },
                    el("button", { type: "button", class: "erp-icon-btn erp-icon-btn--sm", "aria-label": "Geser kiri", onclick: () => scrollBy(-1) }, "‹"),
                    el("button", { type: "button", class: "erp-icon-btn erp-icon-btn--sm", "aria-label": "Geser kanan", onclick: () => scrollBy(1) }, "›"))),
            shown.length ? track : el("p", { class: "erp-muted", text: "Tidak ada pesanan di filter ini." }));
    }

    /** Buka bill terbuka ke layar kasir (dipakai strip pesanan berjalan). */
    async function openBill(bill) {
        if (pos.lines.length && pos.billId !== bill.id && !(await confirmDialog("Pesanan di layar akan diganti dengan bill ini. Lanjut?"))) return;
        Object.assign(pos, {
            billId: bill.id, channel: bill.channel, table: bill.table_no || "", customer: bill.customer_name || "",
            queueNo: bill.queue_no || null, sent: bill.sent || {}, removed: null, splitRest: null, splitNo: 0, equal: null,
            discount: bill.discount || 0, split: false, payments: [{ method: "tunai", amount: "" }],
            lines: bill.lines.map((line) => ({ ...line, product_id: String(line.product_id), key: lineKey(String(line.product_id), line.options || [], line.note || "") })),
        });
        drawAll();
        if (bill.member_id) attachMember(bill.member_id);
        toast(`Bill ${orderLabel(bill)} dibuka.`);
    }

    // ---------- Transaksi hari ini (klik = cetak ulang struk) ----------
    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" },
            el("h2", { text: hasRole(me, "keuangan") ? "Transaksi outlet hari ini" : "Transaksiku hari ini" }),
            el("span", { class: "erp-muted", text: "Klik baris untuk cetak ulang struk" })),
        todaySales.length
            ? el("div", { class: "erp-table-wrap" }, el("table", { class: "erp-table erp-table--click" },
                el("thead", {}, el("tr", {}, ["Struk", "Waktu", "Pesanan", "Item", "Bayar", "Total", ""].map((head) => el("th", { text: head })))),
                el("tbody", {}, todaySales.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).map((sale) => el("tr", {
                    class: sale.status === "batal" ? "is-void" : null,
                    tabindex: 0,
                    onclick: () => showReceipt(sale, outlets.find((entry) => entry.id === sale.outlet_id) || outlet, me, settings, true),
                    onkeydown: (event) => { if (event.key === "Enter") showReceipt(sale, outlet, me, settings, true); },
                },
                    el("td", { "data-label": "Struk" }, el("code", { text: sale.receipt_no })),
                    el("td", { "data-label": "Waktu", text: dateTime(sale.created_at) }),
                    el("td", { "data-label": "Pesanan", text: `${CHANNELS[sale.channel]?.icon || "🛒"} ${orderLabel(sale)}` }),
                    el("td", { "data-label": "Item", text: `${sale.items.reduce((sum, item) => sum + item.qty, 0)} item` }),
                    el("td", { "data-label": "Bayar", text: sale.payments?.length ? methodLabel(sale.payments) : (PAY_METHODS[sale.method] || sale.method) }),
                    el("td", { "data-label": "Total", text: rupiah(sale.total) }),
                    el("td", { "data-label": "" }, sale.status === "batal"
                        ? el("span", { class: "erp-badge", text: `Dibatalkan · ${VOID_REASONS[sale.void_reason] || ""}` })
                        : isCashier ? el("button", {
                            class: "erp-btn erp-btn--sm", type: "button",
                            onclick: (event) => { event.stopPropagation(); voidDialog(sale); },
                        }, "Batalkan") : null)
                )))
            ))
            : emptyState(isCashier ? "Belum ada transaksi hari ini." : "Kamu bukan kasir; transaksi akan ditolak.")
    ));

    // ---------- Tata letak: konten kiri bergulir, panel pesanan TERKUNCI di kanan ----------
    const oldSide = page.querySelector(".erp-pos__side");
    const mainCol = el("div", { class: "erp-pos-main" });
    mainCol.append(...page.childNodes);
    // Kasir fokus ke menu: angka ringkas hari ini dipindah ke bawah daftar menu.
    const statsRow = mainCol.querySelector(":scope > .erp-stats");
    const menuBlock = mainCol.querySelector(":scope > .erp-pos");
    if (statsRow && menuBlock) {
        statsRow.classList.add("erp-stats--compact");
        menuBlock.after(statsRow);
    }
    oldSide?.remove();
    const panel = el("aside", { class: `erp-pos-panel${isCashier && !shift ? " is-locked" : ""}`, "aria-label": "Pesanan" }, cartBox);
    page.classList.add("erp-pos-page");
    page.replaceChildren(el("div", { class: "erp-pos-layout" }, mainCol, panel));

    return page;
}

/* ---------- Pilih varian / tambahan / catatan ---------- */

function itemDialog({ product, groups, channel, settings, existing = null }) {
    return new Promise((resolve) => {
        const selection = {};
        for (const group of groups) {
            const saved = (existing?.options || []).filter((option) => option.group_id === group.id).map((option) => option.option_id);
            selection[group.id] = saved.length ? saved : (group.required ? [group.options[0]?.id].filter(Boolean) : []);
        }
        let qty = existing?.qty || 1;

        const dialog = el("dialog", { class: "erp-dialog erp-pos__item-dialog" });
        const priceText = el("strong");
        const qtyText = el("span", { text: String(qty) });
        const message = el("p", { class: "erp-form__error", hidden: true });
        const note = el("textarea", { rows: 2, maxlength: 120, placeholder: "Catatan untuk dapur/bar, mis. \"jangan terlalu manis\"", "aria-label": "Catatan" });
        note.value = existing?.note || "";

        const chosenOptions = () => groups.flatMap((group) => (selection[group.id] || []).map((id) => ({ group_id: group.id, option_id: id })));
        const unitPrice = () => channelPrice(
            Number(product.price) + chosenOptions().reduce((sum, pick) => sum + (groups.find((group) => group.id === pick.group_id)?.options.find((option) => option.id === pick.option_id)?.price || 0), 0),
            channel, posSettings(settings));
        const refresh = () => {
            priceText.textContent = rupiah(unitPrice() * qty);
            qtyText.textContent = String(qty);
        };

        const groupNodes = groups.map((group) => {
            const multi = group.max_select > 1;
            return el("fieldset", { class: "erp-pos__group" },
                el("legend", {}, group.name, el("small", { text: group.required ? " · wajib" : multi ? ` · boleh pilih s/d ${group.max_select}` : " · opsional" })),
                el("div", { class: "erp-chips" }, group.options.map((option) => {
                    const input = el("input", {
                        type: multi ? "checkbox" : "radio",
                        name: `g-${group.id}`,
                        value: option.id,
                        checked: (selection[group.id] || []).includes(option.id),
                    });
                    input.addEventListener("change", () => {
                        if (multi) {
                            const set = new Set(selection[group.id] || []);
                            if (input.checked) set.add(option.id);
                            else set.delete(option.id);
                            if (set.size > group.max_select) {
                                input.checked = false;
                                set.delete(option.id);
                                toast(`${group.name}: maksimal ${group.max_select}.`, "error");
                            }
                            selection[group.id] = [...set];
                        } else {
                            selection[group.id] = [option.id];
                        }
                        refresh();
                    });
                    // Opsional satu pilihan: klik lagi = batal pilih.
                    if (!multi && !group.required) {
                        input.addEventListener("click", () => {
                            if (input.dataset.was === "1") {
                                input.checked = false;
                                selection[group.id] = [];
                                refresh();
                            }
                            dialog.querySelectorAll(`input[name="g-${group.id}"]`).forEach((other) => { other.dataset.was = other.checked ? "1" : "0"; });
                        });
                        input.dataset.was = input.checked ? "1" : "0";
                    }
                    return el("label", { class: "erp-chip erp-chip--option" }, input,
                        el("span", { text: option.price ? `${option.name} +${rupiah(option.price)}` : option.name }));
                }))
            );
        });

        const done = (value) => {
            dialog.returnValue = value ? "ok" : "";
            dialog.close();
            resolve(value);
        };

        dialog.append(
            el("h2", { class: "erp-dialog__title", text: product.name }),
            el("p", { class: "erp-muted", text: `${CHANNELS[channel]?.label || ""} · harga dasar ${rupiah(channelPrice(product.price, channel, posSettings(settings)))}` }),
            ...groupNodes,
            el("label", { class: "erp-field" }, el("span", { text: "Catatan" }), note),
            el("div", { class: "erp-pos__item-foot" },
                el("span", { class: "erp-qty" },
                    el("button", { type: "button", "aria-label": "Kurangi", onclick: () => { qty = Math.max(1, qty - 1); refresh(); } }, "−"),
                    qtyText,
                    el("button", { type: "button", "aria-label": "Tambah", onclick: () => { qty = Math.min(99, qty + 1); refresh(); } }, "+")
                ),
                priceText
            ),
            message,
            el("div", { class: "erp-form__actions" },
                el("span", { class: "erp-spacer" }),
                el("button", { class: "erp-btn", type: "button", onclick: () => done(null) }, "Batal"),
                el("button", {
                    class: "erp-btn erp-btn--primary", type: "button",
                    onclick: () => {
                        const problem = validateSelection(groups, selection);
                        if (problem) {
                            message.textContent = problem;
                            message.hidden = false;
                            return;
                        }
                        done({ options: chosenOptions(), note: note.value.trim(), qty });
                    },
                }, existing ? "Simpan perubahan" : "Tambah ke pesanan")
            )
        );

        dialog.addEventListener("close", () => {
            if (dialog.returnValue !== "ok") resolve(null);
            dialog.remove();
        });
        refresh();
        document.body.appendChild(dialog);
        dialog.showModal();
    });
}

/* ---------- Pengaturan kasir per outlet (owner & manajer) ---------- */

async function editSettings(ctx, outlet, settings) {
    const yesNo = [{ value: "ya", label: "Aktif" }, { value: "tidak", label: "Tidak" }];
    const values = await formDialog({
        title: `Pengaturan kasir · ${outlet.name}`,
        fields: [
            { name: "service_enabled", label: "Service charge (khusus makan di tempat)", type: "select", value: settings.service_enabled ? "ya" : "tidak", options: yesNo },
            { name: "service_rate", label: "Service charge (%)", type: "number", min: 0, max: 30, step: 0.5, value: settings.service_rate },
            { name: "tax_enabled", label: "Pajak resto / PB1", type: "select", value: settings.tax_enabled ? "ya" : "tidak", options: yesNo, hint: "Dikenakan untuk makan di tempat, bawa pulang & delivery toko. Pesanan ojol sudah termasuk." },
            { name: "tax_rate", label: "PB1 (%)", type: "number", min: 0, max: 30, step: 0.5, value: settings.tax_rate },
            { name: "rounding", label: "Pembulatan total", type: "select", value: settings.rounding, options: [
                { value: 0, label: "Tidak dibulatkan" }, { value: 100, label: "Ke Rp 100 terdekat" },
                { value: 500, label: "Ke Rp 500 terdekat" }, { value: 1000, label: "Ke Rp 1.000 terdekat" },
            ] },
            { name: "online_markup", label: "Harga ojol (GoFood/Grab/Shopee) lebih mahal (%)", type: "number", min: 0, max: 100, step: 1, value: settings.online_markup, hint: "Menutup potongan komisi aplikasi. 0 = sama dengan harga toko." },
            { name: "paper", label: "Lebar kertas struk", type: "select", value: settings.paper, options: [{ value: 58, label: "58 mm (printer kecil)" }, { value: 80, label: "80 mm" }] },
            { name: "footer", label: "Tulisan di bawah struk", max: 80, value: settings.footer },
            { name: "kitchen_enabled", label: "Kirim pesanan ke layar Dapur & Bar", type: "select", value: settings.kitchen_enabled ? "ya" : "tidak", options: yesNo, hint: "Matikan untuk toko retail tanpa dapur." },
            { name: "bar_staff", label: "Jumlah barista bekerja bersamaan", type: "number", min: 1, max: 10, step: 1, value: settings.bar_staff, hint: "Dipakai ETA Jujur menghitung perkiraan siap." },
            { name: "dapur_staff", label: "Jumlah koki bekerja bersamaan", type: "number", min: 1, max: 10, step: 1, value: settings.dapur_staff },
            { name: "discount_pin_percent", label: "Diskon di atas (%) wajib PIN atasan", type: "number", min: 0, max: 100, step: 1, value: settings.discount_pin_percent, hint: "Mencegah \"diskon untuk teman\". 0 = semua diskon butuh PIN." },
            { name: "loyalty_enabled", label: "Member & poin", type: "select", value: settings.loyalty_enabled ? "ya" : "tidak", options: yesNo },
            { name: "points_per", label: "Belanja Rp sekian = 1 poin", type: "number", min: 1000, step: 1000, value: settings.points_per, hint: "Dihitung dari harga setelah diskon, sebelum pajak & service." },
            { name: "point_value", label: "1 poin = Rp (saat ditukar)", type: "number", min: 1, max: 10000, step: 1, value: settings.point_value, hint: "Contoh bawaan: belanja Rp 10.000 = 1 poin, 1 poin = Rp 100 (kembali 1%)." },
            { name: "online_commission", label: "Komisi aplikasi ojol (%)", type: "number", min: 0, max: 50, step: 0.5, value: settings.online_commission, hint: "Dipakai menghitung laba per channel di menu Resep & HPP." },
            { name: "target_food_cost", label: "Target HPP dari harga jual (%)", type: "number", min: 10, max: 80, step: 1, value: settings.target_food_cost, hint: "Menu di atas target mendapat saran harga baru." },
        ],
    });
    if (!values) return;
    try {
        await ctx.data.savePosSettings(outlet.id, {
            ...values,
            service_enabled: values.service_enabled === "ya",
            tax_enabled: values.tax_enabled === "ya",
            kitchen_enabled: values.kitchen_enabled === "ya",
            loyalty_enabled: values.loyalty_enabled === "ya",
        });
        toast("Pengaturan kasir disimpan.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

/* ---------- Varian & tambahan (staf katalog / owner) ---------- */

async function manageModifiers(ctx, products) {
    const groups = await ctx.data.listPosModifiers();
    const dialog = el("dialog", { class: "erp-dialog erp-pos__bills" });
    const close = () => dialog.close();
    const nameOf = (id) => products.find((product) => String(product.id) === String(id))?.name;

    const edit = async (group = {}) => {
        close();
        const values = await formDialog({
            title: group.id ? `Ubah grup: ${group.name}` : "Grup varian baru",
            fields: [
                { name: "name", label: "Nama grup", required: true, max: 40, value: group.name || "", placeholder: "mis. Ukuran, Level gula, Topping" },
                { name: "required", label: "Wajib dipilih?", type: "select", value: group.required ? "ya" : "tidak", options: [{ value: "ya", label: "Wajib (pilih salah satu)" }, { value: "tidak", label: "Opsional" }] },
                { name: "max_select", label: "Boleh pilih maksimal", type: "number", min: 1, max: 10, step: 1, value: group.max_select || 1, hint: "1 = pilih satu (mis. ukuran). Lebih dari 1 = boleh banyak (mis. topping)." },
                { name: "options", label: "Pilihan (satu per baris, tambah harga dengan \"= harga\")", type: "textarea", max: 800, value: formatOptionLines(group.options || []) || "Regular\nLarge = 5000" },
                { name: "applies_all", label: "Berlaku untuk", type: "select", value: group.applies_all ? "semua" : "pilih", options: [{ value: "pilih", label: "Produk yang dicentang di bawah" }, { value: "semua", label: "Semua produk" }] },
                { name: "product_ids", label: "Produk", type: "checkboxes", value: (group.product_ids || []).map(String), options: products.map((product) => ({ value: String(product.id), label: product.name })) },
            ],
            danger: group.id ? {
                label: "Hapus grup",
                onClick: async () => {
                    if (!(await confirmDialog(`Hapus grup "${group.name}"?`))) return;
                    try {
                        await ctx.data.deletePosModifier(group.id);
                        toast("Grup dihapus.");
                        ctx.rerender();
                    } catch (error) {
                        toast(friendlyError(error), "error");
                    }
                },
            } : null,
        });
        if (!values) return;
        try {
            await ctx.data.savePosModifier({
                id: group.id,
                name: values.name,
                required: values.required === "ya",
                max_select: Number(values.max_select) || 1,
                options: parseOptionLines(values.options, group.options || []),
                applies_all: values.applies_all === "semua",
                product_ids: values.product_ids,
                categories: group.categories || [],
                sort: group.sort,
            });
            toast("Varian disimpan.");
            ctx.rerender();
        } catch (error) {
            toast(friendlyError(error), "error");
        }
    };

    dialog.append(
        el("h2", { class: "erp-dialog__title", text: "Varian & tambahan" }),
        el("p", { class: "erp-muted", text: "Pilihan yang muncul saat kasir mengetuk produk: ukuran, level gula, es, topping berbayar, dll." }),
        groups.length
            ? el("ul", { class: "erp-pos__bill-list" }, groups.map((group) => el("li", {},
                el("div", {},
                    el("strong", { text: group.name }),
                    el("small", { text: `${group.required ? "Wajib" : "Opsional"} · ${group.options.map((option) => option.name).join(", ")}` }),
                    el("small", { text: group.applies_all ? "Semua produk" : `${(group.product_ids || []).length} produk: ${(group.product_ids || []).map(nameOf).filter(Boolean).slice(0, 3).join(", ")}${(group.product_ids || []).length > 3 ? "…" : ""}` })
                ),
                el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => edit(group) }, "Ubah")
            )))
            : emptyState("Belum ada varian."),
        el("div", { class: "erp-form__actions" },
            el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => edit() }, "+ Grup baru"),
            el("span", { class: "erp-spacer" }),
            el("button", { class: "erp-btn", type: "button", onclick: close }, "Tutup"))
    );
    dialog.addEventListener("close", () => dialog.remove());
    document.body.appendChild(dialog);
    dialog.showModal();
}

/* ---------- Struk (thermal 58/80 mm) ---------- */

function showReceipt(sale, outlet, cashier, settings, reprint = false, readyAt = null, member = null) {
    const config = posSettings(settings);
    const line = (label, value, className = "") => [el("dt", { class: className, text: label }), el("dd", { class: className, text: value })];
    const payments = sale.payments?.length ? sale.payments : [{ method: sale.method, amount: sale.paid }];

    const dialog = el("dialog", { class: "erp-dialog erp-receipt" },
        el("div", { class: `erp-receipt__paper erp-receipt--${config.paper}`, id: "erpReceipt" },
            el("p", { class: "erp-receipt__brand", text: outlet?.name || "Outlet" }),
            outlet?.address ? el("p", { class: "erp-receipt__meta", text: outlet.address }) : null,
            el("p", { class: "erp-receipt__meta", text: `${sale.receipt_no} · ${dateTime(sale.created_at)}` }),
            el("p", { class: "erp-receipt__meta", text: `Kasir: ${cashier.full_name}` }),
            el("p", { class: "erp-receipt__order", text: `${CHANNELS[sale.channel]?.label || "Penjualan"}${sale.table_no || sale.customer_name ? ` · ${orderLabel(sale)}` : ""}` }),
            sale.queue_no ? el("p", { class: "erp-receipt__queue" }, "No. antrian ", el("strong", { text: sale.queue_no })) : null,
            readyAt ? el("p", { class: "erp-receipt__eta", text: `Perkiraan siap ± ${new Date(readyAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB` }) : null,
            el("ul", {}, sale.items.map((item) => el("li", {},
                el("span", {},
                    `${item.qty}× ${item.name}`,
                    item.options?.length ? el("small", { text: item.options.map((option) => option.name).join(", ") }) : null,
                    item.note ? el("small", { text: `Catatan: ${item.note}` }) : null
                ),
                el("span", { text: rupiah(item.price * item.qty) })
            ))),
            el("dl", {},
                line("Subtotal", rupiah(sale.subtotal)),
                (sale.promos || []).flatMap((row) => line(row.name, `−${rupiah(row.amount)}`)),
                Number(sale.discount) ? line("Diskon", `−${rupiah(sale.discount)}`) : null,
                Number(sale.points_value) ? line(`Tukar ${sale.points_used} poin`, `−${rupiah(sale.points_value)}`) : null,
                Number(sale.service) ? line("Service", rupiah(sale.service)) : null,
                Number(sale.tax) ? line("PB1", rupiah(sale.tax)) : null,
                Number(sale.rounding) ? line("Pembulatan", `${sale.rounding > 0 ? "+" : "−"}${rupiah(Math.abs(sale.rounding))}`) : null,
                line("TOTAL", rupiah(sale.total), "erp-pos__total"),
                payments.flatMap((row) => line(PAY_METHODS[row.method] || row.method, rupiah(row.method === "tunai" && Number(sale.change) ? Number(row.amount) + Number(sale.change) : row.amount))),
                Number(sale.change) ? line("Kembalian", rupiah(sale.change)) : null
            ),
            member || sale.points_earned
                ? el("p", { class: "erp-receipt__meta", text: `Member ${member?.name || sale.customer_name || ""}: +${sale.points_earned || 0} poin${member && member.balance !== null ? ` · saldo ${member.balance} poin` : ""}` })
                : null,
            el("p", { class: "erp-receipt__thanks", text: config.footer || "Terima kasih!" }),
            reprint ? el("p", { class: "erp-receipt__meta", text: "— CETAK ULANG —" }) : null,
            sale.offline_pending ? el("p", { class: "erp-receipt__meta", text: "⚠️ Struk offline — nomor resmi terbit setelah sinkron." }) : null
        ),
        el("div", { class: "erp-form__actions" },
            el("span", { class: "erp-spacer" }),
            el("button", { class: "erp-btn", type: "button", onclick: () => window.print() }, "🖨️ Cetak"),
            el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => dialog.close() }, reprint ? "Tutup" : "Transaksi baru")
        )
    );

    dialog.addEventListener("close", () => dialog.remove());
    document.body.appendChild(dialog);
    dialog.showModal();
    if (!reprint) toast(`Lunas: ${rupiah(sale.total)}`);
}

/* ---------- PIN atasan (persetujuan di tempat) ---------- */

async function askPin(ctx, reason) {
    const values = await formDialog({
        title: "Butuh persetujuan atasan",
        fields: [
            { name: "pin", label: `${reason}. PIN atasan:`, type: "password", required: true, max: 6, hint: ctx.data.mode === "demo" ? "Mode demo: PIN atasan = 1234" : "Atasan memasukkan PIN-nya sendiri." },
        ],
        submitLabel: "Setujui",
    });
    return values?.pin || null;
}

/* ---------- Laporan Z (tutup shift) ---------- */

function showZReport({ shift, summary }, outlet, cashier) {
    const line = (label, value, className = "") => [el("dt", { class: className, text: label }), el("dd", { class: className, text: value })];
    const variance = Number(shift.variance) || 0;
    const tone = variance === 0 ? "Pas" : variance > 0 ? "Lebih" : "Kurang";
    const dialog = el("dialog", { class: "erp-dialog erp-receipt" },
        el("div", { class: "erp-receipt__paper erp-receipt--58", id: "erpReceipt" },
            el("p", { class: "erp-receipt__brand", text: "LAPORAN TUTUP SHIFT" }),
            el("p", { class: "erp-receipt__meta", text: outlet?.name || "" }),
            el("p", { class: "erp-receipt__meta", text: `Kasir: ${cashier.full_name}` }),
            el("p", { class: "erp-receipt__meta", text: `${dateTime(shift.opened_at)} – ${dateTime(shift.closed_at)}` }),
            el("dl", {},
                line("Transaksi", String(summary.transactions)),
                line("Penjualan", rupiah(summary.gross)),
                line("Non-tunai", rupiah(summary.nonCash)),
                summary.voids ? line("Void", `${summary.voids}×`) : null,
                line("Modal awal", rupiah(shift.opening_cash)),
                line("Tunai masuk", rupiah(summary.cashSales)),
                summary.refundCash ? line("Refund tunai", `−${rupiah(summary.refundCash)}`) : null,
                summary.cashIn ? line("Kas masuk", rupiah(summary.cashIn)) : null,
                summary.cashOut ? line("Kas keluar", `−${rupiah(summary.cashOut)}`) : null,
                line("Seharusnya di laci", rupiah(shift.expected_cash), "erp-pos__total"),
                line("Dihitung kasir", rupiah(shift.counted_cash)),
                line(`Selisih (${tone})`, `${variance > 0 ? "+" : variance < 0 ? "−" : ""}${rupiah(Math.abs(variance))}`, "erp-pos__total")
            ),
            shift.note ? el("p", { class: "erp-receipt__meta", text: `Catatan: ${shift.note}` }) : null,
            el("p", { class: "erp-receipt__thanks", text: variance === 0 ? "Laci pas. Terima kasih!" : "Selisih tercatat & dilaporkan ke owner." })
        ),
        el("div", { class: "erp-form__actions" },
            el("span", { class: "erp-spacer" }),
            el("button", { class: "erp-btn", type: "button", onclick: () => window.print() }, "🖨️ Cetak"),
            el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => dialog.close() }, "Selesai"))
    );
    dialog.addEventListener("close", () => dialog.remove());
    document.body.appendChild(dialog);
    dialog.showModal();
}
