/**
 * KANTOONG — WADAH VIDEO FEED (gulir vertikal ala TikTok) — MASIH KOSONG
 * File: frontend/js/video-feed.js
 *
 * Menggantikan tombol kaca pembesar di header toko (keputusan Koko, 10 Nov 2026).
 * Nanti diisi video dari PEMILIK BRAND & KONTEN KREATOR yang mengulas web,
 * brand, dan produk. Konsep lengkap (bersama fitur Profil) didiskusikan dulu
 * dengan Koko — file ini hanya wadah: layar penuh, gulir per video (snap),
 * kolom aksi kanan (suka, komentar, bagikan, produk di video) masih nonaktif.
 */

function el(tag, className, ...children) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    children.flat().forEach((c) => c != null && node.append(c instanceof Node ? c : document.createTextNode(String(c))));
    return node;
}

const SLOTS = [
    { who: "Pemilik brand", text: "Cerita di balik produk, langsung dari pembuatnya." },
    { who: "Konten kreator", text: "Ulasan jujur kreator tentang produk & toko ini." },
    { who: "Pembeli", text: "Video pemakaian asli dari pembeli lain." },
];

let root = null;

function close() {
    if (!root) return;
    root.classList.remove("is-open");
    document.removeEventListener("keydown", onKey);
    window.dispatchEvent(new CustomEvent("kantoong:overlay", { detail: { name: "video", open: false } }));
    const node = root;
    root = null;
    setTimeout(() => node.remove(), 280);
}

function onKey(event) {
    if (event.key === "Escape") close();
}

export function openVideoFeed() {
    if (root) return;
    const x = el("button", "kc-vf__close", "×");
    x.type = "button";
    x.setAttribute("aria-label", "Tutup video");
    x.addEventListener("click", close);

    const feed = el("div", "kc-vf__feed", SLOTS.map((s, i) => el("section", "kc-vf__slot",
        el("div", "kc-vf__frame", el("span", "kc-vf__play", "▶"), el("p", "kc-vf__soon", "Segera hadir")),
        el("div", "kc-vf__meta", el("span", "kc-vf__who", s.who), el("p", "", s.text)),
        el("div", "kc-vf__rail", ["♡", "💬", "↗", "🛍"].map((g) => {
            const b = el("button", "kc-vf__act", g);
            b.type = "button";
            b.disabled = true;
            return b;
        })),
        el("span", "kc-vf__count", `${i + 1} / ${SLOTS.length}`))));

    root = el("div", "kc-vf",
        el("header", "kc-vf__head", el("div", "", el("strong", "", "Video"), el("span", "", "Brand & kreator")), x),
        feed);
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Video dari brand & kreator");
    document.body.append(root);
    document.addEventListener("keydown", onKey);
    window.dispatchEvent(new CustomEvent("kantoong:overlay", { detail: { name: "video", open: true } }));
    requestAnimationFrame(() => root?.classList.add("is-open"));
    x.focus({ preventScroll: true });
}

if (typeof document !== "undefined") {
    document.getElementById("btnVideo")?.addEventListener("click", openVideoFeed);
}
