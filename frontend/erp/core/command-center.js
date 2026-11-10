/**
 * KANTOONG ERP PRO — RUANG KOMANDO & PUSAT NOTIFIKASI (murni, dites)
 * File: frontend/erp/core/command-center.js
 *
 * Semua sinyal penting perusahaan dikumpulkan jadi satu daftar:
 *   { id, area, tone: "kritis"|"penting"|"info", title, body, href, amount, score, at }
 * - Ruang Komando memakai 3 sinyal teratas = "3 keputusan hari ini".
 * - Pusat notifikasi memakai daftar yang sama (sudah dibaca disimpan di perangkat).
 * Skor = urgensi × dampak rupiah (log), agar yang mendesak DAN besar naik ke atas.
 */

import { aging, dueWithin, outstanding } from "./finance-pro.js";
import { reorderSuggestions, expiryAlerts } from "./inventory-pro.js";
import { contractAlerts } from "./hr-pro.js";
import { followUps, stuckDeals } from "./crm-pro.js";
import { currentApprover, isOverdue, chainProgress } from "./approval-chain.js";

const TONE_WEIGHT = { kritis: 3, penting: 2, info: 1 };
const rp = (n) => `Rp${Math.round(Number(n) || 0).toLocaleString("id-ID")}`;

function scoreOf(tone, amount = 0) {
    return TONE_WEIGHT[tone] * 100 + Math.round(Math.log10(1 + Math.max(0, Number(amount) || 0)) * 10);
}

function signal(fields) {
    return { amount: 0, at: null, ...fields, score: scoreOf(fields.tone, fields.amount) };
}

/**
 * input: { me, members, approvals, invoices, levels, moves, products, sales,
 *          batches, contracts, deals, budgets?, now }
 * Hanya sinyal yang boleh dilihat "me" (owner/direktur melihat semua).
 */
export function buildSignals(input) {
    const { me, now = new Date() } = input;
    const level = me?.level ?? 0;
    const role = me?.job_role ?? "";
    const seesAll = level >= 4;
    const seesMoney = seesAll || role === "keuangan";
    const seesStock = seesAll || level >= 3 || ["gudang", "produk"].includes(role);
    const seesHr = seesAll || role === "hr";
    const seesCrm = seesAll || level >= 3 || ["sales", "cs", "marketing"].includes(role);
    const out = [];
    const nameOf = (id) => (input.members || []).find((m) => m.id === id)?.full_name || "seseorang";

    // 1) Persetujuan yang menunggu SAYA.
    (input.approvals || []).filter((a) => a.status === "menunggu" && (currentApprover(a) ?? a.approver_id) === me?.id).forEach((a) => {
        const late = isOverdue(a, now);
        out.push(signal({
            id: `ap-${a.id}`,
            area: "Persetujuan",
            tone: late || (Number(a.amount) || 0) >= 5_000_000 ? "kritis" : "penting",
            title: `Setujui: ${a.title}`,
            body: `${nameOf(a.requester_id)} · ${a.amount ? rp(a.amount) + " · " : ""}${chainProgress(a).label}${late ? " · menunggu > 24 jam" : ""}`,
            href: "#/approvals",
            amount: Number(a.amount) || 0,
            at: a.created_at,
        }));
    });

    // 2) Uang: piutang telat, hutang jatuh tempo ≤ 3 hari.
    if (seesMoney) {
        const ar = aging(input.invoices || [], "piutang", now);
        const late = ar.rows.filter((r) => r.key !== "belum").flatMap((r) => r.items);
        if (late.length) {
            const total = late.reduce((n, inv) => n + outstanding(inv), 0);
            out.push(signal({
                id: "fin-ar-late",
                area: "Keuangan",
                tone: total >= 10_000_000 ? "kritis" : "penting",
                title: `Tagih ${late.length} piutang yang telat`,
                body: `${rp(total)} belum dibayar · terlama: ${late.sort((a, b) => a.due_date.localeCompare(b.due_date))[0].party}`,
                href: "#/finance/piutang",
                amount: total,
            }));
        }
        const payables = dueWithin(input.invoices || [], "hutang", 3, now);
        if (payables.length) {
            const total = payables.reduce((n, inv) => n + outstanding(inv), 0);
            out.push(signal({
                id: "fin-ap-due",
                area: "Keuangan",
                tone: "penting",
                title: `${payables.length} hutang jatuh tempo ≤ 3 hari`,
                body: `${rp(total)} · ${payables.map((p) => p.party).slice(0, 2).join(", ")}`,
                href: "#/finance/hutang",
                amount: total,
            }));
        }
        (input.budgetUsage || []).filter((b) => b.status === "lewat").forEach((b) => {
            out.push(signal({
                id: `fin-budget-${b.id}`,
                area: "Keuangan",
                tone: "penting",
                title: `Anggaran ${b.label || b.account_code} terlampaui (${b.pct}%)`,
                body: `Realisasi ${rp(b.actual)} dari ${rp(b.amount)}`,
                href: "#/finance/anggaran",
                amount: b.actual - b.amount,
            }));
        });
    }

    // 3) Stok: habis / harus dipesan hari ini; kedaluwarsa.
    if (seesStock) {
        const reorder = reorderSuggestions({
            levels: input.levels, moves: input.moves, products: input.products, sales: input.sales, now,
        }).filter((r) => r.urgency === "habis" || r.urgency === "segera");
        if (reorder.length) {
            const value = reorder.reduce((n, r) => n + r.suggest * (r.cost || 0), 0);
            out.push(signal({
                id: "stock-reorder",
                area: "Gudang",
                tone: reorder.some((r) => r.urgency === "habis") ? "kritis" : "penting",
                title: `${reorder.length} barang harus dipesan hari ini`,
                body: reorder.slice(0, 3).map((r) => `${r.name}${r.daysLeft != null ? ` (${r.daysLeft} hr)` : " (habis)"}`).join(", "),
                href: "#/inventory/saran",
                amount: value,
            }));
        }
        const expiring = expiryAlerts(input.batches || [], now).filter((b) => b.status !== "bulan");
        if (expiring.length) {
            out.push(signal({
                id: "stock-expiry",
                area: "Gudang",
                tone: expiring.some((b) => b.status === "lewat") ? "kritis" : "penting",
                title: `${expiring.length} batch kedaluwarsa ≤ 7 hari`,
                body: "Keluarkan lebih dulu (FEFO) atau jadikan promo sebelum terbuang.",
                href: "#/inventory/kedaluwarsa",
            }));
        }
    }

    // 4) SDM: kontrak habis / percobaan selesai.
    if (seesHr) {
        contractAlerts(input.contracts || [], now).forEach((c) => {
            out.push(signal({
                id: `hr-contract-${c.id}-${c.alert}`,
                area: "SDM",
                tone: c.alert === "habis" ? "kritis" : "penting",
                title: c.alert === "percobaan"
                    ? `Masa percobaan ${nameOf(c.member_id)} selesai ${c.left} hari lagi`
                    : c.alert === "habis"
                        ? `Kontrak ${nameOf(c.member_id)} sudah habis`
                        : `Kontrak ${nameOf(c.member_id)} habis ${c.left} hari lagi`,
                body: "Putuskan: perpanjang, angkat tetap, atau akhiri.",
                href: "#/hr/kontrak",
            }));
        });
    }

    // 5) CRM: follow-up telat & deal macet (milik sendiri kecuali atasan).
    if (seesCrm) {
        const mine = (input.deals || []).filter((d) => level >= 3 || d.owner_id === me?.id);
        const groups = followUps(mine, now);
        if (groups.telat.length || groups.hariIni.length) {
            const list = [...groups.telat, ...groups.hariIni];
            out.push(signal({
                id: "crm-follow",
                area: "CRM",
                tone: groups.telat.length ? "penting" : "info",
                title: `${list.length} follow-up calon pelanggan${groups.telat.length ? ` (${groups.telat.length} telat)` : " hari ini"}`,
                body: list.slice(0, 2).map((d) => `${d.customer}: ${d.next_action || "hubungi"}`).join(" · "),
                href: "#/crm/pipeline",
                amount: list.reduce((n, d) => n + (Number(d.value) || 0), 0),
            }));
        }
        const stuck = stuckDeals(mine, now);
        if (stuck.length) {
            out.push(signal({
                id: "crm-stuck",
                area: "CRM",
                tone: "info",
                title: `${stuck.length} calon pelanggan diam > 7 hari`,
                body: "Tanpa rencana follow-up. Sapa lagi atau tandai kalah beserta alasannya.",
                href: "#/crm/pipeline",
                amount: stuck.reduce((n, d) => n + (Number(d.value) || 0), 0),
            }));
        }
    }

    return out.sort((a, b) => b.score - a.score);
}

