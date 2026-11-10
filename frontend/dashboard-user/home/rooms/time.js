/**
 * KANTOONG — RUANG: Kalender · Hitung Mundur · Lokasi Toko · Takeaway · Antrean
 * File: frontend/dashboard-user/home/rooms/time.js
 */

import { ui } from "../room.js";
import { addMe, clean, listMe, readMe, removeMe, writeMe } from "../me-store.js";
import { collectCountdowns, countdownText, earliestPickup, isoDay, monthGrid, parseDay, queueWait, toIcs, upcomingEvents } from "../room-logic.js";
import { cartItems, coupons, download, el, fmtDate, fmtTime, icon, orders, products, rupiah, storeContact, waLink } from "./shared.js";

/** Semua acara: buatan pengguna + tanggal dari alasan keranjang + voucher. */
function allEvents() {
    const own = listMe("events");
    const fromCart = cartItems().filter((it) => it.reason?.date).map((it) => ({ id: `cart-${it.id}`, title: `${it.reason.text || "Rencana"}: ${it.name}`, date: it.reason.date, kind: "keranjang" }));
    const fromVoucher = coupons().filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v.ends_at)).map((v) => ({ id: `v-${v.code}`, title: `Voucher ${v.code} berakhir`, date: v.ends_at, kind: "voucher" }));
    return [...own, ...fromCart, ...fromVoucher];
}

/* ============================================================
   KALENDER
   ============================================================ */
