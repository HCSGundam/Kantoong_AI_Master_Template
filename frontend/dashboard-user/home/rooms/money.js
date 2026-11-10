/**
 * KANTOONG — RUANG: Total Belanja · Analitik Belanja · Voucher & Promo · Poin Member
 * File: frontend/dashboard-user/home/rooms/money.js
 */

import { ui } from "../room.js";
import { monthlySpending } from "../home-data.js";
import { addMe, clean, listMe, readMe, removeMe, writeMe } from "../me-store.js";
import { LEVELS, budgetStatus, costPerWear, memberLevel, spendingPattern, spentThisMonth, voucherFit } from "../room-logic.js";
import { copyText, coupons, el, fmtDate, getCart, icon, orders, rupiah, shortRupiah, signInNote } from "./shared.js";

const VALID = (o) => !["dibatalkan", "menunggu_pembayaran"].includes(o.status);

function chart(months) {
    const max = Math.max(1, ...months.map((m) => m.total));
    return el("div", "bx-chart", months.map((m, i) => {
        const col = el("div", `bx-chart__col${i === months.length - 1 ? " is-now" : ""}`,
            el("span", "bx-chart__val", m.total ? shortRupiah(m.total) : ""),
            el("span", "bx-chart__bar"),
            el("span", "bx-chart__lbl", m.label));
        col.style.setProperty("--h", `${Math.max(3, (m.total / max) * 100)}%`);
        return col;
    }));
}

function meter(pct, level) {
    const bar = el("div", `bx-meter bx-meter--${level}`, el("span", "bx-meter__fill"));
    bar.style.setProperty("--p", `${Math.min(100, pct)}%`);
    return bar;
}

/* ============================================================
   TOTAL BELANJA (+ batas belanja buatan sendiri)
   ============================================================ */
export const totalSpending = {
    id: "total-spending",
    title: "Total Belanja",
    tagline: "Kamu yang menentukan batasnya — kami yang mengingatkan dengan lembut.",
    tone: "ink",
    load: async () => {
        const d = await orders();
        return { ...d, limit: Number(readMe("budget-limit", 0)) || 0 };
    },
    hero: (d) => {
        if (!d.signedIn) return { value: "Masuk untuk menghitung", note: signInNote };
        const month = spentThisMonth(d.orders);
        const b = budgetStatus(month, d.limit);
        return { value: rupiah(month), note: d.limit ? `Bulan ini · ${b.pct}% dari batas` : "Bulan ini · belum ada batas" };
    },
    tools: [
        {
            id: "overview", title: "Ringkasan", desc: "Bulan ini, bulan lalu, sepanjang waktu", icon: "total-spending",
            render(body, d, api) {
                if (!d.signedIn) return body.append(ui.empty("Masuk dulu, ya", "Total dihitung dari pesanan di akunmu.", ui.btn("Masuk", () => api.openFeature("profile"))));
                const valid = d.orders.filter(VALID);
                const total = valid.reduce((s, o) => s + (Number(o.total) || 0), 0);
                const months = monthlySpending(d.orders);
                const now = months.at(-1)?.total ?? 0;
                const prev = months.at(-2)?.total ?? 0;
                body.append(ui.stats(
                    ui.stat("Bulan ini", rupiah(now), prev ? `${now >= prev ? "naik" : "turun"} ${Math.abs(Math.round(((now - prev) / Math.max(1, prev)) * 100))}% dari bulan lalu` : ""),
                    ui.stat("Sepanjang waktu", rupiah(total), `${valid.length} pesanan`),
                    ui.stat("Rata-rata", rupiah(valid.length ? total / valid.length : 0), "per pesanan")),
                    el("h4", "bx-h", "6 bulan terakhir"), chart(months));
            },
        },
        {
            id: "budget", title: "Batas belanja", desc: "Anti kalap: kamu tentukan, kami ingatkan", icon: "lock",
            badge: (d) => (d.limit ? shortRupiah(d.limit) : ""),
            render(body, d) {
                const spent = d.signedIn ? spentThisMonth(d.orders) : 0;
                const b = budgetStatus(spent, d.limit);
                if (d.limit) body.append(el("p", "bx-big", `${b.pct}%`), meter(b.pct, b.level), el("p", "", b.message));
                body.append(ui.form([{ name: "limit", label: "Batas per bulan (Rp)", type: "number", min: 0, value: d.limit || "", placeholder: "Contoh: 1500000" }], (v) => {
                    writeMe("budget-limit", Math.max(0, Math.min(1_000_000_000, Math.round(Number(v.limit) || 0))));
                }, d.limit ? "Ubah batas" : "Pasang batas"),
                d.limit ? ui.btn("Hapus batas", () => writeMe("budget-limit", null), "bx-btn bx-btn--ghost") : null,
                ui.note("Hanya kamu yang melihat. Peringatan muncul di Sinyal saat 80% dan saat terlewati — tidak pernah memblokir belanja."));
            },
        },
    ],
    snapshot: (d) => {
        if (!d.signedIn) return "";
        const month = spentThisMonth(d.orders);
        return `Belanja bulan ini ${rupiah(month)}${d.limit ? `, batas ${rupiah(d.limit)} (${budgetStatus(month, d.limit).pct}%)` : ", tanpa batas"}.`;
    },
};

