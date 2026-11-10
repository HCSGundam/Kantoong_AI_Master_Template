/**
 * KANTOONG ERP — AGEN AI (menu "Agen AI")
 * File: frontend/erp/modules/agents.js
 *
 * Wadah tim AI pribadi setiap anggota:
 * - Mode: "Tampil di layar" (tonton AI bekerja) / "Bekerja di belakang".
 * - Agen: 1 asisten pribadi gratis + agen tambahan dari add-on "ai-agents".
 * - Perintah lewat ketik atau SUARA (dikte di perangkat, Web Speech API).
 * - Riwayat tugas: langkah, hasil, dan pesan siap salin.
 */

import { AGENT_ADDON, AGENT_MODES, SKILLS, TASK_STATUS, agentQuota, assignAgent, defaultAgents, isStopCommand, parseCommand, plannedSteps, validateAgent } from "../core/agents.js";
import { dateTime, el, emptyState, formDialog, friendlyError, pageHeader, segmented, toast } from "../ui.js";
import { isRunning, runTask, stopAll } from "../agent-runner.js";
import { invalidateProData } from "./pro-data.js";

const EXAMPLES = ["buatkan slip gaji untuk Andi", "bikin invoice ke PT Kantor Maju", "susun laporan bulanan", "ajukan PO restok", "siapa yang belum bayar?", "surat keterangan kerja untuk Rina"];

