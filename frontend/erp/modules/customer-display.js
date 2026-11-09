/**
 * KANTOONG ERP — LAYAR PELANGGAN (Tahap 6 POS Pro)
 * File: frontend/erp/modules/customer-display.js
 * Rute: #/pos/layar — dibuka di jendela/monitor kedua yang menghadap pelanggan.
 *
 * Pertanyaan terbalik: "Kenapa pelanggan curiga pada kasir?"
 *   - Pelanggan melihat SETIAP item yang diketik, promo, potongan poin & total secara langsung
 *     (transparansi = juga pencegah kecurangan: item & diskon tidak bisa disembunyikan).
 *   - Setelah bayar: KEPUASAN 1 KETUKAN 😀😐☹️ (tanpa formulir, tanpa data pribadi),
 *     terhubung ke struk -> laporan kepuasan per jam & per kasir.
 * Sinkron dengan kasir lewat dua jalur (data/display-link.js):
 *   - monitor kedua di komputer yang sama: BroadcastChannel (tetap jalan saat offline)
 *   - TABLET terpisah: rute #/pos/layar/<KODE> lewat Supabase Realtime (saluran privat, khusus staf).
 * Layar ini hanya MEMBACA; penilaian disimpan oleh jendela kasir (satu sumber data).
 * Privasi: hanya nama depan member & poin; tidak ada nomor HP / riwayat.
 */

import { promoActive, scheduleText } from "../core/promo.js";
import { RATING_FACES } from "../core/pos-report.js";
import { el, rupiah } from "../ui.js";
import { openDisplayLink } from "../data/display-link.js";
import { codeFromHash, normalizeCode } from "../core/display-code.js";

const RATING_TEXT = { 3: "Puas", 2: "Biasa", 1: "Kurang" };

