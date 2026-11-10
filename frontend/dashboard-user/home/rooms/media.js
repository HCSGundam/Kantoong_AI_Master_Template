/**
 * KANTOONG — RUANG: Dokumen Kerja Sama · Unggah Media · Interaksi Suara · Banner Promo
 * File: frontend/dashboard-user/home/rooms/media.js
 */

import { ui } from "../room.js";
import { addMe, clean, listMe, readMe, removeMe, writeMe } from "../me-store.js";
import { cameraSupported, openWebCamera } from "../../../js/web-camera.js";
import { getStorefront, policyText } from "../../../js/storefront-settings.js";
import { el, fmtDate, icon, storeContact, waLink } from "./shared.js";

const MEDIA_DAYS = 30;
const MEDIA_MAX = 12;

/** Perkecil foto (maks 640 px, JPEG) agar muat di perangkat. */
function shrink(file) {
    return new Promise((resolve) => {
        if (!file?.type?.startsWith("image/")) return resolve(null);
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, 640 / Math.max(img.width, img.height));
            const c = document.createElement("canvas");
            c.width = Math.round(img.width * scale);
            c.height = Math.round(img.height * scale);
            c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
            URL.revokeObjectURL(img.src);
            resolve(c.toDataURL("image/jpeg", 0.72));
        };
        img.onerror = () => resolve(null);
        img.src = URL.createObjectURL(file);
    });
}

function liveMedia() {
    const now = Date.now();
    const list = listMe("media");
    const alive = list.filter((m) => now - m.at < MEDIA_DAYS * 86_400_000);
    if (alive.length !== list.length) writeMe("media", alive);
    return alive;
}

async function dataUrlToFile(url, name) {
    const blob = await (await fetch(url)).blob();
    return new File([blob], name, { type: blob.type });
}

/* ============================================================
   UNGGAH MEDIA
   ============================================================ */
export const mediaUpload = {
    id: "media-upload",
    title: "Unggah Media",
    tagline: "Foto outfit, ruangan, atau referensi — dihapus otomatis setelah 30 hari.",
    tone: "light",
    load: async () => ({ list: liveMedia() }),
    hero: (d) => ({ value: d.list.length ? `${d.list.length} foto tersimpan` : "Belum ada foto", note: "Hapus otomatis 30 hari · hanya di perangkat ini" }),
    tools: [
        {
            id: "add", title: "Unggah / ambil foto", desc: "Dari galeri atau kamera di web", icon: "media-upload",
            render(body, d, api) {
                const input = el("input", "");
                input.type = "file";
                input.accept = "image/*";
                input.multiple = true;
                const save = async (files) => {
                    for (const f of files) {
                        if (liveMedia().length >= MEDIA_MAX) return api.toast(`Maksimal ${MEDIA_MAX} foto. Hapus yang lama dulu.`);
                        const url = await shrink(f);
                        if (url) addMe("media", { name: clean(f.name || "foto", 60), url, at: Date.now() }, { max: MEDIA_MAX });
                    }
                    api.toast("Foto tersimpan.");
                };
                input.addEventListener("change", () => save([...(input.files ?? [])]));
                body.append(el("label", "bx-drop", icon("media-upload", "bx-icon bx-icon--xl"), el("strong", "", "Pilih foto"), el("span", "bx-muted", "JPG/PNG · diperkecil otomatis"), input),
                    cameraSupported() ? ui.btn([icon("media-upload"), "Ambil dengan kamera"], async () => {
                        const shot = await openWebCamera({ facing: "environment" });
                        if (shot) save([shot]);
                    }, "bx-btn bx-btn--ghost") : null);
            },
        },
        {
            id: "gallery", title: "Galeriku", desc: "Kirim ke asisten untuk dianalisis", icon: "grid",
            badge: (d) => String(d.list.length || ""),
            render(body, d, api) {
                if (!d.list.length) return body.append(ui.empty("Belum ada foto", "Unggah foto outfit atau referensi gaya — asisten bisa membantu mencocokkan produk."));
                body.append(el("div", "bx-gallery", d.list.map((m) => {
                    const img = document.createElement("img");
                    img.src = m.url;
                    img.alt = m.name;
                    const left = MEDIA_DAYS - Math.floor((Date.now() - m.at) / 86_400_000);
                    return el("figure", "bx-gallery__item", img,
                        el("figcaption", "", el("span", "", `Hapus otomatis ${left} hari lagi`),
                            ui.btn("Ke asisten", async () => {
                                const file = await dataUrlToFile(m.url, m.name.replace(/\.\w+$/, "") + ".jpg");
                                window.KantoongChat?.attachFiles?.([file]);
                                api.openAssistant();
                            }, "bx-btn bx-btn--sm"),
                            ui.btn(icon("close"), () => removeMe("media", m.id), "bx-row__x")));
                })), ui.note("“Ke asisten” hanya melampirkan foto di kotak ketik. Kamu sendiri yang menulis & mengirim pertanyaannya."));
            },
        },
    ],
    snapshot: (d) => (d.list.length ? `${d.list.length} foto referensi tersimpan (hapus otomatis 30 hari).` : ""),
};