export const calendar = {
    id: "calendar",
    title: "Kalender",
    tagline: "Ulang tahun orang terdekat & rencana belanjamu — diingatkan sebelum terlambat.",
    tone: "light",
    load: async () => ({ events: allEvents() }),
    hero: (d) => {
        const next = upcomingEvents(d.events, Date.now(), 365)[0];
        return { value: next ? next.title : "Belum ada acara", note: next ? (next.days === 0 ? "Hari ini" : `${next.days} hari lagi · ${fmtDate(next.at)}`) : "Tambahkan ulang tahun & acara penting" };
    },
    tools: [
        {
            id: "month", title: "Bulan ini", desc: "Tampilan kalender dengan tanda acara", icon: "calendar",
            render(body, d) {
                const now = new Date();
                let y = now.getFullYear();
                let m = now.getMonth();
                const wrap = el("div", "bx-cal");
                const draw = () => {
                    const marks = new Map();
                    d.events.forEach((e) => {
                        const at = e.repeat === "yearly" ? new Date(y, new Date(parseDay(e.date)).getMonth(), new Date(parseDay(e.date)).getDate()).getTime() : parseDay(e.date);
                        if (Number.isFinite(at)) marks.set(isoDay(at), [...(marks.get(isoDay(at)) ?? []), e.title]);
                    });
                    const today = isoDay(Date.now());
                    const prev = ui.btn("‹", () => { m -= 1; if (m < 0) { m = 11; y -= 1; } draw(); }, "bx-cal__nav");
                    const next = ui.btn("›", () => { m += 1; if (m > 11) { m = 0; y += 1; } draw(); }, "bx-cal__nav");
                    wrap.replaceChildren(
                        el("header", "bx-cal__head", prev, el("strong", "", new Date(y, m, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" })), next),
                        el("div", "bx-cal__grid", ["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mg"].map((dname) => el("span", "bx-cal__dow", dname)),
                            monthGrid(y, m).map((c) => {
                                const has = marks.get(c.key);
                                const cell = el("span", `bx-cal__day${c.inMonth ? "" : " is-out"}${c.key === today ? " is-today" : ""}${has ? " has-event" : ""}`, String(c.d));
                                if (has) cell.title = has.join(", ");
                                return cell;
                            })));
                };
                draw();
                const list = upcomingEvents(d.events, Date.now(), 60);
                body.append(wrap, el("h4", "bx-h", "60 hari ke depan"), list.length ? ui.list(list.map((e) => ui.row(e.kind === "ultah" ? "wishlist" : e.kind === "voucher" ? "vouchers-promos" : "calendar", e.title, e.days === 0 ? "Hari ini" : `${fmtDate(e.at)} · ${e.days} hari lagi`))) : el("p", "bx-muted", "Belum ada acara dalam 60 hari."));
            },
        },
        {
            id: "add", title: "Tambah acara / ulang tahun", desc: "Ulang tahun berulang tiap tahun", icon: "plus",
            render(body, d) {
                const own = listMe("events");
                body.append(ui.form([
                    { name: "title", label: "Nama acara", placeholder: "Contoh: Ulang tahun Mama", required: true, max: 60 },
                    { name: "date", label: "Tanggal", type: "date", required: true },
                    { name: "kind", label: "Jenis", type: "select", options: [{ value: "ultah", label: "Ulang tahun (tiap tahun)" }, { value: "acara", label: "Acara sekali" }] },
                ], (v, f) => {
                    if (!Number.isFinite(parseDay(v.date))) return;
                    addMe("events", { title: clean(v.title, 60), date: v.date, kind: v.kind === "ultah" ? "ultah" : "acara", repeat: v.kind === "ultah" ? "yearly" : "" }, { max: 200 });
                    f.reset();
                }, "Simpan"), own.length ? el("h4", "bx-h", "Buatanku") : null, own.length ? ui.list(own.map((e) => ui.row(e.kind === "ultah" ? "wishlist" : "calendar", e.title, fmtDate(parseDay(e.date)), ui.btn(icon("close"), () => removeMe("events", e.id), "bx-row__x")))) : null);
            },
        },
        {
            id: "export", title: "Ekspor ke Google Calendar", desc: "Unduh file .ics, lalu impor", icon: "data-export",
            render(body, d) {
                body.append(el("p", "", `${d.events.length} acara siap diekspor.`), ui.btn("Unduh kalender (.ics)", () => download("kalender-kantoong.ics", toIcs(d.events, { brand: storeContact().name }), "text/calendar")), ui.note("Buka Google Calendar › Setelan › Impor, lalu pilih file ini."));
            },
        },
    ],
    snapshot: (d) => {
        const list = upcomingEvents(d.events, Date.now(), 30).slice(0, 6);
        return list.length ? `Acara 30 hari ke depan: ${list.map((e) => `${e.title} (${e.days === 0 ? "hari ini" : `${e.days} hari lagi`})`).join("; ")}.` : "Tidak ada acara 30 hari ke depan.";
    },
};

/* ============================================================
   HITUNG MUNDUR (dulu "Jam")
   ============================================================ */
const ZONES = [["WIB", "Asia/Jakarta"], ["WITA", "Asia/Makassar"], ["WIT", "Asia/Jayapura"], ["Singapura", "Asia/Singapore"], ["Tokyo", "Asia/Tokyo"], ["London", "Europe/London"]];

async function tickers() {
    const now = Date.now();
    const src = [];
    upcomingEvents(allEvents(), now, 60).forEach((e) => src.push({ id: e.id, label: e.title, at: e.at, feature: "calendar" }));
    const { orders: list = [] } = await orders();
    list.filter((o) => o.status === "dikirim" && Number.isFinite(Date.parse(o.shipping_eta))).forEach((o) => src.push({ id: o.id, label: `Paket ${o.order_code} tiba`, at: Date.parse(o.shipping_eta), feature: "package-tracking" }));
    const take = readMe("takeaway", null);
    if (take?.readyAt) src.push({ id: "takeaway", label: "Takeaway siap diambil", at: take.readyAt, feature: "takeaway-ordering" });
    listMe("timers").forEach((t) => src.push({ id: t.id, label: t.label, at: t.at, feature: "clock", own: true }));
    return collectCountdowns(src, now);
}

export const clock = {
    id: "clock",
    title: "Hitung Mundur",
    tagline: "Semua yang berdetak dalam satu layar: paket, acara, voucher, takeaway.",
    tone: "ink",
    load: async () => ({ list: await tickers() }),
    hero: (d) => ({ value: d.list[0] ? d.list[0].left : "Tidak ada yang berdetak", note: d.list[0] ? d.list[0].label : "Tambahkan hitung mundurmu sendiri" }),
    tools: [
        {
            id: "all", title: "Yang sedang berdetak", desc: "Urut dari yang paling dekat", icon: "clock",
            badge: (d) => String(d.list.length || ""),
            render(body, d, api) {
                if (!d.list.length) return body.append(ui.empty("Belum ada", "Acara kalender, paket di jalan, dan takeaway otomatis muncul di sini."));
                const ul = ui.list([]);
                const draw = () => {
                    if (!body.isConnected) return clearInterval(t);
                    ul.replaceChildren(...d.list.map((x) => ui.row(x.feature === "clock" ? "clock" : x.feature, x.label, fmtDate(x.at, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }), el("strong", "bx-row__meta", countdownText(x.at)))));
                };
                const t = setInterval(draw, 30_000);
                draw();
                body.append(ul);
                ul.addEventListener("click", (e) => {
                    const i = [...ul.children].indexOf(e.target.closest("li"));
                    const x = d.list[i];
                    if (x && x.feature !== "clock") api.openFeature(x.feature);
                });
            },
        },
        {
            id: "mine", title: "Hitung mundur buatanku", desc: "Flash sale incaran, gajian, liburan…", icon: "plus",
            render(body) {
                const own = listMe("timers");
                body.append(own.length ? ui.list(own.map((t) => ui.row("clock", t.label, `${fmtDate(t.at)} · ${countdownText(t.at)}`, ui.btn(icon("close"), () => removeMe("timers", t.id), "bx-row__x")))) : null,
                    ui.form([{ name: "label", label: "Untuk apa", required: true, max: 50 }, { name: "at", label: "Kapan", type: "datetime-local", required: true }], (v, f) => {
                        const at = Date.parse(v.at);
                        if (!Number.isFinite(at)) return;
                        addMe("timers", { label: clean(v.label, 50), at }, { max: 30 });
                        f.reset();
                    }, "Tambah"));
            },
        },
        {
            id: "world", title: "Jam dunia", desc: "WIB, WITA, WIT & kota luar negeri", icon: "localization",
            render(body) {
                const big = el("p", "bx-bigclock");
                const list = el("div", "bx-zones");
                const tick = () => {
                    if (!body.isConnected) return clearInterval(timer);
                    const now = new Date();
                    big.textContent = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                    list.replaceChildren(...ZONES.map(([label, tz]) => el("div", "bx-zone", el("span", "", label), el("strong", "", now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: tz })))));
                };
                const timer = setInterval(tick, 1000);
                tick();
                body.append(big, list);
            },
        },
    ],
    snapshot: (d) => (d.list.length ? `Hitung mundur: ${d.list.slice(0, 5).map((x) => `${x.label} ${x.left}`).join("; ")}.` : ""),
};