export async function render(ctx) {
    const { data } = ctx;
    const page = el("div", { class: "erp-cdisplay" });
    document.body.classList.add("erp-display");

    const [warehouses, promos] = await Promise.all([data.listWarehouses(), data.listPromos ? data.listPromos() : []]);
    const outletName = warehouses.find((entry) => entry.kind === "outlet")?.name || "Kantoong";
    const code = codeFromHash(location.hash);
    const statusChip = el("span", { class: "erp-cdisplay__status" });
    const setStatus = (status) => {
        const labels = {
            lokal: ["", "Monitor kedua (komputer ini)"],
            menyambung: ["is-wait", "Menyambung ke kasir…"],
            tersambung: ["is-on", `Tersambung ke kasir · kode ${code}`],
            terputus: ["is-off", "Terputus — cek internet tablet"],
        };
        const [tone, text] = labels[status] || labels.lokal;
        statusChip.className = `erp-cdisplay__status ${tone}`;
        statusChip.textContent = text;
        if (status === "tersambung") channel?.post({ type: "hello", remote: true });
    };
    const channel = openDisplayLink({ code, isPrivate: data.mode !== "demo", onStatus: setStatus });
    let state = { type: "idle" };
    let idleTimer = null;
    let pendingCart = null; // pesanan berikutnya ditahan sampai pelanggan sebelumnya selesai menilai

    const idle = () => {
        const running = promos.filter((promo) => promoActive(promo, new Date()));
        return el("div", { class: "erp-cdisplay__idle" },
            el("p", { class: "erp-cdisplay__brand", text: outletName }),
            el("h1", { text: "Selamat datang 👋" }),
            running.length
                ? el("div", { class: "erp-cdisplay__promos" }, running.map((promo) => el("p", {},
                    el("strong", { text: `🎉 ${promo.name}` }),
                    el("span", { text: ` ${promo.kind === "happy_hour" ? `diskon ${promo.percent}%` : `hemat ${rupiah(promo.bundle_amount)} per paket`} · ${scheduleText(promo)}` }))))
                : el("p", { class: "erp-cdisplay__muted", text: "Tanyakan menu favoritmu ke kasir." })
        );
    };

    const cart = (cartState) => el("div", { class: "erp-cdisplay__cart" },
        el("header", {},
            el("strong", { text: outletName }),
            el("span", { text: [cartState.channel, cartState.label].filter(Boolean).join(" · ") })),
        cartState.member ? el("p", { class: "erp-cdisplay__member", text: `Halo, Kak ${cartState.member.name}! Poinmu ${cartState.member.points}${cartState.member.earn ? ` · +${cartState.member.earn} poin dari pesanan ini` : ""}` }) : null,
        el("ul", {}, cartState.items.map((item) => el("li", {},
            el("span", {}, `${item.qty}× ${item.name}`, item.options ? el("small", { text: item.options }) : null),
            el("strong", { text: rupiah(item.total) })))),
        el("dl", {},
            el("dt", { text: "Subtotal" }), el("dd", { text: rupiah(cartState.subtotal) }),
            ...cartState.lines.flatMap((row) => [el("dt", { class: row.good ? "is-good" : "", text: row.label }), el("dd", { class: row.good ? "is-good" : "", text: row.value })]),
            el("dt", { class: "is-total", text: "TOTAL" }), el("dd", { class: "is-total", text: rupiah(cartState.total) })),
        cartState.split?.length ? el("p", { class: "erp-cdisplay__muted", text: `Bagi rata: ${cartState.split.map((amount, index) => `Orang ${index + 1} ${rupiah(amount)}`).join(" · ")}` }) : null
    );

    const paid = (paidState) => {
        const faces = el("div", { class: "erp-cdisplay__faces", role: "group", "aria-label": "Nilai pelayanan" },
            [3, 2, 1].map((score) => el("button", {
                type: "button",
                onclick: () => {
                    // Layar pelanggan TIDAK menyimpan data sendiri: penilaian dikirim ke jendela kasir yang menyimpannya.
                    channel?.post({ type: "rated", score, sale_id: paidState.sale_id, receipt_no: paidState.receipt_no, offline: paidState.offline });
                    state = { type: "thanks", score };
                    draw();
                    schedule(pendingCart ? 2500 : 6000);
                },
            }, el("span", { text: RATING_FACES[score] }), el("small", { text: RATING_TEXT[score] }))));
        return el("div", { class: "erp-cdisplay__paid" },
            el("h1", { text: "Terima kasih! 🙏" }),
            el("p", { class: "erp-cdisplay__big", text: rupiah(paidState.total) }),
            paidState.change ? el("p", { text: `Kembalian ${rupiah(paidState.change)}` }) : null,
            paidState.queue_no ? el("p", {}, "No. antrian ", el("strong", { text: paidState.queue_no }), paidState.ready ? ` · siap ± ${paidState.ready}` : "") : null,
            paidState.points ? el("p", { text: `⭐ +${paidState.points} poin` }) : null,
            el("p", { class: "erp-cdisplay__ask", text: "Bagaimana pelayanan kami hari ini?" }),
            faces,
            el("p", { class: "erp-cdisplay__muted", text: "1 ketukan saja, tanpa data pribadi." })
        );
    };

    const thanks = (score) => el("div", { class: "erp-cdisplay__idle" },
        el("p", { class: "erp-cdisplay__face", text: RATING_FACES[score] }),
        el("h1", { text: score === 1 ? "Maaf ya, kami akan perbaiki 🙏" : "Terima kasih atas penilaianmu!" }));

    const body = el("div", { class: "erp-cdisplay__body" });
    const draw = () => {
        body.replaceChildren(
            state.type === "cart" && state.items.length ? cart(state)
                : state.type === "paid" ? paid(state)
                    : state.type === "thanks" ? thanks(state.score)
                        : idle());
    };
    /** Setelah jeda: tampilkan pesanan yang tertahan, atau layar sambutan. */
    const schedule = (ms) => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            state = pendingCart?.items?.length ? pendingCart : { type: "idle" };
            pendingCart = null;
            draw();
        }, ms);
    };

    if (channel) {
        channel.onMessage((message) => {
            if (message.type === "cart") {
                if (state.type === "paid" || state.type === "thanks") {
                    // Jangan potong layar penilaian: simpan pesanan berikutnya, tampil maks 20 detik lagi.
                    pendingCart = message.items?.length ? message : null;
                    if (pendingCart && state.type === "paid") schedule(20000);
                    return;
                }
                state = message;
                clearTimeout(idleTimer);
            } else if (message.type === "paid") {
                state = message;
                pendingCart = null;
                schedule(45000);
            } else if (message.type === "clear") {
                state = { type: "idle" };
            } else return;
            draw();
        });
        channel.post({ type: "hello", remote: Boolean(code) });
    }

    /** Tablet: masukkan kode pasangan dari kasir. */
    const pairForm = () => {
        const input = el("input", {
            class: "erp-cdisplay__code-input", type: "text", inputmode: "text", autocomplete: "off", autocapitalize: "characters",
            maxlength: 7, placeholder: "ABC 234", "aria-label": "Kode pasangan dari kasir",
        });
        const error = el("p", { class: "erp-cdisplay__muted", text: "" });
        const submit = (event) => {
            event.preventDefault();
            const clean = normalizeCode(input.value);
            if (!clean) {
                error.textContent = "Kode harus 6 huruf/angka seperti yang tampil di layar kasir.";
                return;
            }
            location.hash = `#/pos/layar/${clean}`;
        };
        return el("form", { class: "erp-cdisplay__pair", onsubmit: submit },
            el("p", { class: "erp-cdisplay__brand", text: "Pasang tablet layar pelanggan" }),
            el("h1", { text: "Masukkan kode dari kasir" }),
            el("p", { class: "erp-cdisplay__muted", text: "Di komputer kasir: Kasir POS › Layar pelanggan › Tablet terpisah › Buat kode pasangan." }),
            input,
            el("button", { class: "erp-btn erp-btn--primary", type: "submit" }, "Sambungkan"),
            error);
    };

    page.append(
        el("div", { class: "erp-cdisplay__bar" },
            statusChip,
            el("span", { class: "erp-spacer" }),
            code ? el("a", { class: "erp-btn erp-btn--sm", href: "#/pos/layar" }, "Ganti kode") : null,
            el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => document.documentElement.requestFullscreen?.().catch(() => {}) }, "Layar penuh"),
            el("a", { class: "erp-btn erp-btn--sm", href: "#/pos" }, "Tutup")),
        body
    );
    // Dibuka langsung di tablet (bukan jendela dari kasir) tanpa kode: tampilkan formulir kode.
    if (!code && !window.opener) body.replaceChildren(pairForm());
    else draw();

    ctx.onCleanup(() => {
        clearTimeout(idleTimer);
        channel?.close();
        document.body.classList.remove("erp-display");
    });
    return page;
}
