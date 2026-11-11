/**
 * KANTOONG — GRID BENTO INTERAKTIF (Adaptive Menu, sistem A)
 * File: frontend/dashboard-user/home/bento.js
 *
 * - Tekan & tahan kartu (atau tombol pensil) = mode atur.
 * - Geser kartu: kartu MENGIKUTI jari/kursor secara realtime, kartu lain
 *   bergeser memberi ruang dengan animasi halus (gaya One UI).
 * - Ubah ukuran: tarik busur di sudut kanan bawah. Bingkai mengikuti
 *   jari, kartu melompat ke ukuran sah terdekat secara langsung.
 * - Tombol "−" = arsipkan kartu (bisa dimunculkan lagi lewat Tambah fitur).
 * Posisi BEBAS: tiap kartu menyimpan kolom & barisnya sendiri (per jumlah kolom
 * layar), jadi kartu tetap di tempat ia dilepas — boleh ada ruang kosong.
 * Bila menabrak, kartu lain bergeser ke bawah (freeLayout di bento-engine.js),
 * jadi tidak pernah ada kartu bertumpuk.
 */

import {
    columnsFor,
    modeFor,
    cellAt,
    freeLayout,
    nearestSize,
    rowsUsed,
    sanitizeState,
    toItems,
} from "./bento-engine.js";
import { el, icon } from "./home-icons.js";
import { renderGlance, TONES } from "./home-glance.js";

const LONG_PRESS_MS = 420;
const MOVE_TOLERANCE = 8;

