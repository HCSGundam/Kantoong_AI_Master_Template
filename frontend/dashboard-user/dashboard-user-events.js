
/**
 * ============================================================
 * KANTOONG CORE — Dashboard User Event Controller
 * File: frontend/dashboard-user/dashboard-user-events.js
 *
 * TANGGUNG JAWAB:
 * 1. Mengelola event UI dashboard user.
 * 2. Long press untuk mengaktifkan mode edit.
 * 3. Drag-and-drop kartu fitur.
 * 4. Resize kartu dari 8 arah.
 * 5. Menangani tombol toolbar, tema, dialog, dan Feature Hub.
 * 6. Mengelola pencarian, saran, dan riwayat navigasi.
 * 7. Membersihkan seluruh event listener saat dihentikan.
 *
 * CATATAN:
 * - Tidak menginisialisasi dashboard utama.
 * - Tidak menyimpan layout secara langsung.
 * - Penyimpanan dan validasi layout tetap ditangani dashboard-user.js.
 * - Tidak mengakses API AI/backend secara langsung.
 * ============================================================
 */

import { DASHBOARD_USER_CONFIG } from "./dashboard-user-config.js";

import {
    beginDashboardLayoutEdit,
    finishDashboardLayoutEdit,
    cancelDashboardLayoutEdit,
    moveFeatureCard,
    resizeFeatureCard,
    resetDashboardLayout,
    openDashboardFeature,
    addFeatureToDashboard,
    archiveFeatureFromDashboard,
    openFeatureHub,
    closeFeatureHub,
    renderFeatureHub,
    searchDashboardFeatures,
    clearDashboardSearch,
    toggleNavigationHistory,
    removeNavigationHistoryEntry,
    clearNavigationHistory,
    toggleDashboardTheme,
    getDashboardState,
} from "./dashboard-user.js";

/* ============================================================
   01. CONSTANTS
   ============================================================ */

const SELECTORS = Object.freeze({
    root: "[data-dashboard-user-root]",
    grid: "[data-dashboard-feature-grid]",
    card: "[data-feature-card]",
    toolbar: "[data-layout-toolbar]",
    searchForm: "[data-dashboard-search-form]",
    searchInput: "[data-dashboard-search-input]",
    searchSuggestions: "[data-search-suggestions]",
    searchSuggestion: "[data-search-suggestion]",
    hubDialog: "#dashboardFeatureHubDialog",
    hubSearchForm: "[data-feature-hub-search-form]",
    hubSearchInput: "[data-feature-hub-search]",
    settingsDialog: "#dashboardSettingsDialog",
    historyPanel: "[data-navigation-history]",
    historyItem: "[data-history-item]",
    historyList: "[data-navigation-history-list]",
    resizeHandle: "[data-resize-handle]",
    dragHandle: "[data-drag-handle]",
});

const ACTIONS = Object.freeze({
    toggleTheme: "toggle-theme",
    openSettings: "open-dashboard-settings",
    closeDashboard: "close-dashboard",
    clearSearch: "clear-search",
    voiceSearch: "voice-search",
    toggleHistory: "toggle-navigation-history",
    clearHistory: "clear-navigation-history",
    removeHistoryItem: "remove-history-item",
    cancelEdit: "cancel-layout-edit",
    resetLayout: "reset-layout",
    saveLayout: "save-layout",
    retryFeatures: "retry-load-features",
    openHub: "open-feature-hub",
    closeHub: "close-feature-hub",
    openFeature: "open-feature",
    addFeature: "add-feature",
    archiveFeature: "archive-feature",
    toggleLayoutEdit: "toggle-layout-edit",
    setCardSize: "set-card-size",
});

const LONG_PRESS_DURATION =
    DASHBOARD_USER_CONFIG.editMode.longPressDurationMs;

const LONG_PRESS_TOLERANCE =
    DASHBOARD_USER_CONFIG.editMode.longPressMovementTolerancePx;

const DRAG_THRESHOLD =
    DASHBOARD_USER_CONFIG.editMode.drag.thresholdPx;

const RESIZE_DIRECTIONS = new Set(
    DASHBOARD_USER_CONFIG.editMode.resizeDirections ?? [
        "n", "ne", "e", "se", "s", "sw", "w", "nw",
    ],
);

const SEARCH_DEBOUNCE =
    DASHBOARD_USER_CONFIG.search.debounceMs ?? 180;

const INTERACTIVE_SELECTOR = [
    "button",
    "a",
    "input",
    "textarea",
    "select",
    "summary",
    "[role='button']",
    "[data-drag-handle]",
    "[data-resize-handle]",
].join(",");

/* ============================================================
   02. INTERNAL STATE
   ============================================================ */

let root = null;
let abortController = null;
let searchDebounceTimer = null;

let pointerSession = null;
let longPressTimer = null;

