// ============================================================
// panel.js - Kantoong UI Bottom Sheet & Gesture Controller
// Mengatur panel chat yang bisa ditarik naik-turun dengan tiga
// posisi: peek (kartu sambutan) -> half -> full.
// Tinggi tiap posisi didefinisikan di chat-panel.css lewat
// atribut data-state; file ini hanya mengubah state & menangani
// gestur. Tidak ada CSS di dalam file ini.
//
// EVENT MASUK
//   kantoong:consult  {text}  buka chat ke posisi half
//   kantoong:collapse         kecilkan chat ke posisi peek
// ============================================================

const panel = document.getElementById('chatPanel');
const head = document.getElementById('panelHead');
const peekSendBtn = document.getElementById('peekSendBtn');
const closeBtn = document.getElementById('chatCloseBtn');
const chatBox = document.getElementById('chatBox');
const input = document.getElementById('kolomKetik');

if (!panel || !head) {
    console.warn('⚠️ [Panel] #chatPanel atau #panelHead tidak ditemukan di index.html.');
} else {
    const MOVE_THRESHOLD = 4;      // px minimal sebelum dianggap menarik, bukan mengetuk
    const FLICK_PROJECTION = 150;  // ms: seberapa jauh kecepatan lepas jari "melempar" panel

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    // Tinggi tiap posisi dalam px (harus sama dengan nilai di chat-panel.css)
    function stateHeights() {
        const container = panel.offsetParent ? panel.offsetParent.clientHeight : window.innerHeight;
        const peekVar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--peek-h')) || 150;
        return { peek: peekVar - 40, half: container * 0.55, full: container * 0.88 };
    }

    // Pindah ke posisi tertentu dengan animasi dari tinggi saat ini
    function setState(state, { focus = false } = {}) {
        const from = panel.offsetHeight;
        panel.classList.remove('is-dragging');
        panel.style.height = from + 'px';
        void panel.offsetHeight;          // paksa browser mencatat tinggi awal agar transisi jalan
        panel.dataset.state = state;
        panel.style.height = '';          // kembali memakai tinggi dari CSS sesuai data-state

        if (state !== 'peek' && chatBox) {
            setTimeout(() => { chatBox.scrollTop = chatBox.scrollHeight; }, 360);
        }
        if (focus && state !== 'peek' && input) {
            setTimeout(() => input.focus({ preventScroll: true }), 360);
        }
    }

    // ---------------- Gestur tarik ----------------
    let drag = null;

    head.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return; // tombol di dalam head tetap berfungsi normal
        drag = {
            startY: e.clientY,
            startH: panel.offsetHeight,
            lastY: e.clientY,
            startT: performance.now(),
            moved: false,
            id: e.pointerId
        };
        head.setPointerCapture(e.pointerId);
    });

    head.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const delta = drag.startY - e.clientY; // naik = positif
        if (!drag.moved && Math.abs(delta) < MOVE_THRESHOLD) return;

        if (!drag.moved) {
            drag.moved = true;
            panel.classList.add('is-dragging'); // matikan transisi agar mengikuti jari
        }

        const h = stateHeights();
        const next = clamp(drag.startH + delta, h.peek, h.full);
        panel.style.height = next + 'px';
        drag.lastY = e.clientY;

        // Tampilkan isi chat segera setelah ditarik melewati kartu sambutan
        panel.dataset.state = next > h.peek + 60 ? 'half' : 'peek';
    });

    function endDrag(e) {
        if (!drag || e.pointerId !== drag.id) return;
        const d = drag;
        drag = null;

        // Ketukan tanpa menarik: buka chat jika masih kecil
        if (!d.moved) {
            if (panel.dataset.state === 'peek') setState('half', { focus: true });
            return;
        }

        const h = stateHeights();
        const current = panel.offsetHeight;
        const elapsed = Math.max(1, performance.now() - d.startT);
        const velocity = (d.startY - e.clientY) / elapsed;          // px/ms, naik = positif
        const projected = clamp(current + velocity * FLICK_PROJECTION, h.peek, h.full);

        // Pilih posisi terdekat dari tinggi hasil proyeksi
        const target = ['peek', 'half', 'full']
            .sort((a, b) => Math.abs(h[a] - projected) - Math.abs(h[b] - projected))[0];

        setState(target, { focus: false });
    }

    head.addEventListener('pointerup', endDrag);
    head.addEventListener('pointercancel', endDrag);

    // ---------------- Tombol ----------------
    if (peekSendBtn) peekSendBtn.addEventListener('click', () => setState('half', { focus: true }));
    if (closeBtn) closeBtn.addEventListener('click', () => setState('peek'));

    // Escape mengecilkan chat
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panel.dataset.state !== 'peek') setState('peek');
    });

    // ---------------- Event dari modul lain ----------------
    window.addEventListener('kantoong:consult', (e) => {
        const hasText = Boolean(e.detail && e.detail.text);
        if (panel.dataset.state === 'peek') setState('half', { focus: !hasText });
        else if (!hasText && input) input.focus({ preventScroll: true });
    });

    window.addEventListener('kantoong:collapse', () => setState('peek'));

    // ---------------- Auto-expand kotak ketik (gaya WhatsApp) ----------------
    if (input) {
        input.addEventListener('input', () => {
            input.style.height = '20px';
            input.style.height = Math.min(input.scrollHeight, 90) + 'px';
        });
    }

    // Pastikan posisi awal konsisten dengan CSS
    if (!panel.dataset.state) panel.dataset.state = 'peek';
}