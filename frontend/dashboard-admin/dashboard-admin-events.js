/**
 * KANTOONG CORE — DASHBOARD ADMIN EVENTS
 * File: frontend/dashboard-admin/dashboard-admin-events.js
 *
 * Tanggung jawab: menghubungkan klik/submit ke layanan data.
 */

import { ADMIN_CONFIG } from "./dashboard-admin-config.js";
import {
    adminState,
    $,
    fillForm,
    friendlyError,
    readForm,
    removeProductFromState,
    replaceProductInState,
    resetForm,
    setMessage,
    toast,
    toggleHeroFields,
    updateImagePreview,
    updateHeroImagePreview,
    renderProducts,
} from "./dashboard-admin.js";
import {
    createProduct,
    deleteProduct,
    updateProduct,
    uploadProductImage,
    validateProductInput,
} from "./services/product-detail-service.js";
import { setPublication } from "./services/published-storefront-service.js";
import { signInWithEmail, signOutUser } from "../auth/auth-service.js";

let previewObjectUrl = null;

function findProduct(id) {
    return adminState.products.find(
        (product) => String(product.id) === String(id)
    );
}

function heroCountExcluding(productId) {
    return adminState.products.filter(
        (product) =>
            product.is_hero === true &&
            String(product.id) !== String(productId ?? "")
    ).length;
}

/* ---------- Login / logout ---------- */

async function handleLogin(event, onAuthChanged) {
    event.preventDefault();

    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;
    const button = $("loginSubmit");

    if (!email || !password) {
        setMessage($("loginMessage"), "Isi email dan password.", "error");
        return;
    }

    button.disabled = true;
    setMessage($("loginMessage"), "Masuk…");

    try {
        await signInWithEmail(email, password);
        $("loginPassword").value = "";
        setMessage($("loginMessage"), "");
        await onAuthChanged();
    } catch (error) {
        setMessage($("loginMessage"), friendlyError(error), "error");
    } finally {
        button.disabled = false;
    }
}

async function handleLogout(onAuthChanged) {
    try {
        await signOutUser();
    } catch (error) {
        toast(friendlyError(error));
    }

    await onAuthChanged();
}

/* ---------- Form produk ---------- */

async function handleSubmit(event) {
    event.preventDefault();

    const input = readForm();
    const problem = validateProductInput(input);

    if (problem) {
        setMessage($("formMessage"), problem, "error");
        return;
    }

    const editingId = adminState.editingId;

    if (input.is_hero && heroCountExcluding(editingId) >= ADMIN_CONFIG.maxHeroSlides) {
        setMessage(
            $("formMessage"),
            `Hero slider maksimal ${ADMIN_CONFIG.maxHeroSlides} produk. Matikan salah satu dulu.`,
            "error"
        );
        return;
    }

    const submit = $("formSubmit");
    submit.disabled = true;
    setMessage($("formMessage"), "Menyimpan…");

    try {
        const file = $("fImageFile").files?.[0];

        if (file) {
            setMessage($("formMessage"), "Mengunggah foto…");
            input.image_url = await uploadProductImage(file);
        }

        const heroFile = $("fHeroImageFile").files?.[0];

        if (heroFile) {
            setMessage($("formMessage"), "Mengunggah foto hero…");
            input.hero_image_url = await uploadProductImage(heroFile);
        }

        input.had_hero_image = Boolean(editingId && findProduct(editingId)?.hero_image_url);
        input.existing_keys = Object.keys((editingId && findProduct(editingId)) || {});

        const saved = editingId
            ? await updateProduct(editingId, input)
            : await createProduct(input);

        replaceProductInState(saved);
        resetForm();
        toast(editingId ? "Perubahan disimpan." : "Produk ditambahkan.");
    } catch (error) {
        setMessage($("formMessage"), friendlyError(error), "error");
    } finally {
        submit.disabled = false;
    }
}

