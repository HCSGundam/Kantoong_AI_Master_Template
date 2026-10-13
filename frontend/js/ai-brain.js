const chatBox = document.getElementById('chatBox');
const tombolKirim = document.getElementById('tombolKirim');
const kolomKetik = document.getElementById('kolomKetik');

// Fungsi Otak AI untuk Menyapa Berdasarkan Config
async function generateAIGreeting() {
    const greetings = (typeof KantoongConfig !== 'undefined' && KantoongConfig.ai_greetings) 
        ? KantoongConfig.ai_greetings 
        : [
            "Halo Kakak yang cantik, ada yang bisa dibantu carikan hari ini? ✨",
            "Selamat datang! Mau lihat koleksi produk atau layanan terbaru kami Kak? 💍"
        ];
    
    const randomIndex = Math.floor(Math.random() * greetings.length);
    return greetings[randomIndex];
}

// Fungsi Render Gelembung Chat
function addMessageToChat(text, sender) {
    if (!chatBox) return;
    const wrapper = document.createElement('div');
    wrapper.classList.add('message-wrapper', sender);

    const avatar = document.createElement('div');
    avatar.classList.add('avatar');
    avatar.innerText = sender === 'ai' ? 'AI' : 'USER'; 

    const bubble = document.createElement('div');
    bubble.classList.add('bubble');
    
    const date = new Date();
    const timeText = date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');
    
    const doubleCheckIcon = `
        <svg style="margin-left: 2px; vertical-align: middle; margin-bottom: 2px;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 255, 255, 0.7)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6L7 17l-5-5"></path>
            <path d="M22 10l-7.5 7.5"></path>
        </svg>
    `;

    const formattedText = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");

    bubble.innerHTML = `
        <span class="bubble-text">${formattedText}</span>
        <span class="time-stamp">${timeText} ${sender === 'user' ? doubleCheckIcon : ''}</span>
    `;

    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
    chatBox.appendChild(wrapper);

    chatBox.scrollTop = chatBox.scrollHeight;
}

// Trigger Sapaan Awal Saat Web Dibuka
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(async () => {
        const aiMessage = await generateAIGreeting();
        addMessageToChat(aiMessage, 'ai');
    }, 1000);
});

// Trigger Tombol Kirim Chat Utama
if (tombolKirim && kolomKetik) {
    tombolKirim.addEventListener('click', () => {
        const textUser = kolomKetik.value.trim();
        if (textUser !== "") {
            addMessageToChat(textUser, 'user');
            kolomKetik.value = "";
            
            setTimeout(() => {
                addMessageToChat("Baik Kak, mohon tunggu sebentar ya, sistem sedang memproses permintaan Kakak... ✨", 'ai');
            }, 1200);
        }
    });
}