/* ============================================================
   LOKASI TOKO
   ============================================================ */
export const storeMap = {
    id: "store-map",
    title: "Lokasi Toko",
    tagline: "Cek stok sebelum berangkat — jangan sampai datang, barangnya habis.",
    tone: "light",
    load: async () => ({ info: storeContact(), products: await products() }),
    hero: (d) => ({ value: d.info.city || d.info.address ? `${d.info.name} · ${d.info.city || ""}` : d.info.name, note: d.info.hours ? `Jam buka: ${d.info.hours}` : "Jam buka belum diisi pemilik toko" }),
    tools: [
        {
            id: "visit", title: "Alamat & rute", desc: "Buka di Google Maps", icon: "store-map",
            render(body, d) {
                const q = encodeURIComponent([d.info.name, d.info.address, d.info.city].filter(Boolean).join(" "));
                const maps = /^https:\/\//.test(d.info.maps ?? "") ? d.info.maps : `https://www.google.com/maps/search/?api=1&query=${q}`;
                body.append(el("div", "bx-map bx-map--big", el("span", "bx-map__pin", icon("shipping-address", "bx-icon"))),
                    el("p", "", d.info.address ? `${d.info.address}${d.info.city ? `, ${d.info.city}` : ""}` : "Alamat toko akan tampil setelah diisi pemilik toko."),
                    el("div", "bx-actions", ui.link("Buka di Google Maps", maps, "bx-btn"), waLink("Halo, saya mau tanya lokasi toko.") ? ui.link("Chat WhatsApp", waLink("Halo, saya mau tanya lokasi toko.")) : null));
            },
        },
        {
            id: "stock", title: "Cek stok sebelum datang", desc: "Cari produk, lihat ketersediaan", icon: "search",
            render(body, d) {
                const input = el("input", "bx-input");
                input.type = "search";
                input.placeholder = "Ketik nama produk…";
                const out = ui.list([]);
                const draw = () => {
                    const q = input.value.trim().toLowerCase();
                    const hits = q ? d.products.filter((p) => String(p.name).toLowerCase().includes(q)).slice(0, 8) : [];
                    out.replaceChildren(...hits.map((p) => {
                        const s = p.stock;
                        const label = s === null || s === undefined ? "Tersedia" : Number(s) <= 0 ? "Habis" : Number(s) <= 5 ? `Sisa ${s}` : "Tersedia";
                        return ui.row(Number(s) <= 0 ? "lock" : "check", p.name, rupiah(p.price), el("span", `bx-pill${Number(s) <= 0 ? " is-bad" : ""}`, label));
                    }));
                };
                input.addEventListener("input", draw);
                body.append(input, out, ui.note("Stok = stok toko online saat ini. Untuk cabang tertentu, tanyakan lewat WhatsApp."));
            },
        },
        {
            id: "pickup", title: "Ambil di toko", desc: "Pesan dulu, ambil tanpa antre", icon: "takeaway-ordering",
            render(body, d, api) {
                body.append(el("p", "", "Pesan lewat menu Takeaway, pilih jam ambil, lalu datang tepat waktu."), ui.btn("Buka Takeaway", () => api.openFeature("takeaway-ordering")));
            },
        },
    ],
    snapshot: (d) => `Toko ${d.info.name}${d.info.address ? `, ${d.info.address}` : ""}${d.info.hours ? `, buka ${d.info.hours}` : ""}.`,
};