/* ============================================================
   ANALITIK BELANJA
   ============================================================ */
export const spendingAnalytics = {
    id: "spending-analytics",
    title: "Analitik Belanja",
    tagline: "Bukan sekadar angka: pola, biaya per pakai, dan barang yang jarang kamu pakai.",
    tone: "light",
    load: async () => ({ ...(await orders()), wears: listMe("wears") }),
    hero: (d) => {
        const p = d.signedIn ? spendingPattern(d.orders) : null;
        return { value: p ? p.sentence : "Pola belanjamu muncul di sini", note: p ? `${p.count} pesanan · rata-rata ${rupiah(p.average)}` : "Butuh minimal 1 pesanan selesai" };
    },
    tools: [
        {
            id: "pattern", title: "Pola belanja", desc: "Hari & jam favorit, pesanan terbesar", icon: "spending-analytics",
            render(body, d) {
                const p = d.signedIn ? spendingPattern(d.orders) : null;
                if (!p) return body.append(ui.empty("Belum ada pola", "Setelah beberapa pesanan, kebiasaan belanjamu terbaca di sini."));
                body.append(ui.stats(ui.stat("Hari favorit", p.favoriteDay), ui.stat("Waktu favorit", p.favoritePart), ui.stat("Pesanan terbesar", rupiah(p.biggest.total), p.biggest.code)), el("p", "", p.sentence));
            },
        },
        {
            id: "cost-per-wear", title: "Biaya per pakai", desc: "Harga ÷ berapa kali dipakai", icon: "total-spending",
            badge: (d) => String(d.wears.length || ""),
            render(body, d) {
                const rows = d.wears.map((w) => {
                    const c = costPerWear(w.price, w.count);
                    const plus = ui.btn("+1 dipakai", () => {
                        writeMe("wears", listMe("wears").map((x) => (x.id === w.id ? { ...x, count: (x.count || 0) + 1 } : x)));
                    }, "bx-btn bx-btn--ghost bx-btn--sm");
                    return ui.row("product-catalog", w.item, `${w.count || 0}× dipakai · ${rupiah(c?.per ?? w.price)}/pakai · ${c?.verdict ?? ""}`, el("span", "bx-row__actions", plus, ui.btn(icon("close"), () => removeMe("wears", w.id), "bx-row__x")));
                });
                body.append(rows.length ? ui.list(rows) : el("p", "bx-muted", "Catat barang favoritmu, lalu ketuk +1 setiap dipakai."),
                    ui.form([{ name: "item", label: "Barang", required: true, max: 60 }, { name: "price", label: "Harga beli (Rp)", type: "number", min: 0, required: true }], (v, f) => {
                        addMe("wears", { item: clean(v.item, 60), price: Math.max(0, Number(v.price) || 0), count: 0 });
                        f.reset();
                    }, "Tambah barang"));
            },
        },
        {
            id: "unused", title: "Jarang dipakai", desc: "Barang yang belum sepadan", icon: "sparkle",
            render(body, d) {
                const low = d.wears.filter((w) => (w.count || 0) < 3);
                body.append(low.length ? ui.list(low.map((w) => ui.row("product-catalog", w.item, `${w.count || 0}× dipakai — coba padukan atau simpan untuk acara berikutnya`))) : ui.empty("Semua sepadan", "Belum ada barang yang jarang dipakai dari catatanmu."));
            },
        },
    ],
    snapshot: (d) => {
        const p = d.signedIn ? spendingPattern(d.orders) : null;
        return p ? `${p.sentence} Rata-rata ${rupiah(p.average)}.` : "";
    },
};

