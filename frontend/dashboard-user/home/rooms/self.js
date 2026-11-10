/**
 * KANTOONG — RUANG: Kartu Diriku · Pengaturan · Ekspor Data · Bahasa & Wilayah ·
 *                    Riwayat Chat AI · Customer Service
 * File: frontend/dashboard-user/home/rooms/self.js
 */

import { ui } from "../room.js";
import { getChatSessions, getRecentIds, getWishlistIds } from "../home-data.js";
import { ME_PREFIX, addMe, allMeKeys, clean, listMe, readMe, removeMe, writeMe } from "../me-store.js";
import { convertSize, inferTraits } from "../room-logic.js";
import { renderAppearance } from "../../../js/appearance-panel.js";
import { LANGUAGES, activeLang, openLanguagePicker } from "../../../js/i18n.js";
import { consentLabel, getConsent, setConsent } from "../../../js/ai-consent.js";
import { getMemoryScope, setMemoryScope } from "../../../js/assistant-context.js";
import { download, el, fmtDate, icon, orders, products, storeContact, waLink } from "./shared.js";

function chatTexts() {
    const texts = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k?.startsWith("kantoong:chat:")) continue;
            const v = JSON.parse(localStorage.getItem(k) || "null");
            const msgs = Array.isArray(v) ? v : Array.isArray(v?.messages) ? v.messages : Array.isArray(v) ? v : [];
            const archive = k.endsWith(":archive") && Array.isArray(v) ? v.flatMap((s) => s.messages ?? []) : [];
            [...msgs, ...archive].forEach((m) => {
                if (m?.who === "user" || m?.role === "user") texts.push(String(m.text ?? m.content ?? ""));
            });
        }
    } catch {
        /* abaikan */
    }
    return texts.slice(-200);
}

/* ============================================================
   KARTU DIRIKU — "Yang AI tahu tentangku" (+ hapus per baris)
   ============================================================ */
