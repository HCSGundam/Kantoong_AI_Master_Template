/**
 * KANTOONG ERP — EDITOR PRODUK (bagian dari Katalog Master)
 * File: frontend/erp/modules/product-editor.js
 *
 * Pengganti dashboard admin lama: nama, harga, harga coret, pengiriman,
 * foto utama, video, galeri varian (tumpukan kartu), tampil di homepage
 * (Produk Unggulan / Hero), plus kode barang & barcode.
 * Alamat: #/catalog/produk/<id>  atau  #/catalog/produk/baru
 */

import { PRODUCT_CONFIG, validateProductInput } from "../data/product-service.js";
import { el, friendlyError, pageHeader, toast } from "../ui.js";
import { getGalleryItems, initGalleryDeck, setGalleryItems, uploadPendingGallery } from "./gallery-deck.js";

function field(label, input, hint) {
    return el("label", { class: "erp-field" },
        el("span", { text: label }),
        input,
        hint ? el("small", { text: hint }) : null
    );
}

function input(name, value, attrs = {}) {
    const node = el("input", { name, ...attrs });
    node.value = value ?? "";
    return node;
}

/** Pratinjau + pilih berkas + tempel URL (foto utama & foto hero). */
function imagePicker(name, url, { wide = false } = {}) {
    const preview = el("div", { class: `erp-imgpick__preview${wide ? " is-wide" : ""}` });
    const file = el("input", { type: "file", accept: PRODUCT_CONFIG.storage.allowedTypes.join(","), "aria-label": "Pilih foto" });
    const link = input(`${name}_url`, url, { type: "url", placeholder: "atau tempel URL foto (https://…)" });
    let objectUrl = null;

    const show = (src) => {
        preview.replaceChildren(src ? el("img", { src, alt: "" }) : el("span", { text: wide ? "16:9" : "Foto" }));
    };

    file.addEventListener("change", () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        const picked = file.files?.[0];
        objectUrl = picked ? URL.createObjectURL(picked) : null;
        show(objectUrl || link.value.trim());
    });
    link.addEventListener("input", () => {
        if (!file.files?.length) show(link.value.trim());
    });
    show(url);

    return {
        element: el("div", { class: "erp-imgpick" }, preview, el("div", { class: "erp-imgpick__inputs" }, file, link)),
        file: () => file.files?.[0] || null,
        url: () => link.value.trim(),
    };
}