let initialized = false;
let suppressNextCardClick = false;
let suppressClickTimer = null;

/* ============================================================
   03. GENERAL UTILITIES
   ============================================================ */

function getElement(selector, parent = root) {
    return parent?.querySelector(selector) ?? null;
}

function getElements(selector, parent = root) {
    return parent ? [...parent.querySelectorAll(selector)] : [];
}

function getActionElement(target) {
    if (!(target instanceof Element)) return null;

    return target.closest("[data-action]");
}

function getActionName(target) {
    return getActionElement(target)?.dataset.action ?? "";
}

function getFeatureCard(target) {
    if (!(target instanceof Element)) return null;

    return target.closest(SELECTORS.card);
}

function getFeatureId(element) {
    if (!element) return "";

    return (
        element.dataset.featureId ??
        element.dataset.feature ??
        element.getAttribute("data-id") ??
        ""
    ).trim();
}

function getFeatureIdFromAction(target) {
    const action = getActionElement(target);
    const card = getFeatureCard(target);

    return (
        action?.dataset.featureId ??
        card?.dataset.featureId ??
        card?.dataset.feature ??
        ""
    ).trim();
}

function isDashboardEditMode() {
    const state = getDashboardState();

    return (
        state?.mode === "edit" ||
        root?.dataset.layoutMode === "edit"
    );
}

function getGridElement() {
    return getElement(SELECTORS.grid);
}

