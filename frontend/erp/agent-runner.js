/**
 * KANTOONG ERP — PELAKSANA TUGAS AGEN AI
 * File: frontend/erp/agent-runner.js
 *
 * Mode "tampil": panel melayang menampilkan setiap langkah & layar ikut berpindah
 * ke menu yang sedang dikerjakan (bisa dihentikan dengan tombol / ketik "stop").
 * Mode "belakang": tanpa pindah layar; hasil diberitahukan lewat pesan singkat.
 *
 * Aturan keselamatan: agen hanya MENYIAPKAN. Dokumen buatan agen selalu
 * "menunggu tanda tangan" manusia; PO masuk rantai persetujuan; pesan
 * penagihan hanya disalin, tidak pernah dikirim otomatis.
 */

import { advanceTask, plannedSteps, stopTask } from "./core/agents.js";
import { aging, outstanding } from "./core/finance-pro.js";
import { reorderSuggestions } from "./core/inventory-pro.js";
import { defaultValues, templateById, validateValues } from "./core/documents.js";
import { el, toast } from "./ui.js";

const running = new Map(); // task.id → { stop: boolean }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fold = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

export function stopAll() {
    running.forEach((flag) => {
        flag.stop = true;
    });
}

export function isRunning() {
    return running.size > 0;
}

function overlay(task, agent) {
    let box = document.getElementById("erpAgentLive");
    if (!box) {
        box = el("aside", { class: "erp-agentlive", id: "erpAgentLive", role: "status", "aria-live": "polite" });
        document.body.append(box);
    }
    const draw = (t) => {
        // Bagian opsional bernilai null: disaring agar tidak tertulis "null" di layar.
        box.replaceChildren(...[
            el("header", { class: "erp-agentlive__head" },
                el("span", { class: "erp-agentlive__orb", "aria-hidden": "true" }),
                el("div", {}, el("strong", { text: agent?.name || "Asisten" }), el("small", { text: t.title })),
                ["antre", "berjalan"].includes(t.status)
                    ? el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => {
                        const flag = running.get(t.id);
                        if (flag) flag.stop = true;
                    } }, "Stop")
                    : el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => box.remove() }, "Tutup")),
            el("ol", { class: "erp-agentlive__steps" }, t.steps.map((s, i) => {
                const now = t.status === "berjalan" && s.status === "menunggu" && (i === 0 || t.steps[i - 1].status === "selesai");
                return el("li", { class: `is-${now ? "now" : s.status}` }, el("span", { text: s.status === "selesai" ? "✓" : s.status === "gagal" ? "✕" : now ? "●" : "○" }), el("span", { text: s.label }));
            })),
            t.status === "selesai" ? el("p", { class: "erp-agentlive__done", text: t.result?.message || "Selesai." }) : null,
            t.status === "gagal" ? el("p", { class: "erp-agentlive__err", text: t.error || "Gagal." }) : null,
            t.status === "dihentikan" ? el("p", { class: "erp-agentlive__err", text: "Dihentikan olehmu. Tidak ada yang diubah setelah langkah terakhir." }) : null,
        ].filter(Boolean));
    };
    return { draw, remove: () => box.remove() };
}

/**
 * Jalankan satu tugas. ctx = { data, me }. Mengembalikan tugas akhir (sudah disimpan).
 */
export async function runTask(ctx, task, { agent, visible = true } = {}) {
    const flag = { stop: false };
    running.set(task.id, flag);
    let t = { ...task, steps: task.steps?.length ? task.steps : plannedSteps(task), status: "berjalan", agent_id: agent?.id ?? null };
    const live = visible ? overlay(t, agent) : null;
    const pace = visible ? 650 : 0;
    const save = async () => {
        live?.draw(t);
        try {
            t = await ctx.data.saveAgentTask(t) || t;
        } catch {
            // Tetap lanjut walau riwayat gagal disimpan.
        }
    };
    const step = async (fn, go) => {
        if (flag.stop) throw Object.assign(new Error("stop"), { stop: true });
        if (visible && go) location.hash = go;
        await sleep(pace);
        const note = await fn?.();
        t = advanceTask(t, { note: typeof note === "string" ? note : "" });
        await save();
    };

    await save();
    try {
        const result = await SKILL_RUNNERS[t.skill](ctx, t, step);
        t = { ...t, status: "selesai", result, finished_at: new Date().toISOString() };
        await save();
        if (!visible) toast(`🤖 ${agent?.name || "Asisten"}: ${result?.message || "tugas selesai."}`);
    } catch (error) {
        t = error.stop ? stopTask(t) : advanceTask(t, { ok: false, note: error.message || "Gagal." });
        await save();
        if (!visible && !error.stop) toast(`🤖 ${error.message}`, "error");
    } finally {
        running.delete(task.id);
    }
    return t;
}

/* ---------- Keahlian ---------- */

async function findMember(ctx, name) {
    const members = await ctx.data.listMembers().catch(() => []);
    const q = fold(name);
    return members.find((m) => fold(m.full_name) === q) || members.find((m) => fold(m.full_name).includes(q)) || members.find((m) => q && q.includes(fold(m.full_name).split(" ")[0]));
}