export async function renderEditor(ctx, productId) {
    const { data, me } = ctx;
    const products = await data.listProducts();
    const isNew = productId === "baru";
    const product = isNew ? {} : products.find((entry) => String(entry.id) === String(productId));

    const page = el("div", { class: "erp-page__inner" });

    if (!product) {
        page.append(pageHeader("Produk tidak ditemukan", ""), el("a", { class: "erp-btn", href: "#/catalog" }, "← Kembali ke katalog"));
        return page;
    }

    const canDelete = !isNew && me.level >= 4;

    page.appendChild(pageHeader(
        isNew ? "Produk baru" : `Edit — ${product.name}`,
        "Perubahan langsung tampil di semua toko sales & homepage.",
        el("a", { class: "erp-btn", href: "#/catalog" }, "← Kembali")
    ));

    const form = el("form", { class: "erp-editor", novalidate: true });

    // ---------- Info dasar ----------
    const name = input("name", product.name, { required: true, maxlength: 80 });
    const category = input("category", product.category, { maxlength: 40, placeholder: "Umum" });
    const price = input("price", product.price ?? "", { type: "number", min: 0, step: 500, required: true, inputmode: "numeric" });
    const compareAt = input("compare_at_price", product.compare_at_price ?? "", { type: "number", min: 0, step: 500, inputmode: "numeric", placeholder: "Harga sebelum diskon" });
    const sku = input("sku", product.sku, { maxlength: 40, placeholder: "contoh: MLT-CHOC-250" });
    const barcode = input("barcode", product.barcode, { maxlength: 32, placeholder: "angka di kemasan" });
    const description = el("textarea", { name: "description", rows: 4, maxlength: 600 });
    description.value = product.description || "";

    form.appendChild(el("section", { class: "erp-card" },
        el("h2", { text: "Info produk" }),
        field("Nama produk *", name),
        el("div", { class: "erp-grid2" },
            field("Kategori", category),
            field("Harga (Rp) *", price),
            field("Harga coret (Rp)", compareAt, "Label diskon muncul otomatis bila lebih tinggi dari harga."),
            el("div", { class: "erp-field" }, el("span", { text: "Stok" }), el("p", { class: "erp-muted", text: `${product.stock ?? 0} unit · diatur di Gudang & Stok` }))
        ),
        el("div", { class: "erp-grid2" },
            field("Kode barang (SKU)", sku, "Sama untuk semua toko sales."),
            field("Barcode", barcode)
        ),
        field("Deskripsi", description)
    ));

    // ---------- Pengiriman ----------
    const shipEstimate = input("ship_estimate", product.ship_estimate, { maxlength: 30, placeholder: "±1-2 hari" });
    const shipFrom = input("ship_from", product.ship_from, { maxlength: 40, placeholder: "Jakarta" });

    form.appendChild(el("section", { class: "erp-card" },
        el("h2", { text: "Pengiriman" }),
        el("div", { class: "erp-grid2" }, field("Estimasi kirim", shipEstimate), field("Dikirim dari", shipFrom))
    ));

    // ---------- Foto, video, galeri ----------
    const mainImage = imagePicker("image", product.image_url);
    const video = input("video_url", product.video_url, { type: "url", placeholder: "https://…/video.mp4" });

    form.appendChild(el("section", { class: "erp-card" },
        el("h2", { text: "Foto & video" }),
        el("div", { class: "erp-field" }, el("span", { text: "Foto utama" }), mainImage.element, el("small", { text: "JPG/PNG/WebP, maks 3 MB." })),
        field("Video produk (opsional)", video, "Diputar pertama di popup kartu."),
        el("div", { class: "erp-field" },
            el("span", { text: "Galeri foto & varian (maks 12)" }),
            el("div", { class: "gallery-deck", id: "galleryDeck", "aria-label": "Tumpukan foto galeri" }),
            el("div", { class: "gallery-editor", id: "galleryEditor", hidden: true },
                el("img", { class: "gallery-editor__image", id: "galleryEditorImage", alt: "Foto yang sedang diatur" }),
                el("div", { class: "gallery-editor__body" },
                    el("small", { class: "erp-muted", id: "galleryEditorIndex" }),
                    el("label", { class: "erp-field" },
                        el("span", { text: "Nama produk / varian di foto ini" }),
                        el("input", { id: "galleryEditorLabel", type: "text", maxlength: 40, placeholder: "contoh: Chocolate 250 ml" })
                    ),
                    el("div", { class: "gallery-editor__actions" },
                        el("button", { type: "button", class: "erp-btn erp-btn--sm", id: "galleryMoveLeft" }, "← Geser"),
                        el("button", { type: "button", class: "erp-btn erp-btn--sm", id: "galleryMoveRight" }, "Geser →"),
                        el("button", { type: "button", class: "erp-btn erp-btn--sm erp-btn--danger", id: "galleryRemove" }, "Hapus"),
                        el("button", { type: "button", class: "erp-btn erp-btn--sm erp-btn--primary", id: "galleryPutBack" }, "Masukkan ke tumpukan")
                    )
                )
            ),
            el("div", { class: "gallery-url" },
                el("input", { id: "galleryUrlInput", type: "url", placeholder: "atau tempel URL foto (https://…)" }),
                el("button", { type: "button", class: "erp-btn erp-btn--sm", id: "galleryUrlAdd" }, "Tambah")
            ),
            el("small", { class: "erp-muted", id: "galleryNote" })
        )
    ));

    // ---------- Tampil di homepage ----------
    const featured = el("input", { type: "checkbox", checked: product.is_featured === true });
    const hero = el("input", { type: "checkbox", checked: product.is_hero === true });
    const heroImage = imagePicker("hero", product.hero_image_url, { wide: true });
    const heroCaption = input("hero_caption", product.hero_caption, { maxlength: 40, placeholder: "Premium collection" });
    const heroText = el("textarea", { name: "hero_text", rows: 2, maxlength: 160 });
    heroText.value = product.hero_text || "";

    const heroFields = el("div", { class: "erp-hero-fields", hidden: !hero.checked },
        el("div", { class: "erp-field" }, el("span", { text: "Foto hero (opsional, melebar 16:9)" }), heroImage.element, el("small", { text: "Kosongkan untuk memakai foto produk." })),
        field("Teks kecil hero", heroCaption),
        field("Teks promo hero", heroText)
    );
    hero.addEventListener("change", () => { heroFields.hidden = !hero.checked; });

    form.appendChild(el("section", { class: "erp-card" },
        el("h2", { text: "Tampil di homepage" }),
        el("label", { class: "erp-check" }, featured, "Produk Unggulan (kartu di etalase)"),
        el("label", { class: "erp-check" }, hero, `Hero slider (banner besar, maks. ${PRODUCT_CONFIG.maxHeroSlides})`),
        heroFields
    ));

    // ---------- Aksi ----------
    const message = el("p", { class: "erp-form__error", hidden: true });
    const submit = el("button", { class: "erp-btn erp-btn--primary", type: "submit" }, isNew ? "Simpan produk" : "Simpan perubahan");

    form.appendChild(el("div", { class: "erp-editor__actions" },
        canDelete ? el("button", {
            class: "erp-btn erp-btn--danger", type: "button",
            onclick: async () => {
                if (!window.confirm(`Hapus produk "${product.name}"? Produk hilang dari semua toko.`)) return;
                try {
                    await data.deleteProduct(product.id);
                    toast("Produk dihapus.");
                    location.hash = "#/catalog";
                } catch (error) {
                    toast(friendlyError(error), "error");
                }
            },
        }, "Hapus produk") : null,
        el("span", { class: "erp-spacer" }),
        message,
        el("a", { class: "erp-btn", href: "#/catalog" }, "Batal"),
        submit
    ));

    const fail = (text) => {
        message.textContent = text;
        message.hidden = false;
        submit.disabled = false;
    };

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        message.hidden = true;
        submit.disabled = true;

        const values = {
            name: name.value,
            category: category.value,
            price: price.value,
            stock: product.stock ?? 0,
            compare_at_price: compareAt.value,
            ship_estimate: shipEstimate.value,
            ship_from: shipFrom.value,
            description: description.value,
            image_url: mainImage.url(),
            video_url: video.value,
            gallery: getGalleryItems(),
            is_featured: featured.checked,
            is_hero: hero.checked,
            hero_image_url: heroImage.url(),
            hero_caption: heroCaption.value,
            hero_text: heroText.value,
        };

        const problem = validateProductInput(values);
        if (problem) return fail(problem);

        const heroCount = products.filter((entry) => entry.is_hero && String(entry.id) !== String(product.id)).length;
        if (values.is_hero && heroCount >= PRODUCT_CONFIG.maxHeroSlides) {
            return fail(`Hero slider maksimal ${PRODUCT_CONFIG.maxHeroSlides} produk. Matikan salah satu dulu.`);
        }

        const code = sku.value.trim().toUpperCase();
        if (code && !/^[A-Z0-9][A-Z0-9-]{1,39}$/.test(code)) return fail("Kode barang hanya huruf besar, angka, dan minus.");

        try {
            if (mainImage.file()) {
                submit.textContent = "Mengunggah foto…";
                values.image_url = await data.uploadImage(mainImage.file());
            }
            if (heroImage.file()) {
                submit.textContent = "Mengunggah foto hero…";
                values.hero_image_url = await data.uploadImage(heroImage.file());
            }
            if (values.gallery.some((item) => item.file)) {
                submit.textContent = "Mengunggah galeri…";
                values.gallery = await uploadPendingGallery((file) => data.uploadImage(file));
            }

            submit.textContent = "Menyimpan…";
            const saved = await data.saveProduct(isNew ? null : product, values);

            const codes = { sku: code || null, barcode: barcode.value.trim() || null };
            if (codes.sku !== (product.sku || null) || codes.barcode !== (product.barcode || null)) {
                await data.saveProductCodes(saved.id, codes);
            }

            toast(isNew ? "Produk ditambahkan." : "Perubahan disimpan.");
            location.hash = "#/catalog";
        } catch (error) {
            submit.textContent = isNew ? "Simpan produk" : "Simpan perubahan";
            fail(friendlyError(error));
        }
    });

    page.appendChild(form);

    // Galeri memakai id elemen: pasang setelah halaman tampil.
    setTimeout(() => {
        initGalleryDeck();
        setGalleryItems(product.gallery ?? product.gallery_urls ?? []);
    }, 0);

    return page;
}
