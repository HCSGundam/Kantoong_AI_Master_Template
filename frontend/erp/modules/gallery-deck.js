/**
 * KANTOONG CORE — GALERI FOTO BERGAYA TUMPUKAN KARTU
 * File: frontend/erp/modules/gallery-deck.js
 *
 * Slot banyak foto untuk popup produk (maks 12), tampil seperti
 * tumpukan kartu yang dikipas (sesuai sketsa owner):
 * - Ketuk / tarik ke atas sebuah kartu  -> kartu keluar dari tumpukan
 *   dan bisa diberi nama produk/varian, digeser urutannya, atau dihapus.
 * - "Masukkan lagi" / tarik ke bawah     -> kartu kembali ke tumpukan.
 * - Kartu "+" di ujung                   -> tambah foto (bisa banyak sekaligus).
 *
 * Foto baru baru diunggah saat produk disimpan (uploadPendingGallery).
 */

import { GALLERY_LIMIT, normalizeGallery } from "../data/product-service.js";

const deckState = {
    items: [],
    selected: -1,
};

const $ = (id) => document.getElementById(id);

function previewOf(item) {
    if (item.file && !item.preview) {
        item.preview = URL.createObjectURL(item.file);
    }

    return item.preview || item.url;
}

function releasePreviews() {
    deckState.items.forEach((item) => {
        if (item.preview) URL.revokeObjectURL(item.preview);
    });
}

function setNote(message) {
    const note = $("galleryNote");
    if (note) note.textContent = message;
}

/* ---------- Gambar ulang tumpukan & editor ---------- */

function render() {
    const deck = $("galleryDeck");
    if (!deck) return;

    const { items, selected } = deckState;
    const inDeck = items.length;

    deck.replaceChildren();
    // Jumlah kartu di kipas (termasuk kartu "+") untuk menengahkan tumpukan.
    const total = inDeck + (inDeck < GALLERY_LIMIT ? 1 : 0);
    deck.style.setProperty("--n", String(Math.max(total, 1)));

    items.forEach((item, index) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "gallery-card";
        card.style.setProperty("--i", String(index));
        card.dataset.index = String(index);
        card.setAttribute("aria-label", `Foto ${index + 1}${item.label ? `: ${item.label}` : ""}`);
        if (index === selected) card.classList.add("is-out");

        const image = document.createElement("img");
        image.src = previewOf(item);
        image.alt = "";
        image.loading = "lazy";
        card.appendChild(image);

        const tag = document.createElement("span");
        tag.className = "gallery-card__tag";
        tag.textContent = item.label || `Foto ${index + 1}`;
        card.appendChild(tag);

        attachPull(card, index);
        deck.appendChild(card);
    });

    if (items.length < GALLERY_LIMIT) {
        const add = document.createElement("label");
        add.className = "gallery-card gallery-card--add";
        add.style.setProperty("--i", String(items.length));
        add.title = "Tambah foto";
        add.innerHTML = '<span aria-hidden="true">+</span><small>Tambah</small>';

        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/jpeg,image/png,image/webp";
        input.multiple = true;
        input.hidden = true;
        input.addEventListener("change", () => addFiles(input.files));
        add.appendChild(input);

        deck.appendChild(add);
    }

    renderEditor();
    setNote(`${items.length}/${GALLERY_LIMIT} foto${items.length ? " · ketuk kartu untuk menarik keluar" : ""}`);
}

function renderEditor() {
    const editor = $("galleryEditor");
    if (!editor) return;

    const item = deckState.items[deckState.selected];
    editor.hidden = !item;
    if (!item) return;

    $("galleryEditorImage").src = previewOf(item);
    $("galleryEditorLabel").value = item.label || "";
    $("galleryEditorIndex").textContent = `Foto ${deckState.selected + 1} dari ${deckState.items.length}`;
    $("galleryMoveLeft").disabled = deckState.selected <= 0;
    $("galleryMoveRight").disabled = deckState.selected >= deckState.items.length - 1;
}

/* ---------- Tarik keluar / masukkan lagi ---------- */

function pullOut(index) {
    deckState.selected = index;
    render();
    $("galleryEditorLabel")?.focus({ preventScroll: true });
}

function putBack() {
    deckState.selected = -1;
    render();
}

