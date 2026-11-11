/**
 * KANTOONG — ISI RINGKASAN KARTU (Lapisan 1, Blueprint Vol.7)
 * File: frontend/dashboard-user/home/home-glance.js
 *
 * Setiap fitur punya visual khas + SATU informasi utama.
 * Kartu bukan halaman detail yang diperkecil. Data asli; bila kosong,
 * tampil ajakan yang ramah (tanpa bahasa teknis).
 *
 * Struktur isi:  .bx-g  >  .bx-g__visual  .bx-g__value  .bx-g__note
 * CSS memilih bagian mana yang tampil sesuai ukuran kartu (data-size).
 */

import { el, icon } from "./home-icons.js";
import {
    ORDER_LABEL,
    ORDER_STEPS,
    brandInfo,
    getCart,
    getChatSessions,
    getRecentIds,
    getWishlistIds,
    isActiveOrder,
    loadMyOrders,
    loadProducts,
    monthlySpending,
    productImage,
    shortRupiah,
} from "./home-data.js";
import { supabase } from "../../js/supabase-client.js";
import { CHOICES, readPrefs, savePrefs } from "../../js/theme.js";
import { LANGUAGES, activeLang } from "../../js/i18n.js";
import { consentLabel } from "../../js/ai-consent.js";

/** Tone kartu: light (gading), ink (tinta gelap), gold. */
export const TONES = {
    "total-spending": "ink",
    "package-tracking": "light",
    clock: "ink",
    membership: "gold",
};

/**
 * Kerangka isi kartu. Makin besar kartu, makin banyak yang tampil (diatur CSS lewat data-mode):
 *   icon (1x1)  : ikon saja
 *   pill (2x1)  : ikon + angka/judul satu baris
 *   box  (2x2)  : visual + angka + keterangan
 *   row  (4x2)  : visual di kiri, angka + 2 baris detail di kanan
 *   tall (2x4, 4x4): visual + angka + keterangan + SEMUA detail (more) + daftar (list)
 * more = [[label, nilai], ...]   list = elemen tambahan (mis. daftar produk)
 */
function frame({ visual, value, note, extra, more, list } = {}) {
    const box = el("div", "bx-g");
    if (visual) box.append(el("div", "bx-g__visual", visual));
    box.append(el("div", "bx-g__text", value ? el("p", "bx-g__value", value) : null, note ? el("p", "bx-g__note", note) : null));
    if (extra) box.append(extra);
    const rows = (more || []).filter((row) => row && row[1] !== undefined && row[1] !== null && row[1] !== "");
    if (rows.length) {
        box.append(el("dl", "bx-g__more", rows.map(([label, value]) => el("div", "", el("dt", "", label), el("dd", "", String(value))))));
    }
    if (list) box.append(el("div", "bx-g__list", list));
    return box;
}

function miniItem(p) {
    return el("div", "bx-li", photo(productImage(p), "bx-ph bx-li__ph"), el("span", "bx-li__name", p.name), el("span", "bx-li__price", shortRupiah(Number(p.price) || 0)));
}

function photo(src, className = "bx-ph") {
    const wrap = el("span", className);
    if (src) {
        const img = document.createElement("img");
        img.src = src;
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        wrap.appendChild(img);
    }
    return wrap;
}

function fill(target, node) {
    if (target.isConnected || target.parentNode) target.replaceChildren(node);
}

const timeAgoShort = (date) => {
    if (!date) return "";
    const s = Math.max(0, (Date.now() - date.getTime()) / 1000);
    if (s < 3600) return `${Math.max(1, Math.round(s / 60))} mnt lalu`;
    if (s < 86400) return `${Math.round(s / 3600)} jam lalu`;
    return `${Math.round(s / 86400)} hari lalu`;
};

/* ============================================================
   RENDERER PER FITUR
   ============================================================ */