export async function render(ctx) {
    const { data, me } = ctx;
    const [settingsRaw, tasks, addons, quotaExtra] = await Promise.all([
        data.getAgentSettings?.().catch(() => null),
        data.listAgentTasks?.().catch(() => []) ?? [],
        Promise.resolve(me.addons ?? data.listAddons?.() ?? []).catch(() => []),
        data.addonQuota?.(AGENT_ADDON).catch(() => 0) ?? 0,
    ]);
    const quota = agentQuota({ addons, addonQuota: quotaExtra, level: me.level });
    const settings = { mode: settingsRaw?.mode || "tampil", agents: settingsRaw?.agents?.length ? settingsRaw.agents : defaultAgents(me) };
    const saveSettings = async (next) => {
        try {
            await data.saveAgentSettings(next);
            ctx.rerender();
        } catch (error) {
            toast(friendlyError(error), "error");
        }
    };

    const page = el("div", { class: "erp-page__inner erp-agents" });
    page.appendChild(pageHeader(
        "Agen AI",
        "Tim AI pribadimu: perintahkan lewat ketik atau suara, tonton ia bekerja atau biarkan bekerja di belakang. AI hanya menyiapkan — keputusan, tanda tangan & pengiriman tetap di tanganmu."
    ));

    // ---------- Perintah ----------
    const input = el("input", { class: "erp-agentcmd__input", type: "text", placeholder: "Perintahkan asisten… (contoh: buatkan slip gaji untuk Andi)", maxlength: 200, "aria-label": "Perintah untuk agen" });
    const mic = el("button", { class: "erp-btn erp-agentcmd__mic", type: "button", "aria-label": "Perintah suara", title: "Perintah suara (dikte di perangkat)" }, "🎙");
    const go = el("button", { class: "erp-btn erp-btn--primary", type: "submit" }, "Jalankan");
    const form = el("form", { class: "erp-agentcmd" }, mic, input, go);
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        await command(ctx, input.value, settings, tasks);
    });
    setupVoice(mic, input, () => form.requestSubmit());

    page.appendChild(el("section", { class: "erp-card erp-agentcmd-card" },
        form,
        el("div", { class: "erp-chips" }, EXAMPLES.map((ex) => el("button", { class: "erp-chip", type: "button", onclick: () => {
            input.value = ex;
            input.focus();
        } }, ex))),
        el("div", { class: "erp-agentmode" },
            el("span", { class: "erp-muted", text: "Cara kerja:" }),
            segmented(Object.entries(AGENT_MODES).map(([value, m]) => ({ value, label: m.label })), settings.mode, (mode) => saveSettings({ ...settings, mode })),
            el("small", { class: "erp-muted", text: AGENT_MODES[settings.mode].desc })),
        isRunning() ? el("button", { class: "erp-btn erp-btn--danger", type: "button", onclick: () => stopAll() }, "■ Hentikan semua tugas") : null));

    // ---------- Tim agen ----------
    const busy = new Set(tasks.filter((t) => t.status === "berjalan").map((t) => t.agent_id));
    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" },
            el("div", {},
                el("h2", { text: `Tim agenku (${settings.agents.length}/${quota.total})` }),
                el("p", { class: "erp-muted", text: quota.extra ? `Add-on Agen AI aktif: +${quota.extra} agen.` : "Paket dasar: 1 asisten pribadi. Aktifkan add-on Agen AI untuk menambah agen yang bekerja bersamaan." })),
            el("button", { class: "erp-btn", type: "button", disabled: settings.agents.length >= quota.total, onclick: () => editAgent(settings, null, quota, saveSettings) }, "+ Agen")),
        el("div", { class: "erp-agentgrid" }, settings.agents.map((a) => el("article", { class: `erp-agentcard${busy.has(a.id) ? " is-busy" : ""}` },
            el("span", { class: "erp-agentcard__orb", "aria-hidden": "true" }),
            el("div", { class: "erp-agentcard__main" },
                el("strong", { text: a.name }),
                el("small", { text: `${a.role || "Asisten"} · ${busy.has(a.id) ? "sedang bekerja" : a.active === false ? "nonaktif" : "siap"}` }),
                el("div", { class: "erp-chips erp-chips--sm" }, a.skills.map((s) => el("span", { class: "erp-tag", text: SKILLS[s]?.label || s })))),
            el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => editAgent(settings, a, quota, saveSettings) }, "Atur"))))));

    // ---------- Riwayat tugas ----------
    page.appendChild(el("section", { class: "erp-card" },
        el("h2", { text: "Riwayat tugas" }),
        tasks.length
            ? el("ul", { class: "erp-tasks" }, tasks.slice(0, 40).map((t) => el("li", { class: `erp-task is-${t.status}` },
                el("div", { class: "erp-task__top" },
                    el("strong", { text: t.title || SKILLS[t.skill]?.label }),
                    el("span", { class: `erp-pill erp-pill--${{ selesai: "good", gagal: "bad", dihentikan: "bad", berjalan: "warn", antre: "warn" }[t.status]}`, text: TASK_STATUS[t.status] })),
                el("small", { class: "erp-muted", text: `${settings.agents.find((a) => a.id === t.agent_id)?.name || "Asisten"} · ${dateTime(t.created_at)}${t.steps?.length ? ` · ${t.steps.filter((s) => s.status === "selesai").length}/${t.steps.length} langkah` : ""}` }),
                t.result?.message ? el("p", { class: "erp-task__msg", text: t.result.message }) : null,
                t.error ? el("p", { class: "erp-task__err", text: t.error }) : null,
                t.result?.document_id ? el("a", { class: "erp-btn erp-btn--sm", href: "#/documents/kotak" }, "Buka di Kotak Masuk →") : null,
                (t.result?.messages || []).length ? el("ul", { class: "erp-task__copy" }, t.result.messages.map((m) => el("li", {},
                    el("span", { text: m.party }),
                    el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => navigator.clipboard?.writeText(m.text).then(() => toast("Pesan disalin. Tempel di WhatsApp/email.")) }, "Salin pesan")))) : null)))
            : emptyState("Belum ada tugas. Coba salah satu contoh perintah di atas.")));
    return page;
}

