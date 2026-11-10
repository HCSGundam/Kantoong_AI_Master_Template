/**
 * KANTOONG ERP PRO — RUANG KOMANDO OWNER
 * File: frontend/erp/modules/command.js
 *
 * Satu layar untuk mengambil keputusan, bukan sekadar melihat angka:
 *   1. "3 keputusan hari ini": sinyal paling mendesak × paling besar rupiahnya,
 *      masing-masing dengan tombol langsung ke tempat menyelesaikannya.
 *   2. Denyut perusahaan: omzet hari ini vs kemarin (sampai jam yang sama), kas,
 *      piutang telat, hutang 7 hari, stok kritis, pengajuan menunggu.
 *   3. Proyeksi kas 30 hari: kapan kas paling tipis & apa penyebabnya.
 *   4. Skor kesehatan + semua sinyal per bagian + siapa tidak masuk hari ini.
 * Owner & direktur (level 4+).
 */

import { aging, cashForecast, dueWithin, outstanding } from "../core/finance-pro.js";
import { reorderSuggestions } from "../core/inventory-pro.js";
import { onLeave } from "../core/hr-pro.js";
import { pipelineSummary } from "../core/crm-pro.js";
import { healthScore, topDecisions } from "../core/command-center.js";
import { el, emptyState, pageHeader, rupiah, shortRupiah, statCard } from "../ui.js";
import { cashBalance, loadProData } from "./pro-data.js";
import { autoRefresh } from "./shared.js";

const SVG = "http://www.w3.org/2000/svg";
const svg = (tag, attrs = {}) => {
    const node = document.createElementNS(SVG, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
    return node;
};

function greeting(name) {
    const hour = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }));
    const part = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 19 ? "Selamat sore" : "Selamat malam";
    return `${part}, ${String(name || "").split(" ")[0]}`;
}

/** Omzet hari ini vs kemarin sampai jam yang sama (online yang dibayar + kasir). */
function todayVsYesterday(orders, sales, now = new Date()) {
    const dayKey = (d) => new Date(new Date(d).getTime() + 7 * 3600000).toISOString().slice(0, 10);
    const today = dayKey(now);
    const yesterday = dayKey(now.getTime() - 86400000);
    const minuteOfDay = (d) => {
        const t = new Date(new Date(d).getTime() + 7 * 3600000);
        return t.getUTCHours() * 60 + t.getUTCMinutes();
    };
    const limit = minuteOfDay(now);
    const paid = (o) => !["dibatalkan", "menunggu_pembayaran", "pending", "batal"].includes(o.status);
    const rows = [
        ...(orders || []).filter(paid).map((o) => ({ at: o.created_at, total: Number(o.total) || 0 })),
        ...(sales || []).filter((s) => s.status !== "void").map((s) => ({ at: s.created_at, total: Number(s.total) || 0 })),
    ];
    let a = 0;
    let b = 0;
    let countToday = 0;
    rows.forEach((row) => {
        const key = dayKey(row.at);
        if (key === today) {
            a += row.total;
            countToday += 1;
        } else if (key === yesterday && minuteOfDay(row.at) <= limit) b += row.total;
    });
    const change = b > 0 ? Math.round(((a - b) / b) * 100) : null;
    return { today: a, yesterday: b, change, count: countToday };
}

function healthRing({ score, label }) {
    const r = 34;
    const c = 2 * Math.PI * r;
    const ring = svg("svg", { viewBox: "0 0 84 84", class: "erp-health__ring", "aria-hidden": "true" });
    ring.append(
        svg("circle", { cx: 42, cy: 42, r, class: "erp-health__track" }),
        svg("circle", { cx: 42, cy: 42, r, class: "erp-health__fill", "stroke-dasharray": `${(score / 100) * c} ${c}`, transform: "rotate(-90 42 42)" })
    );
    const tone = score >= 85 ? "good" : score >= 65 ? "warn" : "bad";
    return el("div", { class: `erp-health erp-health--${tone}`, role: "img", "aria-label": `Skor kesehatan ${score} dari 100, ${label}` },
        ring,
        el("div", { class: "erp-health__text" }, el("strong", { text: String(score) }), el("small", { text: label })));
}

