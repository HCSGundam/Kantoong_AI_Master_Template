const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/chat-sheet-D455uvyW.css","assets/ai-brain-1GgHAyHV.js","assets/preload-helper-DD1OZmLC.js","assets/supabase-client-vYFxeodt.js","assets/chat-sheet-HZim1b4u.js"])))=>i.map(i=>d[i]);
import{_ as P}from"./preload-helper-DD1OZmLC.js";import{s as M}from"./supabase-client-vYFxeodt.js";const C={business_id:"master_template_001",app_name:"Miloat",theme_color_primary:"#111111",filter_by_business_id:!1,use_demo_when_empty:!0,hero:{interval_seconds:5,slides:[{type:"none",src:"",media_label:"Foto / video brand",caption:"Premium collection",title:"Nama produk unggulan",text:"Penjelasan singkat produk atau promo yang ingin ditonjolkan brand.",ai_prompt:""},{type:"none",src:"",media_label:"Foto / video brand",caption:"Terbaru",title:"Koleksi terbaru kami",text:"Tanyakan ke asisten AI untuk dicarikan yang paling cocok.",ai_prompt:"Tolong bantu pilihkan produk terbaru yang cocok untuk saya"}]},brand_slot:{type:"marquee",label:"",speed_seconds:30,items:[{icon:"truck",title:"Pengiriman Cepat",sub:"Aman sampai tujuan"},{icon:"badge",title:"Kualitas Terjamin",sub:"Bahan pilihan terbaik"},{icon:"chat",title:"Konsultasi AI",sub:"Tanya kapan saja"},{icon:"lock",title:"Checkout Aman",sub:"Kamu yang bayar sendiri"}],text:""},featured:{eyebrow:"Produk unggulan",title:"Pilihan Terbaik",description:"Produk andalan yang dipilih langsung oleh toko.",matched_title:"Pilihan AI untuk kamu",limit:8,ask_label:"Konsultasi AI",view:"3d"},shipping:{estimate:"",from:""},rails:[{eyebrow:"Paling laris",title:"Best Seller",description:"Produk yang paling banyak dibeli pelanggan.",sort:"sales",limit:10,min_items:2},{eyebrow:"Favorit pembeli",title:"Paling Banyak Di-wishlist",description:"Produk yang paling sering disimpan pembeli.",sort:"wishlist",limit:10,min_items:2},{eyebrow:"Baru datang",title:"Produk Terbaru",description:"Koleksi terbaru yang baru masuk toko.",sort:"newest",limit:10,min_items:2}],testimonials:[],categories:{enabled:!0,title:"Kategori lain"},ai_name:"Asisten",ai_title:"Halo Kak!",ai_endpoint:"/api/chat",ai_greetings:["Mau cari produk yang cocok untuk kebutuhanmu?","Bingung memilih? Ceritakan kebutuhanmu, aku carikan."],ai_suggestions:["Bantu pilihkan sesuai kebutuhan saya","Rekomendasi budget di bawah 500 ribu","Apa produk yang paling banyak dipilih?","Cari produk yang paling hemat","Aku bingung mau pilih yang mana","Ada produk baru apa saja?","Bandingkan produk unggulan untukku","Cari hadiah untuk orang tersayang"],demo_products:[{id:"demo-1",name:"Produk Contoh Satu",price:125e4,category:"kategori a",sales_count:40,image_url:""},{id:"demo-2",name:"Produk Contoh Dua",price:75e4,category:"kategori a",sales_count:32,image_url:""},{id:"demo-3",name:"Produk Contoh Tiga",price:45e4,category:"kategori b",sales_count:25,image_url:""},{id:"demo-4",name:"Produk Contoh Empat",price:23e5,category:"kategori b",sales_count:18,image_url:""},{id:"demo-5",name:"Produk Contoh Lima",price:32e4,category:"kategori a",sales_count:9,image_url:""},{id:"demo-6",name:"Produk Contoh Enam",price:98e4,category:"kategori b",sales_count:4,image_url:""}]};typeof window<"u"&&(window.KantoongConfig=C);const Lt=Object.freeze({persen:"Persen (%)",nominal:"Potongan Rp"});function it(t){return String(t??"").trim().toUpperCase()}function Kt(t){return/^[A-Z0-9]{3,20}$/.test(it(t))}function ot(t,e){const n=Math.max(0,Math.round(Number(e)||0));if(!t)return 0;const a=t.kind==="persen"?Math.min(Math.round(n*Number(t.value)/100),Number(t.max_discount)||1/0):Math.round(Number(t.value)||0);return Math.max(0,Math.min(n,a))}function Pt(t,e,n=new Date){return!t||!t.is_active?{valid:!1,message:"Kode voucher tidak ditemukan."}:t.starts_at&&n<new Date(t.starts_at)?{valid:!1,message:"Voucher belum berlaku."}:t.ends_at&&n>new Date(t.ends_at)?{valid:!1,message:"Voucher sudah berakhir."}:t.quota&&t.used>=t.quota?{valid:!1,message:"Kuota voucher sudah habis."}:(Number(e)||0)<(Number(t.min_purchase)||0)?{valid:!1,message:`Minimal belanja Rp ${Number(t.min_purchase).toLocaleString("id-ID")}.`}:{valid:!0,discount:ot(t,e)}}function Tt(t){if(!t)return"";const e=a=>`Rp ${Number(a).toLocaleString("id-ID")}`,n=t.kind==="persen"?`${String(t.value).replace(".",",")}%${t.max_discount?` maks ${e(t.max_discount)}`:""}`:`Potongan ${e(t.value)}`;return t.min_purchase>0?`${n} · min. belanja ${e(t.min_purchase)}`:n}const st=`
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
`,T="kantoong:assistant:memory-scope",V=Object.freeze({store:"toko",cart:"keranjang",product:"halaman produk",dashboard:"dashboard pengguna",erp:"dashboard kerja ERP"});function x(){try{const t=localStorage.getItem(T);return t==="network"||t==="brand"?t:null}catch{return null}}function rt(t){try{t==="network"||t==="brand"?localStorage.setItem(T,t):localStorage.removeItem(T)}catch{}}function U(){return String(C?.business_id||C?.businessId||"default")}function Z(){return String(C?.app_name||"Kantoong")}function N(){return x()==="network"?"kantoong:chat:network":`kantoong:chat:${U()}`}function ct(){const t=window.KantoongAssistantContext?.surface;if(t&&V[t]){if(t==="store"){if(document.querySelector(".cart-page.is-open, #cartPage.is-open"))return"cart";if(location.hash.startsWith("#produk/"))return"product";if(document.body.classList.contains("dashboard-open"))return"dashboard"}return t}return location.pathname.includes("/erp/")?"erp":"store"}function zt(){const t=window.KantoongAssistantContext||{},e=ct();return{surface:e,surface_label:V[e]||e,brand:Z(),brand_id:U(),user_name:String(t.userName||"").slice(0,60),network_memory:x()==="network",page_title:String(document.title||"").slice(0,80)}}const W=window.matchMedia("(min-width: 900px)"),p=document.documentElement,G="kantoong:assistant-dock",J=["float","side","half"],E=["side","half"],D={float:"Melayang di atas halaman",side:"Chat di samping",half:"Belah layar dua"},dt={float:'<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="7" y="11" width="10" height="5" rx="1.5"/>',side:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M15 5v14"/>',half:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/>'},lt='<path d="M7 7h12l-3-3M17 17H5l3 3"/>';function ut(){try{const t=JSON.parse(localStorage.getItem(G)||"{}");return{side:t.side==="left"?"left":"right",size:J.includes(t.size)?t.size:"side"}}catch{return{side:"right",size:"side"}}}const m=ut();function mt(){try{localStorage.setItem(G,JSON.stringify(m))}catch{}}function y(t){const e=window.innerWidth;return Math.round(t==="half"?e/2:Math.min(440,Math.max(360,e*.32)))}function Y(t,e){p.style.setProperty("--kc-dock-w",`${Math.round(t)}px`),p.style.setProperty("--kc-dock-pad",`${Math.round(e)}px`)}let H=0;function Q(){clearTimeout(H),H=setTimeout(()=>window.dispatchEvent(new Event("resize")),320)}function B(){p.dataset.kcDockSide=m.side,p.dataset.kcDockSize=m.size,Y(y(m.size),y(m.size)),document.querySelectorAll(".kc-dock-tool[data-kc-dock-size]").forEach(t=>{t.setAttribute("aria-pressed",String(t.dataset.kcDockSize===m.size))})}function w(t){Object.assign(m,t),mt(),B(),I(),Q()}let X=null;function I(){const t=X;if(!t)return;const e=W.matches&&m.size!=="float"&&!t.hidden&&t.dataset.state!=="peek"&&t.dataset.open==="true";p.classList.contains("kc-docked")!==e&&(p.classList.toggle("kc-docked",e),t.classList.toggle("kc-sheet--docked",e),Q())}function O(t){return`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${t}</svg>`}function ht(t){const e=t.querySelector(".kc-chatbar");if(!e||e.querySelector(".kc-dock-tools"))return;const n=document.createElement("div");n.className="kc-dock-tools",n.setAttribute("role","group"),n.setAttribute("aria-label","Ukuran chat");for(const i of J){const o=document.createElement("button");o.type="button",o.className="kc-dock-tool",o.dataset.kcDockSize=i,o.title=D[i],o.setAttribute("aria-label",D[i]),o.innerHTML=O(dt[i]),o.addEventListener("click",()=>w({size:i})),n.appendChild(o)}const a=document.createElement("button");a.type="button",a.className="kc-dock-tool kc-dock-swap",a.title="Pindah sisi",a.setAttribute("aria-label","Pindahkan chat ke sisi lain"),a.innerHTML=O(lt),a.addEventListener("click",()=>w({side:m.side==="right"?"left":"right"})),n.appendChild(a),e.querySelector("#chatCloseBtn")?.before(n)}function pt(t){if(t.querySelector(".kc-dock-edge"))return;const e=document.createElement("div");e.className="kc-dock-edge",e.tabIndex=0,e.title="Tarik untuk mengubah lebar chat",e.setAttribute("role","separator"),e.setAttribute("aria-orientation","vertical"),e.setAttribute("aria-label","Ubah lebar chat (panah kiri/kanan)"),t.appendChild(e);let n=null,a=0;const i=s=>{const l=window.innerWidth,c=m.side==="right"?l-s+8:s+8;return Math.min(l*.7,Math.max(200,c))};e.addEventListener("pointerdown",s=>{s.button>0||(n=s.pointerId,a=y(m.size),e.setPointerCapture?.(n),p.classList.add("kc-dock-resizing"),s.preventDefault())}),e.addEventListener("pointermove",s=>{s.pointerId===n&&(a=i(s.clientX),Y(a,a))});const o=s=>{if(s.pointerId!==n)return;if(n=null,p.classList.remove("kc-dock-resizing"),a<280){B(),window.KantoongChat?.collapse?.();return}const l=E.reduce((c,r)=>Math.abs(y(r)-a)<Math.abs(y(c)-a)?r:c);w({size:l})};e.addEventListener("pointerup",o),e.addEventListener("pointercancel",o),e.addEventListener("keydown",s=>{if(s.key!=="ArrowLeft"&&s.key!=="ArrowRight")return;s.preventDefault();const l=s.key==="ArrowLeft"==(m.side==="right"),c=E.indexOf(m.size)+(l?1:-1);c>=0&&c<E.length&&w({size:E[c]})})}function kt(t){let e="";const n=a=>{a!==e&&(e=a,window.dispatchEvent(new CustomEvent(a?"kantoong:stage-focus":"kantoong:stage-blur",{detail:{id:a}})))};t.addEventListener("pointerover",a=>{if(!p.classList.contains("kc-docked")||a.pointerType==="touch")return;const i=a.target.closest?.("#chatBox [data-product-id]");n(i?String(i.dataset.productId):"")}),t.addEventListener("pointerleave",()=>n(""))}function gt(){const t=document.getElementById("chatPanel");t&&(X=t,B(),ht(t),pt(t),kt(t),new MutationObserver(I).observe(t,{attributes:!0,attributeFilter:["data-open","data-state","hidden"]}),W.addEventListener("change",I),I(),window.addEventListener("kantoong:dock-throw",e=>{const n=e.detail?.side==="left"?"left":"right",a=m.size==="float"?{side:n,size:"side"}:{side:n};(a.side!==m.side||a.size)&&w(a)}),window.addEventListener("resize",()=>{p.classList.contains("kc-dock-resizing")||B()}))}const A=window.matchMedia("(hover: hover) and (pointer: fine)"),bt='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="4" width="7.5" height="7.5" rx="2"/><rect x="3" y="14.5" width="7.5" height="5.5" rx="2"/><rect x="13.5" y="14.5" width="7.5" height="5.5" rx="2"/></svg>',q=new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short"}),R=new Intl.DateTimeFormat("id-ID",{hour:"2-digit",minute:"2-digit"});function d(t,e,n){const a=document.createElement(t);return e&&(a.className=e),n!=null&&(a.textContent=n),a}function ft(t){const e=t.find(a=>a.who==="user");if(!e)return"Chat baru";const n=String(e.text||"").replace(/\s+/g," ").trim();return n||(e.attachments?.length?"Kirim lampiran":"Chat tanpa judul")}function vt(){const t=window.KantoongAIBrain,e=t?.getHistory?.()||[],a=(t?.getArchive?.()||[]).map((i,o)=>({index:o,messages:i.messages})).reverse();return a.unshift({index:-1,current:!0,messages:e}),a.map(i=>({...i,title:ft(i.messages),startedAt:Number(i.messages[0]?.timestamp)||Date.now()}))}function yt(t){const e=t.who==="user"?"user":"ai",n=d("div",`kc-hcard__msg kc-hcard__msg--${e}`),a=String(t.text||"").trim();a&&n.appendChild(d("p","",a.length>90?`${a.slice(0,90)}…`:a));const i=Array.isArray(t.productIds)?t.productIds.slice(0,3):[];if(i.length){const o=d("div","kc-hcard__products");for(const s of i){const l=window.KantoongAIBrain?.describeProduct?.(s),c=d("span","kc-hcard__product");if(l?.image){const r=document.createElement("img");r.src=l.image,r.alt="",r.loading="lazy",c.appendChild(r)}else c.classList.add("is-gone"),c.title="Produk sudah tidak tersedia";o.appendChild(c)}n.appendChild(o)}return n}function wt(t){const e=d("button","kc-hcard");e.type="button",e.dataset.index=String(t.index),t.current&&e.classList.add("is-current");const n=new Date(t.startedAt);e.setAttribute("aria-label",`${t.current?"Chat sekarang: ":"Buka chat: "}${t.title}, ${q.format(n)} ${R.format(n)}`);const a=d("span","kc-hcard__preview"),i=d("span","kc-hcard__track");return t.messages.slice(0,14).forEach(o=>i.appendChild(yt(o))),a.append(i,d("span","kc-hcard__time",R.format(n))),t.current&&a.appendChild(d("span","kc-hcard__badge","Sedang dibuka")),e.append(a,d("span","kc-hcard__title",t.title),d("span","kc-hcard__date",q.format(n))),e}function b(t,e){if(!(!t||t.classList.contains("is-live")===e)&&(t.classList.toggle("is-live",e),e)){const n=t.querySelector(".kc-hcard__preview"),a=t.querySelector(".kc-hcard__track"),i=Math.max(0,a.scrollHeight-n.clientHeight+16);t.style.setProperty("--kc-track-dist",`${-i}px`)}}function $(t){const e=t.getBoundingClientRect(),n=e.top+e.height/2;let a=null,i=1/0;for(const o of t.querySelectorAll(".kc-hcard")){const s=o.getBoundingClientRect(),l=Math.abs(s.top+s.height/2-n);l<i&&(i=l,a=o)}t.querySelectorAll(".kc-hcard.is-live").forEach(o=>{o!==a&&b(o,!1)}),b(a,!0)}function _t(){const t=document.getElementById("chatPanel"),e=t?.querySelector(".kc-chatbar");if(!t||!e||t.querySelector(".kc-history"))return;const n=e.querySelector("h2"),a=n?.textContent||"Konsultasi AI",i=d("button","kc-icon-btn kc-history-btn");i.type="button",i.title="Riwayat chat",i.setAttribute("aria-label","Riwayat chat AI"),i.setAttribute("aria-pressed","false"),i.innerHTML=bt,(e.querySelector(".kc-dock-tools")||e.querySelector("#chatCloseBtn"))?.before(i);const o=d("section","kc-history");o.setAttribute("aria-label","Riwayat chat AI");const s=d("div","kc-history__head"),l=d("p","kc-history__note","Obrolan 30 hari terakhir"),c=d("button","kc-history__new","+ Chat baru");c.type="button",s.append(l,c);const r=d("div","kc-history__grid");o.append(s,r),(t.querySelector("#chatBox")||t.lastElementChild).before(o);let L=0;const nt=()=>{const u=vt();r.replaceChildren(...u.map(wt)),u.length===1&&r.appendChild(d("p","kc-history__empty",'Tekan "+ Chat baru" untuk menyimpan obrolan ini. Obrolan lama akan muncul di sini.')),A.matches||requestAnimationFrame(()=>$(o))},S=u=>{t.dataset.view=u?"history":"chat",i.setAttribute("aria-pressed",String(u)),n&&(n.textContent=u?"Riwayat Chat AI":a),u&&(nt(),o.scrollTop=0)};i.addEventListener("click",()=>S(t.dataset.view!=="history")),c.addEventListener("click",()=>{window.KantoongAIBrain?.newChat?.(),S(!1)}),r.addEventListener("pointerover",u=>{if(!A.matches)return;const h=u.target.closest(".kc-hcard");r.querySelectorAll(".kc-hcard.is-live").forEach(k=>k!==h&&b(k,!1)),b(h,!0)}),r.addEventListener("pointerleave",()=>{A.matches&&r.querySelectorAll(".kc-hcard.is-live").forEach(u=>b(u,!1))}),o.addEventListener("scroll",()=>{A.matches||L||(L=requestAnimationFrame(()=>{L=0,$(o)}))},{passive:!0}),r.addEventListener("touchstart",u=>{const h=u.target.closest(".kc-hcard");h&&(r.querySelectorAll(".kc-hcard.is-live").forEach(k=>k!==h&&b(k,!1)),b(h,!0))},{passive:!0}),r.addEventListener("click",u=>{const h=u.target.closest(".kc-hcard");h&&(h.classList.add("is-opening"),setTimeout(()=>{const k=Number(h.dataset.index);k>=0&&window.KantoongAIBrain?.openArchived?.(k),S(!1)},240))}),new MutationObserver(()=>{t.dataset.open==="false"&&t.dataset.view==="history"&&S(!1)}).observe(t,{attributes:!0,attributeFilter:["data-open"]}),t.dataset.view="chat"}const f=window.KantoongAssistantContext=window.KantoongAssistantContext||{};f.surface||(f.surface=location.pathname.includes("/erp/")?"erp":"store");function Mt(){if(document.getElementById("chatPanel"))return;const t=document.createElement("template");t.innerHTML=st.trim();const e=document.getElementById("appRoot");if(e){e.appendChild(t.content);return}const n=document.createElement("div");n.id="kantoongAssistantHost",n.className="kc-host",n.appendChild(t.content),document.body.appendChild(n)}async function xt(){[...document.styleSheets].some(e=>String(e.href||"").includes("chat-sheet.css"))||document.querySelector('link[href*="chat-sheet.css"], style[data-vite-dev-id*="chat-sheet"]')||await P(()=>Promise.resolve({}),__vite__mapDeps([0]))}async function St(){try{const{data:t}=await M.auth.getSession(),e=t?.session?.user;if(!e)return null;const n=e.user_metadata||{};return f.userName||(f.userName=String(n.full_name||n.name||"").trim()),e}catch{return null}}async function Et(){if(!(window.KantoongState||document.getElementById("appRoot")))try{const{data:t}=await M.from("products").select("id, name, price, category, description, image_url").limit(60);window.KantoongState={products:t||[]}}catch{window.KantoongState={products:[]}}}function tt(...t){const e=new Map;for(const n of t)for(const a of n||[])a&&a.id&&!e.has(a.id)&&e.set(a.id,a);return[...e.values()].sort((n,a)=>Number(n.timestamp)-Number(a.timestamp)).slice(-200)}function j(t){try{return JSON.parse(localStorage.getItem(t)||"[]")}catch{return[]}}function At(){if(x()||document.querySelector(".kc-consent"))return;const t=document.getElementById("chatBox");if(!t)return;const e=document.createElement("div");e.className="kc-consent",e.setAttribute("role","region"),e.setAttribute("aria-label","Izin memori asisten");const n=document.createElement("p");n.textContent="Boleh aku mengingat obrolan kita di semua toko jaringan Kantoong? Jadi saat kamu pindah toko, aku tetap nyambung. Kamu bisa menghapusnya kapan saja lewat menu +.";const a=document.createElement("button");a.type="button",a.className="kc-consent__yes",a.textContent="Ingat di semua toko";const i=document.createElement("button");i.type="button",i.className="kc-consent__no",i.textContent=`Hanya di ${Z()}`;const o=async l=>{const c=j(N());if(rt(l),e.remove(),l==="network"){const r=tt(j(N()),c);window.KantoongAIBrain?.reload?.(r),await et()}else window.KantoongAIBrain?.reload?.()};a.addEventListener("click",()=>o("network")),i.addEventListener("click",()=>o("brand"));const s=document.createElement("div");s.className="kc-consent__actions",s.append(a,i),e.append(n,s),t.before(e)}let g=null,_=!1,F=0;async function et(){if(!g||_||x()!=="network")return;const{data:t,error:e}=await M.from("assistant_memory").select("messages").eq("user_id",g.id).maybeSingle();if(e){_=!0;return}const n=window.KantoongAIBrain?.getHistory?.()||[],a=tt(n,t?.messages||[]);a.length!==n.length&&window.KantoongAIBrain?.reload?.(a),a.length!==(t?.messages||[]).length&&at(a)}function at(t){!g||_||x()!=="network"||(clearTimeout(F),F=setTimeout(async()=>{const e=(t||[]).slice(-200).map(a=>({id:a.id,who:a.who,text:String(a.text||"").slice(0,3e3),timestamp:a.timestamp,brand:a.brand,surface:a.surface,productIds:a.productIds,attachments:(a.attachments||[]).map(i=>({name:i.name,type:i.type,product:i.product}))})),{error:n}=await M.from("assistant_memory").upsert({user_id:g.id,messages:e,updated_at:new Date().toISOString()});n&&(_=!0)},1500))}window.addEventListener("kantoong:assistant-history",t=>at(t.detail?.history));window.addEventListener("kantoong:forget-memory",async()=>{if(window.confirm("Hapus semua memori asisten? Riwayat obrolan di semua toko Kantoong (perangkat ini"+(g?" dan akunmu":"")+") akan dihapus permanen.")){try{Object.keys(localStorage).filter(e=>e.startsWith("kantoong:chat:")).forEach(e=>localStorage.removeItem(e))}catch{}g&&!_&&await M.from("assistant_memory").delete().eq("user_id",g.id),window.KantoongAIBrain?.clearHistory?.()}});let K=!1;const v=new Set;function z(t,e){e?v.add(t):v.delete(t),document.body.classList.toggle("kc-overlay-open",v.size>0);const n=window.KantoongChat;n&&(v.size&&!n.isMinimized?.()?(n.minimize(),K=!0):!v.size&&K&&(K=!1,n.restore?.()))}window.addEventListener("kantoong:overlay",t=>z(t.detail?.name||"lapisan",!!t.detail?.open));window.addEventListener("kantoong:dashboard-opened",()=>z("dashboard",!0));window.addEventListener("kantoong:dashboard-closed",()=>z("dashboard",!1));document.addEventListener("click",t=>{if(window.KantoongEngine)return;const e=t.target.closest?.("#chatBox [data-product-id]");e&&(t.preventDefault(),window.open(`/index.html#produk/${encodeURIComponent(e.dataset.productId)}`,"_blank","noopener"))},!0);async function It(){Mt(),await xt(),g=await St(),await Et(),await P(()=>import("./ai-brain-1GgHAyHV.js"),__vite__mapDeps([1,2,3])),window.KantoongAIBrain?.init?.(),await P(()=>import("./chat-sheet-HZim1b4u.js"),__vite__mapDeps([4,2,3])),f.startMinimized&&window.KantoongChat?.minimize?.(),gt(),_t(),At(),et(),window.dispatchEvent(new CustomEvent("kantoong:assistant-ready",{detail:{surface:f.surface}}))}It();export{C as K,Lt as V,ct as a,Z as b,Pt as c,Tt as d,zt as e,N as h,Kt as i,it as n,ot as v};