function getGridMetrics() {
    const grid = getGridElement();

    if (!grid) return null;

    const rect = grid.getBoundingClientRect();
    const style = getComputedStyle(grid);

    const columns = Math.max(
        1,
        Number(
            getDashboardState()?.gridColumns ??
            grid.dataset.columns ??
            DASHBOARD_USER_CONFIG.layout.columns.desktop,
        ),
    );

    const columnGap = parseFloat(style.columnGap) || 0;
    const rowGap = parseFloat(style.rowGap) || 0;

    const columnWidth = (
        rect.width - columnGap * (columns - 1)
    ) / columns;

    const firstCard = getElements(SELECTORS.card, grid)[0];
    const firstCardRect = firstCard?.getBoundingClientRect();

    // Sel grid persegi: tinggi baris = lebar kolom (lihat
    // syncGridCellSize di dashboard-user.js).
    const rowHeight = columnWidth;

    return {
        grid,
        rect,
        columns,
        columnGap,
        rowGap,
        columnWidth,
        rowHeight,
        cellWidth: columnWidth + columnGap,
        cellHeight: rowHeight + rowGap,
    };
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function announce(message) {
    if (!message) return;

    const announcement = document.querySelector("#dashboardAnnouncement");

    if (announcement) {
        announcement.textContent = "";
        requestAnimationFrame(() => {
            announcement.textContent = message;
        });
    }

    root?.dispatchEvent(
        new CustomEvent("kantoong:dashboard-announcement", {
            bubbles: true,
            detail: { message },
        }),
    );
}

function dispatchDashboardEvent(name, detail = {}) {
    root?.dispatchEvent(
        new CustomEvent(name, {
            bubbles: true,
            detail,
        }),
    );
}

function clearSearchDebounce() {
    if (searchDebounceTimer !== null) {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
    }
}

function cancelLongPress() {
    if (longPressTimer !== null) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
}

function suppressCardClickBriefly() {
    suppressNextCardClick = true;

    if (suppressClickTimer !== null) {
        clearTimeout(suppressClickTimer);
    }

    suppressClickTimer = setTimeout(() => {
        suppressNextCardClick = false;
        suppressClickTimer = null;
    }, 250);
}

function safelyCall(callback, ...args) {
    const handleError = (error) => {
        console.error("[KANTOONG Dashboard Events]", error);
        announce("Terjadi kesalahan saat menjalankan aksi.");
        return undefined;
    };

    try {
        const result = callback(...args);

        // Fungsi async: tangkap juga error yang muncul setelah await.
        if (result && typeof result.then === "function") {
            return result.catch(handleError);
        }

        return result;
    } catch (error) {
        return handleError(error);
    }
}

/* ============================================================
   04. DIALOG HELPERS
   ============================================================ */

function openDialog(dialog) {
    if (!dialog) return;

    if (typeof dialog.showModal === "function") {
        if (!dialog.open) dialog.showModal();
        return;
    }

    dialog.setAttribute("open", "");
}

function closeDialog(dialog) {
    if (!dialog) return;

    if (typeof dialog.close === "function" && dialog.open) {
        dialog.close();
        return;
    }

    dialog.removeAttribute("open");
}

function handleDialogBackdropClick(event) {
    const dialog = event.target;

    if (!(dialog instanceof HTMLDialogElement)) return;
    if (dialog !== event.currentTarget) return;

    const rect = dialog.getBoundingClientRect();

    const insideDialog =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

    if (!insideDialog) {
        closeDialog(dialog);
    }
}

/* ============================================================
   05. LAYOUT EDITING
   ============================================================ */

function startLayoutEdit() {
    if (isDashboardEditMode()) return;

    safelyCall(beginDashboardLayoutEdit);

    root.dataset.layoutMode = "edit";
    root.dataset.dashboardState = "editing";

    dispatchDashboardEvent("kantoong:dashboard-layout-edit-start");

    announce("Mode edit aktif. Geser atau ubah ukuran kartu.");
}

function saveLayoutEdit() {
    safelyCall(() => finishDashboardLayoutEdit({ save: true }));

    root.dataset.layoutMode = "view";
    root.dataset.dashboardState = "normal";

    pointerSession = null;
    cancelLongPress();

    dispatchDashboardEvent("kantoong:dashboard-layout-saved");

    announce("Susunan dashboard berhasil disimpan.");
}

function cancelLayoutEdit() {
    cancelLongPress();
    pointerSession = null;

    safelyCall(cancelDashboardLayoutEdit);

    root.dataset.layoutMode = "view";
    root.dataset.dashboardState = "normal";

    dispatchDashboardEvent("kantoong:dashboard-layout-cancelled");

    announce("Perubahan tata letak dibatalkan.");
}

function resetLayout() {
    safelyCall(resetDashboardLayout);

    root.dataset.layoutMode = "view";
    root.dataset.dashboardState = "normal";

    pointerSession = null;
    cancelLongPress();

    dispatchDashboardEvent("kantoong:dashboard-layout-reset");

    announce("Tata letak dashboard telah diatur ulang.");
}

/* ============================================================
   06. LONG PRESS AND POINTER SESSION
   ============================================================ */

function getPointerCoordinates(event) {
    return {
        x: event.clientX,
        y: event.clientY,
    };
}

function getPointerDistance(start, current) {
    return Math.hypot(
        current.x - start.x,
        current.y - start.y,
    );
}

function handlePointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    if (event.isPrimary === false) return;

    const card = getFeatureCard(event.target);
    if (!card) return;

    const featureId = getFeatureId(card);
    if (!featureId) return;

    const resizeHandle = event.target.closest(
        SELECTORS.resizeHandle,
    );

    const dragHandle = event.target.closest(
        SELECTORS.dragHandle,
    );

    const position = getPointerCoordinates(event);

    if (isDashboardEditMode()) {
        if (resizeHandle) {
            const direction = resizeHandle.dataset.resizeHandle;

            if (!RESIZE_DIRECTIONS.has(direction)) return;

            beginPointerSession({
                type: "resize",
                event,
                card,
                featureId,
                direction,
                position,
            });

            return;
        }

        if (dragHandle) {
            beginPointerSession({
                type: "drag",
                event,
                card,
                featureId,
                position,
            });
        }

        return;
    }

    // Tombol "buka fitur" membungkus seluruh kartu, jadi tekan lama HARUS
    // boleh dimulai dari sana (sebelumnya selalu terblokir). Kontrol lain
    // (input, tautan, pegangan) tetap dikecualikan.
    if (event.target instanceof Element) {
        const interactive = event.target.closest(INTERACTIVE_SELECTOR);

        if (
            interactive &&
            !interactive.matches('[data-action="open-feature"]')
        ) {
            return;
        }
    }

    cancelLongPress();

    pointerSession = {
        type: "long-press",
        pointerId: event.pointerId,
        card,
        featureId,
        start: position,
        current: position,
        activated: false,
    };

    longPressTimer = setTimeout(() => {
        if (!pointerSession) return;
        if (pointerSession.type !== "long-press") return;

        pointerSession.activated = true;
        startLayoutEdit();

        // Seleksi kartu pertama tidak mengubah susunan layout.
        card.dataset.layoutSelected = "true";

        announce("Kartu siap diatur. Gunakan pegangan untuk mengubahnya.");
        cancelLongPress();
    }, LONG_PRESS_DURATION);
}

function beginPointerSession({
    type,
    event,
    card,
    featureId,
    direction = null,
    position,
}) {
    if (!isDashboardEditMode()) return;

    event.preventDefault();

    pointerSession = {
        type,
        pointerId: event.pointerId,
        card,
        featureId,
        direction,
        start: position,
        current: position,
        originalRect: card.getBoundingClientRect(),
        originalLayout: getDashboardState()?.layout?.find(
            item => item.id === featureId,
        ) ?? null,
        started: false,
    };

    try {
        event.target.setPointerCapture?.(event.pointerId);
    } catch {
        // Pointer capture tidak tersedia pada semua elemen.
    }
}