/** "3 keputusan hari ini" untuk Ruang Komando. */
export function topDecisions(signals, count = 3) {
    return (signals || []).filter((s) => s.tone !== "info").slice(0, count);
}

/** Skor kesehatan 0–100: mulai 100, dikurangi tiap sinyal sesuai beratnya. */
export function healthScore(signals) {
    const penalty = (signals || []).reduce((n, s) => n + (s.tone === "kritis" ? 12 : s.tone === "penting" ? 5 : 1), 0);
    const score = Math.max(0, 100 - penalty);
    return { score, label: score >= 85 ? "Sehat" : score >= 65 ? "Perlu perhatian" : "Waspada" };
}

/** Notifikasi belum dibaca (id dibaca disimpan perangkat). */
export function unreadCount(signals, readIds = []) {
    const read = new Set(readIds);
    return (signals || []).filter((s) => !read.has(s.id)).length;
}

/* ---------- Ctrl+K: pencarian perintah ---------- */

const fold = (text) => String(text || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/** Skor cocok: awalan kata > berisi > huruf berurutan. 0 = tidak cocok. */
export function matchScore(query, text) {
    const q = fold(query).trim();
    const t = fold(text);
    if (!q) return 1;
    if (t.startsWith(q)) return 100;
    if (t.split(/[\s·/,-]+/).some((word) => word.startsWith(q))) return 80;
    if (t.includes(q)) return 60;
    let i = 0;
    for (const ch of t) if (ch === q[i]) i += 1;
    return i === q.length ? 20 + Math.min(20, q.length) : 0;
}

/** items: [{ id, label, hint, group, keywords? }] */
export function searchCommands(query, items, limit = 12) {
    return (items || [])
        .map((item) => {
            // Keterangan & kata kunci hanya dicocokkan utuh (bukan huruf acak) agar hasil tidak melantur.
            const loose = (text, weight) => {
                const score = matchScore(query, text || "");
                return score >= 60 ? score * weight : 0;
            };
            return { item, score: Math.max(matchScore(query, item.label), loose(item.keywords, 0.9), loose(item.hint, 0.6)) };
        })
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
        .slice(0, limit)
        .map((row) => row.item);
}
