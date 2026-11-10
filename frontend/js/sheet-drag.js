/**
 * KANTOONG — LEMBAR BAWAH YANG BISA DITARIK (satu komponen untuk semua pop-up)
 * File: frontend/js/sheet-drag.js  (dimuat lewat theme.js di semua halaman)
 *
 * Garis pegangan di pop-up (Feature Hub, Pilih bahasa, Tampilan, Filter, Bandingkan, …)
 * kini benar-benar berfungsi, sama seperti chat:
 *   - tarik NAIK  → lembar membesar sampai layar penuh
 *   - tarik TURUN → dari penuh kembali normal; dari normal = menutup
 *   - KETUK garis → bergantian penuh / normal
 * Juga bisa ditarik dari kepala lembar (area judul), kecuali di atas tombol/isian.
 * Menutup memakai jalur yang sama dengan mengetuk latar (tiap pop-up sudah punya).
 * Fungsi murni sheetDecision() dites di test/sheet-drag.test.js.
 */

export const GRAB_SELECTOR = [".kc-col-sheet__grab", ".kc-lang__grab", ".kc-compare__grab", ".bx-shelf__grab", ".ap-grab", "[data-kc-grab]"].join(",");
export const HEAD_SELECTOR = [".kc-col-sheet__head", ".kc-lang__head", ".kc-compare__head", ".bx-shelf__head", ".bx-sheet__head", ".ap-sheet__head", "[data-kc-grab-area]"].join(",");
const FULL = "kc-drag-full";

/**
 * Keputusan saat jari dilepas.
 * dy: geser vertikal (px, + = turun), ms: lama geser, full: sedang penuh?
 * → "toggle" | "full" | "normal" | "close" | "stay"
 */
export function sheetDecision({ dy, ms, full, moved }) {
    if (!moved) return "toggle";
    const velocity = dy / Math.max(1, ms); // px per ms
    if (dy < -50 || velocity < -0.5) return "full";
    if (dy > 90 || velocity > 0.6) return full ? "normal" : "close";
    return "stay";
}

function injectStyle() {
    if (document.getElementById("kc-sheet-drag-style")) return;
    const style = document.createElement("style");
    style.id = "kc-sheet-drag-style";
    style.textContent = `
${GRAB_SELECTOR} { touch-action: none; cursor: grab; position: relative; }
${GRAB_SELECTOR}::after { content: ""; position: absolute; inset: -14px -48px; }
${HEAD_SELECTOR} { touch-action: pan-x; }
.kc-drag-active { transition: none !important; user-select: none; }
.kc-drag-anim { transition: transform .28s cubic-bezier(.22,1,.36,1), height .28s cubic-bezier(.22,1,.36,1), max-height .28s cubic-bezier(.22,1,.36,1), border-radius .28s !important; }
.${FULL} { height: calc(100dvh - 6px) !important; max-height: calc(100dvh - 6px) !important; border-bottom-left-radius: 0 !important; border-bottom-right-radius: 0 !important; }
`;
    document.head.append(style);
}

function closeVia(panel) {
    const root = panel.parentElement;
    if (!root) return;
    // Semua pop-up menutup bila latarnya diketuk → pakai jalur yang sama.
    root.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

function settle(panel, action) {
    panel.classList.add("kc-drag-anim");
    panel.style.transform = "";
    panel.style.height = "";
    panel.style.maxHeight = "";
    if (action === "full") panel.classList.add(FULL);
    if (action === "normal") panel.classList.remove(FULL);
    if (action === "toggle") panel.classList.toggle(FULL);
    if (action === "close") {
        panel.style.transform = "translateY(100%)";
        setTimeout(() => {
            closeVia(panel);
            panel.style.transform = "";
            panel.classList.remove(FULL);
        }, 180);
    }
    setTimeout(() => panel.classList.remove("kc-drag-anim"), 320);
}

function start(event) {
    if (event.button > 0) return;
    const target = event.target;
    const onGrab = target.closest?.(GRAB_SELECTOR);
    const head = !onGrab && target.closest?.(HEAD_SELECTOR);
    if (!onGrab && !head) return;
    if (head && target.closest("button, a, input, select, textarea, label, [role=tab]")) return;
    const grab = onGrab || head.parentElement?.querySelector(GRAB_SELECTOR);
    // Hanya lembar yang punya garis pegangan yang terlihat (desktop menyembunyikannya → tidak aktif).
    if (!grab || grab.offsetParent === null) return;
    const panel = grab.parentElement;
    if (!panel) return;

    const startY = event.clientY;
    const startT = performance.now();
    const startH = panel.getBoundingClientRect().height;
    const full = panel.classList.contains(FULL);
    const maxH = window.innerHeight - 6;
    let dy = 0;
    let moved = false;
    panel.classList.add("kc-drag-active");
    try {
        (onGrab || head).setPointerCapture?.(event.pointerId);
    } catch {
        // abaikan
    }

    const move = (e) => {
        dy = e.clientY - startY;
        if (Math.abs(dy) > 6) moved = true;
        if (!moved) return;
        if (dy > 0) {
            panel.style.transform = `translateY(${dy}px)`;
        } else {
            panel.style.transform = "";
            panel.style.maxHeight = "none";
            panel.style.height = `${Math.min(maxH, startH - dy)}px`;
        }
    };
    const end = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        panel.classList.remove("kc-drag-active");
        const action = sheetDecision({ dy, ms: performance.now() - startT, full, moved });
        if (action === "stay") settle(panel, full ? "full" : "normal");
        else settle(panel, action);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
}

export function initSheetDrag() {
    if (typeof document === "undefined" || window.__kcSheetDrag) return;
    window.__kcSheetDrag = true;
    injectStyle();
    document.addEventListener("pointerdown", start, { passive: true });
}

initSheetDrag();
