/**
 * KANTOONG — RUANG: Pesanan Saya · Lacak Paket · Riwayat Transaksi · Alamat Pengiriman
 * File: frontend/dashboard-user/home/rooms/orders.js
 */

import { ui } from "../room.js";
import { orderCard } from "../details.js";
import { getLastReceipt } from "../home-data.js";
import { addMe, clean, listMe, readMe, removeMe, updateMe, writeMe } from "../me-store.js";
import { collectCountdowns, countdownText, daysUntil, parseDay } from "../room-logic.js";
import { ORDER_LABEL, cartItems, el, fmtDate, icon, orders, rupiah, signInNote, waLink } from "./shared.js";

const ACTIVE = (o) => !["selesai", "dibatalkan"].includes(o.status);
const signIn = (api, text) => ui.empty("Masuk dulu, ya", text, ui.btn("Masuk ke akun", () => api.openFeature("profile")));

/* ============================================================
   PESANAN SAYA
   ============================================================ */
export const myOrders = {
    id: "my-orders",
    title: "Pesanan Saya",
    tagline: "Setiap pesanan menunjukkan langkah berikutnya — kamu tidak perlu menebak.",
    tone: "light",
    load: orders,
    hero: (d) => {
        if (!d.signedIn) return { value: "Masuk untuk melihat pesanan", note: signInNote };
        const active = d.orders.filter(ACTIVE).length;
        return { value: active ? `${active} pesanan berjalan` : "Semua pesanan beres", note: `${d.orders.length} pesanan sepanjang waktu` };
    },
    tools: [
        {
            id: "active", title: "Sedang berjalan", desc: "Status terkini & linimasa tiap pesanan", icon: "my-orders",
            badge: (d) => String(d.orders?.filter(ACTIVE).length || ""),
            render(body, d, api) {
                if (!d.signedIn) return body.append(signIn(api, "Pesananmu tersimpan rapi di sini setelah masuk."));
                const list = d.orders.filter(ACTIVE);
                body.append(...(list.length ? list.map((o) => orderCard(o, { detail: true })) : [ui.empty("Tidak ada pesanan berjalan", "Pesanan baru akan muncul di sini lengkap dengan statusnya.", ui.btn("Mulai belanja", () => api.openFeature("product-catalog")))]));
            },
        },
        {
            id: "need-action", title: "Butuh tindakanmu", desc: "Menunggu pembayaran / konfirmasi terima", icon: "check",
            badge: (d) => String(d.orders?.filter((o) => o.status === "menunggu_pembayaran").length || ""),
            render(body, d, api) {
                if (!d.signedIn) return body.append(signIn(api, "Masuk untuk melihat pesanan yang menunggu tindakanmu."));
                const pay = d.orders.filter((o) => o.status === "menunggu_pembayaran");
                if (!pay.length) return body.append(ui.empty("Tidak ada yang menunggu", "Semua pesananmu tidak butuh tindakan saat ini."));
                body.append(...pay.map((o) => orderCard(o)), ui.note("Pembayaran selalu kamu lakukan sendiri. Asisten tidak pernah membayar atas namamu."));
            },
        },
        {
            id: "done", title: "Selesai & dibatalkan", desc: "Arsip pesanan lama", icon: "transaction-history",
            badge: (d) => String(d.orders?.filter((o) => !ACTIVE(o)).length || ""),
            render(body, d, api) {
                if (!d.signedIn) return body.append(signIn(api, "Arsip pesananmu tampil setelah masuk."));
                const list = d.orders.filter((o) => !ACTIVE(o));
                body.append(...(list.length ? list.map((o) => orderCard(o)) : [ui.empty("Belum ada arsip", "Pesanan yang selesai akan tersimpan di sini.")]));
            },
        },
        {
            id: "purpose", title: "Per tujuan", desc: "Kado vs pribadi, dari alasan di keranjangmu", icon: "sparkle",
            render(body) {
                const items = cartItems().filter((it) => it.reason);
                if (!items.length) return body.append(ui.empty("Belum ada alasan tersimpan", "Saat memasukkan barang ke keranjang, ketuk “Ingat alasannya”. Barang akan dikelompokkan per tujuan di sini."));
                const groups = new Map();
                items.forEach((it) => {
                    const key = clean(it.reason.text || "Tanpa nama", 40);
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key).push(it);
                });
                groups.forEach((list, key) => body.append(el("h4", "bx-h", key), ui.list(list.map((it) => ui.row("product-catalog", it.name, it.reason.date ? `untuk ${fmtDate(parseDay(it.reason.date))}` : "", el("span", "bx-row__meta", rupiah(it.price * it.qty)))))));
            },
        },
    ],
    snapshot: (d) => {
        if (!d.signedIn) return "Belum masuk akun (pesanan tidak terlihat).";
        const active = d.orders.filter(ACTIVE).slice(0, 5).map((o) => `${o.order_code}: ${ORDER_LABEL[o.status] ?? o.status}, ${rupiah(o.total)}${o.shipping_eta ? `, tiba ${o.shipping_eta}` : ""}`);
        return `${d.orders.length} pesanan total. Aktif: ${active.join("; ") || "tidak ada"}.`;
    },
};