function forecastChart(forecast) {
    const points = forecast.series;
    if (!points.length) return null;
    const w = 600;
    const h = 150;
    const values = points.map((p) => p.balance);
    const max = Math.max(0, ...values);
    const min = Math.min(0, ...values);
    const span = max - min || 1;
    const x = (i) => (i / Math.max(1, points.length - 1)) * w;
    const y = (v) => h - ((v - min) / span) * h;
    const chart = svg("svg", { viewBox: `0 0 ${w} ${h + 4}`, class: "erp-forecast__svg", preserveAspectRatio: "none", role: "img", "aria-label": "Proyeksi saldo kas 30 hari" });
    const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.balance).toFixed(1)}`).join(" ");
    chart.append(
        svg("path", { d: `${path} L${w},${y(min)} L0,${y(min)} Z`, class: "erp-forecast__area" }),
        svg("line", { x1: 0, x2: w, y1: y(0), y2: y(0), class: "erp-forecast__zero" }),
        svg("path", { d: path, class: "erp-forecast__line" })
    );
    const lowIndex = points.indexOf(forecast.lowest);
    chart.append(svg("circle", { cx: x(lowIndex), cy: y(forecast.lowest.balance), r: 5, class: "erp-forecast__low" }));
    return chart;
}

export async function render(ctx) {
    const { me } = ctx;
    const { raw, signals } = await loadProData(ctx, { fresh: true });
    const now = new Date();
    const page = el("div", { class: "erp-page__inner erp-command" });

    const decisions = topDecisions(signals);
    const health = healthScore(signals);
    const pulse = todayVsYesterday(raw.orders, raw.sales, now);
    const cash = cashBalance(raw.lines);
    const ar = aging(raw.invoices, "piutang", now);
    const arLate = ar.rows.filter((r) => r.key !== "belum").reduce((n, r) => n + r.total, 0);
    const ap7 = dueWithin(raw.invoices, "hutang", 7, now).reduce((n, inv) => n + outstanding(inv), 0);
    const reorder = reorderSuggestions({ levels: raw.levels, moves: raw.moves, products: raw.products, sales: raw.sales, now });
    const waiting = raw.approvals.filter((a) => a.status === "menunggu").length;
    const forecast = cashForecast({ cashNow: cash, invoices: raw.invoices, recurring: raw.recurring, days: 30, now });
    const absent = onLeave(raw.leaves, now.toISOString().slice(0, 10));
    const pipe = pipelineSummary(raw.deals);
    const nameOf = (id) => raw.members.find((m) => m.id === id)?.full_name || "—";

    page.appendChild(pageHeader(
        "Ruang Komando",
        `${greeting(me.full_name)}. Ini yang paling penting untuk diputuskan hari ini.`,
        el("span", { class: "erp-command__date", text: now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }) })
    ));

    // 1) Keputusan hari ini
    page.appendChild(el("section", { class: "erp-command__hero" },
        el("div", { class: "erp-command__decisions" },
            el("h2", { class: "erp-command__h", text: decisions.length ? `${decisions.length} keputusan hari ini` : "Tidak ada keputusan mendesak" }),
            decisions.length
                ? el("ol", { class: "erp-decisions" }, decisions.map((s, i) => el("li", { class: `erp-decision erp-decision--${s.tone}` },
                    el("span", { class: "erp-decision__no", text: String(i + 1) }),
                    el("div", { class: "erp-decision__body" },
                        el("span", { class: "erp-decision__area", text: s.area }),
                        el("strong", { text: s.title }),
                        el("small", { text: s.body })),
                    el("a", { class: "erp-btn erp-btn--sm erp-btn--primary", href: s.href }, "Selesaikan →"))))
                : el("p", { class: "erp-muted", text: "Semua aman. Waktu yang tepat untuk memikirkan pertumbuhan, bukan memadamkan api." })),
        healthRing(health)));

    // 2) Denyut perusahaan
    page.appendChild(el("section", { class: "erp-stats erp-command__pulse" },
        statCard({
            label: "Omzet hari ini",
            value: shortRupiah(pulse.today),
            sub: pulse.change == null ? `${pulse.count} transaksi` : `${pulse.change >= 0 ? "▲" : "▼"} ${Math.abs(pulse.change)}% vs kemarin di jam yang sama`,
            tone: pulse.change == null ? "" : pulse.change >= 0 ? "good" : "bad",
        }),
        statCard({ label: "Kas & bank", value: shortRupiah(cash), sub: forecast.firstNegative ? `Minus mulai ${fmtDay(forecast.firstNegative.date)}` : `Terendah 30 hari: ${shortRupiah(forecast.lowest.balance)}`, tone: forecast.firstNegative ? "bad" : "" }),
        statCard({ label: "Piutang telat", value: shortRupiah(arLate), sub: `Total piutang ${shortRupiah(ar.total)}`, tone: arLate > 0 ? "warn" : "" }),
        statCard({ label: "Hutang ≤ 7 hari", value: shortRupiah(ap7), sub: "Siapkan dana pembayaran" }),
        statCard({ label: "Barang perlu dipesan", value: String(reorder.length), sub: reorder.length ? `${reorder.filter((r) => r.urgency !== "pesan").length} mendesak` : "Stok aman", tone: reorder.some((r) => r.urgency === "habis") ? "bad" : "" }),
        statCard({ label: "Pengajuan menunggu", value: String(waiting), sub: "di seluruh perusahaan" }),
        statCard({ label: "Peluang penjualan", value: shortRupiah(pipe.forecast), sub: `Berbobot dari ${shortRupiah(pipe.openValue)} pipeline${pipe.winRate != null ? ` · menang ${pipe.winRate}%` : ""}` })
    ));

    // 3) Proyeksi kas
    const flows = forecast.series.flatMap((p) => p.items.map((it) => ({ ...it, date: p.date }))).filter((f) => Math.abs(f.amount) > 0);
    const biggestOut = flows.filter((f) => f.amount < 0).sort((a, b) => a.amount - b.amount).slice(0, 3);
    page.appendChild(el("section", { class: "erp-card erp-forecast" },
        el("div", { class: "erp-card__head" },
            el("div", {},
                el("h2", { text: "Proyeksi kas 30 hari" }),
                el("p", { class: "erp-muted", text: "Dari saldo kas & bank + tagihan jatuh tempo + biaya rutin. Piutang yang sudah telat dihitung 60% saja (jujur, tidak optimis)." }))),
        raw.lines.length || raw.invoices.length
            ? el("div", { class: "erp-forecast__body" },
                forecastChart(forecast),
                el("div", { class: "erp-forecast__facts" },
                    el("p", {}, el("span", { text: "Paling tipis" }), el("strong", { text: `${rupiah(forecast.lowest.balance)} · ${fmtDay(forecast.lowest.date)}` })),
                    el("p", {}, el("span", { text: "Akhir 30 hari" }), el("strong", { text: rupiah(forecast.end) })),
                    biggestOut.length ? el("p", {}, el("span", { text: "Pengeluaran terbesar" }), el("strong", { text: biggestOut.map((f) => `${f.label} (${shortRupiah(-f.amount)})`).join(", ") })) : null))
            : emptyState("Belum ada data kas. Isi jurnal / tagihan di menu Keuangan.")));

    // 4) Semua sinyal per bagian + yang tidak masuk
    const areas = [...new Set(signals.map((s) => s.area))];
    page.appendChild(el("section", { class: "erp-command__grid" },
        el("article", { class: "erp-card" },
            el("h2", { text: "Semua yang perlu perhatian" }),
            signals.length
                ? areas.map((area) => el("div", { class: "erp-signals" },
                    el("h3", { text: area }),
                    signals.filter((s) => s.area === area).map((s) => el("a", { class: `erp-signal erp-signal--${s.tone}`, href: s.href },
                        el("strong", { text: s.title }), el("small", { text: s.body })))))
                : emptyState("Tidak ada sinyal. 🎉")),
        el("article", { class: "erp-card" },
            el("h2", { text: "Tidak masuk hari ini" }),
            absent.length
                ? el("ul", { class: "erp-list" }, absent.map((l) => el("li", { class: "erp-list__row" },
                    el("strong", { text: nameOf(l.member_id) }),
                    el("small", { class: "erp-muted", text: `${{ tahunan: "Cuti", sakit: "Sakit", izin: "Izin", melahirkan: "Cuti melahirkan" }[l.kind] || l.kind} s.d. ${fmtDay(l.ends)}` }))))
                : el("p", { class: "erp-muted", text: "Semua masuk (tidak ada cuti/izin tercatat hari ini)." }),
            el("h2", { class: "erp-command__h2", text: "Pipeline penjualan" }),
            el("ul", { class: "erp-list" }, pipe.rows.filter((r) => r.count).map((r) => el("li", { class: "erp-list__row" },
                el("span", { text: `${r.label} (${r.count})` }), el("strong", { text: shortRupiah(r.value) })))),
            el("a", { class: "erp-btn erp-btn--sm", href: "#/crm/pipeline" }, "Buka pipeline →"))
    ));

    autoRefresh(ctx, () => ctx.rerender());
    return page;
}

function fmtDay(day) {
    return new Date(`${day}T00:00:00+07:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });
}
