/**
 * KANTOONG ERP — TOKOKU & PENJUALAN (modul 4: Sales)
 * File: frontend/erp/modules/sales.js
 *
 * Tiap sales punya toko sendiri (kantoong.id/nama-sales; nanti
 * nama-sales.kantoong.id). Produk & kode barang tetap dari katalog
 * master, tapi sales boleh memilih produk & memasang foto versinya.
 * Setiap pesanan dari toko ini otomatis tercatat atas nama sales.
 */

import { periodStart } from "../core/metrics.js";
import { dateTime, el, emptyState, formDialog, friendlyError, pageHeader, rupiah, toast } from "../ui.js";
import { STATUS_LABELS, autoRefresh, leaderboardPanel } from "./shared.js";

export function storeUrl(slug) {
    return `${location.origin}/${slug}`;
}

export async function render(ctx) {
    const { data, me } = ctx;

    const [store, storeProducts, products, orders] = await Promise.all([
        data.getStorefront(me.id),
        data.listStoreProducts(me.id),
        data.listProducts(),
        data.listOrders({ since: periodStart("month") }),
    ]);

    const page = el("div", { class: "erp-page__inner" });
    page.appendChild(pageHeader("Tokoku & Penjualan", "Toko online pribadimu, terhubung ke katalog & gudang pusat."));

    // ---------- Kartu toko ----------
    if (!store) {
        page.appendChild(el("section", { class: "erp-card" },
            el("h2", { text: "Toko belum dibuat" }),
            el("p", { class: "erp-muted", text: "Minta HR/owner mengisi \"Alamat toko\" di data anggotamu." })
        ));
    } else {
        const url = storeUrl(store.slug);
        const copy = el("button", { class: "erp-btn erp-btn--sm", type: "button" }, "Salin tautan");
        copy.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(url);
                toast("Tautan toko disalin. Bagikan ke pelangganmu!");
            } catch {
                toast(url);
            }
        });

        page.appendChild(el("section", { class: "erp-card erp-store" },
            el("div", { class: "erp-card__head" },
                el("div", {},
                    el("p", { class: "erp-muted", text: store.is_published ? "Toko aktif" : "Toko disembunyikan" }),
                    el("h2", { text: store.display_name }),
                    store.tagline ? el("p", { class: "erp-muted", text: store.tagline }) : null
                ),
                el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => editStore(ctx, store) }, "Ubah toko")
            ),
            el("div", { class: "erp-store__link" },
                el("code", { text: url }),
                copy,
                el("a", { class: "erp-btn erp-btn--sm erp-btn--primary", href: url, target: "_blank", rel: "noopener" }, "Buka toko ↗")
            ),
            el("p", { class: "erp-muted erp-note", text: "Nanti alamatnya menjadi " + `${store.slug}.kantoong.id` + ". Desain tokomu bisa dibuat berbeda dari sales lain." })
        ));

        page.appendChild(productPicker(ctx, products, storeProducts));
    }

    // ---------- Pesananku ----------
    const mine = orders
        .filter((order) => order.sales_member_id === me.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));

    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" },
            el("h2", { text: "Pesananku bulan ini" }),
            el("span", { class: "erp-muted", text: `${mine.length} pesanan` })
        ),
        mine.length
            ? el("div", { class: "erp-table-wrap" },
                el("table", { class: "erp-table" },
                    el("thead", {}, el("tr", {}, ["Kode", "Waktu", "Pembeli", "Total", "Status"].map((head) => el("th", { text: head })))),
                    el("tbody", {}, mine.slice(0, 50).map((order) => el("tr", {},
                        el("td", { "data-label": "Kode" }, el("code", { text: order.order_code })),
                        el("td", { "data-label": "Waktu", text: dateTime(order.created_at) }),
                        el("td", { "data-label": "Pembeli", text: [order.customer_name, order.city].filter(Boolean).join(", ") }),
                        el("td", { "data-label": "Total", text: rupiah(order.total) }),
                        el("td", { "data-label": "Status" }, el("span", { class: `erp-pill${order.status === "dibatalkan" ? " erp-pill--bad" : order.status === "menunggu_pembayaran" ? " erp-pill--warn" : ""}`, text: STATUS_LABELS[order.status] || order.status }))
                    )))
                )
            )
            : emptyState("Belum ada pesanan bulan ini. Bagikan tautan tokomu!")
    ));

    const board = leaderboardPanel(ctx);
    page.appendChild(board.element);
    autoRefresh(ctx, board.refresh);

    return page;
}