/* ============================================================
   LACAK PAKET
   ============================================================ */
const SHIPPING = (o) => ["dibayar", "diproses", "dikirim"].includes(o.status);

export const packageTracking = {
    id: "package-tracking",
    title: "Lacak Paket",
    tagline: "Satu tempat untuk semua paket di jalan — lengkap resi & perkiraan tiba.",
    tone: "ink",
    load: orders,
    hero: (d) => {
        const list = d.orders?.filter(SHIPPING) ?? [];
        if (!d.signedIn) return { value: "Masuk untuk melacak", note: signInNote };
        const moving = list.filter((o) => o.status === "dikirim");
        return { value: list.length ? `${list.length} paket dalam proses` : "Tidak ada paket di jalan", note: moving[0]?.shipping_eta ? `Terdekat: ${moving[0].shipping_eta}` : "Resi muncul begitu dikirim" };
    },
    tools: [
        {
            id: "on-the-way", title: "Di perjalanan", desc: "Kurir, resi (ketuk untuk salin) & tahap", icon: "package-tracking",
            badge: (d) => String(d.orders?.filter(SHIPPING).length || ""),
            render(body, d, api) {
                if (!d.signedIn) return body.append(signIn(api, "Masuk untuk melihat posisi paketmu."));
                const list = d.orders.filter(SHIPPING);
                body.append(...(list.length ? list.map((o) => orderCard(o, { detail: true })) : [ui.empty("Tidak ada paket di jalan", "Begitu pesananmu dikirim, nomor resi & tahapnya tampil di sini.")]));
            },
        },
        {
            id: "remind", title: "Pengingat di web", desc: "Tampilkan hitung mundur tiba di Sinyal", icon: "clock",
            render(body) {
                const on = readMe("track-remind", true);
                const t = ui.btn(on ? "Pengingat aktif ✓" : "Aktifkan pengingat", () => {
                    writeMe("track-remind", !on);
                }, on ? "bx-btn bx-btn--ghost" : "bx-btn");
                body.append(el("p", "", "Paket yang sedang dikirim muncul di strip “Mungkin kamu butuh ini” dan di Hitung Mundur."), t, ui.note("Pengingat hanya tampil di dalam web ini — tidak ada SMS/WhatsApp otomatis."));
            },
        },
        {
            id: "problem", title: "Lapor masalah", desc: "Paket telat, rusak, atau salah kirim", icon: "customer-support",
            render(body, d) {
                const options = (d.orders ?? []).filter((o) => o.status !== "dibatalkan").slice(0, 10).map((o) => ({ value: o.order_code, label: `${o.order_code} · ${ORDER_LABEL[o.status] ?? o.status}` }));
                if (!options.length) return body.append(ui.empty("Belum ada pesanan", "Lapor masalah tersedia untuk pesanan yang sudah kamu buat."));
                body.append(ui.form([
                    { name: "order", label: "Pesanan", type: "select", options },
                    { name: "issue", label: "Masalahnya", type: "select", options: ["Paket belum sampai", "Barang rusak", "Salah barang / ukuran", "Kurang jumlah", "Lainnya"] },
                    { name: "note", label: "Ceritakan singkat", type: "textarea", max: 300 },
                ], (v) => {
                    addMe("tickets", { order: clean(v.order, 40), issue: clean(v.issue, 40), note: clean(v.note, 300), at: Date.now(), status: "Dikirim lewat WhatsApp" });
                    const link = waLink(`Halo, saya mau lapor masalah pesanan ${v.order}: ${v.issue}. ${v.note}`);
                    if (link) window.open(link, "_blank", "noopener");
                }, "Kirim ke toko via WhatsApp"), ui.note("Pesan disiapkan, kamu sendiri yang menekan kirim di WhatsApp. Riwayatnya tersimpan di Customer Service › Tiketku."));
            },
        },
    ],
    snapshot: (d) => {
        if (!d.signedIn) return "";
        const list = d.orders.filter(SHIPPING).map((o) => `${o.order_code} ${ORDER_LABEL[o.status]}${o.courier_name ? ` via ${o.courier_name}` : ""}${o.tracking_number ? ` resi ${o.tracking_number}` : ""}${o.shipping_eta ? ` tiba ${o.shipping_eta}` : ""}`);
        return list.length ? list.join("; ") : "Tidak ada paket di jalan.";
    },
};

