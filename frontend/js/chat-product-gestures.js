/**
 * KANTOONG — GESTUR KARTU PRODUK DI CHAT
 * File: frontend/js/chat-product-gestures.js
 *
 * Kartu produk mini di jawaban AI:
 *   ketuk          -> pop-up produk (ai-brain.js)
 *   tarik ke ATAS  -> produk dilampirkan ke kotak ketik ("Tanya AI")
 *   tarik ke BAWAH -> produk masuk keranjang (hanya di toko)
 * Tarikan pendek = batal, kartu kembali. Geser kiri-kanan tetap untuk
 * menggulir daftar kartu.
 */

const TRIGGER = 56;      // px tarikan untuk menjalankan aksi
const MAX_PULL = 56;     // px maksimal kartu ikut bergerak (muat di ruang daftar)
const START = 8;         // px sebelum dianggap menarik (bukan ketukan)

function productFor(card) {
    return window.KantoongAIBrain?.findProduct?.(card.dataset.productId) || null;
}

function canAddToCart() {
    return typeof window.KantoongEngine?.addToCart === "function";
}

/** Tarikan melambat mendekati batas (efek karet). */
function rubber(dy) {
    const sign = Math.sign(dy);
    const distance = Math.abs(dy);
    return sign * MAX_PULL * (1 - Math.exp(-distance / (MAX_PULL * 0.9)));
}

/** Sama seperti tombol AI di etalase (engine.js): lampirkan, tanpa mengirim. */
function askAI(card, product) {
    const summary = window.KantoongAIBrain?.describeProduct?.(card.dataset.productId) || {};

    window.dispatchEvent(new CustomEvent("kantoong:attach-product", {
        detail: {
            product: {
                id: card.dataset.productId,
                name: summary.name || product.name || "",
                price: Number(product.price ?? product.harga) || null,
                image_url: summary.image || product.image_url || "",
            },
        },
    }));
}

function addToCart(product) {
    window.KantoongEngine.addToCart(product);
}

export function initChatProductGestures() {
    const chatBox = document.getElementById("chatBox");
    if (!chatBox || chatBox.dataset.gesturesReady === "true") return;
    chatBox.dataset.gesturesReady = "true";

    let drag = null;
    let swallowClick = false;

    const reset = (card) => {
        card.classList.remove("is-pulling");
        card.style.removeProperty("--kc-pull");
        delete card.dataset.gesture;
    };

    chatBox.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        const card = event.target.closest(".ai-product-card[data-product-id]");
        if (!card) return;

        drag = { card, id: event.pointerId, x: event.clientX, y: event.clientY, active: false, dy: 0 };
    });

    chatBox.addEventListener("pointermove", (event) => {
        if (!drag || event.pointerId !== drag.id) return;

        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;

        if (!drag.active) {
            if (Math.abs(dx) < START && Math.abs(dy) < START) return;

            // Geser mendatar = gulir daftar kartu, bukan gestur.
            if (Math.abs(dx) >= Math.abs(dy)) {
                drag = null;
                return;
            }

            drag.active = true;
            drag.card.classList.add("is-pulling");
            try {
                drag.card.setPointerCapture(event.pointerId);
            } catch {
                // abaikan
            }
        }

        // Tarik ke bawah hanya bila keranjang tersedia (di toko).
        drag.dy = dy > 0 && !canAddToCart() ? 0 : dy;

        const pull = rubber(drag.dy);
        drag.card.style.setProperty("--kc-pull", `${pull.toFixed(1)}px`);

        if (drag.dy <= -TRIGGER) drag.card.dataset.gesture = "up";
        else if (drag.dy >= TRIGGER) drag.card.dataset.gesture = "down";
        else drag.card.dataset.gesture = drag.dy < 0 ? "up-hint" : drag.dy > 0 ? "down-hint" : "";

        event.preventDefault();
    });

    const finish = (event, cancelled) => {
        if (!drag || event.pointerId !== drag.id) return;

        const { card, active, dy } = drag;
        drag = null;

        if (!active) return;

        // Setelah menarik, "klik" bawaan browser tidak boleh membuka pop-up.
        swallowClick = true;
        setTimeout(() => {
            swallowClick = false;
        }, 0);

        const product = productFor(card);

        if (!cancelled && product && dy <= -TRIGGER) {
            card.classList.add("is-sent-up");
            askAI(card, product);
        } else if (!cancelled && product && dy >= TRIGGER && canAddToCart()) {
            card.classList.add("is-sent-down");
            addToCart(product);
        }

        reset(card);
        setTimeout(() => card.classList.remove("is-sent-up", "is-sent-down"), 520);
    };

    chatBox.addEventListener("pointerup", (event) => finish(event, false));
    chatBox.addEventListener("pointercancel", (event) => finish(event, true));

    chatBox.addEventListener(
        "click",
        (event) => {
            if (!swallowClick || !event.target.closest(".ai-product-card")) return;
            event.preventDefault();
            event.stopPropagation();
            swallowClick = false;
        },
        true
    );

    // Foto di kartu tidak ikut "terseret" sebagai gambar oleh browser.
    chatBox.addEventListener("dragstart", (event) => {
        if (event.target.closest?.(".ai-product-card")) event.preventDefault();
    });
}