function handlePointerMove(event) {
    if (!pointerSession) return;

    if (
        pointerSession.pointerId !== undefined &&
        event.pointerId !== pointerSession.pointerId
    ) {
        return;
    }

    const position = getPointerCoordinates(event);

    if (pointerSession.type === "long-press") {
        pointerSession.current = position;

        const distance = getPointerDistance(
            pointerSession.start,
            position,
        );

        if (distance > LONG_PRESS_TOLERANCE) {
            cancelLongPress();
            pointerSession = null;
        }

        return;
    }

    const session = pointerSession;
    session.current = position;

    const distance = getPointerDistance(session.start, position);

    if (!session.started && distance < DRAG_THRESHOLD) {
        return;
    }

    session.started = true;
    event.preventDefault();

    if (session.type === "drag") {
        updateDragPreview(session, position);
    } else if (session.type === "resize") {
        updateResizePreview(session, position);
    }
}

function handlePointerUp(event) {
    cancelLongPress();

    if (!pointerSession) return;

    if (
        pointerSession.pointerId !== undefined &&
        event.pointerId !== pointerSession.pointerId
    ) {
        return;
    }

    const session = pointerSession;
    pointerSession = null;

    if (session.type === "long-press") {
        // Jari diangkat setelah tekan lama: abaikan klik susulan agar
        // kartu tidak langsung terbuka atau batal terpilih.
        if (session.activated) {
            suppressCardClickBriefly();
        }

        return;
    }

    if (!session.started) return;

    suppressCardClickBriefly();

    try {
        if (session.type === "drag") {
            commitDrag(session, getPointerCoordinates(event));
        } else if (session.type === "resize") {
            commitResize(session, getPointerCoordinates(event));
        }
    } finally {
        session.card?.removeAttribute("data-dragging");
        session.card?.removeAttribute("data-resizing");
        session.card?.removeAttribute("data-resize-direction");

        dispatchDashboardEvent("kantoong:dashboard-card-manipulation-end", {
            featureId: session.featureId,
            type: session.type,
        });
    }
}

function handlePointerCancel() {
    cancelLongPress();

    if (pointerSession?.card) {
        pointerSession.card.removeAttribute("data-dragging");
        pointerSession.card.removeAttribute("data-resizing");
        pointerSession.card.removeAttribute("data-resize-direction");
    }

    pointerSession = null;
}

/* ============================================================
   07. DRAG-AND-DROP
   ============================================================ */

function updateDragPreview(session, position) {
    const card = session.card;

    card.dataset.dragging = "true";

    const dx = position.x - session.start.x;
    const dy = position.y - session.start.y;

    card.style.setProperty("--dashboard-drag-x", `${dx}px`);
    card.style.setProperty("--dashboard-drag-y", `${dy}px`);

    dispatchDashboardEvent("kantoong:dashboard-card-drag", {
        featureId: session.featureId,
        deltaX: dx,
        deltaY: dy,
    });
}

function commitDrag(session, position) {
    const metrics = getGridMetrics();

    session.card.style.removeProperty("--dashboard-drag-x");
    session.card.style.removeProperty("--dashboard-drag-y");

    if (!metrics) return;

    const cardRect = session.card.getBoundingClientRect();

    const deltaX = position.x - session.start.x;
    const deltaY = position.y - session.start.y;

    const targetCenterX =
        cardRect.left + cardRect.width / 2 + deltaX;

    const targetCenterY =
        cardRect.top + cardRect.height / 2 + deltaY;

    const x = clamp(
        Math.round(
            (targetCenterX - metrics.rect.left) / metrics.cellWidth -
            (session.originalLayout?.width ?? 2) / 2,
        ),
        0,
        metrics.columns - 1,
    );

    const y = Math.max(
        0,
        Math.round(
            (targetCenterY - metrics.rect.top) / metrics.cellHeight -
            (session.originalLayout?.height ?? 2) / 2,
        ),
    );

    safelyCall(moveFeatureCard, session.featureId, x, y);

    dispatchDashboardEvent("kantoong:dashboard-card-moved", {
        featureId: session.featureId,
        x,
        y,
    });
}

/* ============================================================
   08. RESIZE — EIGHT DIRECTIONS
   ============================================================ */