const SKILL_RUNNERS = {
    async dokumen(ctx, t, step) {
        const template = templateById(t.input?.template);
        if (!template) throw new Error("Jenis dokumen belum dikenali. Contoh: \"buatkan slip gaji untuk Andi\".");
        let values = defaultValues(template);
        await step(null, "#/documents");
        await step(null, "#/documents/buat");
        await step(async () => {
            const target = t.input?.target || "";
            if (["slip", "keterangan", "peringatan"].includes(template.id)) {
                const m = await findMember(ctx, target);
                if (!m) throw new Error(`Karyawan "${target || "?"}" tidak ditemukan.`);
                const salary = await ctx.data.getSalary?.(m.id).catch(() => null);
                values = { ...values, employee: m.full_name, position: m.position_title, base: salary?.base_salary || "", since: "" };
                if (template.id === "keterangan") values.since = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
                if (template.id === "peringatan") values.violation = t.input?.note || "";
            } else if (["invoice", "penawaran"].includes(template.id)) {
                const deals = await ctx.data.listDeals?.().catch(() => []) ?? [];
                const d = deals.find((x) => fold(x.customer).includes(fold(target))) || null;
                const name = d?.customer || target;
                const items = d ? `${d.title} | 1 | ${d.value}` : "";
                values = template.id === "invoice"
                    ? { ...values, customer: name, items, due: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) }
                    : { ...values, to: name, subject: d?.title || "Penawaran harga", items };
            } else if (template.id === "po") {
                const suppliers = await ctx.data.listSuppliers?.().catch(() => []) ?? [];
                const s = suppliers.find((x) => fold(x.name).includes(fold(target)));
                values = { ...values, supplier: s?.name || target };
            }
            const problem = validateValues(template, values);
            if (problem) throw new Error(`Data belum lengkap untuk ${template.label.toLowerCase()}: ${problem} Lengkapi lewat menu Dokumen.`);
            return `Diisi untuk ${values.employee || values.customer || values.to || values.supplier}`;
        });
        let record = null;
        await step(async () => {
            const { issueDocument } = await import("./docs/issue.js");
            ({ record } = await issueDocument(ctx.data, template.id, values, { sign: true }));
            return record.number;
        });
        await step(null, "#/documents/kotak");
        const wait = record.status === "menunggu";
        return { message: `${template.label} ${record.number} ${wait ? "siap — menunggu tanda tangan manusia." : "terbit (kamu pimpinan, langsung sah)."}`, document_id: record.id, number: record.number };
    },

    async laporan(ctx, t, step) {
        let values = null;
        await step(null, "#/finance");
        await step(async () => {
            const { default: monthly } = await import("./modules/agent-skills.js");
            values = await monthly(ctx);
            return `Omzet ${values.omzet.toLocaleString("id-ID")}`;
        });
        let record = null;
        await step(async () => {
            const { issueDocument } = await import("./docs/issue.js");
            ({ record } = await issueDocument(ctx.data, "laporan", values, { sign: true }));
            return record.number;
        }, "#/documents");
        await step(null, "#/documents/kotak");
        return { message: `Laporan bulanan ${record.number} tersusun${record.status === "menunggu" ? " — menunggu tanda tangan." : " dan terbit."}`, document_id: record.id };
    },

    async restok(ctx, t, step) {
        let rows = [];
        await step(async () => {
            const since = new Date(Date.now() - 14 * 86400000).toISOString();
            const [levels, moves, products, sales] = await Promise.all([
                ctx.data.listStockLevels(), ctx.data.listStockMoves({ limit: 2000 }), ctx.data.listProducts(), ctx.data.listPosSales?.({ since }).catch(() => []) ?? [],
            ]);
            rows = reorderSuggestions({ levels, moves, products, sales });
            return `${rows.length} barang`;
        }, "#/inventory/saran");
        await step(() => {
            if (!rows.length) throw new Error("Semua stok cukup — tidak ada yang perlu dipesan.");
        });
        await step(async () => {
            const total = rows.reduce((n, r) => n + r.suggest * (r.cost || 0), 0);
            await ctx.data.createApproval({ kind: "po", title: `PO restok ${rows.length} barang (disiapkan asisten AI)`, amount: total || null, note: rows.slice(0, 12).map((r) => `${r.name}: ${r.suggest}`).join("\n") });
        }, "#/approvals");
        return { message: `Pengajuan PO restok ${rows.length} barang dibuat — menunggu persetujuan berjenjang.` };
    },

    async tagih(ctx, t, step) {
        let late = [];
        await step(async () => {
            const invoices = await ctx.data.listInvoices?.().catch(() => []) ?? [];
            late = aging(invoices, "piutang").rows.filter((r) => r.key !== "belum").flatMap((r) => r.items);
            return `${late.length} tagihan`;
        }, "#/finance/piutang");
        await step(() => {
            if (!late.length) throw new Error("Tidak ada piutang yang telat. 👍");
        });
        const messages = [];
        await step(() => {
            late.forEach((inv) => messages.push({ party: inv.party, text: `Halo ${inv.party}, kami ingin mengingatkan tagihan ${inv.number} sebesar Rp${outstanding(inv).toLocaleString("id-ID")} yang sudah jatuh tempo pada ${inv.due_date}. Mohon konfirmasi jadwal pembayarannya. Terima kasih.` }));
        });
        return { message: `${messages.length} pesan penagihan siap disalin (tidak dikirim otomatis).`, messages };
    },
};
