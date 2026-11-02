/**
 * KANTOONG CORE — AGENT STATE (WADAH AI AGENT)
 * File: frontend/js/agent-state.js
 *
 * Infrastruktur untuk AI Agent yang kelak "hidup" di web brand dan
 * membantu pengguna: berpindah halaman, mengisi form, mencari produk,
 * dan sebagainya. Modul ini TIDAK melakukan aksi apa pun sendiri;
 * ia hanya menyediakan:
 *
 *   1. Mode:   "chat" (ketik biasa) atau "autopilot" (agen aktif).
 *   2. Tool:   daftar aksi yang boleh dijalankan agen (allowlist).
 *   3. Aturan: aksi yang menyangkut pembayaran/hukum WAJIB manusia
 *              (requiresHuman) dan tidak pernah dijalankan agen.
 *   4. Log:    catatan aksi agen untuk riwayat chat.
 *
 * Tampilan (orb bermata dua) ada di chat-sheet.js; otak AI di ai-brain.js.
 */

export const AGENT_MODES = Object.freeze({
    CHAT: "chat",
    AUTOPILOT: "autopilot",
});

let mode = AGENT_MODES.CHAT;

const listeners = new Set();
const tools = new Map();
const actionLog = [];

const MAX_LOG = 100;

function dispatchModeEvent() {
    window.dispatchEvent(
        new CustomEvent("kantoong:agent-mode", {
            detail: { mode },
        })
    );
}

export const AgentMode = Object.freeze({
    get() {
        return mode;
    },

    set(next) {
        if (!Object.values(AGENT_MODES).includes(next) || next === mode) {
            return false;
        }

        mode = next;

        listeners.forEach((listener) => {
            try {
                listener(mode);
            } catch (error) {
                console.error("[KANTOONG Agent]", error);
            }
        });

        dispatchModeEvent();

        return true;
    },

    toggle() {
        return this.set(
            mode === AGENT_MODES.CHAT
                ? AGENT_MODES.AUTOPILOT
                : AGENT_MODES.CHAT
        );
    },

    subscribe(listener) {
        listeners.add(listener);

        return () => listeners.delete(listener);
    },
});

/**
 * Mendaftarkan aksi yang boleh dijalankan agen.
 *
 * @param {object}   tool
 * @param {string}   tool.name           ID unik, mis. "open-feature"
 * @param {string}   tool.description    penjelasan singkat untuk AI
 * @param {boolean}  [tool.requiresHuman] true = hanya manusia (pembayaran)
 * @param {Function} tool.run            (args) => hasil
 */
export function registerAgentTool(tool) {
    if (!tool?.name || typeof tool.run !== "function") {
        throw new Error("[KANTOONG Agent] Tool tidak valid.");
    }

    tools.set(tool.name, Object.freeze({ ...tool }));
}

export function listAgentTools() {
    return [...tools.values()].map(({ name, description, requiresHuman }) => ({
        name,
        description,
        requiresHuman: requiresHuman === true,
    }));
}

function pushLog(entry) {
    actionLog.push({ at: Date.now(), ...entry });

    if (actionLog.length > MAX_LOG) {
        actionLog.shift();
    }
}

export function getAgentLog() {
    return [...actionLog];
}

/**
 * Menjalankan tool atas nama agen. Ditolak bila:
 * - mode bukan autopilot,
 * - tool tidak terdaftar (di luar allowlist),
 * - tool ditandai requiresHuman (pembayaran dan urusan hukum).
 */
export async function runAgentTool(name, args = {}) {
    if (mode !== AGENT_MODES.AUTOPILOT) {
        return { ok: false, reason: "agent-inactive" };
    }

    const tool = tools.get(name);

    if (!tool) {
        pushLog({ name, ok: false, reason: "not-allowed" });

        return { ok: false, reason: "not-allowed" };
    }

    if (tool.requiresHuman === true) {
        pushLog({ name, ok: false, reason: "requires-human" });

        return { ok: false, reason: "requires-human" };
    }

    try {
        const result = await tool.run(args);

        pushLog({ name, ok: true });

        return { ok: true, result };
    } catch (error) {
        pushLog({ name, ok: false, reason: "error" });

        return { ok: false, reason: "error", error };
    }
}

// Akses global terbatas (mis. dari modul non-ES).
window.KantoongAgent = Object.freeze({
    mode: AgentMode,
    registerTool: registerAgentTool,
    listTools: listAgentTools,
    run: runAgentTool,
    log: getAgentLog,
});