function productPicker(ctx, products, storeProducts) {
    const chosen = new Map(storeProducts.map((item) => [String(item.product_id), item]));
    const showAll = chosen.size === 0;

    const rows = products.map((product) => {
        const pick = chosen.get(String(product.id));
        const box = el("input", { type: "checkbox", checked: showAll || Boolean(pick), "aria-label": `Tampilkan ${product.name}` });
        const photo = el("input", { type: "url", class: "erp-input-sm", placeholder: "Foto versiku (opsional, https://…)", "aria-label": `Foto versiku untuk ${product.name}` });
        photo.value = pick?.custom_image_url || "";
        return { product, box, photo };
    });

    const save = el("button", { class: "erp-btn erp-btn--primary erp-btn--sm", type: "button" }, "Simpan pilihan");
    save.addEventListener("click", async () => {
        const picked = rows.filter((row) => row.box.checked);
        const badPhoto = picked.find((row) => row.photo.value.trim() && !/^https?:\/\//i.test(row.photo.value.trim()));
        if (badPhoto) {
            toast("Foto versimu harus berupa tautan https://", "error");
            return;
        }

        // Semua dicentang & tanpa foto khusus = simpan kosong (artinya tampil semua).
        const everything = picked.length === rows.length && picked.every((row) => !row.photo.value.trim());

        try {
            await ctx.data.saveStoreProducts(ctx.me.id, everything ? [] : picked.map((row) => ({
                product_id: String(row.product.id),
                custom_image_url: row.photo.value.trim() || null,
            })));
            toast("Produk tokomu disimpan.");
        } catch (error) {
            toast(friendlyError(error), "error");
        }
    });

    return el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" },
            el("div", {},
                el("h2", { text: "Produk di tokoku" }),
                el("p", { class: "erp-muted", text: "Kode barang & harga mengikuti katalog master. Foto boleh versimu sendiri." })
            ),
            save
        ),
        rows.length
            ? el("ul", { class: "erp-picks" }, rows.map(({ product, box, photo }) =>
                el("li", { class: "erp-pick" },
                    el("label", { class: "erp-pick__main" },
                        box,
                        product.image_url ? el("img", { class: "erp-thumb", src: product.image_url, alt: "", loading: "lazy" }) : el("span", { class: "erp-thumb erp-thumb--empty", text: product.name.charAt(0) }),
                        el("span", {},
                            el("strong", { text: product.name }),
                            el("small", { text: `${product.sku || "tanpa kode"} · ${rupiah(product.price)}` })
                        )
                    ),
                    photo
                )
            ))
            : emptyState("Katalog master masih kosong.")
    );
}

async function editStore(ctx, store) {
    const values = await formDialog({
        title: "Ubah tokoku",
        fields: [
            { name: "display_name", label: "Nama toko", required: true, max: 60, value: store.display_name },
            { name: "tagline", label: "Slogan singkat", max: 120, value: store.tagline || "" },
            { name: "hero_image_url", label: "Foto banner (https://…, opsional)", type: "url", value: store.hero_image_url || "" },
            { name: "is_published", label: "Status", type: "select", value: store.is_published ? "1" : "0", options: [{ value: "1", label: "Tampil untuk umum" }, { value: "0", label: "Disembunyikan" }] },
        ],
    });

    if (!values) return;

    try {
        await ctx.data.saveStorefront(ctx.me.id, {
            display_name: values.display_name.trim(),
            tagline: values.tagline.trim() || null,
            hero_image_url: values.hero_image_url.trim() || null,
            is_published: values.is_published === "1",
        });
        toast("Toko disimpan.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}