export const myCard = {
    id: "my-card",
    title: "Kartu Diriku",
    tagline: "Platform lain menyembunyikan profilmu. Di sini kamu melihat — dan mengoreksi — semuanya.",
    tone: "gold",
    load: async () => {
        const traits = inferTraits({ products: await products(), wishlistIds: getWishlistIds(), recentIds: getRecentIds(), chatTexts: chatTexts(), suppressed: readMe("suppressed", []) });
        return { traits, sizes: readMe("sizes", {}), consent: getConsent(), scope: getMemoryScope() };
    },
    hero: (d) => ({ value: d.traits.length ? `${d.traits.length} hal yang kami pahami` : "Kami belum menebak apa pun", note: consentLabel(d.consent) }),
    tools: [
        {
            id: "traits", title: "Yang AI tahu tentangku", desc: "Setiap tebakan + sumbernya. Salah? Hapus.", icon: "sparkle",
            badge: (d) => String(d.traits.length || ""),
            render(body, d) {
                if (!d.traits.length) return body.append(ui.empty("Belum ada tebakan", "Setelah kamu melihat, menyimpan, atau ngobrol soal produk, selera yang terbaca akan tampil di sini — lengkap dengan sumbernya."));
                body.append(ui.list(d.traits.map((t) => ui.row("sparkle", `${t.label}: ${t.value}`, t.source, ui.btn("Bukan aku", () => writeMe("suppressed", [...readMe("suppressed", []), t.key]), "bx-btn bx-btn--ghost bx-btn--sm")))),
                    readMe("suppressed", []).length ? ui.btn("Pulihkan tebakan yang kuhapus", () => writeMe("suppressed", []), "bx-btn bx-btn--ghost") : null,
                    ui.note("Tebakan dihitung di perangkat ini dari aktivitasmu di toko ini saja."));
            },
        },
        {
            id: "sizes", title: "Paspor ukuran", desc: "Isi sekali, dipakai di semua brand Kantoong", icon: "profile",
            render(body, d) {
                const s = d.sizes;
                const shoe = convertSize("sepatu", s.shoe);
                const shirt = convertSize("baju", s.shirt);
                body.append(ui.stats(ui.stat("Baju", s.shirt || "—", shirt ? `EU ${shirt.EU} · UK ${shirt.UK}` : ""), ui.stat("Sepatu (EU)", s.shoe || "—", shoe ? `US ${shoe.US} · UK ${shoe.UK}` : ""), ui.stat("Tinggi / berat", s.height ? `${s.height} cm${s.weight ? ` · ${s.weight} kg` : ""}` : "—")),
                    ui.form([
                        { name: "shirt", label: "Ukuran baju", type: "select", options: ["", "XS", "S", "M", "L", "XL", "XXL", "3XL"], value: s.shirt ?? "" },
                        { name: "pants", label: "Ukuran celana (pinggang)", type: "number", min: 20, value: s.pants ?? "" },
                        { name: "shoe", label: "Ukuran sepatu (EU)", type: "number", min: 30, value: s.shoe ?? "" },
                        { name: "height", label: "Tinggi (cm)", type: "number", min: 50, value: s.height ?? "" },
                        { name: "weight", label: "Berat (kg)", type: "number", min: 10, value: s.weight ?? "" },
                    ], (v) => writeMe("sizes", { shirt: clean(v.shirt, 4), pants: Number(v.pants) || "", shoe: Number(v.shoe) || "", height: Number(v.height) || "", weight: Number(v.weight) || "" }), "Simpan ukuran"),
                    ui.note("Asisten memakai ukuran ini saat menyarankan produk (bila kamu mengizinkan)."));
            },
        },
        {
            id: "consent", title: "Izin & memori", desc: "Kendalikan apa yang boleh dibaca AI", icon: "lock",
            render(body, d) {
                const granted = d.consent?.status === "granted";
                body.append(
                    ui.row("lock", "AI membaca aktivitas dashboard", granted ? "Diizinkan — untuk jawaban & Sinyal pribadi" : "Tidak diizinkan — AI hanya tahu isi chat",
                        ui.btn(granted ? "Matikan" : "Izinkan", () => setConsent(granted ? "denied" : "granted"), granted ? "bx-btn bx-btn--ghost bx-btn--sm" : "bx-btn bx-btn--sm")),
                    ui.row("ai-chat-history", "Ingat obrolan di semua toko Kantoong", d.scope === "network" ? "Aktif (lintas brand, dengan izinmu)" : "Hanya toko ini",
                        ui.btn(d.scope === "network" ? "Hanya toko ini" : "Ingat di semua toko", () => { setMemoryScope(d.scope === "network" ? "brand" : "network"); writeMe("scope-changed", Date.now()); }, "bx-btn bx-btn--ghost bx-btn--sm")),
                    ui.note("Hapus memori obrolan: buka asisten › menu + › “Hapus memori asisten” (bisa per brand, per industri, atau semua)."));
            },
        },
        {
            id: "erase", title: "Hapus data saya", desc: "Pilih yang dihapus — sesuai UU PDP", icon: "close",
            render(body, d, api) {
                const groups = [
                    ["Tebakan selera & ukuran", ["suppressed", "sizes"]],
                    ["Alamat & kalender", ["addresses", "address-main", "events", "timers"]],
                    ["Catatan belanja (garansi, biaya per pakai, batas)", ["warranties", "wears", "budget-limit"]],
                    ["Wishlist koleksi & pantauan harga", ["collections", "wish-prices"]],
                ];
                body.append(ui.list(groups.map(([label, keys]) => ui.row("close", label, "Hanya di perangkat ini", ui.btn("Hapus", () => { keys.forEach((k) => writeMe(k, null)); api.toast(`${label} dihapus.`); }, "bx-btn bx-btn--ghost bx-btn--sm")))),
                    ui.btn("Hapus SEMUA data pribadi di perangkat ini", () => {
                        if (!window.confirm("Hapus semua data pribadimu di perangkat ini? Tidak bisa dibatalkan.")) return;
                        allMeKeys().forEach((k) => localStorage.removeItem(k));
                        writeMe("erased", null);
                        api.toast("Semua data pribadi di perangkat ini dihapus.");
                    }, "bx-btn bx-btn--danger"),
                    ui.note("Data akun di server (pesanan, memori chat yang disinkron) dihapus lewat Ekspor Data › Hapus akun, atau minta ke asisten."));
            },
        },
    ],
    snapshot: (d) => {
        const t = d.traits.map((x) => `${x.label}: ${x.value}`).join("; ");
        const s = d.sizes;
        const size = [s.shirt && `baju ${s.shirt}`, s.shoe && `sepatu EU ${s.shoe}`, s.height && `tinggi ${s.height}cm`].filter(Boolean).join(", ");
        return [t && `Selera: ${t}.`, size && `Ukuran: ${size}.`].filter(Boolean).join(" ");
    },
};