/* ============================================================
   RIWAYAT TRANSAKSI (+ Penjaga Garansi)
   ============================================================ */
export const transactionHistory = {
    id: "transaction-history",
    title: "Riwayat Transaksi",
    tagline: "Struk online & toko di satu tempat — plus penjaga garansi yang mengingatkanmu.",
    tone: "light",
    load: async () => ({ ...(await orders()), receipt: getLastReceipt(), warranties: listMe("warranties") }),
    hero: (d) => ({ value: d.signedIn ? `${d.orders.length} transaksi` : "Struk tersimpan di sini", note: d.warranties.length ? `${d.warranties.length} garansi dijaga` : "Belum ada garansi dicatat" }),
    tools: [
        {
            id: "receipts", title: "Struk belanja", desc: "Semua transaksi sah, bisa dicetak/PDF", icon: "transaction-history",
            badge: (d) => String(d.orders?.length || ""),
            render(body, d, api) {
                if (d.receipt) {
                    const r = d.receipt;
                    body.append(el("h4", "bx-h", "Struk terakhir di perangkat ini"), el("article", "bx-receipt",
                        el("header", "", el("strong", "", r.order_code ?? "Pesanan"), el("span", "", fmtDate(r.created_at ?? Date.now()))),
                        ...(r.items ?? []).map((it) => el("div", "bx-receipt__line", el("span", "", `${it.qty}× ${it.name}`), el("span", "", rupiah(it.subtotal ?? it.unit_price * it.qty)))),
                        el("footer", "", el("span", "", "Total"), el("strong", "", rupiah(r.total ?? 0)))));
                    body.append(ui.btn("Cetak / simpan PDF", () => window.print(), "bx-btn bx-btn--ghost"));
                }
                if (!d.signedIn) return body.append(signIn(api, "Struk semua pesananmu tersimpan setelah masuk."));
                const valid = d.orders.filter((o) => o.status !== "dibatalkan");
                body.append(el("h4", "bx-h", "Semua transaksi"), ui.list(valid.map((o) => ui.row("my-orders", o.order_code, `${fmtDate(o.created_at)} · ${ORDER_LABEL[o.status] ?? o.status}`, el("strong", "bx-row__meta", rupiah(o.total))))));
            },
        },
        {
            id: "warranty", title: "Penjaga Garansi", desc: "Catat garansi, diingatkan sebelum habis", icon: "check",
            badge: (d) => String(d.warranties.length || ""),
            render(body, d) {
                const now = Date.now();
                const rows = d.warranties.map((w) => {
                    const end = new Date(parseDay(w.bought));
                    end.setMonth(end.getMonth() + Number(w.months || 0));
                    const left = daysUntil(end.getTime(), now);
                    const x = ui.btn(icon("close"), () => removeMe("warranties", w.id), "bx-row__x");
                    x.setAttribute("aria-label", `Hapus ${w.item}`);
                    return ui.row("check", w.item, left >= 0 ? `Garansi habis ${fmtDate(end)} · ${left} hari lagi` : `Garansi habis ${fmtDate(end)}`, x);
                });
                body.append(rows.length ? ui.list(rows) : el("p", "bx-muted", "Belum ada garansi dicatat."),
                    el("h4", "bx-h", "Tambah garansi"),
                    ui.form([
                        { name: "item", label: "Barang", placeholder: "Contoh: Sepatu lari", required: true, max: 60 },
                        { name: "bought", label: "Tanggal beli", type: "date", required: true },
                        { name: "months", label: "Lama garansi (bulan)", type: "number", min: 1, value: 12 },
                    ], (v, form) => {
                        if (!Number.isFinite(parseDay(v.bought))) return;
                        addMe("warranties", { item: clean(v.item, 60), bought: v.bought, months: Math.min(120, Math.max(1, Number(v.months) || 12)) });
                        form.reset();
                    }, "Simpan garansi"));
            },
        },
    ],
    snapshot: (d) => {
        const w = d.warranties.map((x) => `${x.item} (beli ${x.bought}, ${x.months} bln)`).join("; ");
        return `${d.signedIn ? `${d.orders.length} transaksi.` : ""}${w ? ` Garansi: ${w}.` : ""}`;
    },
};

