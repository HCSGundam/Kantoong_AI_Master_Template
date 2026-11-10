/**
 * KANTOONG — RUANG: Wishlist · Ulasan
 * File: frontend/dashboard-user/home/rooms/shopping.js
 */

import { ui } from "../room.js";
import { mountWishlist } from "../details.js";
import { getRecentIds } from "../home-data.js";
import { addMe, clean, listMe, readMe, removeMe, writeMe } from "../me-store.js";
import { copyText, el, icon, orders, products, productImage, rupiah, storeContact, wishlistWithPrices } from "./shared.js";

/* ============================================================
   WISHLIST
   ============================================================ */
export const wishlist = {
    id: "wishlist",
    title: "Wishlist",
    tagline: "Bukan sekadar disimpan: dikabari saat harga turun & dibagikan jadi daftar kado.",
    tone: "light",
    load: async () => ({ items: await wishlistWithPrices(), collections: listMe("collections") }),
    hero: (d) => {
        const drops = d.items.filter((w) => w.priceThen > w.price);
        return { value: d.items.length ? `${d.items.length} produk disimpan` : "Wishlist masih kosong", note: drops.length ? `${drops.length} turun harga sejak kamu simpan` : "Ketuk ♡ di produk yang kamu suka" };
    },
    tools: [
        {
            id: "all", title: "Semua yang kusimpan", desc: "Gambar mini, ketuk untuk membuka", icon: "wishlist",
            badge: (d) => String(d.items.length || ""),
            render(body) {
                mountWishlist(body);
            },
        },
        {
            id: "alerts", title: "Alarm harga & stok", desc: "Turun harga sejak disimpan, atau stok habis", icon: "sparkle",
            badge: (d) => String(d.items.filter((w) => w.priceThen > w.price).length || ""),
            render(body, d, api) {
                if (!d.items.length) return body.append(ui.empty("Belum ada yang dipantau", "Setiap produk di wishlist otomatis dipantau harganya."));
                body.append(ui.list(d.items.map((w) => {
                    const drop = w.priceThen > w.price ? Math.round((1 - w.price / w.priceThen) * 100) : 0;
                    const out = w.stock !== null && w.stock !== undefined && Number(w.stock) <= 0;
                    const open = ui.btn("Lihat", () => api.openProduct(w.id, "wishlist"), "bx-btn bx-btn--ghost bx-btn--sm");
                    return ui.row(drop ? "check" : out ? "lock" : "wishlist", w.name, drop ? `Turun ${drop}%: ${rupiah(w.priceThen)} → ${rupiah(w.price)}` : out ? "Stok habis — kami pantau restoknya" : `Harga tetap ${rupiah(w.price)}`, open);
                })), ui.note("Pembanding = harga saat produk pertama kali kamu simpan. Harga coret palsu tidak dihitung (Harga Jujur)."));
            },
        },
        {
            id: "collections", title: "Koleksi bernama", desc: "Kelompokkan: Lebaran, Kado, Kantor…", icon: "grid",
            badge: (d) => String(d.collections.length || ""),
            render(body, d) {
                const byId = new Map(d.items.map((w) => [w.id, w]));
                d.collections.forEach((c) => {
                    const picker = el("div", "bx-chips", d.items.map((w) => {
                        const on = (c.ids ?? []).includes(w.id);
                        const chip = ui.btn(w.name, () => {
                            const ids = on ? c.ids.filter((x) => x !== w.id) : [...(c.ids ?? []), w.id];
                            writeMe("collections", listMe("collections").map((x) => (x.id === c.id ? { ...x, ids } : x)));
                        }, `bx-chip${on ? " is-on" : ""}`);
                        return chip;
                    }));
                    const total = (c.ids ?? []).map((id) => byId.get(id)?.price ?? 0).reduce((a, b) => a + b, 0);
                    body.append(el("section", "bx-collection",
                        el("header", "", el("strong", "", c.name), el("span", "bx-muted", `${(c.ids ?? []).length} produk · ${rupiah(total)}`), ui.btn(icon("close"), () => removeMe("collections", c.id), "bx-row__x")),
                        picker));
                });
                body.append(ui.form([{ name: "name", label: "Nama koleksi baru", placeholder: "Contoh: Kado ulang tahun Mama", required: true, max: 40 }], (v, f) => {
                    addMe("collections", { name: clean(v.name, 40), ids: [] }, { max: 20 });
                    f.reset();
                }, "Buat koleksi"));
            },
        },
        {
            id: "gift-list", title: "Bagikan daftar kado", desc: "Teman tahu kamu suka apa, tanpa menebak", icon: "link",
            render(body, d) {
                if (!d.items.length) return body.append(ui.empty("Wishlist kosong", "Simpan beberapa produk dulu, lalu bagikan sebagai daftar kado."));
                const store = storeContact().name;
                const text = [`Daftar kadoku di ${store} 🎁`, ...d.items.slice(0, 15).map((w, i) => `${i + 1}. ${w.name} — ${rupiah(w.price)}`), location.origin + "/"].join("\n");
                const pre = el("pre", "bx-share", text);
                body.append(pre, ui.btn("Salin daftar", async (e) => {
                    e.currentTarget.textContent = (await copyText(text)) ? "Tersalin ✓" : "Salin manual dari kotak di atas";
                }), ui.note("Yang dibagikan hanya nama & harga produk — tanpa data pribadimu."));
            },
        },
    ],
    snapshot: (d) => (d.items.length ? `Wishlist: ${d.items.slice(0, 8).map((w) => `${w.name} ${rupiah(w.price)}${w.priceThen > w.price ? ` (turun dari ${rupiah(w.priceThen)})` : ""}`).join("; ")}.` : "Wishlist kosong."),
};