function calculateResize(session, position) {
    const metrics = getGridMetrics();
    if (!metrics) return null;

    const original = session.originalLayout;
    if (!original) return null;

    const dx = position.x - session.start.x;
    const dy = position.y - session.start.y;

    const direction = session.direction;

    let width = original.width;
    let height = original.height;
    let x = original.x;
    let y = original.y;

    const minWidth = DASHBOARD_USER_CONFIG.cards.constraints.minWidth;
    const minHeight = DASHBOARD_USER_CONFIG.cards.constraints.minHeight;
    const maxHeight = DASHBOARD_USER_CONFIG.cards.constraints.maxHeight;

    const profile =
        getDashboardState()?.gridProfile ?? "desktop";

    const maxWidth =
        DASHBOARD_USER_CONFIG.cards.constraints.maxWidth[profile] ??
        metrics.columns;

    const columnDelta = Math.round(dx / metrics.cellWidth);
    const rowDelta = Math.round(dy / metrics.cellHeight);

    // Sisi timur: tambah/kurangi lebar.
    if (direction.includes("e")) {
        width = clamp(
            original.width + columnDelta,
            minWidth,
            Math.min(maxWidth, metrics.columns - original.x),
        );
    }

    // Sisi barat: ubah lebar dan geser titik awal.
    if (direction.includes("w")) {
        const nextWidth = clamp(
            original.width - columnDelta,
            minWidth,
            Math.min(maxWidth, original.x + original.width),
        );

        width = nextWidth;
        x = original.x + original.width - nextWidth;
    }

    // Sisi selatan: tambah/kurangi tinggi.
    if (direction.includes("s")) {
        height = clamp(
            original.height + rowDelta,
            minHeight,
            maxHeight,
        );
    }

    // Sisi utara: ubah tinggi dan geser titik awal.
    if (direction.includes("n")) {
        const nextHeight = clamp(
            original.height - rowDelta,
            minHeight,
            maxHeight,
        );

        height = nextHeight;
        y = Math.max(
            0,
            original.y + original.height - nextHeight,
        );

        // Pertahankan sisi bawah selama y tidak melewati batas grid.
        height = original.y + original.height - y;
        height = Math.max(minHeight, height);
    }

    width = Math.min(width, metrics.columns - x);

    return {
        x,
        y,
        width,
        height,
    };
}

function updateResizePreview(session, position) {
    session.card.dataset.resizing = "true";
    session.card.dataset.resizeDirection = session.direction;

    const size = calculateResize(session, position);
    if (!size) return;

    session.previewSize = size;

    dispatchDashboardEvent("kantoong:dashboard-card-resize-preview", {
        featureId: session.featureId,
        direction: session.direction,
        ...size,
    });
}

function commitResize(session, position) {
    const nextSize = calculateResize(session, position);
    if (!nextSize) return;

    // API resizeFeatureCard hanya menerima ukuran, bukan x/y.
    // Setelah resize, pindahkan kartu ke koordinat yang dihitung.
    safelyCall(resizeFeatureCard, session.featureId, {
        width: nextSize.width,
        height: nextSize.height,
    });

    const latestLayout = getDashboardState()?.layout?.find(
        item => item.id === session.featureId,
    );

    if (
        latestLayout &&
        (latestLayout.x !== nextSize.x || latestLayout.y !== nextSize.y)
    ) {
        safelyCall(
            moveFeatureCard,
            session.featureId,
            nextSize.x,
            nextSize.y,
        );
    }

    dispatchDashboardEvent("kantoong:dashboard-card-resized", {
        featureId: session.featureId,
        direction: session.direction,
        ...nextSize,
    });
}

/* ============================================================
   09. CARD CLICK / OPEN FEATURE
   ============================================================ */

async function handleFeatureCardClick(event) {
    if (suppressNextCardClick) {
        event.preventDefault();
        event.stopPropagation();
        suppressNextCardClick = false;
        return;
    }

    const card = getFeatureCard(event.target);
    if (!card) return;

    const action = getActionElement(event.target);

    // Tombol "open-feature" membungkus seluruh isi kartu, jadi klik pada
    // kartu HARUS diproses di sini (sebelumnya dilewati oleh dua handler
    // sekaligus sehingga kartu tidak bereaksi). Aksi tombol lain tetap
    // diproses oleh delegated action handler.
    if (action && action.dataset.action !== ACTIONS.openFeature) return;

    const featureId = getFeatureId(card);
    if (!featureId) return;

    if (isDashboardEditMode()) {
        // Klik kartu di mode edit hanya mengubah status seleksi.
        const selected = card.dataset.layoutSelected === "true";

        getElements(SELECTORS.card).forEach(item => {
            delete item.dataset.layoutSelected;
        });

        if (!selected) {
            card.dataset.layoutSelected = "true";
        }

        return;
    }

    await safelyCall(openDashboardFeature, featureId);
}

/* ============================================================
   10. SEARCH AND SUGGESTIONS
   ============================================================ */

function handleSearchInput(event) {
    const query = event.target.value ?? "";

    clearSearchDebounce();

    searchDebounceTimer = setTimeout(() => {
        safelyCall(searchDashboardFeatures, query);

        dispatchDashboardEvent("kantoong:dashboard-search", {
            query,
        });

        searchDebounceTimer = null;
    }, SEARCH_DEBOUNCE);
}