/* ============================================================
   TAKEAWAY
   ============================================================ */
export const takeaway = {
    id: "takeaway-ordering",
    title: "Takeaway",
    tagline: "Pesan dari mana saja, ambil saat sudah jadi — tanpa menunggu di kasir.",
    tone: "ink",
    load: async () => ({ current: readMe("takeaway", null), products: await products() }),
    hero: (d) => (d.current?.readyAt && d.current.readyAt > Date.now()
        ? { value: `Siap ${fmtTime(d.current.readyAt)}`, note: `${countdownText(d.current.readyAt)} lagi · ${d.current.items.length} item` }
        : { value: "Pesan untuk dibawa pulang", note: "Pilih menu & jam ambil" }),
    tools: [
        {
            id: "order", title: "Buat pesanan takeaway", desc: "Pilih menu, jam ambil, kirim ke toko", icon: "takeaway-ordering",
            render(body, d, api) {
                const picked = new Map();
                const list = el("div", "bx-pick");
                const total = el("strong", "");
                const sync = () => {
                    total.textContent = rupiah([...picked.values()].reduce((s, x) => s + x.p.price * x.q, 0));
                };
                d.products.slice(0, 24).forEach((p) => {
                    const qty = el("span", "bx-pick__qty", "0");
                    const set = (n) => {
                        const q = Math.max(0, Math.min(20, n));
                        if (q) picked.set(p.id, { p, q });
                        else picked.delete(p.id);
                        qty.textContent = String(q);
                        sync();
                    };
                    list.append(el("div", "bx-pick__row", el("span", "", p.name, el("small", "", rupiah(p.price))), ui.btn("−", () => set((picked.get(p.id)?.q ?? 0) - 1), "bx-pick__btn"), qty, ui.btn("+", () => set((picked.get(p.id)?.q ?? 0) + 1), "bx-pick__btn")));
                });
                const earliest = earliestPickup(Date.now(), 15);
                const time = el("input", "bx-input");
                time.type = "time";
                time.value = fmtTime(earliest).replace(".", ":");
                const send = ui.btn("Kirim pesanan via WhatsApp", () => {
                    if (!picked.size) return api.toast("Pilih minimal 1 menu dulu.");
                    const [hh, mm] = time.value.split(":").map(Number);
                    const at = new Date();
                    at.setHours(hh || 0, mm || 0, 0, 0);
                    const readyAt = Math.max(at.getTime(), earliest);
                    const items = [...picked.values()].map((x) => ({ name: x.p.name, qty: x.q, price: x.p.price }));
                    writeMe("takeaway", { items, readyAt, at: Date.now() });
                    const text = `Halo, saya pesan takeaway untuk diambil jam ${fmtTime(readyAt)}:\n${items.map((x) => `- ${x.qty}× ${x.name}`).join("\n")}`;
                    const link = waLink(text);
                    if (link) window.open(link, "_blank", "noopener");
                    else api.toast("Nomor WhatsApp toko belum diisi pemilik toko.");
                });
                sync();
                body.append(list, el("label", "bx-form__field", el("span", "", "Jam ambil (paling cepat " + fmtTime(earliest) + ")"), time), el("p", "", "Total: ", total), send, ui.note("Pesan disiapkan — kamu sendiri yang menekan kirim. Pembayaran di toko saat mengambil."));
            },
        },
        {
            id: "status", title: "Pesanan takeaway-ku", desc: "Hitung mundur jam ambil", icon: "clock",
            render(body, d) {
                const c = d.current;
                if (!c?.items?.length) return body.append(ui.empty("Belum ada pesanan takeaway", "Pesananmu dan jam ambilnya tampil di sini."));
                body.append(el("p", "bx-big", c.readyAt > Date.now() ? countdownText(c.readyAt) : "Siap diambil"), el("p", "", `Jam ambil ${fmtTime(c.readyAt)}`), ui.list(c.items.map((x) => ui.row("takeaway-ordering", `${x.qty}× ${x.name}`, rupiah(x.price * x.qty)))), ui.btn("Selesai / hapus", () => writeMe("takeaway", null), "bx-btn bx-btn--ghost"));
            },
        },
    ],
    snapshot: (d) => (d.current?.items?.length ? `Takeaway ${d.current.items.map((x) => `${x.qty}× ${x.name}`).join(", ")}, ambil ${fmtTime(d.current.readyAt)}.` : ""),
};

