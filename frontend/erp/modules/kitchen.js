/**
 * KANTOONG ERP — DAPUR & BAR + LAYAR ANTRIAN (Tahap 2 POS Pro)
 * File: frontend/erp/modules/kitchen.js
 *
 * #/kitchen          papan tiket untuk barista/koki
 * #/kitchen/antrian  layar antrian pelanggan (untuk TV, layar penuh)
 *
 * Fondasi: tiket otomatis dari kasir ke BAR / DAPUR, status Baru →
 * Sedang dibuat → Siap → Diambil, warna lama menunggu.
 * Lapisan Zero-to-One:
 *   - ETA JUJUR di tiap tiket & layar antrian (dipelajari dari data nyata)
 *   - DAPUR PREDIKTIF: "siapkan duluan 30 menit ke depan" dari pola jam
 *     yang sama + produk yang sedang ramai ditanya di chat AI Kantoong
 */

import { hasRole } from "../core/org.js";
import { CHANNELS, posSettings } from "../core/pos-pro.js";
import {
    STATIONS, TICKET_STATUS, estimateReady, forecastPrep, learnPrepTimes, orderReadyAt, slaTone, ticketMinutes,
} from "../core/kitchen.js";
import { el, emptyState, friendlyError, pageHeader, segmented, toast } from "../ui.js";
import { wasteDialog } from "./recipes.js";

const view = { station: "all", outlet: null };

