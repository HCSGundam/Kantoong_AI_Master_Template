
// ============================================================
// KANTOONG AI
// File: js/panel.js
// Bottom Sheet & Gesture Controller
//
// Posisi panel:
//   peek = kartu sambutan
//   half = konsultasi terbuka
//   full = konsultasi hampir layar penuh
//
// Tinggi panel mengikuti chat-panel.css, termasuk:
//   - --peek-h
//   - breakpoint max-height: 600px
//   - batas max-height panel
//
// EVENT MASUK:
//   kantoong:consult  { text }  buka panel konsultasi
//   kantoong:collapse           perkecil panel ke peek
//
// Catatan:
//   File ini mengatur state dan gestur.
//   Tampilan tetap diatur oleh chat-panel.css.
// ============================================================

(() => {
    'use strict';

    const panel = document.getElementById('chatPanel');
    const head = document.getElementById('panelHead');
    const peekSendBtn = document.getElementById('peekSendBtn');
    const closeBtn = document.getElementById('chatCloseBtn');
    const chatBox = document.getElementById('chatBox');
    const input = document.getElementById('kolomKetik');

    if (!panel || !head) {
        console.warn(
            '[Kantoong Panel] #chatPanel atau #panelHead tidak ditemukan.'
        );
        return;
    }

    // Hindari pemasangan event berulang jika modul diinisialisasi ulang.
    if (panel.dataset.panelControllerReady === 'true') {
        return;
    }

    panel.dataset.panelControllerReady = 'true';

    // --------------------------------------------------------
    // 1. KONFIGURASI GESTUR
    // --------------------------------------------------------

    const MOVE_THRESHOLD = 4;
    const FLICK_PROJECTION = 150;
    const OPEN_THRESHOLD = 60;
    const TRANSITION_FALLBACK_MS = 380;
    const INPUT_MAX_HEIGHT = 90;

    const clamp = (value, min, max) =>
        Math.max(min, Math.min(max, value));

    const reducedMotion = () =>
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // --------------------------------------------------------
    // 2. HITUNG TINGGI PANEL
    // --------------------------------------------------------

    function getContainerHeight() {
        const container = panel.offsetParent;

        if (container && container.clientHeight > 0) {
            return container.clientHeight;
        }

        return window.innerHeight;
    }

    function getSafeTop() {
        const value = getComputedStyle(document.documentElement)
            .getPropertyValue('--safe-top')
            .trim();

        const parsed = parseFloat(value);

        return Number.isFinite(parsed) ? parsed : 0;
    }

    function getPeekHeight() {
        const value = getComputedStyle(document.documentElement)
            .getPropertyValue('--peek-h')
            .trim();

        const parsed = parseFloat(value);
        const peekVariable = Number.isFinite(parsed) ? parsed : 150;

        return Math.max(1, peekVariable - 40);
    }

    function getMaximumPanelHeight() {
        const containerHeight = getContainerHeight();

        // Ambil batas max-height aktual dari CSS.
        const computedMax = parseFloat(
            getComputedStyle(panel).maxHeight
        );

        if (Number.isFinite(computedMax) && computedMax > 0) {
            return Math.min(containerHeight, computedMax);
        }

        // Fallback jika browser tidak memberikan nilai max-height
        // dalam piksel.
        return Math.max(
            1,
            containerHeight - getSafeTop() - 20
        );
    }

    function stateHeights() {
        const containerHeight = getContainerHeight();
        const maximumHeight = getMaximumPanelHeight();

        // Samakan breakpoint JavaScript dengan chat-panel.css.
        const shortScreen = window.matchMedia(
            '(max-height: 600px)'
        ).matches;

        const halfRatio = shortScreen ? 0.62 : 0.55;
        const fullRatio = shortScreen ? 0.92 : 0.88;

        const maxHeight = Math.max(1, maximumHeight);

        const peek = Math.min(getPeekHeight(), maxHeight);
        const half = clamp(
            containerHeight * halfRatio,
            peek,
            maxHeight
        );
        const full = clamp(
            containerHeight * fullRatio,
            half,
            maxHeight
        );

        return {
            peek,
            half,
            full
        };
    }

    function nearestState(height, heights) {
        return ['peek', 'half', 'full'].reduce(
            (nearest, state) => {
                const currentDistance = Math.abs(
                    heights[state] - height
                );

                const nearestDistance = Math.abs(
                    heights[nearest] - height
                );

                return currentDistance < nearestDistance
                    ? state
                    : nearest;
            },
            'peek'
        );
    }

    // --------------------------------------------------------
    // 3. ANIMASI PERPINDAHAN STATE
    // --------------------------------------------------------

    let transitionTimer = null;
    let focusTimer = null;

    function clearPendingTimers() {
        if (transitionTimer !== null) {
            clearTimeout(transitionTimer);
            transitionTimer = null;
        }

        if (focusTimer !== null) {
            clearTimeout(focusTimer);
            focusTimer = null;
        }
    }

    function scrollChatToBottom() {
        if (!chatBox) return;

        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function setState(state, options = {}) {
        const { focus = false } = options;

        if (!['peek', 'half', 'full'].includes(state)) {
            return;
        }

        clearPendingTimers();

        const heights = stateHeights();
        const targetHeight = heights[state];

        panel.classList.remove('is-dragging');

        // Pastikan state awal tetap memiliki tinggi yang valid.
        const currentHeight = panel.getBoundingClientRect().height;

        if (reducedMotion()) {
            panel.style.height = '';
            panel.dataset.state = state;
        } else {
            // Kunci tinggi awal agar transisi dari tinggi hasil drag
            // menuju tinggi CSS state berikutnya tetap mulus.
            panel.style.height = `${currentHeight}px`;
            void panel.offsetHeight;

            panel.dataset.state = state;

            // Kembalikan kontrol tinggi ke CSS.
            panel.style.height = '';
        }

        // Bila batas CSS mengubah tinggi target, data-state tetap
        // menjadi sumber kebenaran tampilan panel.
        if (state !== 'peek') {
            transitionTimer = setTimeout(() => {
                transitionTimer = null;
                scrollChatToBottom();
            }, reducedMotion() ? 0 : TRANSITION_FALLBACK_MS);
        }

        if (focus && state !== 'peek' && input) {
            focusTimer = setTimeout(() => {
                focusTimer = null;

                if (panel.dataset.state !== 'peek') {
                    input.focus({ preventScroll: true });
                }
            }, reducedMotion() ? 0 : TRANSITION_FALLBACK_MS);
        }

        // Simpan target untuk penanganan resize dan drag.
        panel.dataset.targetHeight = String(targetHeight);
    }

    // --------------------------------------------------------
    // 4. GESTUR TARIK PANEL
    // --------------------------------------------------------

    let drag = null;

    function isInteractiveTarget(target) {
        return Boolean(
            target.closest(
                'button, a, input, textarea, select, label, [role="button"]'
            )
        );
    }

    function beginDrag(event) {
        if (event.pointerType === 'mouse' && event.button !== 0) {
            return;
        }

        if (isInteractiveTarget(event.target)) {
            return;
        }

        if (drag) return;

        const heights = stateHeights();

        drag = {
            pointerId: event.pointerId,
            startY: event.clientY,
            lastY: event.clientY,
            startHeight: panel.getBoundingClientRect().height,
            startTime: performance.now(),
            moved: false,
            initialState: panel.dataset.state || 'peek',
            heights
        };

        try {
            head.setPointerCapture(event.pointerId);
        } catch {
            // Pointer capture dapat gagal pada kondisi browser tertentu.
        }
    }

    function moveDrag(event) {
        if (!drag || event.pointerId !== drag.pointerId) {
            return;
        }

        const delta = drag.startY - event.clientY;

        if (!drag.moved && Math.abs(delta) < MOVE_THRESHOLD) {
            return;
        }

        if (!drag.moved) {
            drag.moved = true;
            clearPendingTimers();

            panel.classList.add('is-dragging');
        }

        const heights = stateHeights();

        const nextHeight = clamp(
            drag.startHeight + delta,
            heights.peek,
            heights.full
        );

        panel.style.height = `${nextHeight}px`;
        drag.lastY = event.clientY;

        // Tampilkan isi chat ketika panel ditarik melewati
        // ambang kartu sambutan.
        panel.dataset.state =
            nextHeight > heights.peek + OPEN_THRESHOLD
                ? 'half'
                : 'peek';
    }

    function finishDrag(event, cancelled = false) {
        if (!drag || event.pointerId !== drag.pointerId) {
            return;
        }

        const currentDrag = drag;
        drag = null;

        // Ketukan biasa pada header membuka panel jika masih peek.
        if (!currentDrag.moved) {
            if (currentDrag.initialState === 'peek') {
                setState('half', { focus: true });
            }

            return;
        }

        const heights = stateHeights();
        const currentHeight = panel.getBoundingClientRect().height;

        const elapsed = Math.max(
            1,
            performance.now() - currentDrag.startTime
        );

        const finalY = Number.isFinite(event.clientY)
            ? event.clientY
            : currentDrag.lastY;

        const velocity = cancelled
            ? 0
            : (currentDrag.startY - finalY) / elapsed;

        const projectedHeight = clamp(
            currentHeight + velocity * FLICK_PROJECTION,
            heights.peek,
            heights.full
        );

        const target = nearestState(projectedHeight, heights);

        setState(target);
    }

    head.addEventListener('pointerdown', beginDrag);
    head.addEventListener('pointermove', moveDrag);

    head.addEventListener('pointerup', (event) => {
        finishDrag(event, false);
    });

    head.addEventListener('pointercancel', (event) => {
        finishDrag(event, true);
    });

    head.addEventListener('lostpointercapture', (event) => {
        if (drag && event.pointerId === drag.pointerId) {
            finishDrag(event, true);
        }
    });

    // --------------------------------------------------------
    // 5. TOMBOL PANEL
    // --------------------------------------------------------

    peekSendBtn?.addEventListener('click', () => {
        setState('half', { focus: true });
    });

    closeBtn?.addEventListener('click', () => {
        setState('peek');
    });

    // --------------------------------------------------------
    // 6. EVENT KEYBOARD
    // --------------------------------------------------------

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;

        // Jangan mengambil alih Escape jika drawer atau dialog
        // lain sedang terbuka.
        const drawer = document.getElementById('sampleDrawer');

        if (drawer && !drawer.hidden) return;

        const dashboard = document.getElementById(
            'kantoongDashboardHost'
        );

        if (dashboard && !dashboard.hidden) return;

        if (panel.dataset.state !== 'peek') {
            setState('peek');
        }
    });

    // --------------------------------------------------------
    // 7. EVENT ANTARMODUL
    // --------------------------------------------------------

    window.addEventListener('kantoong:consult', (event) => {
        const hasText = Boolean(
            event.detail &&
            typeof event.detail.text === 'string' &&
            event.detail.text.trim()
        );

        if (panel.dataset.state === 'peek') {
            setState('half', { focus: !hasText });
        } else if (!hasText && input) {
            input.focus({ preventScroll: true });
        }
    });

    window.addEventListener('kantoong:collapse', () => {
        setState('peek');
    });

    // --------------------------------------------------------
    // 8. INPUT OTOMATIS MEMBESAR
    // --------------------------------------------------------

    function resizeInput() {
        if (!input) return;

        input.style.height = 'auto';

        const nextHeight = Math.min(
            input.scrollHeight,
            INPUT_MAX_HEIGHT
        );

        input.style.height = `${nextHeight}px`;
        input.style.overflowY =
            input.scrollHeight > INPUT_MAX_HEIGHT
                ? 'auto'
                : 'hidden';
    }

    if (input) {
        input.addEventListener('input', resizeInput);

        // Sesuaikan tinggi jika isi awal sudah tersedia.
        resizeInput();
    }

    // --------------------------------------------------------
    // 9. RESPONSIVE RESIZE
    // --------------------------------------------------------

    let resizeFrame = null;

    function handleResize() {
        if (resizeFrame !== null) {
            cancelAnimationFrame(resizeFrame);
        }

        resizeFrame = requestAnimationFrame(() => {
            resizeFrame = null;

            // Saat tidak sedang ditarik, biarkan CSS menghitung
            // kembali tinggi sesuai ukuran layar terbaru.
            if (!drag) {
                panel.style.height = '';
                panel.classList.remove('is-dragging');

                const state = panel.dataset.state || 'peek';
                const heights = stateHeights();

                panel.dataset.targetHeight = String(
                    heights[state] ?? heights.peek
                );
            } else {
                // Perbarui batas drag jika ukuran viewport berubah.
                drag.heights = stateHeights();
            }
        });
    }

    window.addEventListener('resize', handleResize, {
        passive: true
    });

    window.addEventListener('orientationchange', handleResize, {
        passive: true
    });

    // --------------------------------------------------------
    // 10. INISIALISASI
    // --------------------------------------------------------

    if (!panel.dataset.state) {
        panel.dataset.state = 'peek';
    }

    panel.style.height = '';
    panel.classList.remove('is-dragging');

    panel.dataset.targetHeight = String(
        stateHeights()[panel.dataset.state] ??
        stateHeights().peek
    );

    console.info('[Kantoong Panel] Controller siap.');
})();