function handleImageFileChange() {
    const file = $("fImageFile").files?.[0];

    if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = null;
    }

    if (!file) {
        updateImagePreview($("fImageUrl").value.trim());
        return;
    }

    previewObjectUrl = URL.createObjectURL(file);
    updateImagePreview(previewObjectUrl);
}

let heroPreviewObjectUrl = null;

function handleHeroImageFileChange() {
    const file = $("fHeroImageFile").files?.[0];

    if (heroPreviewObjectUrl) {
        URL.revokeObjectURL(heroPreviewObjectUrl);
        heroPreviewObjectUrl = null;
    }

    if (!file) {
        updateHeroImagePreview($("fHeroImageUrl").value.trim());
        return;
    }

    heroPreviewObjectUrl = URL.createObjectURL(file);
    updateHeroImagePreview(heroPreviewObjectUrl);
}

/* ---------- Aksi pada daftar ---------- */

async function togglePublication(product, field) {
    const next = !(product[field] === true);

    if (field === "is_hero" && next && heroCountExcluding(product.id) >= ADMIN_CONFIG.maxHeroSlides) {
        toast(`Hero slider maksimal ${ADMIN_CONFIG.maxHeroSlides} produk.`);
        return;
    }

    try {
        const updated = await setPublication(product.id, { [field]: next });

        if (updated) {
            replaceProductInState(updated);
        }

        toast(
            field === "is_hero"
                ? next ? "Masuk ke hero slider." : "Dikeluarkan dari hero slider."
                : next ? "Masuk ke Produk Unggulan." : "Dikeluarkan dari Produk Unggulan."
        );
    } catch (error) {
        toast(friendlyError(error));
    }
}

async function handleListClick(event) {
    const button = event.target.closest("[data-action]");

    if (!button) return;

    const item = button.closest("[data-product-id]");
    const product = item ? findProduct(item.dataset.productId) : null;

    if (!product) return;

    switch (button.dataset.action) {
        case "toggle-featured":
            await togglePublication(product, "is_featured");
            break;

        case "toggle-hero":
            await togglePublication(product, "is_hero");
            break;

        case "edit":
            fillForm(product);
            break;

        case "delete": {
            const sure = window.confirm(`Hapus "${product.name}"? Tindakan ini tidak bisa dibatalkan.`);

            if (!sure) return;

            try {
                await deleteProduct(product.id);
                removeProductFromState(product.id);

                if (String(adminState.editingId) === String(product.id)) {
                    resetForm();
                }

                toast("Produk dihapus.");
            } catch (error) {
                toast(friendlyError(error));
            }
            break;
        }

        default:
            break;
    }
}

/* ---------- Pasang semua ---------- */

export function bindAdminEvents({ onAuthChanged }) {
    $("adminLoginForm").addEventListener("submit", (event) =>
        handleLogin(event, onAuthChanged)
    );

    $("adminLogout").addEventListener("click", () => handleLogout(onAuthChanged));
    $("deniedLogout").addEventListener("click", () => handleLogout(onAuthChanged));

    $("productForm").addEventListener("submit", handleSubmit);
    $("formCancel").addEventListener("click", resetForm);

    $("fHero").addEventListener("change", toggleHeroFields);
    $("fImageFile").addEventListener("change", handleImageFileChange);

    $("fImageUrl").addEventListener("input", () => {
        if (!$("fImageFile").files?.length) {
            updateImagePreview($("fImageUrl").value.trim());
        }
    });

    $("fHeroImageFile").addEventListener("change", handleHeroImageFileChange);

    $("fHeroImageUrl").addEventListener("input", () => {
        if (!$("fHeroImageFile").files?.length) {
            updateHeroImagePreview($("fHeroImageUrl").value.trim());
        }
    });

    $("productList").addEventListener("click", handleListClick);

    $("productFilter").addEventListener("input", (event) => {
        adminState.filter = event.target.value;
        renderProducts();
    });
}