async function command(ctx, text, settings, tasks) {
    if (isStopCommand(text)) {
        stopAll();
        toast("Semua tugas agen dihentikan.");
        return;
    }
    const parsed = parseCommand(text);
    if (!parsed) {
        toast("Perintah belum dikenali. Coba: \"buatkan slip gaji untuk Andi\", \"susun laporan bulanan\", \"ajukan PO restok\".", "error");
        return;
    }
    const task = {
        id: `t-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
        skill: parsed.skill,
        title: text.trim().slice(0, 120),
        input: { template: parsed.template, target: parsed.target, text: parsed.text },
        status: "antre",
        steps: plannedSteps({ skill: parsed.skill }),
        created_at: new Date().toISOString(),
    };
    const agent = assignAgent(task, settings.agents, tasks);
    if (!agent) {
        toast("Semua agen yang punya keahlian ini sedang sibuk. Tambah agen atau tunggu sebentar.", "error");
        return;
    }
    const visible = settings.mode === "tampil";
    const done = await runTask(ctx, task, { agent, visible });
    invalidateProData();
    if (!visible || location.hash.startsWith("#/agents")) ctx.rerender();
    return done;
}

async function editAgent(settings, agent, quota, saveSettings) {
    const values = await formDialog({
        title: agent ? `Atur ${agent.name}` : "Agen baru",
        fields: [
            { name: "name", label: "Nama agen", value: agent?.name || "", required: true, max: 40, placeholder: "contoh: Agen Keuangan" },
            { name: "role", label: "Peran", value: agent?.role || "", max: 60, placeholder: "contoh: Menyiapkan tagihan & laporan" },
            { name: "skills", label: "Keahlian", type: "checkboxes", value: agent?.skills || ["dokumen"], options: Object.entries(SKILLS).map(([value, s]) => ({ value, label: `${s.label} — ${s.desc}` })) },
            { name: "active", label: "Status", type: "select", value: agent?.active === false ? "0" : "1", options: [{ value: "1", label: "Aktif" }, { value: "0", label: "Nonaktif (tidak menerima tugas)" }] },
        ],
        danger: agent && settings.agents.length > 1 ? { label: "Hapus agen", onClick: () => saveSettings({ ...settings, agents: settings.agents.filter((a) => a.id !== agent.id) }) } : null,
    });
    if (!values) return;
    const next = { id: agent?.id, name: values.name.trim(), role: values.role.trim(), skills: values.skills, active: values.active === "1" };
    const problem = validateAgent(next, quota, settings.agents);
    if (problem) return toast(problem, "error");
    const agents = agent
        ? settings.agents.map((a) => (a.id === agent.id ? { ...next, id: agent.id } : a))
        : [...settings.agents, { ...next, id: `agent-${Date.now().toString(36)}` }];
    saveSettings({ ...settings, agents });
}

/** Dikte suara (bahasa Indonesia) — diproses mesin dikte browser/perangkat. */
function setupVoice(button, input, submit) {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
        button.disabled = true;
        button.title = "Perintah suara belum didukung browser ini (coba Chrome).";
        return;
    }
    let rec = null;
    button.addEventListener("click", () => {
        if (rec) {
            rec.stop();
            return;
        }
        rec = new Recognition();
        rec.lang = "id-ID";
        rec.interimResults = true;
        rec.maxAlternatives = 1;
        button.classList.add("is-listening");
        input.placeholder = "Mendengarkan… ucapkan perintahmu";
        rec.onresult = (event) => {
            const text = [...event.results].map((r) => r[0].transcript).join(" ");
            input.value = text;
            if (event.results[event.results.length - 1].isFinal) {
                rec.stop();
                if (isStopCommand(text)) stopAll();
                else setTimeout(submit, 300);
            }
        };
        rec.onerror = () => toast("Suara tidak tertangkap. Coba lagi atau ketik perintahnya.", "error");
        rec.onend = () => {
            button.classList.remove("is-listening");
            input.placeholder = "Perintahkan asisten… (contoh: buatkan slip gaji untuk Andi)";
            rec = null;
        };
        rec.start();
    });
}
