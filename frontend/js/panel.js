
/* ============================================================
   KANTOONG CORE
   File: frontend/js/panel.js

   CHAT PANEL CONTROLLER
   ------------------------------------------------------------
   Tanggung jawab:
   1. Mengatur state panel: peek, half, full.
   2. Menangani gesture drag pada header panel.
   3. Menangani pointer, sentuhan, dan mouse.
   4. Menyelaraskan tinggi panel dengan chat-panel.css.
   5. Menjaga transisi panel tetap halus.
   6. Menangani tombol buka dan tutup panel.
   7. Mengintegrasikan event dari AI Brain.
   8. Menangani tombol Escape dan perubahan ukuran layar.
   9. Mengatur tinggi input pesan.
   10. Tidak mengirim pesan AI secara langsung.

   EVENT YANG DITERIMA:
   - kantoong:consult
   - kantoong:collapse

   CATATAN ARSITEKTUR:
   - CSS tetap menjadi sumber utama ukuran visual panel.
   - AI Brain bertanggung jawab atas percakapan dan pengiriman pesan.
   - Panel Controller hanya mengatur tampilan dan interaksi panel.
   - Event aplikasi pada controller ini didengarkan melalui window.
   ============================================================ */

(function () {
    'use strict';

    /* ========================================================
       01. INITIALIZATION GUARD
       ======================================================== */

    var panel = document.getElementById('chatPanel');

    if (!panel) {
        return;
    }

    if (panel.dataset.panelControllerReady === 'true') {
        return;
    }

    var panelHead = document.getElementById('panelHead');
    var peekSendBtn = document.getElementById('peekSendBtn');
    var chatCloseBtn = document.getElementById('chatCloseBtn');
    var chatBox = document.getElementById('chatBox');
    var kolomKetik = document.getElementById('kolomKetik');

    if (!panelHead) {
        console.warn(
            '[KANTOONG PANEL] Elemen #panelHead tidak ditemukan.'
        );
        return;
    }

    panel.dataset.panelControllerReady = 'true';

    /* ========================================================
       02. CONFIGURATION
       ======================================================== */

    var CONFIG = {
        MOVE_THRESHOLD: 5,
        OPEN_THRESHOLD: 60,
        FLICK_VELOCITY: 0.45,
        FLICK_PROJECTION_MS: 160,
        TRANSITION_FALLBACK_MS: 450,
        INPUT_MAX_HEIGHT: 90,
        DEFAULT_STATE: 'peek',
        STATES: ['peek', 'half', 'full']
    };

    var STATE = {
        current: CONFIG.DEFAULT_STATE,
        drag: null,
        transitionToken: 0,
        transitionTimer: null,
        focusTimer: null,
        resizeFrame: null,
        inputFrame: null,
        destroyed: false
    };

    var reducedMotionQuery = window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    /* ========================================================
       03. UTILITIES
       ======================================================== */

    function isReducedMotion() {
        return Boolean(
            reducedMotionQuery && reducedMotionQuery.matches
        );
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function isValidState(state) {
        return CONFIG.STATES.indexOf(state) !== -1;
    }

    function getCurrentState() {
        var state = panel.dataset.state;

        return isValidState(state)
            ? state
            : STATE.current;
    }

    function getContainingBlock() {
        return panel.offsetParent ||
            panel.parentElement ||
            document.documentElement;
    }

    function getContainingBlockHeight() {
        var container = getContainingBlock();
        var height = container
            ? container.clientHeight
            : 0;

        if (!height || !Number.isFinite(height)) {
            height = window.innerHeight ||
                document.documentElement.clientHeight ||
                0;
        }

        return Math.max(1, height);
    }

    function getSafeTop() {
        var value = getComputedStyle(panel)
            .getPropertyValue('--safe-top')
            .trim();

        var parsed = parseFloat(value);

        return Number.isFinite(parsed) ? parsed : 0;
    }

    function getMaximumPanelHeight() {
        var computed = getComputedStyle(panel);
        var maxHeight = parseFloat(computed.maxHeight);

        if (!Number.isFinite(maxHeight) || maxHeight <= 0) {
            maxHeight =
                getContainingBlockHeight() -
                getSafeTop() -
                20;
        }

        return Math.max(1, Math.min(
            maxHeight,
            getContainingBlockHeight()
        ));
    }

    function getPeekHeight() {
        var computed = getComputedStyle(panel);

        /*
         * Prefer the actual CSS state height.
         * This keeps panel.js aligned with chat-panel.css.
         */
        var originalState = panel.dataset.state;
        var originalHeight = panel.style.height;

        panel.dataset.state = 'peek';
        panel.style.height = '';

        var measured = panel.getBoundingClientRect().height;

        panel.style.height = originalHeight;

        if (originalState) {
            panel.dataset.state = originalState;
        } else {
            delete panel.dataset.state;
        }

        if (measured > 0 && Number.isFinite(measured)) {
            return Math.min(measured, getMaximumPanelHeight());
        }

        /*
         * Fallback for environments where the panel cannot
         * be measured during initialization.
         */
        var peekValue = computed
            .getPropertyValue('--peek-h')
            .trim();

        var peek = parseFloat(peekValue);

        if (!Number.isFinite(peek)) {
            peek = 190;
        }

        return clamp(
            peek - 40,
            1,
            getMaximumPanelHeight()
        );
    }

    /* ========================================================
       04. MEASURE CSS STATE HEIGHTS
       ======================================================== */

    /*
     * CSS remains the source of truth for the panel's dimensions.
     *
     * We temporarily apply each data-state, measure the resulting
     * border-box height, and restore the original DOM state.
     *
     * This allows JavaScript gesture calculations to follow the
     * actual values defined in chat-panel.css, including responsive
     * media queries for short screens.
     */

    function measureStateHeight(state) {
        var previousState = panel.dataset.state;
        var previousInlineHeight = panel.style.height;
        var previousTransition = panel.style.transition;

        panel.style.transition = 'none';
        panel.style.height = '';
        panel.dataset.state = state;

        /*
         * Force the browser to calculate the CSS layout.
         */
        void panel.offsetHeight;

        var height = panel.getBoundingClientRect().height;

        panel.dataset.state = previousState || '';
        panel.style.height = previousInlineHeight;
        panel.style.transition = previousTransition;

        void panel.offsetHeight;

        if (!Number.isFinite(height) || height <= 0) {
            return 0;
        }

        return Math.min(height, getMaximumPanelHeight());
    }

    function getStateHeights() {
        var maximum = getMaximumPanelHeight();

        var peek = measureStateHeight('peek');
        var half = measureStateHeight('half');
        var full = measureStateHeight('full');

        if (peek <= 0) {
            peek = getPeekHeight();
        }

        if (half <= 0) {
            half = maximum * (
                window.matchMedia &&
                window.matchMedia('(max-height: 600px)').matches
                    ? 0.62
                    : 0.55
            );
        }

        if (full <= 0) {
            full = maximum * (
                window.matchMedia &&
                window.matchMedia('(max-height: 600px)').matches
                    ? 0.92
                    : 0.88
            );
        }

        peek = clamp(peek, 1, maximum);
        half = clamp(half, peek, maximum);
        full = clamp(full, half, maximum);

        return {
            peek: peek,
            half: half,
            full: full,
            max: maximum
        };
    }

    function getNearestState(height, heights) {
        var nearest = 'peek';
        var smallestDifference = Infinity;

        CONFIG.STATES.forEach(function (state) {
            var difference = Math.abs(height - heights[state]);

            if (difference < smallestDifference) {
                smallestDifference = difference;
                nearest = state;
            }
        });

        return nearest;
    }

    /* ========================================================
       05. TIMER MANAGEMENT
       ======================================================== */

    function clearTransitionTimer() {
        if (STATE.transitionTimer !== null) {
            window.clearTimeout(STATE.transitionTimer);
            STATE.transitionTimer = null;
        }
    }

    function clearFocusTimer() {
        if (STATE.focusTimer !== null) {
            window.clearTimeout(STATE.focusTimer);
            STATE.focusTimer = null;
        }
    }

    function cancelScheduledFrames() {
        if (STATE.resizeFrame !== null) {
            window.cancelAnimationFrame(STATE.resizeFrame);
            STATE.resizeFrame = null;
        }

        if (STATE.inputFrame !== null) {
            window.cancelAnimationFrame(STATE.inputFrame);
            STATE.inputFrame = null;
        }
    }

    /* ========================================================
       06. FOCUS MANAGEMENT
       ======================================================== */

    function focusMessageInput() {
        if (!kolomKetik || STATE.destroyed) {
            return;
        }

        if (panel.dataset.state === 'peek') {
            return;
        }

        try {
            kolomKetik.focus({
                preventScroll: true
            });
        } catch (error) {
            kolomKetik.focus();
        }
    }

    function scheduleInputFocus(delay) {
        clearFocusTimer();

        STATE.focusTimer = window.setTimeout(function () {
            STATE.focusTimer = null;
            focusMessageInput();
        }, typeof delay === 'number' ? delay : 100);
    }

    /* ========================================================
       07. PANEL STATE CONTROLLER
       ======================================================== */

    function setState(nextState, options) {
        options = options || {};

        if (STATE.destroyed || !isValidState(nextState)) {
            return;
        }

        var currentState = getCurrentState();
        var shouldFocus = options.focus === true;
        var shouldScroll = options.scroll === true;

        clearTransitionTimer();
        clearFocusTimer();

        STATE.current = nextState;

        /*
         * Invalidate callbacks from previous transitions.
         */
        STATE.transitionToken += 1;

        var transitionToken = STATE.transitionToken;

        panel.classList.remove('is-dragging');

        var targetHeights = getStateHeights();

        panel.dataset.targetHeight = String(
            Math.round(targetHeights[nextState])
        );

        /*
         * When reduced motion is enabled, switch directly to the
         * requested CSS state without an animated height transition.
         */
        if (isReducedMotion()) {
            panel.style.height = '';
            panel.dataset.state = nextState;

            if (shouldFocus) {
                scheduleInputFocus(0);
            }

            if (shouldScroll && chatBox) {
                chatBox.scrollTop = chatBox.scrollHeight;
            }

            return;
        }

        /*
         * Capture the currently rendered height before changing
         * data-state. This avoids the panel jumping when a drag ends.
         */
        var currentHeight = panel.getBoundingClientRect().height;

        if (!Number.isFinite(currentHeight) || currentHeight <= 0) {
            currentHeight = targetHeights[currentState] ||
                targetHeights.peek;
        }

        /*
         * Lock the current rendered height, force layout, then change
         * the state and release the inline height on the next frame.
         * CSS can then animate from the captured height to its target.
         */
        panel.style.height = currentHeight + 'px';

        void panel.offsetHeight;

        panel.dataset.state = nextState;

        STATE.transitionTimer = window.setTimeout(function () {
            if (transitionToken !== STATE.transitionToken) {
                return;
            }

            STATE.transitionTimer = null;
            panel.style.height = '';
        }, CONFIG.TRANSITION_FALLBACK_MS);

        window.requestAnimationFrame(function () {
            if (transitionToken !== STATE.transitionToken) {
                return;
            }

            panel.style.height = '';
        });

        if (shouldScroll && chatBox) {
            window.requestAnimationFrame(function () {
                if (transitionToken !== STATE.transitionToken) {
                    return;
                }

                chatBox.scrollTop = chatBox.scrollHeight;
            });
        }

        if (shouldFocus) {
            scheduleInputFocus(120);
        }
    }

    function openPanel(options) {
        options = options || {};

        var state = getCurrentState();

        if (state === 'peek') {
            setState('half', options);
            return;
        }

        if (options.focus) {
            scheduleInputFocus(0);
        }
    }

    function closePanel() {
        setState('peek');
    }

    function togglePanel() {
        var state = getCurrentState();

        if (state === 'peek') {
            setState('half');
        } else {
            setState('peek');
        }
    }

    /* ========================================================
       08. POINTER / DRAG HELPERS
       ======================================================== */

    function isInteractiveTarget(target) {
        if (!(target instanceof Element)) {
            return false;
        }

        return Boolean(target.closest(
            'button, a, input, textarea, select, ' +
            '[role="button"], [contenteditable="true"]'
        ));
    }

    function isPrimaryPointer(event) {
        if (event.pointerType === 'mouse') {
            return event.button === 0;
        }

        return true;
    }

    function beginDrag(event) {
        if (STATE.destroyed || STATE.drag) {
            return;
        }

        if (!isPrimaryPointer(event)) {
            return;
        }

        if (isInteractiveTarget(event.target)) {
            return;
        }

        var heights = getStateHeights();
        var currentHeight = panel.getBoundingClientRect().height;

        if (!Number.isFinite(currentHeight) || currentHeight <= 0) {
            currentHeight = heights[getCurrentState()];
        }

        STATE.drag = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            lastY: event.clientY,
            startHeight: currentHeight,
            currentHeight: currentHeight,
            startTime: performance.now(),
            lastTime: performance.now(),
            velocityY: 0,
            moved: false,
            initialState: getCurrentState(),
            heights: heights
        };

        panel.classList.add('is-dragging');

        /*
         * Pointer capture keeps drag events available even when the
         * pointer moves beyond the header.
         */
        if (
            typeof panelHead.setPointerCapture === 'function' &&
            event.pointerId !== undefined
        ) {
            try {
                panelHead.setPointerCapture(event.pointerId);
            } catch (error) {
                /*
                 * Pointer capture may fail if the pointer is no longer
                 * active. The normal pointer handlers remain available.
                 */
            }
        }
    }

    function moveDrag(event) {
        var drag = STATE.drag;

        if (!drag || event.pointerId !== drag.pointerId) {
            return;
        }

        var deltaY = drag.startY - event.clientY;

        if (
            !drag.moved &&
            Math.abs(deltaY) < CONFIG.MOVE_THRESHOLD
        ) {
            return;
        }

        drag.moved = true;

        var now = performance.now();
        var elapsed = now - drag.lastTime;

        if (elapsed > 0) {
            /*
             * Positive velocity means the finger is moving upward.
             */
            drag.velocityY =
                (drag.lastY - event.clientY) / elapsed;
        }

        drag.lastY = event.clientY;
        drag.lastTime = now;

        var nextHeight = clamp(
            drag.startHeight + deltaY,
            drag.heights.peek,
            drag.heights.max
        );

        drag.currentHeight = nextHeight;

        panel.style.height = nextHeight + 'px';

        panel.dataset.targetHeight = String(
            Math.round(nextHeight)
        );

        /*
         * Keep the visual state aligned with the nearest state
         * while the panel is being dragged.
         */
        panel.dataset.state = getNearestState(
            nextHeight,
            drag.heights
        );

        if (event.cancelable) {
            event.preventDefault();
        }
    }

    function releasePointerCapture(pointerId) {
        if (
            typeof panelHead.releasePointerCapture !== 'function' ||
            pointerId === undefined
        ) {
            return;
        }

        try {
            if (
                typeof panelHead.hasPointerCapture !== 'function' ||
                panelHead.hasPointerCapture(pointerId)
            ) {
                panelHead.releasePointerCapture(pointerId);
            }
        } catch (error) {
            /*
             * Pointer capture can already be released by the browser.
             */
        }
    }

    function finishDrag(event, cancelled) {
        var drag = STATE.drag;

        if (!drag) {
            return;
        }

        if (
            event &&
            event.pointerId !== undefined &&
            event.pointerId !== drag.pointerId
        ) {
            return;
        }

        /*
         * Clear drag state before releasing pointer capture.
         * This prevents lostpointercapture from finishing twice.
         */
        STATE.drag = null;

        panel.classList.remove('is-dragging');

        releasePointerCapture(drag.pointerId);

        if (!drag.moved) {
            /*
             * A tap on the header opens a collapsed panel.
             */
            if (drag.initialState === 'peek' && !cancelled) {
                setState('half');
            } else {
                panel.style.height = '';
                panel.dataset.state = drag.initialState;
            }

            return;
        }

        var finalHeight = drag.currentHeight;
        var velocity = drag.velocityY;

        if (!cancelled && Math.abs(velocity) >= CONFIG.FLICK_VELOCITY) {
            /*
             * Project the panel's movement briefly to make quick
             * flick gestures feel natural.
             */
            finalHeight +=
                velocity * CONFIG.FLICK_PROJECTION_MS;
        }

        finalHeight = clamp(
            finalHeight,
            drag.heights.peek,
            drag.heights.max
        );

        var targetState = getNearestState(
            finalHeight,
            drag.heights
        );

        /*
         * A strong upward flick should open the panel further.
         * A strong downward flick should collapse it.
         */
        if (!cancelled && velocity > CONFIG.FLICK_VELOCITY) {
            if (drag.initialState === 'peek') {
                targetState = 'full';
            } else {
                targetState = 'full';
            }
        } else if (
            !cancelled &&
            velocity < -CONFIG.FLICK_VELOCITY
        ) {
            targetState = 'peek';
        }

        setState(targetState);
    }

    /* ========================================================
       09. POINTER EVENT HANDLERS
       ======================================================== */

    function handlePointerDown(event) {
        beginDrag(event);
    }

    function handlePointerMove(event) {
        moveDrag(event);
    }

    function handlePointerUp(event) {
        finishDrag(event, false);
    }

    function handlePointerCancel(event) {
        finishDrag(event, true);
    }

    function handleLostPointerCapture(event) {
        if (STATE.drag) {
            finishDrag(event, true);
        }
    }

    panelHead.addEventListener(
        'pointerdown',
        handlePointerDown
    );

    panelHead.addEventListener(
        'pointermove',
        handlePointerMove,
        { passive: false }
    );

    panelHead.addEventListener(
        'pointerup',
        handlePointerUp
    );

    panelHead.addEventListener(
        'pointercancel',
        handlePointerCancel
    );

    panelHead.addEventListener(
        'lostpointercapture',
        handleLostPointerCapture
    );

    /* ========================================================
       10. PANEL BUTTONS
       ======================================================== */

    function handlePeekSendClick(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        openPanel({
            focus: true
        });
    }

    function handleCloseClick(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        closePanel();
    }

    if (peekSendBtn) {
        peekSendBtn.addEventListener(
            'click',
            handlePeekSendClick
        );
    }

    if (chatCloseBtn) {
        chatCloseBtn.addEventListener(
            'click',
            handleCloseClick
        );
    }

    /* ========================================================
       11. KEYBOARD HANDLING
       ======================================================== */

    function isElementVisible(element) {
        if (!element) {
            return false;
        }

        if (element.hidden) {
            return false;
        }

        if (element.getAttribute('aria-hidden') === 'true') {
            return false;
        }

        return element.getClientRects().length > 0;
    }

    function handleKeyDown(event) {
        if (event.key !== 'Escape') {
            return;
        }

        var dashboardHost = document.getElementById(
            'kantoongDashboardHost'
        );

        /*
         * Let an open dashboard handle Escape first.
         * This controller only collapses the chat panel when the
         * dashboard is not currently visible.
         */
        if (isElementVisible(dashboardHost)) {
            return;
        }

        if (getCurrentState() !== 'peek') {
            closePanel();
        }
    }

    document.addEventListener(
        'keydown',
        handleKeyDown
    );

    /* ========================================================
       12. APPLICATION EVENT INTEGRATION
       ======================================================== */

    /*
     * The panel listens on window as the canonical application-event
     * target. It does not send messages or emit a second consult event.
     */

    function handleConsultEvent(event) {
        var detail = event && event.detail
            ? event.detail
            : {};

        var hasText = typeof detail.text === 'string' &&
            detail.text.trim().length > 0;

        openPanel({
            focus: !hasText
        });
    }

    function handleCollapseEvent() {
        closePanel();
    }

    window.addEventListener(
        'kantoong:consult',
        handleConsultEvent
    );

    window.addEventListener(
        'kantoong:collapse',
        handleCollapseEvent
    );

    /* ========================================================
       13. INPUT AUTO-RESIZE
       ======================================================== */

    function resizeInput() {
        if (!kolomKetik) {
            return;
        }

        kolomKetik.style.height = 'auto';

        var nextHeight = Math.min(
            kolomKetik.scrollHeight,
            CONFIG.INPUT_MAX_HEIGHT
        );

        kolomKetik.style.height = nextHeight + 'px';

        kolomKetik.style.overflowY =
            kolomKetik.scrollHeight > CONFIG.INPUT_MAX_HEIGHT
                ? 'auto'
                : 'hidden';
    }

    function handleInput() {
        if (STATE.inputFrame !== null) {
            window.cancelAnimationFrame(STATE.inputFrame);
        }

        STATE.inputFrame = window.requestAnimationFrame(function () {
            STATE.inputFrame = null;
            resizeInput();
        });
    }

    if (kolomKetik) {
        kolomKetik.addEventListener(
            'input',
            handleInput
        );

        resizeInput();
    }

    /* ========================================================
       14. RESPONSIVE RESIZE
       ======================================================== */

    function handleResize() {
        if (STATE.destroyed || STATE.drag) {
            return;
        }

        if (STATE.resizeFrame !== null) {
            window.cancelAnimationFrame(STATE.resizeFrame);
        }

        STATE.resizeFrame = window.requestAnimationFrame(function () {
            STATE.resizeFrame = null;

            clearTransitionTimer();

            /*
             * Let CSS recalculate the active state against the new
             * viewport/container dimensions.
             */
            panel.style.height = '';

            var state = getCurrentState();
            panel.dataset.state = state;

            var heights = getStateHeights();

            panel.dataset.targetHeight = String(
                Math.round(heights[state])
            );
        });
    }

    window.addEventListener(
        'resize',
        handleResize,
        { passive: true }
    );

    window.addEventListener(
        'orientationchange',
        handleResize,
        { passive: true }
    );

    /* ========================================================
       15. TRANSITION COMPLETION
       ======================================================== */

    function handleTransitionEnd(event) {
        if (
            event.target !== panel ||
            event.propertyName !== 'height'
        ) {
            return;
        }

        clearTransitionTimer();

        /*
        * Transisi selesai.
        * Kembalikan pengaturan tinggi ke CSS.
        * Jangan mengukur ulang semua state di sini karena
        * pengukuran mengubah data-state sementara.
        */
        panel.style.height = '';

        /*
        * Gunakan target yang sudah dicatat ketika state berubah.
        */
        var targetHeight = Number(panel.dataset.targetHeight);

        if (Number.isFinite(targetHeight) && targetHeight > 0) {
            panel.dataset.targetHeight = String(
                Math.round(targetHeight)
            );
        }
    }


    panel.addEventListener(
        'transitionend',
        handleTransitionEnd
    );

    /* ========================================================
       16. INITIAL STATE
       ======================================================== */

    function initializePanel() {
        panel.classList.remove('is-dragging');

        panel.style.height = '';

        var initialState = isValidState(panel.dataset.state)
            ? panel.dataset.state
            : CONFIG.DEFAULT_STATE;

        STATE.current = initialState;
        panel.dataset.state = initialState;

        var heights = getStateHeights();

        panel.dataset.targetHeight = String(
            Math.round(heights[initialState])
        );

        if (kolomKetik) {
            resizeInput();
        }
    }

    initializePanel();

    /* ========================================================
       17. PUBLIC CONTROLLER API
       ======================================================== */

    /*
     * Provides a single, namespaced interface for other frontend
     * modules without exposing internal implementation details.
     */

    window.KantoongPanel = {
        open: openPanel,

        close: closePanel,

        toggle: togglePanel,

        setState: setState,

        getState: getCurrentState,

        getHeights: getStateHeights
    };

})();