export function createBento({
    grid,
    storageKey,
    defaults = {},
    onOpen,
    onArchive,
    onAdd,
    getContext = () => ({}),
    onEditChange,
}) {
    const s = {
        features: [],
        state: { order: [], sizes: {} },
        placed: [],
        cols: 4,
        cell: 80,
        gap: 12,
        editing: false,
        selected: null,
        cards: new Map(),
        press: null,
        drag: null,
        resize: null,
    };

    grid.classList.add("bx-grid");
    const placeholder = el("div", "bx-placeholder");
    const ghost = el("div", "bx-resize-ghost");
    const addTile = el("button", "bx-add", el("span", "bx-add__plus", icon("plus")), el("span", "", "Tambah fitur"));
    addTile.type = "button";
    addTile.addEventListener("click", () => onAdd?.());

    // Bar mode atur (melayang di bawah, gaya One UI).
    const editBar = el("div", "bx-editbar",
        el("p", "bx-editbar__hint", "Geser untuk memindahkan · tarik sudut untuk ubah ukuran"),
        el("div", "bx-editbar__actions"));
    const resetBtn = el("button", "bx-editbar__btn", "Atur ulang");
    const addBtn = el("button", "bx-editbar__btn", icon("plus"), "Tambah");
    const doneBtn = el("button", "bx-editbar__btn bx-editbar__btn--done", icon("check"), "Selesai");
    [resetBtn, addBtn, doneBtn].forEach((b) => (b.type = "button"));
    editBar.lastChild.append(resetBtn, addBtn, doneBtn);
    resetBtn.addEventListener("click", () => reset());
    addBtn.addEventListener("click", () => onAdd?.());
    doneBtn.addEventListener("click", () => setEditing(false));
    editBar.hidden = true;

    /* ---------- Simpan ---------- */

    function load() {
        try {
            return JSON.parse(localStorage.getItem(storageKey) || "null");
        } catch {
            return null;
        }
    }

    /*
     * Simpanan PENUH (termasuk kartu yang belum termuat). Kartu dimuat bertahap,
     * jadi tampilan sementara tidak boleh menimpa simpanan: urutan & ukuran
     * kartu yang belum tampil dipertahankan di posisinya.
     */
    let stored = load() ?? { order: [], sizes: {}, pos: {} };

    function mergeIntoStored() {
        const shown = new Set(s.state.order);
        const old = Array.isArray(stored.order) ? stored.order.map(String) : [];
        const order = [...s.state.order];
        old.forEach((id, i) => {
            if (shown.has(id) || order.includes(id)) return;
            // Sisipkan kartu tersembunyi setelah tetangga sebelumnya yang masih ada.
            let at = 0;
            for (let j = i - 1; j >= 0; j--) {
                const k = order.indexOf(old[j]);
                if (k >= 0) {
                    at = k + 1;
                    break;
                }
            }
            order.splice(at, 0, id);
        });
        const pos = { ...(stored.pos ?? {}) };
        Object.entries(s.state.pos ?? {}).forEach(([cols, map]) => {
            pos[cols] = { ...(pos[cols] ?? {}), ...map };
        });
        stored = { order, sizes: { ...(stored.sizes ?? {}), ...s.state.sizes }, pos };
    }

    function save() {
        mergeIntoStored();
        try {
            localStorage.setItem(storageKey, JSON.stringify(stored));
        } catch {
            /* storage penuh/diblokir: tata letak tetap jalan selama halaman terbuka */
        }
    }

    /* ---------- Ukuran & posisi ---------- */

    function measure() {
        const width = grid.clientWidth || grid.getBoundingClientRect().width || 360;
        s.cols = columnsFor(width);
        s.gap = s.cols === 4 ? 12 : 14;
        s.cell = (width - s.gap * (s.cols - 1)) / s.cols;
        grid.style.setProperty("--bx-cell", `${s.cell}px`);
        grid.style.setProperty("--bx-gap", `${s.gap}px`);
        grid.dataset.cols = String(s.cols);
    }

    const step = () => s.cell + s.gap;
    const px = (cells) => cells * s.cell + Math.max(0, cells - 1) * s.gap;

    function place(node, p) {
        node.style.width = `${px(p.w)}px`;
        node.style.height = `${px(p.h)}px`;
        node.style.transform = `translate3d(${p.x * step()}px, ${p.y * step()}px, 0)`;
    }

    const posMap = () => {
        s.state.pos = s.state.pos ?? {};
        return (s.state.pos[s.cols] = s.state.pos[s.cols] ?? {});
    };

    /** Kunci posisi hasil tata letak sebagai posisi tetap kartu (dipanggil setelah selesai menggeser). */
    function commitPositions() {
        const map = posMap();
        s.placed.forEach((p) => {
            map[p.id] = { x: p.x, y: p.y };
        });
    }

    function layout() {
        // Saat menggeser: posisi sementara (kartu lain kembali ke tempat asal bila jari menjauh).
        const pos = s.drag?.pos ?? posMap();
        const priority = s.drag?.id ?? s.resize?.id ?? null;
        s.placed = freeLayout(toItems(s.state), s.cols, pos, priority);
        if (!s.drag && !s.resize) commitPositions();
        let rows = rowsUsed(s.placed);

        s.placed.forEach((p) => {
            const card = s.cards.get(p.id);
            if (!card) return;
            card.dataset.size = `${p.w}x${p.h}`;
            card.dataset.w = String(p.w);
            card.dataset.h = String(p.h);
            card.dataset.mode = modeFor(p.w, p.h);
            if (s.drag?.id === p.id) {
                place(placeholder, p);
                // Kartu yang digeser tetap mengikuti jari; ukurannya saja yang disamakan.
                card.style.width = `${px(p.w)}px`;
                card.style.height = `${px(p.h)}px`;
                return;
            }
            place(card, p);
        });

        // Kotak "Tambah fitur" selalu di baris baru di bawah kartu terakhir (tidak mengambil ruang kosong milik user).
        const tile = { id: "__add", x: 0, y: rows, w: Math.min(2, s.cols), h: 1 };
        place(addTile, tile);
        rows = Math.max(rows, tile.y + tile.h);

        grid.style.height = `${Math.max(1, rows) * step() - s.gap}px`;
    }

    /* ---------- Kartu ---------- */

    function createCard(feature) {
        const card = el("article", "bx-card");
        card.dataset.id = feature.id;
        card.dataset.tone = TONES[feature.id] ?? "light";
        card.dataset.instant = "1";

        const hit = el("button", "bx-card__hit");
        hit.type = "button";
        hit.setAttribute("aria-label", `Buka ${feature.title}`);
        const head = el("span", "bx-card__head", el("span", "bx-card__badge", icon(feature.id)), el("span", "bx-card__title", feature.title));
        const body = el("span", "bx-card__body");
        hit.append(head, body, el("span", "bx-card__arrow", icon("arrow")));

        const remove = el("button", "bx-card__remove", icon("minus"));
        remove.type = "button";
        remove.setAttribute("aria-label", `Arsipkan ${feature.title}`);
        remove.addEventListener("click", (event) => {
            event.stopPropagation();
            card.classList.add("is-leaving");
            setTimeout(() => onArchive?.(feature.id), 220);
        });

        const handle = el("span", "bx-card__resize");
        handle.setAttribute("aria-hidden", "true");
        handle.innerHTML = '<svg viewBox="0 0 40 40"><path d="M36 6 A30 30 0 0 1 6 36"/></svg>';

        card.append(hit, remove, handle);
        renderGlance(body, feature, getContext());
        return card;
    }

    function render(features) {
        s.features = features;
        const ids = features.map((f) => f.id);
        // Selalu dari simpanan penuh (bukan dari tampilan sementara).
        if (s.state.order.length) mergeIntoStored();
        s.state = sanitizeState(stored, ids, defaults);

        const wanted = new Set(ids);
        for (const [id, card] of s.cards) {
            if (!wanted.has(id)) {
                card.remove();
                s.cards.delete(id);
            }
        }
        features.forEach((feature) => {
            if (!s.cards.has(feature.id)) {
                const card = createCard(feature);
                s.cards.set(feature.id, card);
                grid.appendChild(card);
            }
        });
        if (!addTile.isConnected) grid.appendChild(addTile);

        measure();
        layout();
        requestAnimationFrame(() => {
            s.cards.forEach((card) => delete card.dataset.instant);
        });
    }

    function refresh() {
        s.features.forEach((feature) => {
            const body = s.cards.get(feature.id)?.querySelector(".bx-card__body");
            if (body) renderGlance(body, feature, getContext());
        });
    }

    /* ---------- Mode atur ---------- */

    function setEditing(on) {
        if (s.editing === Boolean(on)) return;
        s.editing = Boolean(on);
        grid.dataset.editing = s.editing ? "true" : "false";
        if (!editBar.isConnected) (grid.closest("[data-dashboard-user-root]") ?? document.body).append(editBar);
        editBar.hidden = false;
        requestAnimationFrame(() => editBar.classList.toggle("is-open", s.editing));
        if (!s.editing) setTimeout(() => (editBar.hidden = !s.editing), 260);
        select(null);
        if (!s.editing) save();
        onEditChange?.(s.editing);
    }

    function select(id) {
        s.selected = id;
        s.cards.forEach((card, key) => card.classList.toggle("is-selected", key === id));
    }

    function reset() {
        stored = { order: [], sizes: {}, pos: {} };
        s.state = sanitizeState(null, s.features.map((f) => f.id), defaults);
        layout();
        save();
    }

    /* ---------- Geser ---------- */

    function gridPoint(event) {
        const rect = grid.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function beginDrag(event, card) {
        const id = card.dataset.id;
        const point = gridPoint(event);
        const p = s.placed.find((it) => it.id === id);
        s.drag = {
            id,
            card,
            dx: point.x - p.x * step(),
            dy: point.y - p.y * step(),
            pointerId: event.pointerId,
            base: { ...posMap() },
            pos: { ...posMap() },
            cell: `${p.x},${p.y}`,
        };
        select(null);
        card.classList.add("is-dragging");
        grid.classList.add("is-dragging");
        grid.appendChild(placeholder);
        try {
            card.setPointerCapture(event.pointerId);
        } catch {
            /* sudah dilepas */
        }
        navigator.vibrate?.(8);
        layout();
        moveDrag(event);
        startAutoScroll();
    }

    function moveDrag(event) {
        const d = s.drag;
        const point = gridPoint(event);
        d.lastEvent = event;
        const left = point.x - d.dx;
        const top = point.y - d.dy;
        d.card.style.transform = `translate3d(${left}px, ${top}px, 0) scale(1.04)`;

        // Sel terdekat dengan pojok kiri-atas kartu = tempat kartu akan diletakkan (bebas, tidak dirapatkan ke atas).
        const me = s.placed.find((p) => p.id === d.id);
        const cell = cellAt(left, top, step(), s.cols, me?.w ?? 1);
        const key = `${cell.x},${cell.y}`;
        if (key !== d.cell) {
            d.cell = key;
            // Kartu lain selalu dihitung dari posisi asalnya, hanya yang tertabrak yang turun.
            d.pos = { ...d.base, [d.id]: cell };
            layout();
        }
    }

    function endDrag() {
        const d = s.drag;
        if (!d) return;
        s.drag = null;
        stopAutoScroll();
        d.card.classList.remove("is-dragging");
        grid.classList.remove("is-dragging");
        placeholder.remove();
        // Posisi yang terakhir terlihat (termasuk kartu yang tertabrak turun) menjadi posisi tetap.
        const map = posMap();
        Object.keys(map).forEach((id) => delete map[id]);
        Object.assign(map, d.pos);
        layout();
        save();
    }

    let scrollRaf = 0;
    function startAutoScroll() {
        const scroller = document.scrollingElement || document.documentElement;
        const tick = () => {
            const e = s.drag?.lastEvent;
            if (!s.drag) return;
            if (e) {
                const edge = 70;
                const vh = window.innerHeight;
                let dy = 0;
                if (e.clientY < edge) dy = -Math.ceil((edge - e.clientY) / 6);
                else if (e.clientY > vh - edge) dy = Math.ceil((e.clientY - (vh - edge)) / 6);
                if (dy) {
                    scroller.scrollTop += dy;
                    moveDrag(e);
                }
            }
            scrollRaf = requestAnimationFrame(tick);
        };
        scrollRaf = requestAnimationFrame(tick);
    }
    function stopAutoScroll() {
        cancelAnimationFrame(scrollRaf);
    }

    /* ---------- Ubah ukuran ---------- */

    function beginResize(event, card) {
        event.preventDefault();
        event.stopPropagation();
        const id = card.dataset.id;
        const p = s.placed.find((it) => it.id === id);
        s.resize = { id, card, origin: { x: p.x * step(), y: p.y * step() }, pointerId: event.pointerId };
        card.classList.add("is-resizing");
        grid.appendChild(ghost);
        try {
            event.target.setPointerCapture(event.pointerId);
        } catch {
            /* abaikan */
        }
        moveResize(event);
    }

    function moveResize(event) {
        const r = s.resize;
        const point = gridPoint(event);
        const p = s.placed.find((it) => it.id === r.id);
        r.origin = { x: p.x * step(), y: p.y * step() };
        // Bingkai mengikuti jari tapi tidak keluar dari grid.
        const maxWidth = grid.clientWidth - r.origin.x;
        const width = Math.min(maxWidth, Math.max(s.cell * 0.6, point.x - r.origin.x));
        const height = Math.min(6 * step() - s.gap, Math.max(s.cell * 0.6, point.y - r.origin.y));
        ghost.style.transform = `translate3d(${r.origin.x}px, ${r.origin.y}px, 0)`;
        ghost.style.width = `${width}px`;
        ghost.style.height = `${height}px`;

        const size = nearestSize((width + s.gap) / step(), (height + s.gap) / step(), s.cols);
        if (s.state.sizes[r.id] !== size) {
            s.state.sizes[r.id] = size;
            navigator.vibrate?.(5);
            layout();
        }
    }

    function endResize() {
        const r = s.resize;
        if (!r) return;
        s.resize = null;
        r.card.classList.remove("is-resizing");
        ghost.remove();
        layout();
        save();
    }

    /* ---------- Pointer ---------- */

    function onPointerDown(event) {
        if (event.button !== undefined && event.button !== 0) return;
        const card = event.target.closest(".bx-card");
        if (!card || !grid.contains(card)) return;
        if (event.target.closest(".bx-card__remove")) return;

        if (event.target.closest(".bx-card__resize")) {
            if (s.editing) beginResize(event, card);
            return;
        }

        s.press = {
            card,
            x: event.clientX,
            y: event.clientY,
            moved: false,
            long: false,
            event,
            timer: setTimeout(() => {
                if (!s.press || s.press.moved) return;
                s.press.long = true;
                if (!s.editing) setEditing(true);
                card.classList.add("is-armed");
                navigator.vibrate?.(12);
            }, LONG_PRESS_MS),
        };
    }

    function onPointerMove(event) {
        if (s.resize) {
            moveResize(event);
            return;
        }
        if (s.drag) {
            moveDrag(event);
            return;
        }
        const press = s.press;
        if (!press) return;
        const far = Math.hypot(event.clientX - press.x, event.clientY - press.y) > MOVE_TOLERANCE;
        if (!far) return;
        press.moved = true;
        // Di mode atur (atau setelah tekan lama) gerakan = menggeser kartu.
        if (s.editing && (press.long || event.pointerType === "mouse" || s.editing)) {
            clearTimeout(press.timer);
            press.card.classList.remove("is-armed");
            s.press = null;
            beginDrag(event, press.card);
        } else {
            clearTimeout(press.timer);
            s.press = null; // menggulir halaman
        }
    }

    function onPointerUp(event) {
        if (s.resize) {
            endResize();
            return;
        }
        if (s.drag) {
            endDrag();
            return;
        }
        const press = s.press;
        s.press = null;
        if (!press) return;
        clearTimeout(press.timer);
        press.card.classList.remove("is-armed");
        if (press.moved || press.long) return;

        const id = press.card.dataset.id;
        if (s.editing) {
            select(s.selected === id ? null : id);
        } else {
            onOpen?.(id);
        }
    }

    function onPointerCancel() {
        if (s.press) clearTimeout(s.press.timer);
        s.press = null;
        endDrag();
        endResize();
    }

    // Saat menggeser di HP, cegah halaman ikut tergulir.
    function onTouchMove(event) {
        if (s.drag || s.resize || (s.press?.long && s.editing)) event.preventDefault();
    }

    // Klik keyboard (Enter/Spasi) pada kartu.
    function onClick(event) {
        const hit = event.target.closest(".bx-card__hit");
        if (!hit || event.detail !== 0) return;
        const id = hit.closest(".bx-card")?.dataset.id;
        if (!id) return;
        if (s.editing) select(s.selected === id ? null : id);
        else onOpen?.(id);
    }

    function onKey(event) {
        if (event.key === "Escape" && s.editing) setEditing(false);
    }

    grid.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    grid.addEventListener("click", onClick);
    grid.addEventListener("contextmenu", (event) => {
        if (event.target.closest(".bx-card")) event.preventDefault();
    });
    document.addEventListener("keydown", onKey);

    const ro = new ResizeObserver(() => {
        const before = s.cols;
        const width = s.cell;
        measure();
        if (before !== s.cols || Math.abs(width - s.cell) > 0.5) layout();
    });
    ro.observe(grid);

    return {
        render,
        refresh,
        reset,
        setEditing,
        isEditing: () => s.editing,
        getState: () => JSON.parse(JSON.stringify(s.state)),
        destroy() {
            ro.disconnect();
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            window.removeEventListener("pointercancel", onPointerCancel);
            document.removeEventListener("touchmove", onTouchMove);
            document.removeEventListener("keydown", onKey);
        },
    };
}