/* ============================================================
   PENGATURAN
   ============================================================ */
export const settings = {
    id: "settings",
    title: "Pengaturan",
    tagline: "Satu pusat untuk tampilan, bahasa, privasi, dan pemberitahuan.",
    tone: "light",
    load: async () => ({ consent: getConsent(), quiet: readMe("quiet-hours", { on: false, from: "21:00", to: "07:00" }) }),
    hero: (d) => ({ value: LANGUAGES.find((l) => l.id === activeLang())?.label ?? "Bahasa Indonesia", note: `${consentLabel(d.consent)}${d.quiet.on ? ` · jam tenang ${d.quiet.from}–${d.quiet.to}` : ""}` }),
    tools: [
        { id: "appearance", title: "Tampilan", desc: "Bahasa, tema, warna chat, font", icon: "settings", render(body) { renderAppearance(body); } },
        { id: "privacy", title: "Privasi & izin AI", desc: "Apa yang boleh dibaca asisten", icon: "lock", render(body, d, api) { myCard.tools.find((t) => t.id === "consent").render(body, { consent: d.consent, scope: getMemoryScope() }, api); } },
        {
            id: "notify", title: "Pemberitahuan & jam tenang", desc: "Sinyal tidak muncul di jam istirahatmu", icon: "clock",
            render(body, d) {
                body.append(ui.form([
                    { name: "on", label: "Jam tenang", type: "select", options: [{ value: "1", label: "Aktif" }, { value: "", label: "Mati" }], value: d.quiet.on ? "1" : "" },
                    { name: "from", label: "Mulai", type: "time", value: d.quiet.from },
                    { name: "to", label: "Sampai", type: "time", value: d.quiet.to },
                ], (v) => writeMe("quiet-hours", { on: v.on === "1", from: /^\d{2}:\d{2}$/.test(v.from) ? v.from : "21:00", to: /^\d{2}:\d{2}$/.test(v.to) ? v.to : "07:00" }), "Simpan"), ui.note("Kami tidak pernah mengirim SMS/WhatsApp otomatis. Pemberitahuan hanya tampil di dalam web."));
            },
        },
        {
            id: "layout", title: "Tata letak & riwayat", desc: "Kembalikan susunan kartu, hapus riwayat", icon: "grid",
            render(body, d, api) {
                const dash = api.context?.dashboardApi;
                body.append(ui.row("grid", "Susunan kartu menu", "Kembali ke tampilan awal di perangkat ini", ui.btn("Kembalikan", () => { dash?.resetLayout?.(); api.toast("Tata letak dikembalikan."); }, "bx-btn bx-btn--ghost bx-btn--sm")),
                    ui.row("search", "Riwayat aktivitas", "Dihapus otomatis tiap Minggu 00.00", ui.btn("Hapus sekarang", () => { dash?.clearHistory?.(); api.toast("Riwayat dihapus."); }, "bx-btn bx-btn--ghost bx-btn--sm")));
            },
        },
    ],
    snapshot: (d) => `Bahasa ${activeLang()}. ${consentLabel(d.consent)}.`,
};

/* ============================================================
   EKSPOR DATA
   ============================================================ */
