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
 * 6. Mode orb: ketuk orb di kotak sambutan -> kotak berubah jadi SATU orb
 *    melayang yang bisa digeser ke mana saja dan menempel di tepi layar
 *    (seperti panel edge HP). Ketuk orb -> kembali jadi kotak sambutan.
 *
 * Percakapan dan pengiriman pesan TETAP di ai-brain.js.
 *
 * EVENT YANG DITERIMA (window):
 *   kantoong:consult     -> buka chat (kirim pesan bila ada detail.text; detail.hint = petunjuk abu-abu saja)
 *   kantoong:attach-product -> buka chat & LAMPIRKAN produk (foto, nama, harga)
 *                              ke kotak ketik. TIDAK dikirim otomatis: pembeli
 *                              menulis sendiri keinginannya (warna, model, dll).
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

    const PEEK_HEIGHT = 104;
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

    /** true = kotak chat sedang disembunyikan dan tampil sebagai orb. */
    let minimized = false;

    const drag = {
        active: false,
        id: null,
        startY: 0,
        startH: 0,
        lastY: 0,
        lastT: 0,
        v: 0,
        moved: false,
        target: null,
        raf: 0,
        nextH: 0,
        startX: 0,
        dx: 0,
        throwing: false,
    };

    /** Desktop: kotak "Halo Kak" dilempar ke kiri/kanan = chat menempel di sisi itu. */
    const desktopQuery = window.matchMedia("(min-width: 900px)");
    const THROW_DISTANCE = 80;

    /* Mode BEBAS (ERP & kasir): pil "Halo Kak" digeser kiri/kanan = pindah tempat, disimpan. */
    const FREE_KEY = "kantoong:assistant-free-x";
    const isFree = () => document.documentElement.dataset.kcFree !== undefined;
    function applyFreeX(ratio = null) {
        if (!isFree()) return;
        let value = ratio;
        if (value === null) {
            try {
                value = Number(localStorage.getItem(FREE_KEY));
            } catch {
                value = NaN;
            }
        }
        const root = document.documentElement;
        if (!Number.isFinite(value) || value <= 0) {
            root.style.removeProperty("--kc-free-left");
            return;
        }
        const width = panel.getBoundingClientRect().width || 440;
        const left = clamp(value * window.innerWidth, 12, window.innerWidth - width - 12);
        root.style.setProperty("--kc-free-left", `${Math.round(left)}px`);
    }
    window.addEventListener("resize", () => applyFreeX());
    requestAnimationFrame(() => applyFreeX());

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

        restoreFromOrb();

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
        drag.startX = event.clientX;
        drag.dx = 0;
        drag.throwing = false;
        drag.startH = panel.getBoundingClientRect().height;
        drag.lastY = event.clientY;
        drag.lastT = performance.now();
        drag.v = 0;
        drag.moved = false;
        // Setelah pointer capture, target event berubah jadi `grab`;
        // simpan elemen yang benar-benar disentuh untuk deteksi ketukan.
        drag.target = event.target;

        try {
            grab.setPointerCapture(event.pointerId);
        } catch {
            // Browser lama: lanjutkan tanpa capture.
        }
    });

    grab.addEventListener("pointermove", (event) => {
        if (!drag.active || event.pointerId !== drag.id) return;

        const dy = drag.startY - event.clientY;
        const dx = event.clientX - drag.startX;

        if (
            !drag.moved && !drag.throwing && (state === "peek" || isFree()) && desktopQuery.matches &&
            Math.abs(dx) >= 8 && Math.abs(dx) > Math.abs(dy) * 1.5
        ) {
            drag.throwing = true;
            panel.classList.add("is-dragging");
        }

        if (drag.throwing) {
            drag.dx = dx;
            panel.style.setProperty("--kc-throw-x", `${dx}px`);

            // Bayangan sisi tujuan, agar user tahu chat akan menempel di mana (bukan di mode bebas).
            const root = document.documentElement;
            if (!isFree() && Math.abs(dx) >= THROW_DISTANCE) root.dataset.kcThrow = dx < 0 ? "left" : "right";
            else delete root.dataset.kcThrow;

            event.preventDefault();
            return;
        }

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

        if (drag.throwing) {
            drag.throwing = false;
            panel.classList.remove("is-dragging");

            if (isFree()) {
                // Mode bebas: posisi baru disimpan (perbandingan lebar layar), tidak membuka chat.
                const rect = panel.getBoundingClientRect();
                panel.style.removeProperty("--kc-throw-x");
                const left = clamp(rect.left, 12, window.innerWidth - rect.width - 12);
                const ratio = left / window.innerWidth;
                try {
                    localStorage.setItem(FREE_KEY, String(ratio));
                } catch {
                    // Penyimpanan diblokir: posisi berlaku selama halaman terbuka.
                }
                applyFreeX(ratio);
                return;
            }

            panel.style.removeProperty("--kc-throw-x");
            delete document.documentElement.dataset.kcThrow;

            if (!cancelled && Math.abs(drag.dx) >= THROW_DISTANCE) {
                // Didengar assistant-dock.js: tentukan sisi dulu, baru dibuka.
                window.dispatchEvent(new CustomEvent("kantoong:dock-throw", {
                    detail: { side: drag.dx < 0 ? "left" : "right" },
                }));
                snapTo("mid", { focus: true });
            }

            return;
        }

        if (!drag.moved) {
            panel.classList.remove("is-dragging");

            if (!cancelled) {
                handleTap();
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

    function handleTap() {
        const target = drag.target instanceof Element ? drag.target : grab;

        // Ketuk orb di kotak sambutan: kotak mengecil jadi orb melayang.
        if (state === "peek" && target.closest("#peekOrb")) {
            minimizeToOrb();
            return;
        }

        if (state === "peek") {
            snapTo("mid");
            return;
        }

        // Ketuk garis pegangan: turun satu tingkat (penuh -> tengah -> minim).
        // Untuk naik, tahan lalu tarik garis pegangan ke atas.
        if (target.closest(".kc-sheet__handle")) {
            snapTo(state === "full" ? "mid" : "peek");
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

    function photoText(product) {
        const total = product.photo_total ? ` dari ${product.photo_total}` : "";
        const label = product.photo_label ? ` · ${product.photo_label}` : "";
        return `Foto ke-${product.photo_index}${total}${label}`;
    }

    function renderAttachments() {
        const chips = pending.map((entry, index) => {
            const chip = document.createElement("span");
            chip.className = "kc-attach";

            // Lampiran produk dari tombol AI di kartu/popup/halaman produk.
            if (entry.product) {
                chip.classList.add("kc-attach--product");

                const thumb = document.createElement(entry.product.image_url ? "img" : "span");
                thumb.className = "kc-attach__thumb";
                if (entry.product.image_url) {
                    thumb.alt = "";
                    thumb.src = entry.product.image_url;
                } else {
                    thumb.textContent = String(entry.product.name || "P").charAt(0);
                }

                const text = document.createElement("span");
                text.className = "kc-attach__name";

                const title = document.createElement("strong");
                title.textContent = entry.product.name;
                text.append(title);

                if (entry.product.photo_index) {
                    const which = document.createElement("small");
                    which.className = "kc-attach__photo";
                    which.textContent = photoText(entry.product);
                    text.append(which);
                }

                if (entry.product.price) {
                    const price = document.createElement("small");
                    price.textContent = `Rp ${Number(entry.product.price).toLocaleString("id-ID")}`;
                    text.append(price);
                }

                const remove = document.createElement("button");
                remove.type = "button";
                remove.className = "kc-attach__remove";
                remove.setAttribute("aria-label", `Hapus ${entry.product.name}`);
                remove.textContent = "\u00D7";
                remove.addEventListener("click", () => removeAttachment(index));

                chip.append(thumb, text, remove);
                return chip;
            }

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

    /** Lampirkan produk (maks 3, tanpa duplikat). Tidak mengirim pesan. */
    function attachProduct(product) {
        if (!product?.id) return;

        const photoIndex = Number(product.photo_index) || 0;
        const same = (entry) =>
            entry.product?.id === String(product.id) && (entry.product.photo_index || 0) === photoIndex;

        if (!pending.some(same)) {
            if (pending.length >= MAX_FILES) {
                notify(`Maksimal ${MAX_FILES} lampiran.`);
                return;
            }

            pending.push({
                url: "",
                product: {
                    id: String(product.id),
                    name: String(product.name || "Produk").slice(0, 80),
                    price: Number(product.price) || 0,
                    image_url: String(product.image_url || ""),
                    // Foto ke-berapa yang ditanyakan (1 kartu bisa berisi beberapa model).
                    ...(photoIndex ? {
                        photo_index: photoIndex,
                        photo_total: Number(product.photo_total) || 0,
                        photo_label: String(product.photo_label || "").slice(0, 80),
                    } : {}),
                },
            });
        }

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
        syncTypingSoon();
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

    /**
     * Membuka pemilih file sesuai jenis lampiran.
     * Kamera: di HP langsung membuka kamera; di laptop jadi pemilih foto biasa.
     */
    function openPicker(action) {
        if (!fileInput) return;

        fileInput.removeAttribute("capture");

        switch (action) {
            case "attach-file":
                fileInput.accept = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt";
                break;

            case "attach-camera":
                fileInput.accept = "image/*";
                fileInput.setAttribute("capture", "environment");
                break;

            case "attach-video":
                fileInput.accept = "video/*";
                break;

            default:
                return;
        }

        fileInput.click();
    }

    /**
     * Menyisipkan link (http/https) ke kolom ketik lewat kolom isian DI DALAM chat
     * (bukan kotak bawaan browser yang muncul di atas layar).
     */
    let linkBar = null;

    function closeLinkBar({ focus = true } = {}) {
        if (!linkBar || linkBar.hidden) return;
        linkBar.hidden = true;
        if (focus) textarea?.focus({ preventScroll: true });
    }

    function submitLink(input) {
        const value = String(input.value ?? "").trim();
        if (!value) return;

        let url;
        try {
            url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
        } catch {
            input.setCustomValidity("Link tidak valid.");
            input.reportValidity();
            return;
        }

        if (url.protocol !== "https:" && url.protocol !== "http:") {
            input.setCustomValidity("Hanya link http/https.");
            input.reportValidity();
            return;
        }

        const current = textarea.value.trim();
        textarea.value = current ? `${current} ${url.href}` : url.href;
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        input.value = "";
        closeLinkBar();
    }

    function insertLink() {
        if (!linkBar) {
            linkBar = document.createElement("form");
            linkBar.className = "kc-linkbar";
            linkBar.setAttribute("aria-label", "Sisipkan link");

            const input = document.createElement("input");
            // type "text" (bukan "url") agar "tokopedia.com/..." tanpa https:// tetap diterima.
            input.type = "text";
            input.inputMode = "url";
            input.spellcheck = false;
            input.className = "kc-linkbar__input";
            input.placeholder = "Tempel link produk atau referensi…";
            input.autocomplete = "off";
            input.addEventListener("input", () => input.setCustomValidity(""));
            input.addEventListener("keydown", (event) => {
                if (event.key === "Escape") {
                    event.preventDefault();
                    closeLinkBar();
                }
            });

            const add = document.createElement("button");
            add.type = "submit";
            add.className = "kc-linkbar__add";
            add.textContent = "Sisipkan";

            const close = document.createElement("button");
            close.type = "button";
            close.className = "kc-linkbar__close";
            close.setAttribute("aria-label", "Batal");
            close.textContent = "×";
            close.addEventListener("click", () => closeLinkBar());

            linkBar.append(input, add, close);
            linkBar.addEventListener("submit", (event) => {
                event.preventDefault();
                submitLink(input);
            });
            attachBar.after(linkBar);
        }

        if (minimized) restoreFromOrb();
        if (state === "peek") snapTo(window.innerWidth < 900 ? "full" : "mid");
        linkBar.hidden = false;
        linkBar.querySelector("input").focus({ preventScroll: true });
    }

    $("btnLink")?.addEventListener("click", insertLink);

    // Peniti di bar DIAM: menu kecil foto/dokumen, kamera, video.
    const attachBtn = $("btnAttach");
    const attachMenu = $("kcAttachMenu");

    function closeAttachMenu() {
        if (!attachMenu || attachMenu.hidden) return;

        attachMenu.hidden = true;
        attachBtn?.setAttribute("aria-expanded", "false");
    }

    attachBtn?.addEventListener("click", (event) => {
        event.stopPropagation();

        if (!attachMenu) return;

        const willOpen = attachMenu.hidden;

        attachMenu.hidden = !willOpen;
        attachBtn.setAttribute("aria-expanded", String(willOpen));
    });

    document.addEventListener("pointerdown", (event) => {
        if (!event.target.closest(".kc-attach-wrap")) {
            closeAttachMenu();
        }
    });

    attachMenu?.addEventListener("click", (event) => {
        const item = event.target.closest("[data-kc-action]");

        if (!item) return;

        openPicker(item.dataset.kcAction);
        closeAttachMenu();
    });

    // Tombol + di bar DIAM: menu kecil "Chat baru" & "ANACHRONOS MODE" (segera).
    const startBtn = $("kcIdleSend");
    const startMenu = $("kcStartMenu");

    function closeStartMenu() {
        if (!startMenu || startMenu.hidden) return;

        startMenu.hidden = true;
        startBtn?.setAttribute("aria-expanded", "false");
    }

    startBtn?.addEventListener("click", (event) => {
        event.stopPropagation();

        if (!startMenu) return;

        const willOpen = startMenu.hidden;

        startMenu.hidden = !willOpen;
        startBtn.setAttribute("aria-expanded", String(willOpen));
    });

    document.addEventListener("pointerdown", (event) => {
        if (!event.target.closest(".kc-start-wrap")) {
            closeStartMenu();
        }
    });

    startMenu?.addEventListener("click", (event) => {
        const item = event.target.closest("[data-kc-action]");

        if (!item || item.disabled) return;

        if (item.dataset.kcAction === "new-chat") {
            clearAttachments();
            window.KantoongAIBrain?.newChat?.();
        }

        // Hak pengguna (UU PDP): hapus memori asisten. Ditangani kantoong-assistant.js.
        if (item.dataset.kcAction === "forget-memory") {
            clearAttachments();
            window.dispatchEvent(new CustomEvent("kantoong:forget-memory"));
        }

        closeStartMenu();
    });

    /*
     * Dua keadaan bar ketik:
     * - DIAM     : ikon alat tampil di kanan.
     * - MENGETIK : kolom memanjang, ikon kanan hilang, semua fitur
     *              pindah ke menu + di kiri, tombol kirim hitam di luar.
     * Mengetik = kolom sudah berisi teks (atau menu + sedang terbuka).
     * Menghapus semua teks = kembali ke bar DIAM.
     */
    let typingTimer = 0;

    function syncTyping() {
        const typing =
            Boolean(textarea?.value.trim()) ||
            (menu ? !menu.hidden : false);

        composer.dataset.typing = String(typing);
    }

    function syncTypingSoon() {
        // Beri jeda agar ketukan tombol + sempat membuka menunya dulu.
        window.clearTimeout(typingTimer);
        typingTimer = window.setTimeout(syncTyping, 160);
    }

    textarea?.addEventListener("focus", syncTyping);
    textarea?.addEventListener("input", syncTyping);
    composer?.addEventListener("focusout", syncTypingSoon);
    composer?.addEventListener("click", syncTypingSoon);
    document.addEventListener("pointerdown", syncTypingSoon);

    syncTyping();

    // Ikon robot: buka/tutup saran chat (diatur ai-brain.js).
    const suggestBtn = $("btnSuggest");

    suggestBtn?.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("kantoong:show-suggestions"));
    });

    window.addEventListener("kantoong:suggestions-toggled", (event) => {
        suggestBtn?.setAttribute("aria-pressed", String(event.detail?.open === true));
    });

    menu?.addEventListener("click", (event) => {
        const item = event.target.closest("[data-kc-action]");

        if (!item || item.disabled) return;

        switch (item.dataset.kcAction) {
            case "attach-file":
            case "attach-video":
                openPicker(item.dataset.kcAction);
                break;

            case "new-chat":
                clearAttachments();
                window.KantoongAIBrain?.newChat?.();
                break;

            case "insert-link":
                insertLink();
                break;

            case "suggest":
                window.dispatchEvent(new CustomEvent("kantoong:show-suggestions"));
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
            const hint = String(event.detail?.hint || "").trim();
            if (textarea && hint) textarea.placeholder = hint.slice(0, 90);
            textarea?.focus({ preventScroll: true });
        }
    });

    // Tombol AI di produk: lampirkan produk, buka chat, siap diketik (tidak dikirim).
    window.addEventListener("kantoong:attach-product", (event) => {
        attachProduct(event.detail?.product);

        if (minimized) restoreFromOrb();
        snapTo(window.innerWidth < 900 ? "full" : "mid");

        if (textarea) {
            textarea.placeholder = "Ceritakan yang kamu cari: warna, ukuran, model…";
            window.setTimeout(() => textarea.focus({ preventScroll: true }), 320);
        }
    });

    window.addEventListener("kantoong:collapse", () => {
        // Saat sedang jadi orb, biarkan tetap orb.
        if (!minimized) snapTo("peek");
    });

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

        if (attachMenu && !attachMenu.hidden) {
            closeAttachMenu();
            return;
        }

        if (startMenu && !startMenu.hidden) {
            closeStartMenu();
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
       12B. MODE ORB MELAYANG
       ==================================================== */

    const ORB_SIZE = 56;
    const ORB_MARGIN = 8;
    const ORB_STORE_KEY = "kantoong_orb_pos";

    const floatOrb = document.createElement("button");
    floatOrb.type = "button";
    floatOrb.className = "kc-float-orb kc-orb";
    floatOrb.id = "kcFloatOrb";
    floatOrb.hidden = true;
    floatOrb.setAttribute("aria-label", "Buka konsultasi AI");
    host.appendChild(floatOrb);

    /** Posisi orb: sisi layar (kiri/kanan) + tinggi relatif 0..1.
        Mode bebas (ERP & kasir): bawaan kiri bawah, supaya tidak menutupi panel pesanan/tombol Bayar di kanan. */
    let orbPos = isFree() ? { side: "left", y: 0.94 } : { side: "right", y: 0.72 };

    try {
        const saved = JSON.parse(localStorage.getItem(ORB_STORE_KEY) || "null");
        if (saved && (saved.side === "left" || saved.side === "right")) {
            orbPos = { side: saved.side, y: clamp(Number(saved.y) || 0.72, 0, 1) };
        }
    } catch {
        // Penyimpanan browser tidak tersedia; pakai posisi bawaan.
    }

    function orbLimits() {
        const headerHeight =
            document.querySelector(".app-header")?.offsetHeight ?? 58;

        return {
            minY: headerHeight + ORB_MARGIN,
            maxY: (host.clientHeight || window.innerHeight) - ORB_SIZE - ORB_MARGIN,
            maxX: (host.clientWidth || window.innerWidth) - ORB_SIZE - ORB_MARGIN,
        };
    }

    function placeOrb(x, y) {
        floatOrb.style.left = `${Math.round(x)}px`;
        floatOrb.style.top = `${Math.round(y)}px`;
    }

    /** Menempelkan orb ke tepi kiri/kanan sesuai orbPos. */
    function dockOrb() {
        const { minY, maxY, maxX } = orbLimits();

        placeOrb(
            orbPos.side === "left" ? ORB_MARGIN : maxX,
            minY + (maxY - minY) * orbPos.y
        );
    }

    function minimizeToOrb() {
        snapTo("peek");

        minimized = true;
        panel.hidden = true;
        floatOrb.hidden = false;
        dockOrb();
    }

    function restoreFromOrb() {
        if (!minimized) return;

        minimized = false;
        floatOrb.hidden = true;
        panel.hidden = false;
    }

    const orbDrag = { id: null, dx: 0, dy: 0, startX: 0, startY: 0, moved: false };

    floatOrb.addEventListener("pointerdown", (event) => {
        const rect = floatOrb.getBoundingClientRect();

        orbDrag.id = event.pointerId;
        orbDrag.dx = event.clientX - rect.left;
        orbDrag.dy = event.clientY - rect.top;
        orbDrag.startX = event.clientX;
        orbDrag.startY = event.clientY;
        orbDrag.moved = false;

        floatOrb.setPointerCapture(event.pointerId);
        floatOrb.classList.add("is-dragging");
    });

    floatOrb.addEventListener("pointermove", (event) => {
        if (event.pointerId !== orbDrag.id) return;

        if (
            !orbDrag.moved &&
            Math.hypot(event.clientX - orbDrag.startX, event.clientY - orbDrag.startY) < 6
        ) {
            return;
        }

        orbDrag.moved = true;

        const hostRect = host.getBoundingClientRect();
        const { minY, maxY, maxX } = orbLimits();

        placeOrb(
            clamp(event.clientX - hostRect.left - orbDrag.dx, ORB_MARGIN, maxX),
            clamp(event.clientY - hostRect.top - orbDrag.dy, minY, maxY)
        );
    });

    function endOrbDrag(event, cancelled) {
        if (event.pointerId !== orbDrag.id) return;

        orbDrag.id = null;
        floatOrb.classList.remove("is-dragging");

        if (!orbDrag.moved) {
            // Ketuk orb: kembali jadi kotak sambutan.
            if (!cancelled) snapTo("peek");
            return;
        }

        // Lepas: menempel ke tepi terdekat, seperti panel edge HP.
        const { minY, maxY, maxX } = orbLimits();
        const x = floatOrb.offsetLeft;
        const y = floatOrb.offsetTop;

        orbPos = {
            side: x + ORB_SIZE / 2 < (maxX + ORB_SIZE) / 2 ? "left" : "right",
            y: maxY > minY ? clamp((y - minY) / (maxY - minY), 0, 1) : 0,
        };

        try {
            localStorage.setItem(ORB_STORE_KEY, JSON.stringify(orbPos));
        } catch {
            // Posisi hanya berlaku sampai halaman ditutup.
        }

        dockOrb();
    }

    $("peekOrb")?.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            minimizeToOrb();
            floatOrb.focus();
        }
    });

    floatOrb.addEventListener("pointerup", (event) => endOrbDrag(event, false));
    floatOrb.addEventListener("pointercancel", (event) => endOrbDrag(event, true));

    window.addEventListener("resize", () => {
        if (minimized) dockOrb();
    });

    /* ====================================================
       13. API
       ==================================================== */

    window.KantoongChat = Object.freeze({
        open: (name = "mid") => snapTo(name, { focus: true }),
        collapse: () => snapTo("peek"),
        minimize: () => minimizeToOrb(),
        restore: () => restoreFromOrb(),
        isMinimized: () => minimized,
        getState: () => state,
        getLastFiles: () => [...lastFiles],

        peekAttachments: () =>
            pending.map(({ file, product }) => (product
                ? { name: product.name, type: "product", product }
                : { name: file.name, type: file.type, size: file.size })),

        attachProduct: (product) => attachProduct(product),

        takeAttachments() {
            const meta = this.peekAttachments();

            // File asli disimpan untuk pengunggahan nanti.
            lastFiles = pending.filter((entry) => entry.file).map((entry) => entry.file);

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
