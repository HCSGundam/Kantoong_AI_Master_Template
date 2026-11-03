const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/chat-sheet-7rVmKWuc.css","assets/ai-brain-BIX5qQIF.js","assets/preload-helper-DD1OZmLC.js","assets/supabase-client-vYFxeodt.js","assets/chat-sheet-BBH-X2b3.js"])))=>i.map(i=>d[i]);
import{_ as T}from"./preload-helper-DD1OZmLC.js";import{s as x}from"./supabase-client-vYFxeodt.js";const B={business_id:"master_template_001",app_name:"Miloat",theme_color_primary:"#111111",filter_by_business_id:!1,use_demo_when_empty:!0,hero:{interval_seconds:5,slides:[{type:"none",src:"",media_label:"Foto / video brand",caption:"Premium collection",title:"Nama produk unggulan",text:"Penjelasan singkat produk atau promo yang ingin ditonjolkan brand.",ai_prompt:""},{type:"none",src:"",media_label:"Foto / video brand",caption:"Terbaru",title:"Koleksi terbaru kami",text:"Tanyakan ke asisten AI untuk dicarikan yang paling cocok.",ai_prompt:"Tolong bantu pilihkan produk terbaru yang cocok untuk saya"}]},brand_slot:{type:"marquee",label:"",speed_seconds:30,items:[{icon:"truck",title:"Pengiriman Cepat",sub:"Aman sampai tujuan"},{icon:"badge",title:"Kualitas Terjamin",sub:"Bahan pilihan terbaik"},{icon:"chat",title:"Konsultasi AI",sub:"Tanya kapan saja"},{icon:"lock",title:"Checkout Aman",sub:"Kamu yang bayar sendiri"}],text:""},featured:{eyebrow:"Produk unggulan",title:"Pilihan Terbaik",description:"Produk andalan yang dipilih langsung oleh toko.",matched_title:"Pilihan AI untuk kamu",limit:8,ask_label:"Konsultasi AI",view:"3d"},shipping:{estimate:"",from:""},rails:[{eyebrow:"Paling laris",title:"Best Seller",description:"Produk yang paling banyak dibeli pelanggan.",sort:"sales",limit:10,min_items:2},{eyebrow:"Favorit pembeli",title:"Paling Banyak Di-wishlist",description:"Produk yang paling sering disimpan pembeli.",sort:"wishlist",limit:10,min_items:2},{eyebrow:"Baru datang",title:"Produk Terbaru",description:"Koleksi terbaru yang baru masuk toko.",sort:"newest",limit:10,min_items:2}],testimonials:[],categories:{enabled:!0,title:"Kategori lain"},ai_name:"Asisten",ai_title:"Halo Kak!",ai_endpoint:"/api/chat",ai_greetings:["Mau cari produk yang cocok untuk kebutuhanmu?","Bingung memilih? Ceritakan kebutuhanmu, aku carikan."],ai_suggestions:["Bantu pilihkan sesuai kebutuhan saya","Rekomendasi budget di bawah 500 ribu","Apa produk yang paling banyak dipilih?","Cari produk yang paling hemat","Aku bingung mau pilih yang mana","Ada produk baru apa saja?","Bandingkan produk unggulan untukku","Cari hadiah untuk orang tersayang"],demo_products:[{id:"demo-1",name:"Produk Contoh Satu",price:125e4,category:"kategori a",sales_count:40,image_url:""},{id:"demo-2",name:"Produk Contoh Dua",price:75e4,category:"kategori a",sales_count:32,image_url:""},{id:"demo-3",name:"Produk Contoh Tiga",price:45e4,category:"kategori b",sales_count:25,image_url:""},{id:"demo-4",name:"Produk Contoh Empat",price:23e5,category:"kategori b",sales_count:18,image_url:""},{id:"demo-5",name:"Produk Contoh Lima",price:32e4,category:"kategori a",sales_count:9,image_url:""},{id:"demo-6",name:"Produk Contoh Enam",price:98e4,category:"kategori b",sales_count:4,image_url:""}]};typeof window<"u"&&(window.KantoongConfig=B);const Ot=Object.freeze({persen:"Persen (%)",nominal:"Potongan Rp"});function ct(t){return String(t??"").trim().toUpperCase()}function qt(t){return/^[A-Z0-9]{3,20}$/.test(ct(t))}function dt(t,e){const n=Math.max(0,Math.round(Number(e)||0));if(!t)return 0;const a=t.kind==="persen"?Math.min(Math.round(n*Number(t.value)/100),Number(t.max_discount)||1/0):Math.round(Number(t.value)||0);return Math.max(0,Math.min(n,a))}function $t(t,e,n=new Date){return!t||!t.is_active?{valid:!1,message:"Kode voucher tidak ditemukan."}:t.starts_at&&n<new Date(t.starts_at)?{valid:!1,message:"Voucher belum berlaku."}:t.ends_at&&n>new Date(t.ends_at)?{valid:!1,message:"Voucher sudah berakhir."}:t.quota&&t.used>=t.quota?{valid:!1,message:"Kuota voucher sudah habis."}:(Number(e)||0)<(Number(t.min_purchase)||0)?{valid:!1,message:`Minimal belanja Rp ${Number(t.min_purchase).toLocaleString("id-ID")}.`}:{valid:!0,discount:dt(t,e)}}function Ft(t){if(!t)return"";const e=a=>`Rp ${Number(a).toLocaleString("id-ID")}`,n=t.kind==="persen"?`${String(t.value).replace(".",",")}%${t.max_discount?` maks ${e(t.max_discount)}`:""}`:`Potongan ${e(t.value)}`;return t.min_purchase>0?`${n} · min. belanja ${e(t.min_purchase)}`:n}const ut=`
<!-- =========================================
     PANEL CHAT AI
========================================== -->
<aside
    class="kc-sheet"
    id="chatPanel"
    aria-label="Konsultasi AI"
    data-state="peek"
    data-open="false"
>

    <!-- Bagian yang bisa ditahan lalu digeser naik-turun -->
    <div class="kc-sheet__grab" id="panelHead">

        <div class="kc-sheet__handle" aria-hidden="true"></div>

        <!-- Posisi peek: sambutan AI -->
        <div class="kc-peek" id="peekRow">
            <!-- Ketuk orb: kotak mengecil jadi orb melayang di tepi layar -->
            <span
                class="kc-orb kc-peek__orb"
                id="peekOrb"
                role="button"
                tabindex="0"
                aria-label="Kecilkan jadi orb"
            ></span>

            <div class="kc-peek__text">
                <strong id="peekTitle">Halo Kak!</strong>
                <p id="peekGreeting">
                    Mau cari produk yang cocok untuk kebutuhanmu?
                </p>
            </div>

            <button
                class="kc-send"
                id="peekSendBtn"
                type="button"
                aria-label="Mulai konsultasi"
            >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            </button>
        </div>

        <!-- Posisi terbuka: judul dan tombol tutup (X, hanya desktop) -->
        <div class="kc-chatbar">
            <h2>Konsultasi AI</h2>

            <button
                class="kc-icon-btn"
                id="chatCloseBtn"
                type="button"
                aria-label="Tutup chat"
                title="Tutup chat"
                aria-expanded="false"
            >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg>
            </button>
        </div>

    </div>

    <!-- Percakapan -->
    <div
        class="kc-messages"
        id="chatBox"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
    ></div>

    <!-- Saran pertanyaan: 3 chip, hanya sebelum chat pertama hari ini -->
    <div
        class="kc-suggestions"
        id="chatSuggestions"
        aria-label="Saran pertanyaan"
    ></div>

    <!-- Kotak ketik bergaya asisten AI -->
    <div class="kc-composer" id="kcComposer" data-mode="chat">

        <div class="kc-attachments" id="kcAttachments" hidden></div>

        <!-- Bar ketik, dua keadaan (data-typing di #kcComposer):
             DIAM     : [kirim | Tulis Context]  suara  link  lampiran | saran
             MENGETIK : [+ | Tulis Context ........ mic]  (kirim)
             Saat mengetik, semua fitur pindah ke menu +. -->
        <div class="kc-composer__row">

            <div class="kc-composer__box">

                <!-- Hanya saat DIAM: ikon kirim (mengetuknya = mulai mengetik) -->
                <!-- Bar DIAM: tombol + bulat hitam -> menu Chat baru & Anachronos Mode -->
                <div class="kc-start-wrap">
                    <button
                        class="kc-send kc-send--idle"
                        id="kcIdleSend"
                        type="button"
                        aria-label="Menu chat"
                        aria-haspopup="menu"
                        aria-expanded="false"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"/></svg>
                    </button>

                    <div class="kc-menu kc-menu--start" id="kcStartMenu" role="menu" hidden>
                        <button class="kc-menu__item" type="button" role="menuitem" data-kc-action="new-chat">
                            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"/></svg>
                            Chat baru
                        </button>

                        <!-- Hak pengguna (UU PDP): hapus semua memori asisten -->
                        <button class="kc-menu__item" type="button" role="menuitem" data-kc-action="forget-memory">
                            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
                            Hapus memori asisten
                        </button>

                        <!-- Konsep sedang disiapkan owner: abu-abu, belum bisa dipilih -->
                        <button class="kc-menu__item kc-menu__item--anachronos" type="button" role="menuitem" data-kc-action="anachronos-mode" disabled>
                            <svg class="kc-anachronos-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                <path class="kc-anachronos-icon__star" d="M12 1.5C12.9 7.8 16.2 11.1 22.5 12C16.2 12.9 12.9 16.2 12 22.5C11.1 16.2 7.8 12.9 1.5 12C7.8 11.1 11.1 7.8 12 1.5Z"/>
                                <path class="kc-anachronos-icon__infinity" d="M12 12c-.75-.95-1.35-1.45-2.05-1.45a1.45 1.45 0 0 0 0 2.9c.7 0 1.3-.5 2.05-1.45zm0 0c.75.95 1.35 1.45 2.05 1.45a1.45 1.45 0 0 0 0-2.9c-.7 0-1.3.5-2.05 1.45z"/>
                            </svg>
                            ANACHRONOS MODE
                            <span class="kc-menu__tag">Segera</span>
                        </button>
                    </div>
                </div>

                <!-- Hanya saat MENGETIK: tombol + berisi semua fitur -->
                <div class="kc-plus">
                    <button
                        class="kc-tool kc-tool--plus"
                        id="btnPlus"
                        type="button"
                        aria-label="Tambah lampiran atau opsi lain"
                        aria-haspopup="menu"
                        aria-expanded="false"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"/></svg>
                    </button>

                    <div class="kc-menu" id="kcPlusMenu" role="menu" hidden>

                        <button class="kc-menu__item" type="button" role="menuitem" data-kc-action="attach-file">
                            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21 12.5l-8.5 8.5a5 5 0 0 1-7-7L14 5.500a3.500 3.500 0 0 1 5 5L10.500 19a2 2 0 0 1-3-3L15 8.500"/></svg>
                            Foto atau dokumen
                        </button>

                        <button class="kc-menu__item" type="button" role="menuitem" data-kc-action="attach-video">
                            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 7h12v10H3zM15 11l6-3v8l-6-3"/></svg>
                            Video
                        </button>

                        <button class="kc-menu__item" type="button" role="menuitem" data-kc-action="new-chat">
                            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 20h9M16.500 3.500a2.100 2.100 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                            Chat baru
                        </button>

                        <button class="kc-menu__item" type="button" role="menuitem" data-kc-action="insert-link">
                            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>
                            Sisipkan link
                        </button>

                        <button class="kc-menu__item" type="button" role="menuitem" data-kc-action="suggest">
                            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="6" width="14" height="11" rx="3"/><path d="M12 6V3M9.500 11v1M14.500 11v1M3 11v2M21 11v2M10 20l2-3 2 3"/></svg>
                            Saran chat
                        </button>

                        <button class="kc-menu__item" id="kcAgentItem" type="button" role="menuitem" data-kc-action="agent-toggle" disabled>
                            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8"/><path d="M9 11v2M15 11v2"/></svg>
                            Mode agen
                            <span class="kc-menu__tag">Segera</span>
                        </button>

                    </div>
                </div>

                <textarea
                    id="kolomKetik"
                    rows="1"
                    placeholder="Tulis Context"
                    aria-label="Ketik pesan"
                    enterkeyhint="send"
                    autocomplete="off"
                ></textarea>

                <!-- Hanya saat MENGETIK: mic di dalam kolom -->
                <button
                    class="kc-tool kc-tool--mic"
                    id="btnMic"
                    type="button"
                    aria-label="Input suara (segera hadir)"
                    disabled
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>
                </button>

                <!-- Mode agen (infrastruktur): orb menggantikan kolom ketik -->
                <button
                    class="kc-agent"
                    id="kcAgentOrb"
                    type="button"
                    aria-label="Matikan mode agen dan kembali mengetik"
                >
                    <span class="kc-orb" aria-hidden="true"></span>
                    <span class="kc-agent__text">
                        Mode agen aktif
                        <small>Ketuk untuk kembali mengetik</small>
                    </span>
                </button>
            </div>

            <!-- Hanya saat DIAM: ikon alat di kanan -->
            <div class="kc-composer__tools">
                <button
                    class="kc-tool"
                    id="btnVoice"
                    type="button"
                    aria-label="Input suara (segera hadir)"
                    disabled
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/></svg>
                </button>

                <button
                    class="kc-tool"
                    id="btnLink"
                    type="button"
                    aria-label="Sisipkan link"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>
                </button>

                <!-- Peniti: pilih foto/dokumen, kamera, atau video -->
                <div class="kc-attach-wrap">
                    <button
                        class="kc-tool"
                        id="btnAttach"
                        type="button"
                        aria-label="Lampirkan foto, kamera, atau video"
                        aria-haspopup="menu"
                        aria-expanded="false"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21 12.5l-8.5 8.5a5 5 0 0 1-7-7L14 5.500a3.500 3.500 0 0 1 5 5L10.500 19a2 2 0 0 1-3-3L15 8.500"/></svg>
                    </button>

                    <div class="kc-menu kc-menu--attach" id="kcAttachMenu" role="menu" hidden>
                        <button class="kc-menu__item" type="button" role="menuitem" data-kc-action="attach-file">
                            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4"/></svg>
                            Foto atau dokumen
                        </button>

                        <button class="kc-menu__item" type="button" role="menuitem" data-kc-action="attach-camera">
                            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.500"/></svg>
                            Kamera
                        </button>

                        <button class="kc-menu__item" type="button" role="menuitem" data-kc-action="attach-video">
                            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 7h12v10H3zM15 11l6-3v8l-6-3"/></svg>
                            Video
                        </button>
                    </div>
                </div>

                <span class="kc-tools__divider" aria-hidden="true"></span>

                <!-- Saran chat: muncul hanya saat ikon ini dipencet -->
                <button
                    class="kc-tool"
                    id="btnSuggest"
                    type="button"
                    aria-label="Tampilkan saran chat"
                    aria-pressed="false"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="6" width="14" height="11" rx="3"/><path d="M12 6V3M9.500 11v1M14.500 11v1M3 11v2M21 11v2M10 20l2-3 2 3"/></svg>
                </button>
            </div>

            <!-- Hanya saat MENGETIK: tombol kirim hitam di luar kolom -->
            <button
                class="kc-send kc-send--main"
                id="tombolKirim"
                type="button"
                aria-label="Kirim pesan"
                disabled
            >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/></svg>
            </button>

        </div>

        <input type="file" id="kcFileInput" multiple hidden>

    </div>

</aside>
`,z="kantoong:assistant:memory-scope",W=Object.freeze({store:"toko",cart:"keranjang",product:"halaman produk",dashboard:"dashboard pengguna",erp:"dashboard kerja ERP"});function S(){try{const t=localStorage.getItem(z);return t==="network"||t==="brand"?t:null}catch{return null}}function lt(t){try{t==="network"||t==="brand"?localStorage.setItem(z,t):localStorage.removeItem(z)}catch{}}function Y(){return String(B?.business_id||B?.businessId||"default")}function X(){return String(B?.app_name||"Kantoong")}function D(){return S()==="network"?"kantoong:chat:network":`kantoong:chat:${Y()}`}function mt(){const t=window.KantoongAssistantContext?.surface;if(t&&W[t]){if(t==="store"){if(document.querySelector(".cart-page.is-open, #cartPage.is-open"))return"cart";if(location.hash.startsWith("#produk/"))return"product";if(document.body.classList.contains("dashboard-open"))return"dashboard"}return t}return location.pathname.includes("/erp/")?"erp":"store"}function jt(){const t=window.KantoongAssistantContext||{},e=mt();return{surface:e,surface_label:W[e]||e,brand:X(),brand_id:Y(),user_name:String(t.userName||"").slice(0,60),network_memory:S()==="network",page_title:String(document.title||"").slice(0,80)}}const J=window.matchMedia("(min-width: 900px)"),h=document.documentElement,Q="kantoong:assistant-dock",tt=["float","side","half"],I=["side","half"],H={float:"Melayang di atas halaman",side:"Chat di samping",half:"Belah layar dua"},pt={float:'<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="7" y="11" width="10" height="5" rx="1.5"/>',side:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M15 5v14"/>',half:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/>'},ht='<path d="M7 7h12l-3-3M17 17H5l3 3"/>';function kt(){try{const t=JSON.parse(localStorage.getItem(Q)||"{}");return{side:t.side==="left"?"left":"right",size:tt.includes(t.size)?t.size:"side"}}catch{return{side:"right",size:"side"}}}const m=kt();function gt(){try{localStorage.setItem(Q,JSON.stringify(m))}catch{}}function w(t){const e=window.innerWidth;return Math.round(t==="half"?e/2:Math.min(440,Math.max(360,e*.32)))}function et(t,e){h.style.setProperty("--kc-dock-w",`${Math.round(t)}px`),h.style.setProperty("--kc-dock-pad",`${Math.round(e)}px`)}let R=0;function at(){clearTimeout(R),R=setTimeout(()=>window.dispatchEvent(new Event("resize")),320)}function K(){h.dataset.kcDockSide=m.side,h.dataset.kcDockSize=m.size,et(w(m.size),w(m.size)),document.querySelectorAll(".kc-dock-tool[data-kc-dock-size]").forEach(t=>{t.setAttribute("aria-pressed",String(t.dataset.kcDockSize===m.size))})}function _(t){Object.assign(m,t),gt(),K(),L(),at()}let nt=null;function L(){const t=nt;if(!t)return;const e=J.matches&&m.size!=="float"&&!t.hidden&&t.dataset.state!=="peek"&&t.dataset.open==="true";h.classList.contains("kc-docked")!==e&&(h.classList.toggle("kc-docked",e),t.classList.toggle("kc-sheet--docked",e),at())}function O(t){return`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${t}</svg>`}function bt(t){const e=t.querySelector(".kc-chatbar");if(!e||e.querySelector(".kc-dock-tools"))return;const n=document.createElement("div");n.className="kc-dock-tools",n.setAttribute("role","group"),n.setAttribute("aria-label","Ukuran chat");for(const o of tt){const i=document.createElement("button");i.type="button",i.className="kc-dock-tool",i.dataset.kcDockSize=o,i.title=H[o],i.setAttribute("aria-label",H[o]),i.innerHTML=O(pt[o]),i.addEventListener("click",()=>_({size:o})),n.appendChild(i)}const a=document.createElement("button");a.type="button",a.className="kc-dock-tool kc-dock-swap",a.title="Pindah sisi",a.setAttribute("aria-label","Pindahkan chat ke sisi lain"),a.innerHTML=O(ht),a.addEventListener("click",()=>_({side:m.side==="right"?"left":"right"})),n.appendChild(a),e.querySelector("#chatCloseBtn")?.before(n)}function ft(t){if(t.querySelector(".kc-dock-edge"))return;const e=document.createElement("div");e.className="kc-dock-edge",e.tabIndex=0,e.title="Tarik untuk mengubah lebar chat",e.setAttribute("role","separator"),e.setAttribute("aria-orientation","vertical"),e.setAttribute("aria-label","Ubah lebar chat (panah kiri/kanan)"),t.appendChild(e);let n=null,a=0;const o=s=>{const r=window.innerWidth,c=m.side==="right"?r-s+8:s+8;return Math.min(r*.7,Math.max(200,c))};e.addEventListener("pointerdown",s=>{s.button>0||(n=s.pointerId,a=w(m.size),e.setPointerCapture?.(n),h.classList.add("kc-dock-resizing"),s.preventDefault())}),e.addEventListener("pointermove",s=>{s.pointerId===n&&(a=o(s.clientX),et(a,a))});const i=s=>{if(s.pointerId!==n)return;if(n=null,h.classList.remove("kc-dock-resizing"),a<280){K(),window.KantoongChat?.collapse?.();return}const r=I.reduce((c,d)=>Math.abs(w(d)-a)<Math.abs(w(c)-a)?d:c);_({size:r})};e.addEventListener("pointerup",i),e.addEventListener("pointercancel",i),e.addEventListener("keydown",s=>{if(s.key!=="ArrowLeft"&&s.key!=="ArrowRight")return;s.preventDefault();const r=s.key==="ArrowLeft"==(m.side==="right"),c=I.indexOf(m.size)+(r?1:-1);c>=0&&c<I.length&&_({size:I[c]})})}function yt(t){let e="";const n=a=>{a!==e&&(e=a,window.dispatchEvent(new CustomEvent(a?"kantoong:stage-focus":"kantoong:stage-blur",{detail:{id:a}})))};t.addEventListener("pointerover",a=>{if(!h.classList.contains("kc-docked")||a.pointerType==="touch")return;const o=a.target.closest?.("#chatBox [data-product-id]");n(o?String(o.dataset.productId):"")}),t.addEventListener("pointerleave",()=>n(""))}function vt(){const t=document.getElementById("chatPanel");t&&(nt=t,K(),bt(t),ft(t),yt(t),new MutationObserver(L).observe(t,{attributes:!0,attributeFilter:["data-open","data-state","hidden"]}),J.addEventListener("change",L),L(),window.addEventListener("kantoong:dock-throw",e=>{const n=e.detail?.side==="left"?"left":"right",a=m.size==="float"?{side:n,size:"side"}:{side:n};(a.side!==m.side||a.size)&&_(a)}),window.addEventListener("resize",()=>{h.classList.contains("kc-dock-resizing")||K()}))}const A=window.matchMedia("(hover: hover) and (pointer: fine)"),wt='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="4" width="7.5" height="7.5" rx="2"/><rect x="3" y="14.5" width="7.5" height="5.5" rx="2"/><rect x="13.5" y="14.5" width="7.5" height="5.5" rx="2"/></svg>',q=new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short"}),$=new Intl.DateTimeFormat("id-ID",{hour:"2-digit",minute:"2-digit"});function u(t,e,n){const a=document.createElement(t);return e&&(a.className=e),n!=null&&(a.textContent=n),a}function _t(t){const e=t.find(a=>a.who==="user");if(!e)return"Chat baru";const n=String(e.text||"").replace(/\s+/g," ").trim();return n||(e.attachments?.length?"Kirim lampiran":"Chat tanpa judul")}function Mt(){const t=window.KantoongAIBrain,e=t?.getHistory?.()||[],a=(t?.getArchive?.()||[]).map((o,i)=>({index:i,messages:o.messages})).reverse();return a.unshift({index:-1,current:!0,messages:e}),a.map(o=>({...o,title:_t(o.messages),startedAt:Number(o.messages[0]?.timestamp)||Date.now()}))}function xt(t){const e=t.who==="user"?"user":"ai",n=u("div",`kc-hcard__msg kc-hcard__msg--${e}`),a=String(t.text||"").trim();a&&n.appendChild(u("p","",a.length>90?`${a.slice(0,90)}…`:a));const o=Array.isArray(t.productIds)?t.productIds.slice(0,3):[];if(o.length){const i=u("div","kc-hcard__products");for(const s of o){const r=window.KantoongAIBrain?.describeProduct?.(s),c=u("span","kc-hcard__product");if(r?.image){const d=document.createElement("img");d.src=r.image,d.alt="",d.loading="lazy",c.appendChild(d)}else c.classList.add("is-gone"),c.title="Produk sudah tidak tersedia";i.appendChild(c)}n.appendChild(i)}return n}function St(t){const e=u("button","kc-hcard");e.type="button",e.dataset.index=String(t.index),t.current&&e.classList.add("is-current");const n=new Date(t.startedAt);e.setAttribute("aria-label",`${t.current?"Chat sekarang: ":"Buka chat: "}${t.title}, ${q.format(n)} ${$.format(n)}`);const a=u("span","kc-hcard__preview"),o=u("span","kc-hcard__track");return t.messages.slice(0,14).forEach(i=>o.appendChild(xt(i))),a.append(o,u("span","kc-hcard__time",$.format(n))),t.current&&a.appendChild(u("span","kc-hcard__badge","Sedang dibuka")),e.append(a,u("span","kc-hcard__title",t.title),u("span","kc-hcard__date",q.format(n))),e}function f(t,e){if(!(!t||t.classList.contains("is-live")===e)&&(t.classList.toggle("is-live",e),e)){const n=t.querySelector(".kc-hcard__preview"),a=t.querySelector(".kc-hcard__track"),o=Math.max(0,a.scrollHeight-n.clientHeight+16);t.style.setProperty("--kc-track-dist",`${-o}px`)}}function F(t){const e=t.getBoundingClientRect(),n=e.top+e.height/2;let a=null,o=1/0;for(const i of t.querySelectorAll(".kc-hcard")){const s=i.getBoundingClientRect(),r=Math.abs(s.top+s.height/2-n);r<o&&(o=r,a=i)}t.querySelectorAll(".kc-hcard.is-live").forEach(i=>{i!==a&&f(i,!1)}),f(a,!0)}function Et(){const t=document.getElementById("chatPanel"),e=t?.querySelector(".kc-chatbar");if(!t||!e||t.querySelector(".kc-history"))return;const n=e.querySelector("h2"),a=n?.textContent||"Konsultasi AI",o=u("button","kc-icon-btn kc-history-btn");o.type="button",o.title="Riwayat chat",o.setAttribute("aria-label","Riwayat chat AI"),o.setAttribute("aria-pressed","false"),o.innerHTML=wt,(e.querySelector(".kc-dock-tools")||e.querySelector("#chatCloseBtn"))?.before(o);const i=u("section","kc-history");i.setAttribute("aria-label","Riwayat chat AI");const s=u("div","kc-history__head"),r=u("p","kc-history__note","Obrolan 30 hari terakhir"),c=u("button","kc-history__new","+ Chat baru");c.type="button",s.append(r,c);const d=u("div","kc-history__grid");i.append(s,d),(t.querySelector("#chatBox")||t.lastElementChild).before(i);let k=0;const rt=()=>{const l=Mt();d.replaceChildren(...l.map(St)),l.length===1&&d.appendChild(u("p","kc-history__empty",'Tekan "+ Chat baru" untuk menyimpan obrolan ini. Obrolan lama akan muncul di sini.')),A.matches||requestAnimationFrame(()=>F(i))},E=l=>{t.dataset.view=l?"history":"chat",o.setAttribute("aria-pressed",String(l)),n&&(n.textContent=l?"Riwayat Chat AI":a),l&&(rt(),i.scrollTop=0)};o.addEventListener("click",()=>E(t.dataset.view!=="history")),c.addEventListener("click",()=>{window.KantoongAIBrain?.newChat?.(),E(!1)}),d.addEventListener("pointerover",l=>{if(!A.matches)return;const p=l.target.closest(".kc-hcard");d.querySelectorAll(".kc-hcard.is-live").forEach(g=>g!==p&&f(g,!1)),f(p,!0)}),d.addEventListener("pointerleave",()=>{A.matches&&d.querySelectorAll(".kc-hcard.is-live").forEach(l=>f(l,!1))}),i.addEventListener("scroll",()=>{A.matches||k||(k=requestAnimationFrame(()=>{k=0,F(i)}))},{passive:!0}),d.addEventListener("touchstart",l=>{const p=l.target.closest(".kc-hcard");p&&(d.querySelectorAll(".kc-hcard.is-live").forEach(g=>g!==p&&f(g,!1)),f(p,!0))},{passive:!0}),d.addEventListener("click",l=>{const p=l.target.closest(".kc-hcard");p&&(p.classList.add("is-opening"),setTimeout(()=>{const g=Number(p.dataset.index);g>=0&&window.KantoongAIBrain?.openArchived?.(g),E(!1)},240))}),new MutationObserver(()=>{t.dataset.open==="false"&&t.dataset.view==="history"&&E(!1)}).observe(t,{attributes:!0,attributeFilter:["data-open"]}),t.dataset.view="chat"}const C=56,j=56,V=8;function It(t){return window.KantoongAIBrain?.findProduct?.(t.dataset.productId)||null}function U(){return typeof window.KantoongEngine?.addToCart=="function"}function At(t){const e=Math.sign(t),n=Math.abs(t);return e*j*(1-Math.exp(-n/(j*.9)))}function Ct(t,e){const n=window.KantoongAIBrain?.describeProduct?.(t.dataset.productId)||{};window.dispatchEvent(new CustomEvent("kantoong:attach-product",{detail:{product:{id:t.dataset.productId,name:n.name||e.name||"",price:Number(e.price??e.harga)||null,image_url:n.image||e.image_url||""}}}))}function Lt(t){window.KantoongEngine.addToCart(t)}function Bt(){const t=document.getElementById("chatBox");if(!t||t.dataset.gesturesReady==="true")return;t.dataset.gesturesReady="true";let e=null,n=!1;const a=i=>{i.classList.remove("is-pulling"),i.style.removeProperty("--kc-pull"),delete i.dataset.gesture};t.addEventListener("pointerdown",i=>{if(i.pointerType==="mouse"&&i.button!==0)return;const s=i.target.closest(".ai-product-card[data-product-id]");s&&(e={card:s,id:i.pointerId,x:i.clientX,y:i.clientY,active:!1,dy:0})}),t.addEventListener("pointermove",i=>{if(!e||i.pointerId!==e.id)return;const s=i.clientX-e.x,r=i.clientY-e.y;if(!e.active){if(Math.abs(s)<V&&Math.abs(r)<V)return;if(Math.abs(s)>=Math.abs(r)){e=null;return}e.active=!0,e.card.classList.add("is-pulling");try{e.card.setPointerCapture(i.pointerId)}catch{}}e.dy=r>0&&!U()?0:r;const c=At(e.dy);e.card.style.setProperty("--kc-pull",`${c.toFixed(1)}px`),e.dy<=-C?e.card.dataset.gesture="up":e.dy>=C?e.card.dataset.gesture="down":e.card.dataset.gesture=e.dy<0?"up-hint":e.dy>0?"down-hint":"",i.preventDefault()});const o=(i,s)=>{if(!e||i.pointerId!==e.id)return;const{card:r,active:c,dy:d}=e;if(e=null,!c)return;n=!0,setTimeout(()=>{n=!1},0);const k=It(r);!s&&k&&d<=-C?(r.classList.add("is-sent-up"),Ct(r,k)):!s&&k&&d>=C&&U()&&(r.classList.add("is-sent-down"),Lt(k)),a(r),setTimeout(()=>r.classList.remove("is-sent-up","is-sent-down"),520)};t.addEventListener("pointerup",i=>o(i,!1)),t.addEventListener("pointercancel",i=>o(i,!0)),t.addEventListener("click",i=>{!n||!i.target.closest(".ai-product-card")||(i.preventDefault(),i.stopPropagation(),n=!1)},!0),t.addEventListener("dragstart",i=>{i.target.closest?.(".ai-product-card")&&i.preventDefault()})}const y=window.KantoongAssistantContext=window.KantoongAssistantContext||{};y.surface||(y.surface=location.pathname.includes("/erp/")?"erp":"store");function Kt(){if(document.getElementById("chatPanel"))return;const t=document.createElement("template");t.innerHTML=ut.trim();const e=document.getElementById("appRoot");if(e){e.appendChild(t.content);return}const n=document.createElement("div");n.id="kantoongAssistantHost",n.className="kc-host",n.appendChild(t.content),document.body.appendChild(n)}async function Pt(){[...document.styleSheets].some(e=>String(e.href||"").includes("chat-sheet.css"))||document.querySelector('link[href*="chat-sheet.css"], style[data-vite-dev-id*="chat-sheet"]')||await T(()=>Promise.resolve({}),__vite__mapDeps([0]))}async function Tt(){try{const{data:t}=await x.auth.getSession(),e=t?.session?.user;if(!e)return null;const n=e.user_metadata||{};return y.userName||(y.userName=String(n.full_name||n.name||"").trim()),e}catch{return null}}async function zt(){if(!(window.KantoongState||document.getElementById("appRoot")))try{const{data:t}=await x.from("products").select("id, name, price, category, description, image_url").limit(60);window.KantoongState={products:t||[]}}catch{window.KantoongState={products:[]}}}function it(...t){const e=new Map;for(const n of t)for(const a of n||[])a&&a.id&&!e.has(a.id)&&e.set(a.id,a);return[...e.values()].sort((n,a)=>Number(n.timestamp)-Number(a.timestamp)).slice(-200)}function G(t){try{return JSON.parse(localStorage.getItem(t)||"[]")}catch{return[]}}function Nt(){if(S()||document.querySelector(".kc-consent"))return;const t=document.getElementById("chatBox");if(!t)return;const e=document.createElement("div");e.className="kc-consent",e.setAttribute("role","region"),e.setAttribute("aria-label","Izin memori asisten");const n=document.createElement("p");n.textContent="Boleh aku mengingat obrolan kita di semua toko jaringan Kantoong? Jadi saat kamu pindah toko, aku tetap nyambung. Kamu bisa menghapusnya kapan saja lewat menu +.";const a=document.createElement("button");a.type="button",a.className="kc-consent__yes",a.textContent="Ingat di semua toko";const o=document.createElement("button");o.type="button",o.className="kc-consent__no",o.textContent=`Hanya di ${X()}`;const i=async r=>{const c=G(D());if(lt(r),e.remove(),r==="network"){const d=it(G(D()),c);window.KantoongAIBrain?.reload?.(d),await ot()}else window.KantoongAIBrain?.reload?.()};a.addEventListener("click",()=>i("network")),o.addEventListener("click",()=>i("brand"));const s=document.createElement("div");s.className="kc-consent__actions",s.append(a,o),e.append(n,s),t.before(e)}let b=null,M=!1,Z=0;async function ot(){if(!b||M||S()!=="network")return;const{data:t,error:e}=await x.from("assistant_memory").select("messages").eq("user_id",b.id).maybeSingle();if(e){M=!0;return}const n=window.KantoongAIBrain?.getHistory?.()||[],a=it(n,t?.messages||[]);a.length!==n.length&&window.KantoongAIBrain?.reload?.(a),a.length!==(t?.messages||[]).length&&st(a)}function st(t){!b||M||S()!=="network"||(clearTimeout(Z),Z=setTimeout(async()=>{const e=(t||[]).slice(-200).map(a=>({id:a.id,who:a.who,text:String(a.text||"").slice(0,3e3),timestamp:a.timestamp,brand:a.brand,surface:a.surface,productIds:a.productIds,attachments:(a.attachments||[]).map(o=>({name:o.name,type:o.type,product:o.product}))})),{error:n}=await x.from("assistant_memory").upsert({user_id:b.id,messages:e,updated_at:new Date().toISOString()});n&&(M=!0)},1500))}window.addEventListener("kantoong:assistant-history",t=>st(t.detail?.history));window.addEventListener("kantoong:forget-memory",async()=>{if(window.confirm("Hapus semua memori asisten? Riwayat obrolan di semua toko Kantoong (perangkat ini"+(b?" dan akunmu":"")+") akan dihapus permanen.")){try{Object.keys(localStorage).filter(e=>e.startsWith("kantoong:chat:")).forEach(e=>localStorage.removeItem(e))}catch{}b&&!M&&await x.from("assistant_memory").delete().eq("user_id",b.id),window.KantoongAIBrain?.clearHistory?.()}});let P=!1;const v=new Set;function N(t,e){e?v.add(t):v.delete(t),document.body.classList.toggle("kc-overlay-open",v.size>0);const n=window.KantoongChat;n&&(v.size&&!n.isMinimized?.()?(n.minimize(),P=!0):!v.size&&P&&(P=!1,n.restore?.()))}window.addEventListener("kantoong:overlay",t=>N(t.detail?.name||"lapisan",!!t.detail?.open));window.addEventListener("kantoong:dashboard-opened",()=>N("dashboard",!0));window.addEventListener("kantoong:dashboard-closed",()=>N("dashboard",!1));document.addEventListener("click",t=>{if(window.KantoongEngine)return;const e=t.target.closest?.("#chatBox [data-product-id]");e&&(t.preventDefault(),window.open(`/index.html#produk/${encodeURIComponent(e.dataset.productId)}`,"_blank","noopener"))},!0);async function Dt(){Kt(),await Pt(),b=await Tt(),await zt(),await T(()=>import("./ai-brain-BIX5qQIF.js"),__vite__mapDeps([1,2,3])),window.KantoongAIBrain?.init?.(),await T(()=>import("./chat-sheet-BBH-X2b3.js"),__vite__mapDeps([4,2,3])),y.startMinimized&&window.KantoongChat?.minimize?.(),vt(),Et(),Bt(),Nt(),ot(),window.dispatchEvent(new CustomEvent("kantoong:assistant-ready",{detail:{surface:y.surface}}))}Dt();export{B as K,Ot as V,mt as a,X as b,$t as c,Ft as d,jt as e,D as h,qt as i,ct as n,dt as v};