function handleSearchSubmit(event) {
    event.preventDefault();

    const input = getElement(SELECTORS.searchInput);
    const query = input?.value?.trim() ?? "";

    clearSearchDebounce();

    safelyCall(searchDashboardFeatures, query);

    const firstSuggestion = getElements(
        SELECTORS.searchSuggestion,
        getElement(SELECTORS.searchSuggestions),
    )[0];

    if (firstSuggestion && query) {
        const featureId =
            firstSuggestion.dataset.featureId ??
            firstSuggestion.dataset.id;

        if (featureId) {
            safelyCall(openDashboardFeature, featureId);
        }
    }
}

function handleSearchSuggestionClick(event) {
    const suggestion = event.target.closest(
        SELECTORS.searchSuggestion,
    );

    if (!suggestion) return;

    const featureId =
        suggestion.dataset.featureId ??
        suggestion.dataset.id;

    if (!featureId) return;

    event.preventDefault();

    safelyCall(openDashboardFeature, featureId);
}

function handleSearchKeyboard(event) {
    const container = getElement(SELECTORS.searchSuggestions);
    if (!container) return;

    const suggestions = getElements(
        SELECTORS.searchSuggestion,
        container,
    );

    if (!suggestions.length) {
        if (event.key === "Escape") {
            container.hidden = true;
        }

        return;
    }

    const activeIndex = suggestions.findIndex(
        item => item.getAttribute("aria-selected") === "true",
    );

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();

        const direction = event.key === "ArrowDown" ? 1 : -1;

        const nextIndex = activeIndex < 0
            ? (direction > 0 ? 0 : suggestions.length - 1)
            : (activeIndex + direction + suggestions.length) %
                suggestions.length;

        suggestions.forEach((item, index) => {
            item.setAttribute(
                "aria-selected",
                String(index === nextIndex),
            );
        });

        suggestions[nextIndex]?.scrollIntoView({
            block: "nearest",
        });

        return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
        event.preventDefault();
        suggestions[activeIndex]?.click();
        return;
    }

    if (event.key === "Escape") {
        container.hidden = true;
    }
}

function handleClearSearch() {
    clearSearchDebounce();
    safelyCall(clearDashboardSearch);

    const input = getElement(SELECTORS.searchInput);

    if (input) {
        input.value = "";
        input.focus();
    }

    const suggestions = getElement(SELECTORS.searchSuggestions);

    if (suggestions) {
        suggestions.hidden = true;
    }
}

/* ============================================================
   11. FEATURE HUB
   ============================================================ */

function handleOpenFeatureHub() {
    safelyCall(openFeatureHub);

    const dialog = getElement(SELECTORS.hubDialog, document);

    if (dialog) {
        openDialog(dialog);
    }

    const search = getElement(SELECTORS.hubSearchInput);

    if (search) {
        search.value = "";
    }

    safelyCall(renderFeatureHub, "");

    dispatchDashboardEvent("kantoong:dashboard-feature-hub-open");
}

function handleCloseFeatureHub() {
    safelyCall(closeFeatureHub);

    const dialog = getElement(SELECTORS.hubDialog, document);

    if (dialog) {
        closeDialog(dialog);
    }

    dispatchDashboardEvent("kantoong:dashboard-feature-hub-close");
}

function handleFeatureHubSearch(event) {
    event.preventDefault();

    const input = getElement(SELECTORS.hubSearchInput);
    safelyCall(renderFeatureHub, input?.value?.trim() ?? "");
}

function handleFeatureHubSearchInput(event) {
    safelyCall(renderFeatureHub, event.target.value ?? "");
}

function handleAddFeature(featureId) {
    if (!featureId) return;

    safelyCall(addFeatureToDashboard, featureId);

    dispatchDashboardEvent("kantoong:dashboard-feature-added", {
        featureId,
    });
}

/** Mengubah ukuran kartu yang sedang dipilih (mode edit). */
function handleSetCardSize(sizeText) {
    const [width, height] = String(sizeText ?? "")
        .split("x")
        .map((part) => Number.parseInt(part, 10));

    if (!width || !height) return;

    const selected = root.querySelector(
        '[data-feature-card][data-layout-selected="true"]'
    );

    if (!selected) {
        announce("Pilih kartu dulu, lalu pilih ukurannya.");
        return;
    }

    const featureId = selected.dataset.featureId;

    safelyCall(resizeFeatureCard, featureId, { width, height });

    // Kartu dibuat ulang setelah ukuran berubah: tandai lagi.
    requestAnimationFrame(() => {
        root
            .querySelectorAll("[data-feature-card]")
            .forEach((card) => {
                if (card.dataset.featureId === featureId) {
                    card.dataset.layoutSelected = "true";
                }
            });
    });
}

function handleArchiveFeature(featureId) {
    if (!featureId) return;

    safelyCall(archiveFeatureFromDashboard, featureId);

    dispatchDashboardEvent("kantoong:dashboard-feature-archived", {
        featureId,
    });
}

