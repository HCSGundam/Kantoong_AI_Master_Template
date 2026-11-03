/**
 * KANTOONG — CHAT MENEMPEL DI SAMPING (khusus desktop, lebar >= 900px)
 * File: frontend/js/assistant-dock.js
 *
 * Di HP chat ditarik NAIK (peek / setengah / penuh). Di desktop ada 3 mode:
 *   float = mode awal: melayang di tengah di atas halaman, ditarik naik
 *           ke setengah/penuh persis seperti di HP;
 *   side  = menempel di samping (sepertiga), halaman menyempit;
 *   half  = layar dibelah dua.
 * Tombol X di ujung bar judul = kembali ke kotak "Halo Kak".
 *
 * - Lempar kotak "Halo Kak" ke kiri/kanan = chat menempel di sisi itu
 *   (gerakan dari chat-sheet.js, event kantoong:dock-throw).
 * - Tarik tepi dalam chat untuk mengubah ukuran (berhenti di ukuran
 *   terdekat; ditarik sangat sempit = chat turun lagi).
 * - Tombol ukuran & pindah sisi di bar judul chat.
 * - Panggung: arahkan mouse ke kartu produk di chat = kartu yang sama
 *   di halaman ikut menyala (engine.js, event kantoong:stage-focus).
 *
 * Pilihan sisi & ukuran disimpan di browser (kenyamanan saja).
 */

const desktopQuery = window.matchMedia("(min-width: 900px)");
const root = document.documentElement;
const PREF_KEY = "kantoong:assistant-dock";
const SIZES = ["float", "side", "half"];
/** Ukuran yang menempel di samping (bisa diubah dengan menarik tepi). */
const DOCK_SIZES = ["side", "half"];

const SIZE_LABELS = {
    float: "Melayang di atas halaman",
    side: "Chat di samping",
    half: "Belah layar dua",
};

const SIZE_ICONS = {
    float: '<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="7" y="11" width="10" height="5" rx="1.5"/>',
    side: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M15 5v14"/>',
    half: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/>',
};

const SWAP_ICON = '<path d="M7 7h12l-3-3M17 17H5l3 3"/>';

function readPref() {
    try {
        const saved = JSON.parse(localStorage.getItem(PREF_KEY) || "{}");
        return {
            side: saved.side === "left" ? "left" : "right",
            size: SIZES.includes(saved.size) ? saved.size : "side",
        };
    } catch {
        return { side: "right", size: "side" };
    }
}

const pref = readPref();

function savePref() {
    try {
        localStorage.setItem(PREF_KEY, JSON.stringify(pref));
    } catch {
        // Penyimpanan diblokir: pilihan berlaku selama halaman terbuka.
    }
}

function widthFor(size) {
    const vw = window.innerWidth;
    if (size === "half") return Math.round(vw / 2);
    // float memakai lebar "samping" untuk bayangan saat kotak dilempar.
    return Math.round(Math.min(440, Math.max(360, vw * 0.32)));
}

/** Lebar chat & ruang yang dikosongkan halaman. */
function setWidths(chatWidth, pageGap) {
    root.style.setProperty("--kc-dock-w", `${Math.round(chatWidth)}px`);
    root.style.setProperty("--kc-dock-pad", `${Math.round(pageGap)}px`);
}

let relayoutTimer = 0;

function relayoutPage() {
    // Lebar halaman berubah: carousel, tulisan etalase, dll. menghitung ulang.
    clearTimeout(relayoutTimer);
    relayoutTimer = setTimeout(() => window.dispatchEvent(new Event("resize")), 320);
}

function apply() {
    root.dataset.kcDockSide = pref.side;
    root.dataset.kcDockSize = pref.size;
    setWidths(widthFor(pref.size), widthFor(pref.size));

    document.querySelectorAll(".kc-dock-tool[data-kc-dock-size]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.kcDockSize === pref.size));
    });
}

function choose(patch) {
    Object.assign(pref, patch);
    savePref();
    apply();
    updateDocking();
    relayoutPage();
}

/* ---------- Kapan menempel ---------- */

let dockPanel = null;

/** Menempel bila: desktop, chat terbuka, bukan mode melayang. */
function updateDocking() {
    const panel = dockPanel;
    if (!panel) return;

    const docked = desktopQuery.matches && pref.size !== "float" &&
        !panel.hidden && panel.dataset.state !== "peek" && panel.dataset.open === "true";
    if (root.classList.contains("kc-docked") === docked) return;

    root.classList.toggle("kc-docked", docked);
    panel.classList.toggle("kc-sheet--docked", docked);
    relayoutPage();
}

/* ---------- Tombol ukuran & pindah sisi di bar judul ---------- */

function svg(paths) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
}

