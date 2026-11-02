/**
 * KANTOONG CORE — CHAT SHEET CONTROLLER
 * File: frontend/js/chat-sheet.js
 *
 * Menggantikan panel.js. Tanggung jawab:
 *
 * 1. Kotak chat 3 posisi (peek / tengah / penuh) yang bisa DITAHAN lalu
 *    digeser naik-turun ke posisi mana pun; saat dilepas ia menempel ke
 *    posisi terdekat (atau mengikuti arah lemparan jari).
 * 2. Gerakan mulus: tinggi diperbarui sekali per frame (rAF), transisi
 *    hanya setelah dilepas, tidak ada lompatan layout.
 * 3. Penyesuaian keyboard layar (visualViewport) di HP.
 * 4. Kotak ketik bergaya asisten AI: tombol + (lampiran foto, dokumen,
 *    video, chat baru, mode agen), auto-tinggi, tombol kirim.
 * 5. Mode agen (infrastruktur): orb bermata dua menggantikan kolom ketik.
 *
 * Percakapan dan pengiriman pesan TETAP di ai-brain.js.
 *
 * EVENT YANG DITERIMA (window):
 *   kantoong:consult     -> buka chat (kirim pesan bila ada detail.text)
 *   kantoong:collapse    -> turunkan chat ke posisi peek
 *   kantoong:ai-matched  -> bila penuh, turunkan ke tengah agar etalase
 *                           di belakang terlihat
 */

import CFG from "../client-config.js";
import { AgentMode, AGENT_MODES } from "./agent-state.js";

const $ = (id) => document.getElementById(id);

const panel = $("chatPanel");

if (panel && panel.dataset.sheetReady !== "true") {
    panel.dataset.sheetReady = "true";
    initChatSheet();
}

