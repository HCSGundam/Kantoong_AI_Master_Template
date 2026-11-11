/**
 * NOTIFIKASI BOLA (sketsa Koko)
 *
 *   Keranjang : bola berikon jatuh dari ATAS → memanjang jadi pil berisi tulisan
 *               → menyatu lagi jadi bola → naik kembali ke atas.
 *   Wishlist  : sama, tetapi muncul dari BAWAH lalu turun lagi.
 *
 * dropNotice({ from: "top" | "bottom", icon: "cart" | "heart", title?, text, action?: { label, onClick } })
 */

const ICONS = {
    cart: '<path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    heartOff: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M4 4l16 16"/>',
};

let current = null;

export function dropNotice({ from = "top", icon = "cart", title = "", text = "", action = null, hold } = {}) {
    current?.remove();
    const el = document.createElement("div");
    el.className = `kc-drop kc-drop--${from}`;
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");

    const ball = document.createElement("span");
    ball.className = "kc-drop__ball";
    ball.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[icon] || ICONS.cart}</svg>`;

    const label = document.createElement("span");
    label.className = "kc-drop__text";
    // Baris 1 = nama (tebal), baris 2 = keterangan. Masing-masing satu baris, dipotong "…" bila panjang.
    if (title) {
        const b = document.createElement("b");
        b.textContent = String(title);
        const s = document.createElement("small");
        s.textContent = String(text);
        label.append(b, s);
    } else {
        label.textContent = String(text);
    }

    el.append(ball, label);
    if (action?.label) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "kc-drop__act";
        btn.textContent = action.label;
        btn.addEventListener("click", () => {
            action.onClick?.();
            close();
        });
        el.append(btn);
    }
    document.body.append(el);
    current = el;

    // Lebar pil = isi sebenarnya (dibatasi layar).
    const textWidth = Math.max(label.scrollWidth, ...[...label.children].map((c) => c.scrollWidth));
    const full = Math.min(window.innerWidth - 24, 520, 48 + textWidth + (el.querySelector(".kc-drop__act")?.scrollWidth || 0) + 44);
    el.style.setProperty("--w", `${Math.max(48, full)}px`);

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, reduce ? 0 : ms));
    const stay = hold ?? (action ? 4800 : 2200);

    function close() {
        timers.forEach(clearTimeout);
        el.classList.remove("is-open");
        setTimeout(() => el.classList.remove("is-in"), reduce ? 0 : 320);
        setTimeout(() => el.remove(), reduce ? 0 : 800);
        if (current === el) current = null;
    }

    requestAnimationFrame(() => {
        el.classList.add("is-in"); // bola jatuh / naik ke posisi
        later(() => el.classList.add("is-open"), 460); // memanjang
        later(close, 460 + 380 + stay); // menyatu & pergi
    });
    return close;
}
