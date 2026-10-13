window.addEventListener('DOMContentLoaded', () => {
    const chatPanel = document.getElementById('chatPanel');
    const dragHandle = document.getElementById('dragHandle');
    const container = document.querySelector('.mobile-container');

    const logoBtn = document.getElementById('logoBtn');
    const logoText = document.getElementById('logoText');
    const logoDots = document.getElementById('logoDots');
    const floatingInputBar = document.getElementById('floatingInputBar');
    const kolomKetikFloating = document.getElementById('kolomKetikFloating');
    const tombolKirimFloating = document.getElementById('tombolKirimFloating');

    const kolomKetikUtama = document.getElementById('kolomKetik');
    const tombolKirimUtama = document.getElementById('tombolKirim');

    if (!chatPanel || !container) return;

    let startY = 0;
    let startHeight = 0;
    let isDragging = false;

    // Diubah jadi 0.42 (42% tinggi layar) agar pas proporsional seperti Yanti Gold
    const getInitialHeight = () => container.getBoundingClientRect().height * 0.42;
    const getMaxHeight = () => container.getBoundingClientRect().height * 0.88;

    const startDrag = (e) => {
        isDragging = true;
        startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        startHeight = chatPanel.getBoundingClientRect().height;
        chatPanel.style.transition = 'none'; 
    };

    const onDrag = (e) => {
        if (!isDragging) return;
        const currentY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        const deltaY = currentY - startY;

        let newHeight = startHeight - deltaY;
        const maxH = getMaxHeight();

        if (newHeight > maxH) newHeight = maxH;
        if (newHeight < 90) newHeight = 90;

        chatPanel.style.height = `${newHeight}px`;
        chatPanel.style.transform = 'translateY(0)';
    };

    const stopDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        
        chatPanel.style.transition = 'height 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';
        
        const currentHeight = chatPanel.getBoundingClientRect().height;
        const initialH = getInitialHeight();
        const maxH = getMaxHeight();

        if (currentHeight < 140) {
            chatPanel.style.transform = 'translateY(110%)'; 
            if (logoBtn) {
                setTimeout(() => { logoBtn.style.display = 'flex'; }, 300);
            }
        } 
        else if (currentHeight > initialH + 60) {
            chatPanel.style.height = `${maxH}px`;
        } 
        else {
            chatPanel.style.height = `${initialH}px`;
        }
    };

    if (dragHandle) {
        dragHandle.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        dragHandle.addEventListener('touchstart', startDrag, {passive: true});
        document.addEventListener('touchmove', onDrag, {passive: true});
        document.addEventListener('touchend', stopDrag);
    }

    // Inisialisasi tinggi awal panel
    chatPanel.style.height = `${getInitialHeight()}px`;

    // --- ANIMASI ACAK MATA ORB & GELOMBANG ---
    setInterval(() => {
        if (logoBtn && logoBtn.style.display === 'flex' && logoText && logoDots) {
            const isListening = Math.random() > 0.5;
            if (isListening) {
                logoText.style.display = 'none';
                logoDots.style.display = 'flex';
            } else {
                logoText.style.display = 'flex';
                logoDots.style.display = 'none';
            }
        }
    }, 4000);

    // --- AUTO-EXPAND TEXTAREA (GAYA WHATSAPP) ---
    function autoExpand(textarea) {
        if (!textarea) return;
        textarea.style.height = '20px'; 
        textarea.style.height = (textarea.scrollHeight) + 'px';
    }

    if (kolomKetikFloating) {
        kolomKetikFloating.addEventListener('input', function() { autoExpand(this); });
    }
    if (kolomKetikUtama) {
        kolomKetikUtama.addEventListener('input', function() { autoExpand(this); });
    }

    // --- 1. SAAT TOMBOL ORB / WAVE DIKLIK ---
    if (logoBtn && floatingInputBar && kolomKetikFloating) {
        logoBtn.addEventListener('click', () => {
            logoBtn.style.display = 'none';
            chatPanel.style.transition = 'none';
            chatPanel.style.transform = 'translateY(110%)';
            floatingInputBar.style.display = 'flex';
            kolomKetikFloating.focus();
        });
    }

    // --- 2. SAAT TOMBOL KIRIM DI FLOATING BAR DIKLIK ---
    if (tombolKirimFloating && floatingInputBar && kolomKetikFloating) {
        tombolKirimFloating.addEventListener('click', () => {
            const textUser = kolomKetikFloating.value.trim();
            if (textUser !== "") {
                floatingInputBar.style.display = 'none';
                chatPanel.style.transition = 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), height 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)';
                chatPanel.style.height = `${getInitialHeight()}px`;
                chatPanel.style.transform = 'translateY(0)';
                
                if (typeof addMessageToChat === "function") {
                    addMessageToChat(textUser, 'user');
                    setTimeout(() => {
                        addMessageToChat("Baik Kak, sistem sedang mengecek permintaannya... ✨", 'ai');
                    }, 1000);
                }

                kolomKetikFloating.value = "";
                kolomKetikFloating.style.height = '20px'; 
            }
        });
    }

    // --- KLIK KIRIM DI BAR UTAMA DALAM PANEL ---
    if (tombolKirimUtama && kolomKetikUtama) {
        tombolKirimUtama.addEventListener('click', () => {
            const textUser = kolomKetikUtama.value.trim();
            if (textUser !== "") {
                if (typeof addMessageToChat === "function") {
                    addMessageToChat(textUser, 'user');
                    setTimeout(() => {
                        addMessageToChat("Baik Kak, pesanan Kakak segera diproses ya! ✨", 'ai');
                    }, 1000);
                }

                kolomKetikUtama.value = "";
                kolomKetikUtama.style.height = '20px'; 
            }
        });
    }
});