/* ============================================================
   INTERAKSI SUARA
   ============================================================ */
const Recognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

/** Bacakan jawaban AI (bila diaktifkan) — dipasang sekali per halaman. */
let readerOn = false;
function startReader() {
    if (readerOn || typeof MutationObserver === "undefined" || !("speechSynthesis" in window)) return;
    readerOn = true;
    new MutationObserver((records) => {
        if (!readMe("voice-read", false)) return;
        records.forEach((r) => r.addedNodes.forEach((n) => {
            if (n.nodeType === 1 && n.classList?.contains("ai-message--ai")) {
                const text = n.querySelector(".ai-message__bubble")?.textContent ?? "";
                if (!text) return;
                const u = new SpeechSynthesisUtterance(text.slice(0, 400));
                u.lang = document.documentElement.lang === "en" ? "en-US" : "id-ID";
                speechSynthesis.cancel();
                speechSynthesis.speak(u);
            }
        }));
    }).observe(document.body, { childList: true, subtree: true });
}
if (typeof window !== "undefined" && readMe("voice-read", false)) setTimeout(startReader, 1500);

export const voiceInteraction = {
    id: "voice-interaction",
    title: "Interaksi Suara",
    tagline: "Bicara untuk mencari, dengarkan jawaban asisten — tangan tetap bebas.",
    tone: "ink",
    load: async () => ({ read: readMe("voice-read", false), supported: Boolean(Recognition), tts: "speechSynthesis" in window }),
    hero: (d) => ({ value: d.supported ? "Siap mendengar" : "Browser belum mendukung suara", note: d.read ? "Jawaban asisten dibacakan" : "Jawaban asisten tidak dibacakan" }),
    tools: [
        {
            id: "search", title: "Cari pakai suara", desc: "Ucapkan produk yang kamu cari", icon: "voice-interaction",
            render(body, d, api) {
                if (!d.supported) return body.append(ui.empty("Belum didukung", "Coba Chrome terbaru di HP atau laptop untuk memakai pencarian suara."));
                const out = el("p", "bx-big", "…");
                const go = ui.btn([icon("voice-interaction"), "Tekan & bicara"], () => {
                    const rec = new Recognition();
                    rec.lang = document.documentElement.lang === "en" ? "en-US" : "id-ID";
                    rec.interimResults = true;
                    out.textContent = "Mendengarkan…";
                    rec.onresult = (e) => {
                        out.textContent = [...e.results].map((r) => r[0].transcript).join(" ");
                    };
                    rec.onend = () => {
                        const q = out.textContent.trim();
                        if (q && q !== "Mendengarkan…") {
                            try {
                                sessionStorage.setItem("kantoong:catalog-query", q.slice(0, 80));
                            } catch { /* abaikan */ }
                            api.openFeature("product-catalog");
                        }
                    };
                    rec.onerror = () => (out.textContent = "Tidak terdengar. Coba lagi.");
                    rec.start();
                });
                body.append(out, go, ui.note("Suara diproses oleh browser-mu. Hasil kata dibuka di Katalog Produk."));
            },
        },
        {
            id: "read", title: "Bacakan jawaban asisten", desc: "Asisten berbicara setiap menjawab", icon: "music-player",
            render(body, d) {
                if (!d.tts) return body.append(ui.empty("Belum didukung", "Browser ini belum bisa membacakan teks."));
                body.append(ui.btn(d.read ? "Matikan pembaca" : "Aktifkan pembaca", () => {
                    writeMe("voice-read", !d.read);
                    if (!d.read) startReader();
                    else speechSynthesis.cancel();
                }, d.read ? "bx-btn bx-btn--ghost" : "bx-btn"), ui.btn("Coba dengar", () => {
                    const u = new SpeechSynthesisUtterance("Halo Kak, aku siap membantu.");
                    u.lang = "id-ID";
                    speechSynthesis.speak(u);
                }, "bx-btn bx-btn--ghost"));
            },
        },
    ],
    snapshot: () => "",
};

/* ============================================================
   BANNER PROMO
   ============================================================ */
function promoBlocks() {
    const blocks = getStorefront().home?.blocks ?? [];
    return blocks.filter((b) => b.enabled !== false && ["banner", "posters", "coupons"].includes(b.type));
}

