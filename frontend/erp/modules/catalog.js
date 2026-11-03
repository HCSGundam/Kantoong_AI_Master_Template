/**
 * KANTOONG ERP — KATALOG MASTER (modul 9)
 * File: frontend/erp/modules/catalog.js
 *
 * Satu katalog untuk semua toko sales: kode barang (SKU) & barcode
 * selalu sama walau foto/desain tiap toko berbeda.
 * Cari dengan mengetik, atau SCAN barcode memakai kamera.
 * Tambah/edit produk lengkap (foto, harga, galeri, hero) ada di
 * product-editor.js (pengganti dashboard admin lama).
 */

import { el, emptyState, formDialog, friendlyError, pageHeader, rupiah, toast } from "../ui.js";
import { renderEditor } from "./product-editor.js";

let query = "";

export async function render(ctx) {
    const { data, me } = ctx;
    const canEdit = me.level >= 4 || me.job_role === "produk";

    // #/catalog/produk/<id|baru> = halaman editor produk.
    const [, sub, productId] = location.hash.replace(/^#\/?/, "").split("/");
    if (sub === "produk" && productId && canEdit) return renderEditor(ctx, decodeURIComponent(productId));

    const products = await data.listProducts();
    const page = el("div", { class: "erp-page__inner" });

    page.appendChild(pageHeader(
        "Katalog Master",
        "Produk, foto, harga, kode barang & barcode untuk semua toko sales, kasir, dan gudang.",
        canEdit && me.level >= 4 ? el("a", { class: "erp-btn erp-btn--primary", href: "#/catalog/produk/baru" }, "+ Produk baru") : null
    ));

    const searchInput = el("input", {
        type: "search",
        class: "erp-search erp-search--wide",
        placeholder: "Ketik nama, kode barang, atau barcode…",
        "aria-label": "Cari produk",
    });
    searchInput.value = query;

    const list = el("div");

    const draw = () => {
        const q = query.trim().toLowerCase();
        const rows = products.filter((product) =>
            !q || `${product.name} ${product.sku || ""} ${product.barcode || ""} ${product.category || ""}`.toLowerCase().includes(q)
        );

        if (!rows.length) {
            list.replaceChildren(emptyState(q ? `Tidak ada produk dengan "${query}".` : "Katalog masih kosong."));
            return;
        }

        list.replaceChildren(el("div", { class: "erp-table-wrap" },
            el("table", { class: "erp-table" },
                el("thead", {}, el("tr", {}, ["Produk", "Kode barang", "Barcode", "Harga", "Stok", "Homepage", ""].map((head) => el("th", { text: head })))),
                el("tbody", {}, rows.map((product) => el("tr", {},
                    el("td", {}, el("div", { class: "erp-person" },
                        product.image_url
                            ? el("img", { class: "erp-thumb", src: product.image_url, alt: "", loading: "lazy" })
                            : el("span", { class: "erp-thumb erp-thumb--empty", text: product.name.charAt(0) }),
                        el("span", {}, el("strong", { text: product.name }), el("small", { text: product.category || "" }))
                    )),
                    el("td", { "data-label": "Kode barang" }, product.sku ? el("code", { text: product.sku }) : el("span", { class: "erp-pill erp-pill--warn", text: "Belum ada" })),
                    el("td", { "data-label": "Barcode" }, product.barcode ? el("code", { text: product.barcode }) : "-"),
                    el("td", { "data-label": "Harga", text: rupiah(product.price) }),
                    el("td", { "data-label": "Stok", text: String(product.stock ?? 0) }),
                    el("td", { "data-label": "Homepage" }, el("div", { class: "erp-row-actions erp-row-actions--start" },
                        publishToggle(ctx, product, "is_featured", "Unggulan", canEdit),
                        publishToggle(ctx, product, "is_hero", "Hero", canEdit)
                    )),
                    el("td", {}, canEdit ? el("div", { class: "erp-row-actions" },
                        el("a", { class: "erp-btn erp-btn--sm erp-btn--primary", href: `#/catalog/produk/${encodeURIComponent(product.id)}` }, "Edit"),
                        el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => editCodes(ctx, product) }, "Kode")
                    ) : null)
                )))
            )
        ));
    };

    searchInput.addEventListener("input", () => {
        query = searchInput.value;
        draw();
    });

    const scanButton = el("button", { class: "erp-btn", type: "button" }, "📷 Scan barcode");
    scanButton.addEventListener("click", async () => {
        const code = await scanBarcode();
        if (!code) return;
        query = code;
        searchInput.value = code;
        draw();
        const hit = products.find((product) => product.barcode === code || product.sku === code);
        toast(hit ? `Ditemukan: ${hit.name}` : `Barcode ${code} belum terdaftar di katalog.`, hit ? "" : "error");
    });

    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-toolbar" }, searchInput, scanButton),
        el("p", { class: "erp-muted", text: `${products.length} produk · ${products.filter((product) => !product.sku).length} belum punya kode barang` }),
        list
    ));

    draw();
    return page;
}