const RENDER = {
    async profile(slot) {
        let user = null;
        try {
            user = (await supabase.auth.getUser())?.data?.user ?? null;
        } catch {
            /* offline */
        }
        const meta = user?.user_metadata ?? {};
        const name = meta.full_name || meta.name || (user?.email ? user.email.split("@")[0] : "");
        const avatar = meta.avatar_url || meta.picture || "";
        const hour = new Date().getHours();
        const greet = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 19 ? "Selamat sore" : "Selamat malam";

        const face = avatar ? photo(avatar, "bx-avatar") : el("span", "bx-avatar bx-avatar--initial", (name || "K").charAt(0).toUpperCase());
        fill(slot, frame({
            visual: face,
            value: user ? name : "Masuk ke akunmu",
            note: user ? greet : "Simpan pesanan & poin di satu tempat",
            more: user ? [["Email", user.email], ["Bergabung", user.created_at ? new Date(user.created_at).toLocaleDateString("id-ID", { month: "long", year: "numeric" }) : null], ["Favorit", getWishlistIds().length]] : [],
        }));
    },

    async "product-catalog"(slot) {
        const products = await loadProducts();
        const pics = products.map(productImage).filter(Boolean).slice(0, 4);
        const fan = el("div", "bx-fan", pics.map((src) => photo(src)));
        const prices = products.map((p) => Number(p.price) || 0).filter((n) => n > 0);
        const cats = new Set(products.map((p) => p.category).filter(Boolean));
        const newest = [...products].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0];
        fill(slot, frame({
            visual: fan,
            value: products.length ? `${products.length} produk` : "Katalog",
            note: "Cari, saring & bandingkan",
            more: [
                ["Kategori", cats.size || null],
                ["Mulai dari", prices.length ? shortRupiah(Math.min(...prices)) : null],
                ["Terbaru", newest?.name],
            ],
            list: products.slice(0, 3).map(miniItem),
        }));
    },

    async wishlist(slot) {
        const ids = getWishlistIds();
        const products = ids.length ? await loadProducts() : [];
        const byId = new Map(products.map((p) => [String(p.id), p]));
        const items = ids.map((id) => byId.get(id)).filter(Boolean);
        if (!items.length) {
            fill(slot, frame({
                visual: el("span", "bx-orb", icon("wishlist", "bx-icon bx-icon--xl")),
                value: "Belum ada favorit",
                note: "Ketuk ♡ di produk yang kamu suka",
            }));
            return;
        }
        const stack = el("div", "bx-stack", items.slice(0, 4).map((p) => photo(productImage(p), "bx-ph bx-ph--round")));
        const total = items.reduce((n, p) => n + (Number(p.price) || 0), 0);
        fill(slot, frame({
            visual: stack,
            value: `${items.length} favorit`,
            note: items[0].name,
            more: [["Total harga", shortRupiah(total)], ["Termurah", shortRupiah(Math.min(...items.map((p) => Number(p.price) || 0)))]],
            list: items.slice(0, 3).map(miniItem),
        }));
    },

    async "my-orders"(slot) {
        const { signedIn, orders } = await loadMyOrders();
        if (!signedIn) {
            fill(slot, frame({ visual: el("span", "bx-orb", icon("my-orders", "bx-icon bx-icon--xl")), value: "Pesananmu", note: "Masuk untuk melihat status" }));
            return;
        }
        const active = orders.filter(isActiveOrder);
        if (!active.length) {
            fill(slot, frame({ visual: el("span", "bx-orb", icon("my-orders", "bx-icon bx-icon--xl")), value: "Tidak ada pesanan aktif", note: orders.length ? `${orders.length} pesanan selesai` : "Yuk mulai belanja" }));
            return;
        }
        const top = active[0];
        const step = Math.max(0, ORDER_STEPS.indexOf(top.status));
        const dots = el("div", "bx-steps", ORDER_STEPS.map((_, i) => el("span", i <= step ? "is-on" : "")));
        fill(slot, frame({
            visual: el("span", "bx-count", String(active.length)),
            value: active.length === 1 ? "1 pesanan aktif" : `${active.length} pesanan aktif`,
            note: ORDER_LABEL[top.status] ?? top.status,
            extra: dots,
            more: [
                ["Kode", top.order_code],
                ["Total", top.total ? shortRupiah(Number(top.total)) : null],
                ["Selesai", orders.length - active.length],
            ],
        }));
    },

    async "package-tracking"(slot) {
        const { signedIn, orders } = await loadMyOrders();
        const moving = orders.find((o) => o.status === "dikirim");
        const road = el("div", "bx-road", el("span", "bx-road__line"), el("span", `bx-van${moving ? " is-moving" : ""}`, icon("package-tracking", "bx-icon bx-icon--van")));
        if (moving) {
            fill(slot, frame({
                visual: road,
                value: "Sedang dikirim",
                note: [moving.courier_name, moving.shipping_eta && `tiba ${moving.shipping_eta}`].filter(Boolean).join(" · ") || moving.order_code,
            }));
            return;
        }
        const packing = orders.find((o) => o.status === "diproses" || o.status === "dibayar");
        fill(slot, frame({
            visual: road,
            value: packing ? "Sedang dikemas" : "Tidak ada paket di jalan",
            note: packing ? "Segera diserahkan ke kurir" : signedIn ? "Paketmu akan tampil di sini" : "Masuk untuk melacak paket",
        }));
    },

    async "total-spending"(slot) {
        const { signedIn, orders } = await loadMyOrders();
        const months = monthlySpending(orders);
        const now = months[months.length - 1].total;
        const prev = months[months.length - 2].total;
        const max = Math.max(1, ...months.map((m) => m.total));
        const bars = el("div", "bx-bars", months.map((m, i) => {
            const bar = el("span", i === months.length - 1 ? "is-now" : "");
            bar.style.setProperty("--h", `${Math.max(6, (m.total / max) * 100)}%`);
            bar.title = `${m.label}: ${shortRupiah(m.total)}`;
            return bar;
        }));
        let note = signedIn ? "Bulan ini" : "Masuk untuk melihat";
        if (signedIn && prev > 0) {
            const pct = Math.round(((now - prev) / prev) * 100);
            note = `Bulan ini · ${pct >= 0 ? "↑" : "↓"}${Math.abs(pct)}% dari bulan lalu`;
        }
        const year = months.reduce((n, m) => n + m.total, 0);
        fill(slot, frame({
            value: signedIn ? shortRupiah(now) : "Rp —",
            note,
            extra: bars,
            more: signedIn ? [["Bulan lalu", shortRupiah(prev)], ["6 bulan", shortRupiah(year)], ["Pesanan", orders.length]] : [],
        }));
    },

    async "ai-chat-history"(slot) {
        const sessions = getChatSessions();
        if (!sessions.length) {
            fill(slot, frame({ visual: el("span", "bx-orb", icon("ai-chat-history", "bx-icon bx-icon--xl")), value: "Belum ada percakapan", note: "Ngobrol dengan asisten kapan saja" }));
            return;
        }
        const last = sessions[0];
        fill(slot, frame({
            visual: el("p", "bx-bubble", `“${last.title}”`),
            value: `${sessions.length} percakapan`,
            note: last.at ? timeAgoShort(last.at) : "Terakhir",
            more: sessions.slice(1, 4).map((s) => [s.at ? timeAgoShort(s.at) : "", s.title]),
        }));
    },

    clock(slot) {
        const time = el("p", "bx-clock");
        const date = el("p", "bx-g__note");
        const face = el("div", "bx-dial", el("span", "bx-dial__h"), el("span", "bx-dial__m"), el("span", "bx-dial__s"));
        const tick = () => {
            if (!slot.isConnected && slot.dataset.mounted) return clearInterval(timer);
            slot.dataset.mounted = "1";
            const d = new Date();
            time.textContent = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
            date.textContent = d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
            face.style.setProperty("--h", `${(d.getHours() % 12) * 30 + d.getMinutes() / 2}deg`);
            face.style.setProperty("--m", `${d.getMinutes() * 6}deg`);
            face.style.setProperty("--s", `${d.getSeconds() * 6}deg`);
        };
        const timer = setInterval(tick, 1000);
        const box = el("div", "bx-g bx-g--clock", el("div", "bx-g__visual", face), el("div", "bx-g__text", time, date));
        fill(slot, box);
        tick();
    },

    "store-map"(slot) {
        const info = brandInfo();
        const map = el("div", "bx-map", el("span", "bx-map__pin", icon("shipping-address", "bx-icon")));
        fill(slot, frame({
            visual: map,
            value: info.name,
            note: info.address || info.hours || "Lihat lokasi & jam buka",
            more: [["Alamat", info.address], ["Jam buka", info.hours], ["WhatsApp", info.whatsapp ? "Tersedia" : null]],
        }));
    },

    "customer-support"(slot) {
        const info = brandInfo();
        fill(slot, frame({
            visual: el("span", "bx-orb bx-orb--live", icon("customer-support", "bx-icon bx-icon--xl")),
            value: "Butuh bantuan?",
            note: info.whatsapp ? "Chat tim kami lewat WhatsApp" : "Tanya asisten, dijawab langsung",
        }));
    },

    settings(slot) {
        // Ringkasan 3 hal penting + tombol cepat yang benar-benar berfungsi.
        const draw = () => {
            const prefs = readPrefs();
            const themeId = prefs.mode === "all" ? prefs.all : "per-area";
            const themeLabel = themeId === "per-area" ? "Per halaman" : (CHOICES.find((c) => c.id === themeId)?.label ?? "");
            const lang = LANGUAGES.find((l) => l.id === activeLang())?.label ?? "Bahasa Indonesia";
            const quick = el("button", "bx-quick", icon("sparkle"), "Ganti tema");
            quick.type = "button";
            quick.setAttribute("aria-label", "Ganti tema terang / gelap / ikuti perangkat");
            quick.addEventListener("click", (event) => {
                event.stopPropagation();
                const order = ["light", "dark", "system"];
                const next = order[(order.indexOf(prefs.all) + 1) % order.length];
                savePrefs({ ...prefs, mode: "all", all: next });
                draw();
            });
            quick.addEventListener("pointerdown", (event) => event.stopPropagation());
            const rows = el("dl", "bx-g__rows",
                el("div", "", el("dt", "", "Bahasa"), el("dd", "", lang)),
                el("div", "", el("dt", "", "Tema"), el("dd", "", themeLabel)),
                el("div", "", el("dt", "", "Izin AI"), el("dd", "", consentLabel())));
            fill(slot, frame({ value: "Pengaturan kamu", note: "Tampilan, bahasa & privasi", extra: el("div", "bx-g__settings", rows, quick) }));
        };
        draw();
    },

    "transaction-history"(slot) {
        const cart = getCart();
        fill(slot, frame({ value: cart.count ? `${cart.count} barang di keranjang` : "Riwayat transaksi", note: cart.count ? shortRupiah(cart.total) : "Struk belanjamu tersimpan di sini" }));
    },
};

/** Fitur tanpa renderer khusus: ikon besar + deskripsi singkat. */
function fallback(slot, feature) {
    fill(slot, frame({
        visual: el("span", "bx-orb", icon(feature.id, "bx-icon bx-icon--xl")),
        value: feature.title,
        note: feature.description,
    }));
}

export function renderGlance(slot, feature, ctx = {}) {
    const render = RENDER[feature.id];
    if (!render) {
        fallback(slot, feature);
        return;
    }
    // Kerangka halus selagi data dimuat.
    slot.replaceChildren(el("div", "bx-g bx-g--loading", el("span", "bx-shimmer"), el("span", "bx-shimmer bx-shimmer--short")));
    Promise.resolve(render(slot, ctx)).catch((error) => {
        console.warn(`[KANTOONG Dashboard] Ringkasan ${feature.id} gagal:`, error);
        fallback(slot, feature);
    });
}

export function hasGlance(id) {
    return Boolean(RENDER[id]);
}

export { getRecentIds };