/* ============================================================
   VOUCHER & PROMO
   ============================================================ */
export const vouchersPromos = {
    id: "vouchers-promos",
    title: "Voucher & Promo",
    tagline: "Hanya voucher yang relevan — dan langsung dicek cocok tidaknya untuk keranjangmu.",
    tone: "gold",
    load: async () => ({ list: coupons(), cart: getCart() }),
    hero: (d) => {
        const usable = d.list.filter((v) => voucherFit(v, d.cart.total).usable);
        return { value: d.list.length ? `${d.list.length} voucher tersedia` : "Belum ada voucher", note: d.cart.count ? `${usable.length} bisa dipakai untuk keranjangmu` : "Keranjangmu kosong" };
    },
    tools: [
        {
            id: "wallet", title: "Dompet voucher", desc: "Klaim & salin kode", icon: "vouchers-promos",
            badge: (d) => String(d.list.length || ""),
            render(body, d, api) {
                if (!d.list.length) return body.append(ui.empty("Belum ada voucher", "Voucher dari toko akan muncul di sini. Cek juga kotak hadiah di beranda."));
                body.append(el("div", "bx-vouchers", d.list.map((v) => {
                    const f = voucherFit(v, d.cart.total);
                    const copy = ui.btn(v.claimed ? "Salin kode" : "Klaim & salin", async () => {
                        let claimed = [];
                        try {
                            claimed = JSON.parse(localStorage.getItem("kantoong:claimed-coupons") || "[]");
                        } catch { /* kosong */ }
                        if (!claimed.includes(v.code)) localStorage.setItem("kantoong:claimed-coupons", JSON.stringify([...claimed, v.code]));
                        copy.textContent = (await copyText(v.code)) ? "Disalin ✓" : v.code;
                        api.toast(`Kode ${v.code} siap dipakai saat checkout`);
                    }, "bx-btn bx-btn--sm");
                    return el("article", `bx-voucher${f.usable ? " is-usable" : ""}`,
                        el("div", "bx-voucher__left", el("strong", "", v.title || v.code), el("span", "", v.text || ""), el("code", "", v.code)),
                        el("div", "bx-voucher__right", f.usable && d.cart.count ? el("span", "bx-pill", "Pas untuk keranjang") : f.short ? el("small", "", `Kurang ${shortRupiah(f.short)}`) : null, v.ends_at ? el("small", "", `s.d. ${fmtDate(v.ends_at)}`) : null, copy));
                })));
            },
        },
        {
            id: "for-cart", title: "Cocok untuk keranjangmu", desc: "Dicek otomatis dengan total keranjang", icon: "check",
            render(body, d, api) {
                if (!d.cart.count) return body.append(ui.empty("Keranjang kosong", "Masukkan barang dulu, lalu cek voucher yang pas di sini.", ui.btn("Lihat katalog", () => api.openFeature("product-catalog"))));
                const rows = d.list.map((v) => {
                    const f = voucherFit(v, d.cart.total);
                    return ui.row(f.usable ? "check" : "lock", `${v.code} · ${v.title || ""}`, f.usable ? "Bisa dipakai sekarang" : f.expired ? "Sudah hangus" : `Tambah ${rupiah(f.short)} lagi agar bisa dipakai`);
                });
                body.append(el("p", "", `Total keranjang: `, el("strong", "", rupiah(d.cart.total))), ui.list(rows), ui.btn("Buka keranjang", api.openCart, "bx-btn bx-btn--ghost"));
            },
        },
        {
            id: "mystery", title: "Kotak hadiah", desc: "Kesempatan harian di beranda toko", icon: "sparkle",
            render(body) {
                let last = null;
                try {
                    last = JSON.parse(localStorage.getItem("kantoong:jackpot") || "null");
                } catch { /* kosong */ }
                body.append(el("p", "", last?.label ? `Terakhir kamu dapat: ` : "Belum membuka kotak hadiah hari ini.", last?.label ? el("strong", "", last.label) : null), ui.note("Kotak hadiah ada di beranda toko, bisa dibuka 1× sehari per perangkat."));
            },
        },
    ],
    snapshot: (d) => (d.list.length ? `Voucher: ${d.list.map((v) => `${v.code}${v.min_purchase ? ` min ${v.min_purchase}` : ""}${v.ends_at ? ` s.d. ${v.ends_at}` : ""}`).join(", ")}. Total keranjang ${rupiah(d.cart.total)}.` : "Tidak ada voucher."),
};