const clock = (ms) => new Date(ms).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const elapsed = (from, now) => {
    const seconds = Math.max(0, Math.floor((now - new Date(from).getTime()) / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const NEXT = {
    baru: { status: "dibuat", label: "Mulai buat" },
    dibuat: { status: "siap", label: "Siap ✓" },
    siap: { status: "diambil", label: "Sudah diambil" },
};

export async function render(ctx) {
    const { data, me } = ctx;
    const display = location.hash.split("/")[2] === "antrian";

    const warehouses = await data.listWarehouses();
    const outlets = warehouses.filter((entry) => entry.kind === "outlet" && entry.is_active !== false);
    if (!outlets.some((entry) => entry.id === view.outlet)) view.outlet = outlets[0]?.id || null;

    const page = el("div", { class: display ? "erp-queue" : "erp-page__inner" });
    if (!outlets.length) {
        page.append(pageHeader("Dapur & Bar", "Belum ada outlet."), emptyState("Buat outlet dulu di menu Gudang & Stok (jenis: Outlet)."));
        return page;
    }

    const outlet = outlets.find((entry) => entry.id === view.outlet);
    const [settingsRaw, products, sales, interest] = await Promise.all([
        data.getPosSettings(view.outlet),
        data.listProducts(),
        display ? Promise.resolve([]) : data.listPosSales({ since: new Date(Date.now() - 28 * 86400000).toISOString() }),
        display ? Promise.resolve([]) : data.kitchenInterest({ hours: 2 }),
    ]);
    const settings = posSettings(settingsRaw);
    const capacity = { bar: settings.bar_staff, dapur: settings.dapur_staff };

    let tickets = [];
    const body = el("div");
    let tick = 0;

    const load = async () => {
        try {
            tickets = await data.listKitchenTickets({ outletId: view.outlet, days: 14 });
        } catch (error) {
            toast(friendlyError(error), "error");
        }
        draw();
    };

    const draw = () => {
        const now = Date.now();
        const prep = learnPrepTimes(tickets);
        const eta = estimateReady(tickets, prep, now, capacity);
        body.replaceChildren(display ? queueScreen(tickets, eta, now) : board(tickets, eta, prep, now));
    };

    /* ---------- Papan tiket (barista/koki) ---------- */
    function board(all, eta, prep, now) {
        const live = all.filter((ticket) => ["baru", "dibuat", "siap"].includes(ticket.status) && (view.station === "all" || ticket.station === view.station));
        const column = (status) => {
            const list = live.filter((ticket) => ticket.status === status).sort((a, b) => a.created_at.localeCompare(b.created_at));
            return el("section", { class: `erp-kds__col erp-kds__col--${status}` },
                el("h2", {}, TICKET_STATUS[status], el("span", { class: "erp-kds__count", text: String(list.length) })),
                list.length ? list.map((ticket) => ticketCard(ticket, eta[ticket.id], prep, now)) : emptyState(status === "baru" ? "Tidak ada pesanan baru." : "—")
            );
        };

        const forecast = forecastPrep(sales, new Date(now), {
            products,
            aiEvents: interest.map((row) => ({ at: new Date(now).toISOString(), product_name: row.product_name, count: row.count }))
                .flatMap((row) => Array.from({ length: row.count }, () => row)),
        }).filter((row) => view.station === "all" || row.station === view.station);

        const learned = prep.samples;
        return el("div", { class: "erp-kds" },
            el("aside", { class: "erp-card erp-kds__predict" },
                el("h2", { text: "🔮 Siapkan duluan · 30 menit ke depan" }),
                el("p", { class: "erp-muted", text: `Dari pola jam yang sama di ${forecast[0]?.basis || 0} hari terakhir + produk yang sedang ramai ditanya di chat AI Kantoong.` }),
                forecast.length
                    ? el("ul", { class: "erp-kds__forecast" }, forecast.map((row) => el("li", {},
                        el("span", {}, `${STATIONS[row.station].icon} `, el("strong", { text: row.name })),
                        el("span", { class: "erp-kds__suggest", text: `±${row.suggest}` }),
                        row.hot ? el("small", { class: "erp-kds__hot", text: `🔥 ${row.hot}× ditanya di chat AI 2 jam terakhir` }) : null
                    )))
                    : emptyState("Belum ada pola untuk jam ini."),
                el("p", { class: "erp-kds__learn" },
                    "⏱️ ETA Jujur belajar dari ", el("strong", { text: `${learned} tiket` }), " yang sudah selesai: ",
                    Object.entries(STATIONS).map(([key, station]) => `${station.label} ±${(prep.station[key] ?? station.prep).toFixed(1)} mnt`).join(" · "),
                    ` · ${capacity.bar} barista, ${capacity.dapur} koki`)
            ),
            el("div", { class: "erp-kds__cols" }, column("baru"), column("dibuat"), column("siap"))
        );
    }

    function ticketCard(ticket, readyAt, prep, now) {
        const tone = ticket.status === "siap" ? "ready" : slaTone(ticket.created_at, now);
        const action = NEXT[ticket.status];
        const channel = CHANNELS[ticket.channel];
        return el("article", { class: `erp-kds__ticket is-${tone}` },
            el("header", {},
                el("strong", { class: "erp-kds__no", text: ticket.queue_no || "—" }),
                el("span", { text: `${channel?.icon || ""} ${ticket.label || channel?.label || ""}` }),
                el("span", { class: "erp-kds__station", text: `${STATIONS[ticket.station]?.icon || ""} ${STATIONS[ticket.station]?.label || ticket.station}` })
            ),
            el("ul", {}, ticket.items.map((item) => el("li", {},
                el("strong", { text: `${item.qty}×` }), ` ${item.name}`,
                item.options?.length ? el("small", { text: item.options.join(" · ") }) : null,
                item.note ? el("small", { class: "erp-kds__note", text: `📝 ${item.note}` }) : null
            ))),
            el("footer", {},
                el("span", { class: "erp-kds__timer", text: `⏱ ${elapsed(ticket.created_at, now)}` }),
                readyAt
                    ? el("span", { class: "erp-kds__eta", text: `siap ±${clock(readyAt)}` })
                    : el("span", { class: "erp-kds__eta", text: ticket.status === "siap" ? "menunggu diambil" : `±${ticketMinutes(ticket, prep).toFixed(0)} mnt` }),
                action ? el("button", {
                    class: `erp-btn erp-btn--sm${ticket.status === "dibuat" ? " erp-btn--primary" : ""}`,
                    type: "button",
                    onclick: async (event) => {
                        event.currentTarget.disabled = true;
                        try {
                            await data.setTicketStatus(ticket.id, action.status);
                            await load();
                        } catch (error) {
                            toast(friendlyError(error), "error");
                        }
                    },
                }, action.label) : null
            )
        );
    }

    /* ---------- Layar antrian pelanggan (TV) ---------- */
    function queueScreen(all, eta, now) {
        const orders = new Map();
        for (const ticket of all) {
            if (!["baru", "dibuat", "siap"].includes(ticket.status)) continue;
            const order = orders.get(ticket.queue_no) || { queue_no: ticket.queue_no, label: ticket.label, channel: ticket.channel, statuses: [], created_at: ticket.created_at };
            order.statuses.push(ticket.status);
            orders.set(ticket.queue_no, order);
        }
        const list = [...orders.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
        const ready = list.filter((order) => order.statuses.every((status) => status === "siap"));
        const cooking = list.filter((order) => !order.statuses.every((status) => status === "siap"));
        const shortName = (order) => (CHANNELS[order.channel]?.online ? `${CHANNELS[order.channel].label} · ${order.label}` : order.label);

        return el("div", { class: "erp-queue__screen" },
            el("header", { class: "erp-queue__head" },
                el("strong", { text: outlet.name }),
                el("span", { text: clock(now) }),
                el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => document.documentElement.requestFullscreen?.().catch(() => {}) }, "Layar penuh"),
                el("a", { class: "erp-btn erp-btn--sm", href: "#/kitchen" }, "Tutup")
            ),
            el("div", { class: "erp-queue__cols" },
                el("section", { class: "erp-queue__col" },
                    el("h2", { text: "Sedang dibuat" }),
                    cooking.length ? cooking.map((order) => {
                        const at = orderReadyAt(order.queue_no, all, eta);
                        return el("div", { class: "erp-queue__item" },
                            el("strong", { text: order.queue_no }),
                            el("span", { text: shortName(order) }),
                            el("em", { text: at ? `± ${clock(at)}` : "" })
                        );
                    }) : emptyState("—")
                ),
                el("section", { class: "erp-queue__col erp-queue__col--ready" },
                    el("h2", { text: "🔔 Siap diambil" }),
                    ready.length ? ready.map((order) => el("div", { class: "erp-queue__item erp-queue__item--ready" },
                        el("strong", { text: order.queue_no }),
                        el("span", { text: shortName(order) })
                    )) : emptyState("—")
                )
            ),
            el("p", { class: "erp-queue__foot", text: "Perkiraan waktu dihitung dari antrian & kecepatan dapur yang sebenarnya — Kantoong ETA Jujur." })
        );
    }

    // ---------- Kepala halaman ----------
    if (!display) {
        page.appendChild(pageHeader(
            "Dapur & Bar",
            `${outlet.name} · tiket otomatis dari kasir · ETA Jujur & Dapur Prediktif`,
            outlets.length > 1 ? segmented(outlets.map((entry) => ({ value: entry.id, label: `🏪 ${entry.name}` })), view.outlet, (value) => { view.outlet = value; ctx.rerender(); }) : null,
            segmented([{ value: "all", label: "Semua" }, { value: "bar", label: "🥤 Bar" }, { value: "dapur", label: "🍳 Dapur" }], view.station, (value) => { view.station = value; draw(); ctx.rerender(); }),
            el("a", { class: "erp-btn", href: "#/kitchen/antrian" }, "📺 Layar antrian"),
            el("button", { class: "erp-btn", type: "button", onclick: () => wasteDialog(ctx, view.outlet) }, "🗑️ Bahan dibuang"),
            hasRole(me, "kasir") ? el("a", { class: "erp-btn", href: "#/pos" }, "🧾 Kasir") : null
        ));
        if (!settings.kitchen_enabled) {
            page.appendChild(el("p", { class: "erp-note erp-muted", text: "Pengiriman ke dapur sedang dimatikan di Pengaturan kasir outlet ini." }));
        }
    } else {
        document.body.classList.add("erp-display");
    }
    page.appendChild(body);

    await load();

    // Perbarui: data tiap 8 detik, timer tiap detik.
    const timer = setInterval(() => {
        tick += 1;
        if (tick % 8 === 0) load();
        else draw();
    }, 1000);
    ctx.onCleanup(() => {
        clearInterval(timer);
        document.body.classList.remove("erp-display");
    });

    return page;
}