/* ============================================================
   12. NAVIGATION HISTORY
   ============================================================ */

function handleToggleHistory() {
    safelyCall(toggleNavigationHistory);

    const panel = getElement(SELECTORS.historyPanel);

    dispatchDashboardEvent("kantoong:dashboard-history-toggle", {
        open: panel ? !panel.hidden : undefined,
    });
}

function handleRemoveHistoryItem(target) {
    const item = target.closest(SELECTORS.historyItem);

    const historyId =
        target.dataset.historyId ??
        item?.dataset.historyId ??
        item?.dataset.entryId;

    if (!historyId) return;

    safelyCall(removeNavigationHistoryEntry, historyId);
}

function handleClearHistory() {
    safelyCall(clearNavigationHistory);

    dispatchDashboardEvent("kantoong:dashboard-history-cleared");
}

/* ============================================================
   13. THEME AND DASHBOARD ACTIONS
   ============================================================ */

function handleToggleTheme() {
    safelyCall(toggleDashboardTheme);

    dispatchDashboardEvent("kantoong:dashboard-theme-toggle");
}

function handleCloseDashboard() {
    root.dataset.dashboardState = "closed";

    dispatchDashboardEvent("kantoong:dashboard-close-request");
}

function handleVoiceSearch() {
    if (!DASHBOARD_USER_CONFIG.search.voice?.enabled &&
        DASHBOARD_USER_CONFIG.search.voiceEnabled !== true) {
        announce("Pencarian suara belum diaktifkan.");
        return;
    }

    dispatchDashboardEvent("kantoong:dashboard-voice-search-request");
}

function handleRetryFeatures() {
    dispatchDashboardEvent("kantoong:dashboard-retry-features");
}

/* ============================================================
   14. ACTION DELEGATION
   ============================================================ */

function handleActionClick(event) {
    const actionElement = getActionElement(event.target);
    if (!actionElement) return;

    const action = actionElement.dataset.action;
    const featureId = getFeatureIdFromAction(event.target);

    switch (action) {
        case ACTIONS.toggleTheme:
            event.preventDefault();
            handleToggleTheme();
            break;

        case ACTIONS.openSettings:
            event.preventDefault();
            openDialog(getElement(SELECTORS.settingsDialog, document));
            break;

        case ACTIONS.closeDashboard:
            event.preventDefault();
            handleCloseDashboard();
            break;

        case ACTIONS.clearSearch:
            event.preventDefault();
            handleClearSearch();
            break;

        case ACTIONS.voiceSearch:
            event.preventDefault();
            handleVoiceSearch();
            break;

        case ACTIONS.toggleHistory:
            event.preventDefault();
            handleToggleHistory();
            break;

        case ACTIONS.clearHistory:
            event.preventDefault();
            handleClearHistory();
            break;

        case ACTIONS.removeHistoryItem:
            event.preventDefault();
            handleRemoveHistoryItem(actionElement);
            break;

        case ACTIONS.cancelEdit:
            event.preventDefault();
            cancelLayoutEdit();
            break;

        case ACTIONS.resetLayout:
            event.preventDefault();
            resetLayout();
            break;

        case ACTIONS.saveLayout:
            event.preventDefault();
            saveLayoutEdit();
            break;

        case ACTIONS.retryFeatures:
            event.preventDefault();
            handleRetryFeatures();
            break;

        case ACTIONS.openHub:
            event.preventDefault();
            handleOpenFeatureHub();
            break;

        case ACTIONS.closeHub:
            event.preventDefault();
            handleCloseFeatureHub();
            break;

        case ACTIONS.openFeature:
            // Ditangani oleh handleFeatureCardClick jika berasal dari kartu.
            // Tombol open-feature di luar kartu tetap didukung.
            if (!getFeatureCard(event.target)) {
                event.preventDefault();

                if (featureId) {
                    safelyCall(openDashboardFeature, featureId);
                }
            }
            break;

        case ACTIONS.toggleLayoutEdit:
            event.preventDefault();

            if (isDashboardEditMode()) {
                saveLayoutEdit();
            } else {
                startLayoutEdit();
            }
            break;

        case ACTIONS.setCardSize:
            event.preventDefault();
            handleSetCardSize(action.dataset.size);
            break;

        case ACTIONS.addFeature:
            event.preventDefault();
            handleAddFeature(featureId);
            break;

        case ACTIONS.archiveFeature:
            event.preventDefault();
            handleArchiveFeature(featureId);
            break;

        default:
            // Aksi modul lain dapat ditangani oleh listener eksternal.
            break;
    }
}

/* ============================================================
   15. KEYBOARD AND GLOBAL POINTER EVENTS
   ============================================================ */