/* ============================================================
   ALAMAT PENGIRIMAN
   ============================================================ */
const LABELS = ["Rumah", "Kantor", "Kos", "Penerima kado", "Lainnya"];

export const shippingAddress = {
    id: "shipping-address",
    title: "Alamat Pengiriman",
    tagline: "Simpan alamat + catatan kurir sekali, termasuk alamat penerima kado.",
    tone: "light",
    load: async () => ({ list: listMe("addresses"), main: readMe("address-main", "") }),
    hero: (d) => {
        const main = d.list.find((a) => a.id === d.main) ?? d.list[0];
        return { value: d.list.length ? `${d.list.length} alamat tersimpan` : "Belum ada alamat", note: main ? `Utama: ${main.label} · ${main.city}` : "Tambahkan alamat pertamamu" };
    },
    tools: [
        {
            id: "list", title: "Alamatku", desc: "Pilih alamat utama, ubah, atau hapus", icon: "shipping-address",
            badge: (d) => String(d.list.length || ""),
            render(body, d) {
                if (!d.list.length) return body.append(ui.empty("Belum ada alamat", "Tambahkan alamat agar checkout lebih cepat. Tersimpan di perangkat ini."));
                body.append(ui.list(d.list.map((a) => {
                    const isMain = a.id === (d.main || d.list[0].id);
                    const actions = el("span", "bx-row__actions",
                        isMain ? el("span", "bx-pill", "Utama") : ui.btn("Jadikan utama", () => writeMe("address-main", a.id), "bx-btn bx-btn--ghost bx-btn--sm"),
                        ui.btn(icon("close"), () => removeMe("addresses", a.id), "bx-row__x"));
                    return ui.row(a.label === "Penerima kado" ? "wishlist" : "shipping-address", `${a.label} · ${a.name}`, `${a.street}, ${a.city}${a.note ? ` — catatan kurir: ${a.note}` : ""}`, actions);
                })));
            },
        },
        {
            id: "add", title: "Tambah alamat", desc: "Rumah, kantor, atau penerima kado", icon: "plus",
            render(body) {
                body.append(ui.form([
                    { name: "label", label: "Label", type: "select", options: LABELS },
                    { name: "name", label: "Nama penerima", required: true, max: 60 },
                    { name: "phone", label: "Nomor HP penerima", type: "tel", max: 20 },
                    { name: "street", label: "Alamat lengkap", type: "textarea", required: true, max: 200 },
                    { name: "city", label: "Kota / kecamatan", required: true, max: 60 },
                    { name: "note", label: "Catatan untuk kurir", placeholder: "Contoh: pagar hitam, titip satpam", max: 120 },
                ], (v, form) => {
                    addMe("addresses", { label: clean(v.label, 20), name: clean(v.name, 60), phone: clean(v.phone, 20).replace(/[^\d+]/g, ""), street: clean(v.street, 200), city: clean(v.city, 60), note: clean(v.note, 120) }, { max: 10 });
                    form.reset();
                }, "Simpan alamat"), ui.note("Disimpan di perangkat ini. Saat checkout, alamat utama terisi otomatis."));
            },
        },
        {
            id: "gift", title: "Kirim sebagai kado", desc: "Tips agar kejutan tetap rahasia", icon: "wishlist",
            render(body) {
                body.append(el("ol", "bx-steps",
                    el("li", "", "Simpan alamat dengan label ", el("strong", "", "Penerima kado"), "."),
                    el("li", "", "Saat checkout, pilih alamat itu & tulis di catatan: “Kado, jangan sertakan harga”."),
                    el("li", "", "Tandai tanggalnya di Kalender — Sinyal akan mengingatkanmu.")));
            },
        },
    ],
    snapshot: (d) => (d.list.length ? `Alamat tersimpan: ${d.list.map((a) => `${a.label} (${a.city})`).join(", ")}.` : "Belum ada alamat tersimpan."),
};

/** Untuk Hitung Mundur & Sinyal: paket berperkiraan tiba (bila ETA berupa tanggal). */
export function orderCountdowns(list, now = Date.now()) {
    return collectCountdowns((list ?? []).filter((o) => o.status === "dikirim" && Number.isFinite(Date.parse(o.shipping_eta))).map((o) => ({ id: o.id, label: `Paket ${o.order_code} tiba`, at: Date.parse(o.shipping_eta), feature: "package-tracking" })), now);
}

export { countdownText, updateMe };