export const bannerCarousel = {
    id: "banner-carousel",
    title: "Banner Promo",
    tagline: "Semua promo toko di satu tempat — tidak perlu menggulir beranda.",
    tone: "gold",
    load: async () => ({ blocks: promoBlocks() }),
    hero: (d) => {
        const n = d.blocks.reduce((s, b) => s + (b.items?.length || 1), 0);
        return { value: n ? `${n} promo aktif` : "Belum ada promo", note: "Diatur langsung oleh toko" };
    },
    tools: [
        {
            id: "all", title: "Promo berjalan", desc: "Banner, poster & kupon dari toko", icon: "banner-carousel",
            badge: (d) => String(d.blocks.length || ""),
            render(body, d, api) {
                if (!d.blocks.length) return body.append(ui.empty("Belum ada promo", "Promo yang dipasang toko akan muncul di sini."));
                body.append(el("div", "bx-promos", d.blocks.flatMap((b) => (b.items?.length ? b.items : [b]).map((it) => {
                    const card = el("article", "bx-promo");
                    if (/^(https:|data:image)/.test(it.image ?? "")) {
                        const img = document.createElement("img");
                        img.src = it.image;
                        img.alt = "";
                        card.append(img);
                    }
                    card.append(el("div", "bx-promo__text", el("strong", "", it.title || b.title || "Promo"), it.text ? el("span", "", it.text) : null, it.code ? el("code", "", it.code) : null));
                    return card;
                }))), ui.btn("Lihat voucherku", () => api.openFeature("vouchers-promos"), "bx-btn bx-btn--ghost"));
            },
        },
    ],
    snapshot: (d) => (d.blocks.length ? `Promo toko: ${d.blocks.map((b) => b.title || b.type).join(", ")}.` : ""),
};

/* ============================================================
   DOKUMEN KERJA SAMA (reseller, mitra, korporat)
   ============================================================ */
export const cooperationDocs = {
    id: "cooperation-documents",
    title: "Dokumen Kerja Sama",
    tagline: "Mau jadi reseller atau mitra? Ajukan, simpan dokumen, dan pantau statusnya.",
    tone: "light",
    load: async () => ({ list: listMe("partner-requests"), info: storeContact() }),
    hero: (d) => ({ value: d.list.length ? `${d.list.length} pengajuan` : "Belum ada pengajuan", note: "Reseller · mitra · pesanan korporat" }),
    tools: [
        {
            id: "apply", title: "Ajukan kerja sama", desc: "Reseller, dropship, korporat, kolaborasi", icon: "cooperation-documents",
            render(body, d, api) {
                body.append(ui.form([
                    { name: "type", label: "Jenis", type: "select", options: ["Reseller", "Dropship", "Pesanan korporat / seragam", "Kolaborasi konten", "Titip jual / konsinyasi"] },
                    { name: "company", label: "Nama usaha / instansi", max: 80 },
                    { name: "city", label: "Kota", max: 60 },
                    { name: "volume", label: "Perkiraan jumlah / bulan", max: 40 },
                    { name: "note", label: "Ceritakan singkat", type: "textarea", max: 400 },
                ], (v) => {
                    addMe("partner-requests", { type: clean(v.type, 40), company: clean(v.company, 80), city: clean(v.city, 60), volume: clean(v.volume, 40), note: clean(v.note, 400), at: Date.now(), status: "Diajukan via WhatsApp" }, { max: 20 });
                    const link = waLink(`Halo, saya ingin mengajukan kerja sama (${v.type}).\nUsaha: ${v.company}\nKota: ${v.city}\nVolume: ${v.volume}\n${v.note}`);
                    if (link) window.open(link, "_blank", "noopener");
                    else api.toast("Nomor WhatsApp toko belum diisi.");
                }, "Kirim pengajuan via WhatsApp"), ui.note("Pesan disiapkan, kamu sendiri yang menekan kirim. Dokumen (KTP/NIB) kirim langsung di chat WhatsApp toko, jangan di sini."));
            },
        },
        {
            id: "status", title: "Pengajuanku", desc: "Riwayat & status", icon: "check",
            badge: (d) => String(d.list.length || ""),
            render(body, d) {
                body.append(d.list.length ? ui.list(d.list.map((r) => ui.row("cooperation-documents", `${r.type}${r.company ? ` · ${r.company}` : ""}`, `${fmtDate(r.at)} · ${r.status}`, ui.btn(icon("close"), () => removeMe("partner-requests", r.id), "bx-row__x")))) : ui.empty("Belum ada", "Pengajuan kerja sama yang kamu kirim tercatat di sini."));
            },
        },
        {
            id: "terms", title: "Syarat & ketentuan", desc: "Dari kebijakan resmi toko", icon: "data-export",
            render(body) {
                body.append(el("div", "bx-doc", policyText(getStorefront(), "terms")), ui.link("Buka halaman lengkap", "../info.html?halaman=syarat"));
            },
        },
    ],
    snapshot: (d) => (d.list.length ? `Pengajuan kerja sama: ${d.list.map((r) => `${r.type} (${r.status})`).join(", ")}.` : ""),
};