/** Tombol tampil di homepage (Produk Unggulan / Hero), sama seperti admin lama. */
function publishToggle(ctx, product, key, label, canEdit) {
    const on = product[key] === true;
    return el("button", {
        class: `erp-toggle${on ? " is-on" : ""}`,
        type: "button",
        disabled: !canEdit,
        "aria-pressed": String(on),
        title: on ? `Matikan ${label}` : `Tampilkan sebagai ${label}`,
        onclick: async () => {
            try {
                await ctx.data.setPublication(product.id, { [key]: !on });
                toast(`${label} ${on ? "dimatikan" : "diaktifkan"} untuk ${product.name}.`);
                ctx.rerender();
            } catch (error) {
                toast(friendlyError(error), "error");
            }
        },
    }, label);
}

async function editCodes(ctx, product) {
    const suggestion = product.sku || `${(product.category || "PRD").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "PRD"}-${String(product.id).replace(/[^A-Za-z0-9]/g, "").slice(-4).toUpperCase()}`;

    const values = await formDialog({
        title: `Kode barang — ${product.name}`,
        fields: [
            { name: "sku", label: "Kode barang (SKU)", required: true, max: 40, value: product.sku || suggestion, hint: "Huruf besar, angka, dan minus. Harus unik." },
            { name: "barcode", label: "Barcode (EAN/UPC)", max: 32, value: product.barcode || "", hint: "Isi dari kemasan, atau pakai Scan di halaman katalog." },
            { name: "stock", label: "Stok", type: "number", min: 0, step: 1, value: product.stock ?? 0 },
        ],
    });

    if (!values) return;

    const sku = values.sku.trim().toUpperCase();
    const barcode = values.barcode.trim();

    if (!/^[A-Z0-9][A-Z0-9-]{1,39}$/.test(sku)) {
        toast("Kode barang hanya boleh huruf besar, angka, dan minus (2–40 karakter).", "error");
        return;
    }

    if (barcode && !/^[0-9A-Za-z-]{4,32}$/.test(barcode)) {
        toast("Barcode hanya boleh angka/huruf (4–32 karakter).", "error");
        return;
    }

    try {
        await ctx.data.saveProductCodes(product.id, {
            sku,
            barcode: barcode || null,
            stock: Math.max(0, Math.floor(Number(values.stock) || 0)),
        });
        toast("Kode barang disimpan.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

/**
 * Scan barcode lewat kamera (BarcodeDetector bawaan browser Chrome/Android).
 * Bila tidak didukung, minta ketik manual.
 */
export async function scanBarcode() {
    if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
        const manual = await formDialog({
            title: "Scan belum didukung di browser ini",
            submitLabel: "Cari",
            fields: [{ name: "code", label: "Ketik angka barcode", required: true, max: 32 }],
        });
        return manual?.code.trim() || null;
    }

    const video = el("video", { class: "erp-scan__video", playsinline: true, muted: true });
    const dialog = el("dialog", { class: "erp-dialog erp-scan" },
        el("h2", { class: "erp-dialog__title", text: "Arahkan kamera ke barcode" }),
        video,
        el("div", { class: "erp-form__actions" },
            el("span", { class: "erp-spacer" }),
            el("button", { class: "erp-btn", type: "button", onclick: () => dialog.close() }, "Batal")
        )
    );
    document.body.appendChild(dialog);

    let stream;
    let found = null;

    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream;
        await video.play();
        dialog.showModal();

        const detector = new window.BarcodeDetector();

        await new Promise((resolve) => {
            const tick = async () => {
                if (!dialog.open) return resolve();
                try {
                    const codes = await detector.detect(video);
                    if (codes[0]?.rawValue) {
                        found = codes[0].rawValue;
                        return resolve();
                    }
                } catch {
                    // bingkai belum siap
                }
                requestAnimationFrame(tick);
            };
            dialog.addEventListener("close", resolve, { once: true });
            tick();
        });
    } catch {
        toast("Kamera tidak bisa dibuka. Izinkan akses kamera atau ketik manual.", "error");
    } finally {
        stream?.getTracks().forEach((track) => track.stop());
        if (dialog.open) dialog.close();
        dialog.remove();
    }

    return found;
}