/* ============================================================
   ANTREAN
   ============================================================ */
export const queue = {
    id: "queue-management",
    title: "Antrean",
    tagline: "Pegang nomormu, jalan-jalan dulu — kami hitungkan kapan giliranmu.",
    tone: "light",
    load: async () => ({ ticket: readMe("queue", null) }),
    hero: (d) => {
        const w = d.ticket ? queueWait(d.ticket.mine, d.ticket.serving, d.ticket.avg) : null;
        return w ? { value: `Nomor ${d.ticket.mine}`, note: w.text } : { value: "Belum ada nomor antrean", note: "Masukkan nomor dari struk/layar toko" };
    },
    tools: [
        {
            id: "my-number", title: "Nomor antreanku", desc: "Dari struk kasir atau layar antrean", icon: "queue-management",
            render(body, d) {
                const t = d.ticket;
                if (t) {
                    const w = queueWait(t.mine, t.serving, t.avg);
                    body.append(el("p", "bx-big", `#${t.mine}`), el("p", "", w?.text ?? ""),
                        ui.form([{ name: "serving", label: "Nomor yang sedang dilayani sekarang", type: "number", min: 0, value: t.serving }], (v) => writeMe("queue", { ...t, serving: Math.max(0, Number(v.serving) || 0), updated: Date.now() }), "Perbarui"),
                        ui.btn("Selesai / hapus nomor", () => writeMe("queue", null), "bx-btn bx-btn--ghost"));
                    return;
                }
                body.append(ui.form([
                    { name: "mine", label: "Nomor antreanku", type: "number", min: 1, required: true },
                    { name: "serving", label: "Sedang dilayani", type: "number", min: 0, value: 0 },
                    { name: "avg", label: "Perkiraan menit per orang", type: "number", min: 1, value: 4 },
                ], (v) => writeMe("queue", { mine: Math.max(1, Number(v.mine) || 1), serving: Math.max(0, Number(v.serving) || 0), avg: Math.max(1, Number(v.avg) || 4), at: Date.now() }), "Simpan nomor"));
            },
        },
        {
            id: "tips", title: "Antre lebih cerdas", desc: "Kapan datang supaya tidak menunggu", icon: "sparkle",
            render(body, d, api) {
                body.append(el("ol", "bx-steps", el("li", "", "Pesan lewat Takeaway: tidak perlu antre kasir."), el("li", "", "Di toko, nomor antrean juga tampil di layar antrean dapur/bar."), el("li", "", "Perbarui nomor yang dilayani — perkiraan waktu ikut menyesuaikan.")), ui.btn("Buka Takeaway", () => api.openFeature("takeaway-ordering"), "bx-btn bx-btn--ghost"));
            },
        },
    ],
    snapshot: (d) => (d.ticket ? `Antrean nomor ${d.ticket.mine}, dilayani ${d.ticket.serving}.` : ""),
};

export { allEvents };