function handleKeyDown(event) {
    if (event.key === "Escape") {
        if (pointerSession) {
            handlePointerCancel();
        }

        const historyPanel = getElement(SELECTORS.historyPanel);

        if (historyPanel && !historyPanel.hidden) {
            handleToggleHistory();
        }
    }

    if (
        event.key === "Enter" &&
        event.target instanceof Element &&
        event.target.matches(SELECTORS.card) &&
        !isDashboardEditMode()
    ) {
        const featureId = getFeatureId(event.target);

        if (featureId) {
            event.preventDefault();
            safelyCall(openDashboardFeature, featureId);
        }
    }
}

function handleGlobalPointerUp(event) {
    if (!(event.target instanceof Node)) return;
    if (!root?.contains(event.target) && pointerSession) {
        handlePointerUp(event);
    }
}

function handleWindowBlur() {
    handlePointerCancel();
}

/* ============================================================
   16. EVENT BINDING
   ============================================================ */

function bindEvents() {
    if (!root || !abortController) return;

    const { signal } = abortController;

    root.addEventListener("click", handleActionClick, { signal });
    root.addEventListener("click", handleFeatureCardClick, { signal });

    // Ketuk di luar panel riwayat menutupnya.
    root.addEventListener(
        "click",
        (event) => {
            const panel = getElement(SELECTORS.historyPanel);

            if (!panel || panel.hidden) return;

            if (
                event.target.closest("[data-navigation-history]") ||
                event.target.closest(
                    '[data-action="toggle-navigation-history"]'
                )
            ) {
                return;
            }

            handleToggleHistory();
        },
        { signal }
    );

    // Layar sentuh: cegah menu bawaan browser saat kartu ditekan lama.
    root.addEventListener(
        "contextmenu",
        (event) => {
            if (
                event.target instanceof Element &&
                event.target.closest(SELECTORS.card) &&
                window.matchMedia("(pointer: coarse)").matches
            ) {
                event.preventDefault();
            }
        },
        { signal }
    );
    root.addEventListener("click", handleSearchSuggestionClick, { signal });

    root.addEventListener("pointerdown", handlePointerDown, {
        signal,
        passive: false,
    });

    root.addEventListener("pointermove", handlePointerMove, {
        signal,
        passive: false,
    });

    root.addEventListener("pointerup", handlePointerUp, { signal });
    root.addEventListener("pointercancel", handlePointerCancel, { signal });

    root.addEventListener("keydown", handleKeyDown, { signal });

    const searchForm = getElement(SELECTORS.searchForm);
    const searchInput = getElement(SELECTORS.searchInput);

    searchForm?.addEventListener("submit", handleSearchSubmit, { signal });
    searchInput?.addEventListener("input", handleSearchInput, { signal });
    searchInput?.addEventListener("keydown", handleSearchKeyboard, { signal });

    const hubDialog = getElement(SELECTORS.hubDialog, document);
    const hubSearchForm = getElement(SELECTORS.hubSearchForm);
    const hubSearchInput = getElement(SELECTORS.hubSearchInput);

    hubSearchForm?.addEventListener(
        "submit",
        handleFeatureHubSearch,
        { signal },
    );

    hubSearchInput?.addEventListener(
        "input",
        handleFeatureHubSearchInput,
        { signal },
    );

    hubDialog?.addEventListener(
        "click",
        handleDialogBackdropClick,
        { signal },
    );

    const settingsDialog = getElement(
        SELECTORS.settingsDialog,
        document,
    );

    settingsDialog?.addEventListener(
        "click",
        handleDialogBackdropClick,
        { signal },
    );

    window.addEventListener("pointerup", handleGlobalPointerUp, { signal });
    window.addEventListener("blur", handleWindowBlur, { signal });
}

/* ============================================================
   17. INITIALIZATION AND CLEANUP
   ============================================================ */

/**
 * Pasang seluruh event dashboard user.
 *
 * Panggil setelah initDashboardUser() berhasil dijalankan.
 */
export function initDashboardUserEvents() {
    if (initialized) {
        destroyDashboardUserEvents();
    }

    root = document.querySelector(SELECTORS.root);

    if (!root) {
        console.warn(
            "[KANTOONG Dashboard Events] Root dashboard tidak ditemukan.",
        );

        return false;
    }

    abortController = new AbortController();

    bindEvents();

    initialized = true;

    dispatchDashboardEvent("kantoong:dashboard-events-ready");

    return true;
}

/**
 * Hapus seluruh event listener yang dipasang modul ini.
 */
export function destroyDashboardUserEvents() {
    cancelLongPress();
    clearSearchDebounce();
    handlePointerCancel();

    if (suppressClickTimer !== null) {
        clearTimeout(suppressClickTimer);
        suppressClickTimer = null;
    }

    suppressNextCardClick = false;

    abortController?.abort();
    abortController = null;

    root = null;
    initialized = false;
}

export default {
    initDashboardUserEvents,
    destroyDashboardUserEvents,
};