function mountTools(panel) {
    const bar = panel.querySelector(".kc-chatbar");
    if (!bar || bar.querySelector(".kc-dock-tools")) return;

    const tools = document.createElement("div");
    tools.className = "kc-dock-tools";
    tools.setAttribute("role", "group");
    tools.setAttribute("aria-label", "Ukuran chat");

    for (const size of SIZES) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "kc-dock-tool";
        button.dataset.kcDockSize = size;
        button.title = SIZE_LABELS[size];
        button.setAttribute("aria-label", SIZE_LABELS[size]);
        button.innerHTML = svg(SIZE_ICONS[size]);
        button.addEventListener("click", () => choose({ size }));
        tools.appendChild(button);
    }

    const swap = document.createElement("button");
    swap.type = "button";
    swap.className = "kc-dock-tool kc-dock-swap";
    swap.title = "Pindah sisi";
    swap.setAttribute("aria-label", "Pindahkan chat ke sisi lain");
    swap.innerHTML = svg(SWAP_ICON);
    swap.addEventListener("click", () => choose({ side: pref.side === "right" ? "left" : "right" }));
    tools.appendChild(swap);

    bar.querySelector("#chatCloseBtn")?.before(tools);
}

/* ---------- Tepi dalam chat: tarik untuk mengubah ukuran ---------- */

function mountEdge(panel) {
    if (panel.querySelector(".kc-dock-edge")) return;

    const edge = document.createElement("div");
    edge.className = "kc-dock-edge";
    edge.tabIndex = 0;
    edge.title = "Tarik untuk mengubah lebar chat";
    edge.setAttribute("role", "separator");
    edge.setAttribute("aria-orientation", "vertical");
    edge.setAttribute("aria-label", "Ubah lebar chat (panah kiri/kanan)");
    panel.appendChild(edge);

    let dragId = null;
    let width = 0;

    const widthAt = (x) => {
        const vw = window.innerWidth;
        const raw = pref.side === "right" ? vw - x + 8 : x + 8;
        return Math.min(vw * 0.7, Math.max(200, raw));
    };

    edge.addEventListener("pointerdown", (event) => {
        if (event.button > 0) return;
        dragId = event.pointerId;
        width = widthFor(pref.size);
        edge.setPointerCapture?.(dragId);
        root.classList.add("kc-dock-resizing");
        event.preventDefault();
    });

    edge.addEventListener("pointermove", (event) => {
        if (event.pointerId !== dragId) return;
        width = widthAt(event.clientX);
        setWidths(width, width);
    });

    const release = (event) => {
        if (event.pointerId !== dragId) return;
        dragId = null;
        root.classList.remove("kc-dock-resizing");

        // Ditarik sangat sempit = chat ditutup (kembali ke "Halo Kak").
        if (width < 280) {
            apply();
            window.KantoongChat?.collapse?.();
            return;
        }

        const nearest = DOCK_SIZES.reduce((best, size) =>
            Math.abs(widthFor(size) - width) < Math.abs(widthFor(best) - width) ? size : best);
        choose({ size: nearest });
    };

    edge.addEventListener("pointerup", release);
    edge.addEventListener("pointercancel", release);

    edge.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        // Panah ke arah tengah layar = chat melebar.
        const wider = (event.key === "ArrowLeft") === (pref.side === "right");
        const index = DOCK_SIZES.indexOf(pref.size) + (wider ? 1 : -1);
        if (index >= 0 && index < DOCK_SIZES.length) choose({ size: DOCK_SIZES[index] });
    });
}

/* ---------- Panggung: kartu di chat <-> kartu di halaman ---------- */

function mountStageSync(panel) {
    let focused = "";

    const focus = (id) => {
        if (id === focused) return;
        focused = id;
        window.dispatchEvent(new CustomEvent(id ? "kantoong:stage-focus" : "kantoong:stage-blur", { detail: { id } }));
    };

    panel.addEventListener("pointerover", (event) => {
        if (!root.classList.contains("kc-docked") || event.pointerType === "touch") return;
        const card = event.target.closest?.("#chatBox [data-product-id]");
        focus(card ? String(card.dataset.productId) : "");
    });

    panel.addEventListener("pointerleave", () => focus(""));
}

/* ---------- Mulai ---------- */

export function initAssistantDock() {
    const panel = document.getElementById("chatPanel");
    if (!panel) return;

    dockPanel = panel;
    apply();
    mountTools(panel);
    mountEdge(panel);
    mountStageSync(panel);

    new MutationObserver(updateDocking).observe(panel, { attributes: true, attributeFilter: ["data-open", "data-state", "hidden"] });
    desktopQuery.addEventListener("change", updateDocking);
    updateDocking();

    // Kotak "Halo Kak" dilempar: sisi ditentukan sebelum chat terbuka.
    // Dari mode melayang, lemparan berarti "tempelkan di samping".
    window.addEventListener("kantoong:dock-throw", (event) => {
        const side = event.detail?.side === "left" ? "left" : "right";
        const patch = pref.size === "float" ? { side, size: "side" } : { side };
        if (patch.side !== pref.side || patch.size) choose(patch);
    });

    window.addEventListener("resize", () => {
        if (!root.classList.contains("kc-dock-resizing")) apply();
    });
}