/* ============================================================
   ULASAN
   ============================================================ */
export const productReviews = {
    id: "product-reviews",
    title: "Ulasan",
    tagline: "Ulasan terbaik ditulis setelah dipakai — kami ingatkan di hari ke-30.",
    tone: "light",
    load: async () => {
        const list = await products();
        const recent = getRecentIds().map((id) => list.find((p) => String(p.id) === id)).filter(Boolean).slice(0, 8);
        return { ...(await orders()), recent, reminders: listMe("review-reminders"), remindOn: readMe("review-30", true) };
    },
    hero: (d) => ({ value: d.reminders.length ? `${d.reminders.length} ulasan menunggu` : "Ceritakan pengalamanmu", note: "Ulasanmu membantu pembeli lain memilih" }),
    tools: [
        {
            id: "to-review", title: "Siap diulas", desc: "Produk yang baru kamu lihat/beli", icon: "product-reviews",
            badge: (d) => String(d.recent.length || ""),
            render(body, d, api) {
                if (!d.recent.length) return body.append(ui.empty("Belum ada produk", "Produk yang kamu buka atau beli akan muncul di sini untuk diulas."));
                body.append(ui.list(d.recent.map((p) => {
                    const img = el("span", "bx-row__thumb");
                    if (productImage(p)) {
                        const i = document.createElement("img");
                        i.src = productImage(p);
                        i.alt = "";
                        img.append(i);
                    }
                    const write = ui.btn("Tulis ulasan", () => api.openProduct(p.id, "product-reviews"), "bx-btn bx-btn--sm");
                    const later = ui.btn("Ingatkan 30 hari", () => addMe("review-reminders", { productId: String(p.id), name: p.name, at: Date.now() + 30 * 86_400_000 }), "bx-btn bx-btn--ghost bx-btn--sm");
                    return el("li", "bx-row", img, el("div", "bx-row__text", el("strong", "", p.name), el("span", "", rupiah(p.price))), el("span", "bx-row__actions", write, later));
                })));
            },
        },
        {
            id: "reminders", title: "Pengingat ulasan", desc: "Setelah dipakai 30 hari", icon: "clock",
            badge: (d) => String(d.reminders.length || ""),
            render(body, d) {
                body.append(d.reminders.length ? ui.list(d.reminders.map((r) => ui.row("clock", r.name, `Diingatkan ${new Date(r.at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}`, ui.btn(icon("close"), () => removeMe("review-reminders", r.id), "bx-row__x")))) : ui.empty("Belum ada pengingat", "Pilih “Ingatkan 30 hari” di produk yang ingin kamu ulas setelah dipakai."));
            },
        },
        {
            id: "guide", title: "Ulasan yang membantu", desc: "3 hal yang paling dicari pembeli lain", icon: "check",
            render(body) {
                body.append(el("ol", "bx-steps", el("li", "", "Ukuran & tinggi/berat badanmu (untuk pakaian/sepatu)."), el("li", "", "Foto di cahaya alami — bukan foto katalog."), el("li", "", "Setelah berapa lama dipakai & bagaimana kondisinya.")));
            },
        },
    ],
    snapshot: (d) => (d.reminders.length ? `Pengingat ulasan: ${d.reminders.map((r) => r.name).join(", ")}.` : ""),
};