export const dataExport = {
    id: "data-export",
    title: "Ekspor Data",
    tagline: "Datamu milikmu: unduh semuanya, kapan saja, dalam format yang bisa dibaca.",
    tone: "light",
    load: async () => ({ ...(await orders()), keys: allMeKeys() }),
    hero: (d) => ({ value: `${d.keys.length} catatan pribadi di perangkat ini`, note: d.signedIn ? `${d.orders.length} pesanan di akunmu` : "Masuk untuk menyertakan pesanan" }),
    tools: [
        {
            id: "download", title: "Unduh semua dataku", desc: "JSON (lengkap) atau CSV pesanan", icon: "data-export",
            render(body, d) {
                const personal = Object.fromEntries(d.keys.map((k) => {
                    try {
                        return [k.replace(ME_PREFIX, ""), JSON.parse(localStorage.getItem(k))];
                    } catch {
                        return [k, null];
                    }
                }));
                const pack = { dibuat: new Date().toISOString(), toko: storeContact().name, pesanan: d.orders ?? [], wishlist: getWishlistIds(), data_pribadi: personal };
                body.append(ui.btn("Unduh JSON lengkap", () => download(`data-saya-${Date.now()}.json`, JSON.stringify(pack, null, 2), "application/json")),
                    d.orders?.length ? ui.btn("Unduh pesanan (CSV untuk Excel)", () => {
                        const rows = [["Kode", "Tanggal", "Status", "Total"], ...d.orders.map((o) => [o.order_code, o.created_at, o.status, o.total])];
                        download(`pesanan-${Date.now()}.csv`, "﻿" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n"), "text/csv");
                    }, "bx-btn bx-btn--ghost") : null,
                    ui.note("File dibuat di perangkatmu sendiri — tidak dikirim ke mana pun."));
            },
        },
        {
            id: "account", title: "Hapus akun", desc: "Ajukan penghapusan data di server", icon: "close",
            render(body, d, api) {
                body.append(el("p", "", "Penghapusan akun & data di server diproses toko maksimal 3×24 jam sesuai UU PDP."), ui.btn("Ajukan lewat WhatsApp", () => {
                    const link = waLink("Halo, saya ingin mengajukan penghapusan akun & data pribadi saya.");
                    if (link) window.open(link, "_blank", "noopener");
                    else api.toast("Nomor WhatsApp toko belum diisi. Minta lewat asisten.");
                }, "bx-btn bx-btn--danger"), ui.note("Pesan disiapkan, kamu sendiri yang menekan kirim."));
            },
        },
        {
            id: "access-log", title: "Siapa yang melihat dataku", desc: "Log akses staf toko", icon: "lock",
            render(body) {
                body.append(ui.empty("Segera hadir", "Daftar staf yang membuka datamu (dari catatan audit ERP) akan tampil di sini. Akses staf sudah dicatat sejak sekarang."));
            },
        },
    ],
    snapshot: () => "",
};

/* ============================================================
   BAHASA & WILAYAH
   ============================================================ */
export const localization = {
    id: "localization",
    title: "Bahasa & Wilayah",
    tagline: "Bahasa, zona waktu, dan ukuran internasional — tanpa perlu menebak.",
    tone: "light",
    load: async () => ({ tz: readMe("tz", "Asia/Jakarta") }),
    hero: (d) => ({ value: LANGUAGES.find((l) => l.id === activeLang())?.label ?? "Bahasa Indonesia", note: `Zona waktu: ${d.tz.replace("Asia/", "")}` }),
    tools: [
        { id: "language", title: "Bahasa", desc: "7 bahasa — semua teks ikut diterjemahkan", icon: "localization", render(body) { body.append(ui.btn("Pilih bahasa", () => openLanguagePicker())); } },
        {
            id: "timezone", title: "Zona waktu", desc: "Untuk hitung mundur & jam ambil", icon: "clock",
            render(body, d) {
                body.append(ui.form([{ name: "tz", label: "Zona waktu", type: "select", value: d.tz, options: [{ value: "Asia/Jakarta", label: "WIB (Jakarta)" }, { value: "Asia/Makassar", label: "WITA (Makassar)" }, { value: "Asia/Jayapura", label: "WIT (Jayapura)" }, { value: "Asia/Singapore", label: "Singapura" }, { value: "Asia/Tokyo", label: "Tokyo" }, { value: "Europe/London", label: "London" }] }], (v) => writeMe("tz", clean(v.tz, 40)), "Simpan"));
            },
        },
        {
            id: "sizes", title: "Konversi ukuran", desc: "Sepatu EU/US/UK & baju huruf/EU", icon: "product-catalog",
            render(body) {
                const out = el("div", "bx-stats");
                body.append(ui.form([{ name: "kind", label: "Jenis", type: "select", options: [{ value: "sepatu", label: "Sepatu (masukkan EU)" }, { value: "baju", label: "Baju (masukkan S/M/L…)" }] }, { name: "value", label: "Ukuran", required: true, max: 4 }], (v) => {
                    const r = convertSize(v.kind, v.value);
                    out.replaceChildren(...(r ? Object.entries(r).map(([k, val]) => ui.stat(k, String(val))) : [el("p", "bx-muted", "Ukuran tidak dikenal.")]));
                }, "Konversi"), out, ui.note("Perkiraan umum; tiap brand bisa sedikit berbeda — cek panduan ukuran di halaman produk."));
            },
        },
    ],
    snapshot: (d) => `Bahasa ${activeLang()}, zona ${d.tz}.`,
};

/* ============================================================
   RIWAYAT CHAT AI
   ============================================================ */
export const aiChatHistory = {
    id: "ai-chat-history",
    title: "Riwayat Chat AI",
    tagline: "Bukan sekadar log: cari isinya dan sematkan jawaban yang penting.",
    tone: "light",
    load: async () => ({ sessions: getChatSessions(), pins: listMe("pins") }),
    hero: (d) => ({ value: d.sessions.length ? `${d.sessions.length} percakapan` : "Belum ada percakapan", note: "Tersimpan 30 hari di perangkat ini" }),
    tools: [
        {
            id: "sessions", title: "Percakapan", desc: "Cari & lanjutkan", icon: "ai-chat-history",
            badge: (d) => String(d.sessions.length || ""),
            render(body, d, api) {
                if (!d.sessions.length) return body.append(ui.empty("Belum ada percakapan", "Ngobrol dengan asisten soal ukuran, kecocokan, atau rekomendasi.", ui.btn("Buka asisten", api.openAssistant)));
                const input = el("input", "bx-input");
                input.type = "search";
                input.placeholder = "Cari di judul percakapan…";
                const list = ui.list([]);
                const draw = () => {
                    const q = input.value.trim().toLowerCase();
                    list.replaceChildren(...d.sessions.filter((s) => !q || s.title.toLowerCase().includes(q)).map((s) => ui.row("ai-chat-history", s.title, `${s.count} pesan${s.at ? ` · ${fmtDate(s.at)}` : ""}${s.live ? " · berjalan" : ""}`,
                        ui.btn("Sematkan", () => addMe("pins", { text: s.title, at: Date.now() }, { max: 30 }), "bx-btn bx-btn--ghost bx-btn--sm"))));
                };
                input.addEventListener("input", draw);
                draw();
                body.append(input, list, ui.btn("Lanjutkan di asisten", api.openAssistant));
            },
        },
        {
            id: "pins", title: "Disematkan", desc: "Hal penting yang ingin kamu ingat", icon: "check",
            badge: (d) => String(d.pins.length || ""),
            render(body, d) {
                body.append(d.pins.length ? ui.list(d.pins.map((p) => ui.row("check", p.text, fmtDate(p.at), ui.btn(icon("close"), () => removeMe("pins", p.id), "bx-row__x")))) : ui.empty("Belum ada", "Sematkan percakapan penting agar mudah ditemukan."));
            },
        },
    ],
    snapshot: (d) => (d.sessions.length ? `Percakapan terakhir: ${d.sessions.slice(0, 3).map((s) => s.title).join("; ")}.` : ""),
};

/* ============================================================
   CUSTOMER SERVICE
   ============================================================ */
const FAQ = [
    ["Berapa lama pengiriman?", "Estimasi tampil di setiap produk dan saat checkout, tergantung kurir dan kotamu."],
    ["Bagaimana cara tukar atau retur?", "Pakai Retur terpandu di sini: pilih pesanan, alasan, lalu kirim ke toko."],
    ["Apakah asisten bisa membayar untukku?", "Tidak. Pembayaran selalu kamu lakukan sendiri — asisten hanya membantu memilih."],
    ["Bagaimana menghapus data saya?", "Buka Kartu Diriku › Hapus data saya, atau Ekspor Data › Hapus akun."],
];

export const customerSupport = {
    id: "customer-support",
    title: "Customer Service",
    tagline: "Asisten mencoba dulu 24 jam; manusia turun tangan bila perlu.",
    tone: "light",
    load: async () => ({ ...(await orders()), tickets: listMe("tickets"), info: storeContact() }),
    hero: (d) => ({ value: d.tickets.length ? `${d.tickets.length} permintaan tercatat` : "Ada yang bisa kami bantu?", note: d.info.hours ? `Tim toko: ${d.info.hours}` : "Asisten AI menjawab 24 jam" }),
    tools: [
        { id: "ask", title: "Tanya asisten sekarang", desc: "Jawaban langsung, 24 jam", icon: "ai-chat-history", render(body, d, api) { body.append(el("p", "", "Asisten sudah tahu halaman yang kamu buka (dan pesananmu, bila kamu mengizinkan)."), ui.btn("Buka asisten", api.openAssistant)); } },
        {
            id: "return", title: "Retur & tukar terpandu", desc: "Pesanan → alasan → kirim ke toko", icon: "my-orders",
            render(body, d) {
                const opts = (d.orders ?? []).filter((o) => ["dikirim", "selesai"].includes(o.status)).map((o) => ({ value: o.order_code, label: `${o.order_code} · ${fmtDate(o.created_at)}` }));
                if (!opts.length) return body.append(ui.empty("Belum ada pesanan yang bisa diretur", "Retur tersedia untuk pesanan yang sudah dikirim/diterima."));
                body.append(ui.form([
                    { name: "order", label: "Pesanan", type: "select", options: opts },
                    { name: "type", label: "Mau apa", type: "select", options: ["Tukar ukuran", "Tukar warna", "Retur uang kembali", "Barang rusak / cacat"] },
                    { name: "note", label: "Ceritakan singkat", type: "textarea", max: 300 },
                ], (v) => {
                    addMe("tickets", { order: clean(v.order, 40), issue: clean(v.type, 40), note: clean(v.note, 300), at: Date.now(), status: "Dikirim lewat WhatsApp" });
                    const link = waLink(`Halo, saya ingin ${v.type} untuk pesanan ${v.order}. ${v.note} (foto akan saya kirim setelah ini)`);
                    if (link) window.open(link, "_blank", "noopener");
                }, "Siapkan pesan ke toko"), ui.note("Siapkan foto barang & kemasan. Kebijakan lengkap: halaman Info › Tukar & retur."));
            },
        },
        {
            id: "tickets", title: "Tiketku", desc: "Riwayat permintaan bantuan", icon: "check",
            badge: (d) => String(d.tickets.length || ""),
            render(body, d) {
                body.append(d.tickets.length ? ui.list(d.tickets.map((t) => ui.row("customer-support", `${t.issue} · ${t.order}`, `${fmtDate(t.at)} · ${t.status}`, ui.btn(icon("close"), () => removeMe("tickets", t.id), "bx-row__x")))) : ui.empty("Belum ada tiket", "Permintaan retur & laporan masalah tercatat di sini."));
            },
        },
        {
            id: "faq", title: "Pertanyaan umum", desc: "Jawaban cepat", icon: "search",
            render(body) {
                body.append(el("div", "bx-faq", FAQ.map(([q, a]) => {
                    const det = document.createElement("details");
                    det.append(el("summary", "", q), el("p", "", a));
                    return det;
                })));
            },
        },
    ],
    snapshot: (d) => (d.tickets.length ? `Tiket: ${d.tickets.slice(0, 3).map((t) => `${t.issue} ${t.order} (${t.status})`).join("; ")}.` : ""),
};