/** Ketuk = tarik keluar. Tarik ke atas juga menarik keluar, ke bawah memasukkan lagi. */
function attachPull(card, index) {
    let startY = 0;
    let dragging = false;

    card.addEventListener("pointerdown", (event) => {
        startY = event.clientY;
        dragging = true;
    });

    card.addEventListener("pointerup", (event) => {
        if (!dragging) return;
        dragging = false;

        const dy = event.clientY - startY;
        const isOut = deckState.selected === index;

        if (dy < -24) {
            pullOut(index);
        } else if (dy > 24) {
            if (isOut) putBack();
        } else if (isOut) {
            putBack();
        } else {
            pullOut(index);
        }
    });

    card.addEventListener("click", (event) => {
        // Klik keyboard (Enter/Spasi) tidak lewat pointer.
        if (event.detail === 0) {
            deckState.selected === index ? putBack() : pullOut(index);
        }
    });
}

/* ---------- Tambah, urutkan, hapus ---------- */

function addFiles(fileList) {
    const files = Array.from(fileList || []);
    const room = GALLERY_LIMIT - deckState.items.length;

    files.slice(0, room).forEach((file) => {
        deckState.items.push({ url: "", label: "", file });
    });

    if (files.length > room) {
        setNote(`Maksimal ${GALLERY_LIMIT} foto. ${files.length - room} foto tidak ditambahkan.`);
    }

    deckState.selected = deckState.items.length - 1;
    render();
}

function addUrl() {
    const input = $("galleryUrlInput");
    const url = input?.value.trim();

    if (!url) return;

    if (!/^https?:\/\//i.test(url)) {
        setNote("URL foto harus diawali https://");
        return;
    }

    if (deckState.items.length >= GALLERY_LIMIT) {
        setNote(`Maksimal ${GALLERY_LIMIT} foto.`);
        return;
    }

    deckState.items.push({ url, label: "" });
    input.value = "";
    deckState.selected = deckState.items.length - 1;
    render();
}

function move(step) {
    const from = deckState.selected;
    const to = from + step;

    if (from < 0 || to < 0 || to >= deckState.items.length) return;

    const [item] = deckState.items.splice(from, 1);
    deckState.items.splice(to, 0, item);
    deckState.selected = to;
    render();
}

function removeSelected() {
    const index = deckState.selected;
    if (index < 0) return;

    const [item] = deckState.items.splice(index, 1);
    if (item?.preview) URL.revokeObjectURL(item.preview);

    deckState.selected = -1;
    render();
}

/* ---------- API untuk form produk ---------- */

export function setGalleryItems(list) {
    releasePreviews();
    deckState.items = normalizeGallery(list).map(({ url, label }) => ({ url, label }));
    deckState.selected = -1;
    render();
}

export function getGalleryItems() {
    return deckState.items.map(({ url, label, file }) => ({ url, label, file }));
}

/** Unggah foto baru (yang masih berupa file) lalu isi url-nya. */
export async function uploadPendingGallery(upload) {
    for (const item of deckState.items) {
        if (!item.file) continue;
        item.url = await upload(item.file);
        if (item.preview) URL.revokeObjectURL(item.preview);
        item.preview = "";
        item.file = undefined;
    }

    return getGalleryItems();
}

export function initGalleryDeck() {
    if (!$("galleryDeck")) return;

    $("galleryEditorLabel")?.addEventListener("input", (event) => {
        const item = deckState.items[deckState.selected];
        if (!item) return;
        item.label = event.target.value.slice(0, 40);

        const tag = $("galleryDeck").querySelector(
            `.gallery-card[data-index="${deckState.selected}"] .gallery-card__tag`
        );
        if (tag) tag.textContent = item.label || `Foto ${deckState.selected + 1}`;
    });

    $("galleryPutBack")?.addEventListener("click", putBack);
    $("galleryMoveLeft")?.addEventListener("click", () => move(-1));
    $("galleryMoveRight")?.addEventListener("click", () => move(1));
    $("galleryRemove")?.addEventListener("click", removeSelected);
    $("galleryUrlAdd")?.addEventListener("click", addUrl);
    $("galleryUrlInput")?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            addUrl();
        }
    });

    // Tarik foto besar ke bawah = masukkan lagi ke tumpukan.
    const big = $("galleryEditorImage");
    let startY = 0;
    big?.addEventListener("pointerdown", (event) => {
        startY = event.clientY;
    });
    big?.addEventListener("pointerup", (event) => {
        if (event.clientY - startY > 40) putBack();
    });

    render();
}