function initChatSheet() {
    const grab = $("panelHead");
    const peekTitle = $("peekTitle");
    const peekGreeting = $("peekGreeting");
    const peekSendBtn = $("peekSendBtn");
    const chevron = $("chatCloseBtn");
    const composer = $("kcComposer");
    const textarea = $("kolomKetik");
    const sendBtn = $("tombolKirim");
    const plusBtn = $("btnPlus");
    const menu = $("kcPlusMenu");
    const fileInput = $("kcFileInput");
    const attachBar = $("kcAttachments");
    const agentOrb = $("kcAgentOrb");
    const agentItem = $("kcAgentItem");

    const host = $("appRoot") ?? panel.parentElement ?? document.body;

    /* ====================================================
       01. KONSTANTA
       ==================================================== */

    const PEEK_HEIGHT = 132;
    const OPEN_THRESHOLD = PEEK_HEIGHT + 36;
    const MID_RATIO = 0.52;
    const FLICK_SPEED = 0.4; // px per milidetik

    const MAX_FILES = 4;
    const MAX_FILE_BYTES = 20 * 1024 * 1024;

    /* ====================================================
       02. STATE
       ==================================================== */

    let state = "peek";
    let height = PEEK_HEIGHT;
    let closeTimer = 0;
    let keyboard = 0;

    const drag = {
        active: false,
        id: null,
        startY: 0,
        startH: 0,
        lastY: 0,
        lastT: 0,
        v: 0,
        moved: false,
        raf: 0,
        nextH: 0,
    };

    /** File lampiran yang menunggu dikirim. */
    let pending = [];

    /** File dari pengiriman terakhir (untuk pengunggahan nanti). */
    let lastFiles = [];

    /* ====================================================
       03. UKURAN
       ==================================================== */

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    function getBounds() {
        const hostHeight = host.clientHeight || window.innerHeight;
        const headerHeight =
            document.querySelector(".app-header")?.offsetHeight ?? 58;

        const full = Math.max(
            PEEK_HEIGHT + 120,
            hostHeight - headerHeight - 24 - keyboard
        );

        const mid = clamp(
            Math.round((hostHeight - headerHeight) * MID_RATIO),
            PEEK_HEIGHT + 120,
            full
        );

        return { peek: PEEK_HEIGHT, mid, full };
    }

    function setHeightVar(px) {
        panel.style.setProperty("--kc-sheet-h", `${Math.round(px)}px`);
        height = px;
    }

    function updateOpenAttr() {
        panel.dataset.open = String(height > OPEN_THRESHOLD);
    }

    /* ====================================================
       04. POSISI
       ==================================================== */

    function snapTo(name, { focus = false } = {}) {
        const bounds = getBounds();

        window.clearTimeout(closeTimer);

        state = name;
        panel.dataset.state = name;

        panel.classList.remove("is-dragging");

        setHeightVar(bounds[name]);

        if (name === "peek") {
            // Biarkan tinggi turun dulu, baru isi chat disembunyikan.
            closeTimer = window.setTimeout(() => {
                if (state === "peek") {
                    panel.dataset.open = "false";
                }
            }, 290);

            if (document.activeElement === textarea) {
                textarea.blur();
            }
        } else {
            panel.dataset.open = "true";
        }

        chevron?.setAttribute("aria-expanded", String(name !== "peek"));

        if (focus && name !== "peek") {
            textarea?.focus({ preventScroll: true });
        }
    }

    /** Menyesuaikan ulang tinggi tanpa animasi (resize, keyboard). */
    function rebound() {
        panel.classList.add("is-dragging");

        setHeightVar(getBounds()[state]);
        updateOpenAttr();

        requestAnimationFrame(() => {
            panel.classList.remove("is-dragging");
        });
    }

    /* ====================================================
       05. GESER (TAHAN LALU TARIK)
       ==================================================== */

    function nearestState(h, bounds) {
        return ["peek", "mid", "full"].reduce((best, name) =>
            Math.abs(bounds[name] - h) < Math.abs(bounds[best] - h)
                ? name
                : best
        , "peek");
    }

    function flickTarget(h, speed, bounds) {
        const points = [
            ["peek", bounds.peek],
            ["mid", bounds.mid],
            ["full", bounds.full],
        ];

        if (speed > 0) {
            return points.find(([, p]) => p > h + 8)?.[0] ?? "full";
        }

        return (
            [...points].reverse().find(([, p]) => p < h - 8)?.[0] ?? "peek"
        );
    }

    grab.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;

        if (event.target.closest("button, a, input, textarea")) return;

        drag.active = true;
        drag.id = event.pointerId;
        drag.startY = event.clientY;
        drag.startH = panel.getBoundingClientRect().height;
        drag.lastY = event.clientY;
        drag.lastT = performance.now();
        drag.v = 0;
        drag.moved = false;

        try {
            grab.setPointerCapture(event.pointerId);
        } catch {
            // Browser lama: lanjutkan tanpa capture.
        }
    });

    grab.addEventListener("pointermove", (event) => {
        if (!drag.active || event.pointerId !== drag.id) return;

        const dy = drag.startY - event.clientY;

        if (!drag.moved) {
            if (Math.abs(dy) < 5) return;

            drag.moved = true;
            window.clearTimeout(closeTimer);
            panel.classList.add("is-dragging");
        }

        const now = performance.now();
        const dt = Math.max(1, now - drag.lastT);

        drag.v = drag.v * 0.7 + ((drag.lastY - event.clientY) / dt) * 0.3;
        drag.lastY = event.clientY;
        drag.lastT = now;

        const bounds = getBounds();

        drag.nextH = clamp(drag.startH + dy, bounds.peek, bounds.full);

        if (!drag.raf) {
            drag.raf = requestAnimationFrame(() => {
                drag.raf = 0;
                setHeightVar(drag.nextH);
                updateOpenAttr();
            });
        }

        event.preventDefault();
    });

    function endDrag(event, cancelled) {
        if (!drag.active || event.pointerId !== drag.id) return;

        drag.active = false;

        try {
            grab.releasePointerCapture(drag.id);
        } catch {
            // Sudah dilepas.
        }

        if (drag.raf) {
            cancelAnimationFrame(drag.raf);
            drag.raf = 0;
            setHeightVar(drag.nextH);
        }

        if (!drag.moved) {
            panel.classList.remove("is-dragging");

            if (!cancelled) {
                handleTap(event);
            }

            return;
        }

        const bounds = getBounds();

        const target =
            Math.abs(drag.v) > FLICK_SPEED
                ? flickTarget(height, drag.v, bounds)
                : nearestState(height, bounds);

        snapTo(target);
    }

    grab.addEventListener("pointerup", (event) => endDrag(event, false));
    grab.addEventListener("pointercancel", (event) => endDrag(event, true));

    function handleTap(event) {
        if (state === "peek") {
            snapTo("mid");
            return;
        }

        // Ketuk garis pegangan: mid <-> penuh.
        if (event.target.closest(".kc-sheet__handle")) {
            snapTo(state === "mid" ? "full" : "mid");
        }
    }

    peekSendBtn?.addEventListener("click", () => {
        snapTo("mid", { focus: true });
    });

    chevron?.addEventListener("click", () => snapTo("peek"));

    /* ====================================================
       06. KEYBOARD LAYAR (HP)
       ==================================================== */

    const viewport = window.visualViewport;

    function syncKeyboard() {
        if (!viewport) return;

        const next = Math.max(
            0,
            Math.round(
                window.innerHeight - viewport.height - viewport.offsetTop
            )
        );

        if (Math.abs(next - keyboard) < 2) return;

        keyboard = next;
        panel.style.setProperty("--kc-kb", `${keyboard}px`);

        rebound();
    }

    viewport?.addEventListener("resize", syncKeyboard);
    viewport?.addEventListener("scroll", syncKeyboard);

    window.addEventListener("resize", rebound);

    /* ====================================================
       07. KOTAK KETIK
       ==================================================== */

    function updateSendState() {
        if (!sendBtn || !textarea) return;

        sendBtn.disabled =
            textarea.value.trim().length === 0 && pending.length === 0;
    }

    function autosize() {
        if (!textarea) return;

        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }

    textarea?.addEventListener("input", () => {
        autosize();
        updateSendState();
    });

    textarea?.addEventListener("focus", () => {
        if (state === "peek") {
            snapTo(window.innerWidth < 900 ? "full" : "mid");
        }
    });

    autosize();
    updateSendState();

    /* ====================================================
       08. LAMPIRAN
       ==================================================== */

    function iconFor(file) {
        if (file.type.startsWith("video/")) return "\u{1F3AC}";
        if (file.type === "application/pdf") return "\u{1F4C4}";

        return "\u{1F4CE}";
    }

    function notify(text) {
        const note = document.createElement("span");

        note.className = "kc-attach";
        note.textContent = text;

        attachBar.hidden = false;
        attachBar.append(note);

        window.setTimeout(() => {
            note.remove();
            renderAttachments();
        }, 3200);
    }

    function renderAttachments() {
        const chips = pending.map((entry, index) => {
            const chip = document.createElement("span");
            chip.className = "kc-attach";

            if (entry.file.type.startsWith("image/")) {
                const image = document.createElement("img");

                image.className = "kc-attach__thumb";
                image.alt = "";
                image.src = entry.url;

                chip.append(image);
            } else {
                const thumb = document.createElement("span");

                thumb.className = "kc-attach__thumb";
                thumb.textContent = iconFor(entry.file);

                chip.append(thumb);
            }

            const name = document.createElement("span");

            name.className = "kc-attach__name";
            name.textContent = entry.file.name;

            const remove = document.createElement("button");

            remove.type = "button";
            remove.className = "kc-attach__remove";
            remove.setAttribute("aria-label", `Hapus ${entry.file.name}`);
            remove.textContent = "\u00D7";
            remove.addEventListener("click", () => removeAttachment(index));

            chip.append(name, remove);

            return chip;
        });

        attachBar.replaceChildren(...chips);
        attachBar.hidden = chips.length === 0;

        updateSendState();
    }

    function removeAttachment(index) {
        const [removed] = pending.splice(index, 1);

        if (removed?.url) {
            URL.revokeObjectURL(removed.url);
        }

        renderAttachments();
    }

    function clearAttachments() {
        pending.forEach((entry) => entry.url && URL.revokeObjectURL(entry.url));
        pending = [];

        renderAttachments();
    }

    fileInput?.addEventListener("change", () => {
        const files = Array.from(fileInput.files ?? []);

        fileInput.value = "";

        for (const file of files) {
            if (pending.length >= MAX_FILES) {
                notify(`Maksimal ${MAX_FILES} lampiran.`);
                break;
            }

            if (file.size > MAX_FILE_BYTES) {
                notify(`"${file.name}" lebih dari 20 MB.`);
                continue;
            }

            pending.push({
                file,
                url: file.type.startsWith("image/")
                    ? URL.createObjectURL(file)
                    : "",
            });
        }

        renderAttachments();
    });

    /* ====================================================
       09. MENU +
       ==================================================== */

    function closeMenu() {
        if (!menu || menu.hidden) return;

        menu.hidden = true;
        plusBtn?.setAttribute("aria-expanded", "false");
    }

    function toggleMenu() {
        if (!menu) return;

        const willOpen = menu.hidden;

        menu.hidden = !willOpen;
        plusBtn?.setAttribute("aria-expanded", String(willOpen));
    }

    plusBtn?.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleMenu();
    });

    document.addEventListener("pointerdown", (event) => {
        if (menu && !menu.hidden && !event.target.closest(".kc-plus")) {
            closeMenu();
        }
    });

    menu?.addEventListener("click", (event) => {
        const item = event.target.closest("[data-kc-action]");

        if (!item || item.disabled) return;

        switch (item.dataset.kcAction) {
            case "attach-file":
                fileInput.accept =
                    "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt";
                fileInput.click();
                break;

            case "attach-video":
                fileInput.accept = "video/*";
                fileInput.click();
                break;

            case "new-chat":
                clearAttachments();
                window.KantoongAIBrain?.newChat?.();
                break;

            case "agent-toggle":
                AgentMode.toggle();
                break;

            default:
                break;
        }

        closeMenu();
    });

    /* ====================================================
       10. MODE AGEN (INFRASTRUKTUR)
       ==================================================== */

    const agentEnabled = CFG?.agent_enabled === true;

    if (agentItem) {
        agentItem.disabled = !agentEnabled;
    }

    AgentMode.subscribe((mode) => {
        composer.dataset.mode = mode;

        if (agentItem) {
            agentItem.setAttribute(
                "aria-pressed",
                String(mode === AGENT_MODES.AUTOPILOT)
            );
        }

        updateSendState();
    });

    agentOrb?.addEventListener("click", () => {
        AgentMode.set(AGENT_MODES.CHAT);
        textarea?.focus({ preventScroll: true });
    });

    /* ====================================================
       11. TEKS SAMBUTAN
       ==================================================== */

    if (peekTitle) {
        peekTitle.textContent = CFG?.ai_title || "Halo Kak!";
    }

    if (peekGreeting) {
        const greetings = Array.isArray(CFG?.ai_greetings)
            ? CFG.ai_greetings.filter(Boolean)
            : [];

        if (greetings.length > 0) {
            peekGreeting.textContent =
                greetings[Math.floor(Math.random() * greetings.length)];
        }
    }

    /* ====================================================
       12. EVENT DARI SISTEM LAIN
       ==================================================== */

    window.addEventListener("kantoong:consult", (event) => {
        if (state === "peek") {
            snapTo("mid");
        }

        if (!event.detail?.text) {
            textarea?.focus({ preventScroll: true });
        }
    });

    window.addEventListener("kantoong:collapse", () => snapTo("peek"));

    window.addEventListener("kantoong:ai-matched", () => {
        if (state === "full") {
            snapTo("mid");
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;

        if (menu && !menu.hidden) {
            closeMenu();
            return;
        }

        if (
            state !== "peek" &&
            (panel.contains(document.activeElement) || state === "full")
        ) {
            snapTo("peek");
        }
    });

    /* ====================================================
       13. API
       ==================================================== */

    window.KantoongChat = Object.freeze({
        open: (name = "mid") => snapTo(name, { focus: true }),
        collapse: () => snapTo("peek"),
        getState: () => state,
        getLastFiles: () => [...lastFiles],

        peekAttachments: () =>
            pending.map(({ file }) => ({
                name: file.name,
                type: file.type,
                size: file.size,
            })),

        takeAttachments() {
            const meta = this.peekAttachments();

            // File asli disimpan untuk pengunggahan nanti.
            lastFiles = pending.map((entry) => entry.file);

            clearAttachments();

            return meta;
        },
    });

    /* ====================================================
       14. AWAL
       ==================================================== */

    panel.dataset.state = "peek";
    panel.dataset.open = "false";

    setHeightVar(PEEK_HEIGHT);
}
