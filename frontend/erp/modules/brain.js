/**
 * KANTOONG ERP — SECOND BRAIN (khusus OWNER)
 * File: frontend/erp/modules/brain.js
 *
 * Brand ini = SATU neuron di otak Anachronos Digital Mall. Neuron
 * berdenyut; percikan cahaya masuk setiap ada aktivitas AI. Klik neuron
 * untuk membuka isinya (ringkas): angka utama, produk paling diminati,
 * kebutuhan pembeli, jam ramai, aktivitas terbaru.
 *
 * Hanya brand sendiri. Peta banyak neuron (semua brand) hanya ada di
 * web internal Anachronos Digital Mall, bukan di sini.
 * Data: ai_events anonim (db/erp-phase4.sql).
 */

import { activityFeed, guestLabels, summarizeResearch } from "../core/research.js";
import { createNeuron } from "./brain-neuron.js";
import { dateTime, el, pageHeader, segmented } from "../ui.js";

let open = false;
let days = 30;

const FEED_ICON = { ask: "💬", recommend: "✨", view: "👀", attach: "📎", cart: "🛒" };

export async function render(ctx) {
    const { data } = ctx;
    const [events, products, brands] = await Promise.all([
        data.listAiEvents({ days }),
        data.listProducts().catch(() => []),
        data.researchBrands(),
    ]);
    const brand = brands[0]?.name || "Brand";

    let all = events.slice();

    const page = el("div", { class: "erp-page__inner" });
    page.appendChild(pageHeader(
        "Second Brain",
        `${brand} adalah satu neuron di otak Anachronos Digital Mall. Khusus owner — klik neuron untuk melihat isinya.`
    ));

    const panel = el("aside", { class: "erp-card erp-neuron__panel", "aria-label": `Isi neuron ${brand}` });
    const layout = el("div", { class: `erp-neuron${open ? " is-open" : ""}` });

    const setOpen = (value) => {
        open = value;
        layout.classList.toggle("is-open", open);
        if (open) drawPanel();
    };

    const neuron = createNeuron({ name: brand, onOpen: () => setOpen(!open) });
    const hint = el("p", { class: "erp-neuron__hint", text: all.length ? "Klik neuron untuk membuka isinya" : "Belum ada aktivitas AI — neuron menunggu pembeli pertama" });

    function drawPanel() {
        const summary = summarizeResearch(all, products, { days });
        const feed = activityFeed(all, { products, labels: guestLabels(all), limit: 5 });
        const { totals } = summary;

        const stat = (label, value) => el("div", { class: "erp-neuron__stat" }, el("strong", { text: value }), el("span", { text: label }));
        const list = (rows, empty) => rows.length
            ? el("ol", { class: "erp-neuron__list" }, rows)
            : el("p", { class: "erp-muted erp-neuron__empty", text: empty });

        panel.replaceChildren(
            el("div", { class: "erp-neuron__head" },
                el("div", {},
                    el("span", { class: "erp-neuron__badge", text: "Neuron aktif" }),
                    el("h2", { text: brand })
                ),
                el("button", { class: "erp-icon-btn", type: "button", "aria-label": "Tutup isi neuron", onclick: () => setOpen(false) }, "✕")
            ),
            segmented([{ value: 7, label: "7 hari" }, { value: 30, label: "30 hari" }], days, (value) => {
                days = value;
                ctx.rerender();
            }),
            el("div", { class: "erp-neuron__stats" },
                stat("tamu mengobrol", String(totals.sessions)),
                stat("pertanyaan ke AI", String(totals.asks)),
                stat("masuk keranjang", String(totals.carts)),
                stat("konversi", `${totals.conversion}%`)
            ),
            el("section", {},
                el("h3", { text: "Paling diminati" }),
                list(summary.topProducts.slice(0, 3).map((row) => el("li", {},
                    el("span", { text: row.name }), el("small", { text: `${row.count}× · 🛒 ${row.carts}` }))), "Belum ada produk yang diminati.")
            ),
            el("section", {},
                el("h3", { text: "Yang dibutuhkan pembeli" }),
                summary.needs.length
                    ? el("div", { class: "erp-neuron__chips" }, summary.needs.slice(0, 3).map((need) => el("span", { text: `${need.label} · ${need.count}` })))
                    : el("p", { class: "erp-muted erp-neuron__empty", text: "Belum terdeteksi." })
            ),
            summary.peakHour === null ? null : el("p", { class: "erp-neuron__peak" },
                "⏰ Paling ramai sekitar pukul ", el("strong", { text: `${String(summary.peakHour).padStart(2, "0")}.00 WIB` })),
            el("section", {},
                el("h3", {}, "Aktivitas terbaru ", el("span", { class: "erp-neuron__live", text: "LIVE" })),
                list(feed.map((item) => el("li", { class: "erp-neuron__event" },
                    el("span", { "aria-hidden": "true", text: FEED_ICON[item.kind] || "•" }),
                    el("span", {}, el("span", { text: item.text }), el("small", { text: dateTime(item.at) }))
                )), "Belum ada aktivitas.")
            ),
            el("p", { class: "erp-muted erp-neuron__privacy", text:
                "🔒 Hanya data brand ini. Tamu anonim (\"Tamu #n\"), tanpa nama/HP/email/isi chat. Terhapus otomatis 90 hari." })
        );
    }

    layout.append(el("section", { class: "erp-neuron__main" }, neuron.element, hint), panel);
    page.appendChild(layout);
    if (open) drawPanel();

    // ---------- Denyut langsung ----------
    let busy = false;
    const tick = async () => {
        if (busy || document.hidden) return;
        busy = true;
        try {
            let fresh = [];
            if (data.mode === "demo" && data.demoAiTick) {
                // Demo: tamu fiktif baru datang tiap beberapa detik.
                fresh = await data.demoAiTick();
                all = all.concat(fresh);
            } else {
                const latest = await data.listAiEvents({ days });
                const key = (event) => `${event.at}|${event.session_key}|${event.kind}|${event.product_id}`;
                const known = new Set(all.map(key));
                fresh = latest.filter((event) => !known.has(key(event)));
                all = latest;
            }
            fresh.forEach((event, index) => setTimeout(() => neuron.spark(event.kind === "cart" ? "cart" : "interest"), index * 250));
            if (fresh.length) {
                hint.textContent = "Klik neuron untuk membuka isinya";
                if (open) drawPanel();
            }
        } catch {
            // Jaringan putus sesaat: coba lagi di putaran berikutnya.
        } finally {
            busy = false;
        }
    };

    const timer = setInterval(tick, data.mode === "demo" ? 4500 : 20000);
    ctx.onCleanup(() => {
        clearInterval(timer);
        neuron.destroy();
    });

    return page;
}