/* ============================================================
   POIN MEMBER (level dari belanja sah — tanpa angka karangan)
   ============================================================ */
export const membership = {
    id: "membership",
    title: "Poin Member",
    tagline: "Level naik dari belanja sungguhan, online maupun di kasir toko.",
    tone: "gold",
    load: orders,
    hero: (d) => {
        if (!d.signedIn) return { value: "Level Teman", note: "Masuk agar belanjamu terhitung" };
        const total = d.orders.filter(VALID).reduce((s, o) => s + (Number(o.total) || 0), 0);
        const m = memberLevel(total);
        return { value: `Level ${m.level.label}`, note: m.next ? `${rupiah(m.toNext)} lagi menuju ${m.next.label}` : "Level tertinggi" };
    },
    tools: [
        {
            id: "level", title: "Levelku", desc: "Kemajuan menuju level berikutnya", icon: "membership",
            render(body, d) {
                const total = d.signedIn ? d.orders.filter(VALID).reduce((s, o) => s + (Number(o.total) || 0), 0) : 0;
                const m = memberLevel(total);
                body.append(el("p", "bx-big", m.level.label), meter(m.pct, "ok"), el("p", "", m.next ? `${rupiah(m.toNext)} lagi menuju ${m.next.label}.` : "Kamu di level tertinggi."),
                    ui.list(LEVELS.map((l) => ui.row(total >= l.min ? "check" : "lock", l.label, l.min ? `mulai ${rupiah(l.min)}` : "level awal"))));
            },
        },
        {
            id: "how", title: "Cara dapat poin", desc: "Belanja online, kasir toko, ulasan", icon: "sparkle",
            render(body) {
                body.append(el("ol", "bx-steps",
                    el("li", "", "Belanja online dengan akun yang sama — otomatis terhitung."),
                    el("li", "", "Belanja di toko: sebutkan nomor HP-mu ke kasir (member kasir)."),
                    el("li", "", "Tukar poin langsung di kasir toko.")), ui.note("Poin kasir & online menyatu di buku besar yang sama (siap lintas brand Kantoong, dengan izinmu)."));
            },
        },
    ],
    snapshot: (d) => {
        if (!d.signedIn) return "";
        const total = d.orders.filter(VALID).reduce((s, o) => s + (Number(o.total) || 0), 0);
        const m = memberLevel(total);
        return `Level ${m.level.label}${m.next ? `, kurang ${rupiah(m.toNext)} ke ${m.next.label}` : ""}.`;
    },
};
