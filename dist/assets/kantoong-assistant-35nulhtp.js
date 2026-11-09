const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/chat-sheet-D-2G7aRn.css","assets/ai-brain-DtvVeUip.js","assets/theme-BJsjxonE.js","assets/supabase-client-BtPJjuZk.js","assets/chat-sheet-C945-KpI.js"])))=>i.map(i=>d[i]);
import{K as y,_ as U}from"./theme-BJsjxonE.js";import{supabase as E}from"./supabase-client-BtPJjuZk.js";const Ke=["id","name","price","stock","category","image_url","created_at","business_id","caption","description","sales_count","is_published","is_featured","is_hero","hero_caption","hero_text","compare_at_price","ship_estimate","ship_from","video_url","gallery","hero_image_url","sku","barcode","rating_avg","review_count"].join(", "),gt=Object.freeze({umum:{label:"Umum (retail, F&B, fashion)",fields:[]},properti:{label:"Properti (agen / developer)",fields:[{key:"listing",label:"Status",type:"select",options:["Dijual","Disewakan"]},{key:"lokasi",label:"Lokasi",type:"text",placeholder:"Contoh: Bintaro Sektor 9, Tangerang Selatan"},{key:"lt",label:"Luas tanah (m²)",type:"number"},{key:"lb",label:"Luas bangunan (m²)",type:"number"},{key:"kt",label:"Kamar tidur",type:"number"},{key:"km",label:"Kamar mandi",type:"number"},{key:"lantai",label:"Jumlah lantai",type:"number"},{key:"sertifikat",label:"Sertifikat",type:"select",options:["SHM","HGB","SHGB","Strata Title","AJB","Girik","Lainnya"]},{key:"maps",label:"Link Google Maps (https)",type:"url",placeholder:"https://maps.app.goo.gl/…"}]},emas:{label:"Toko emas & perhiasan",fields:[{key:"jenis",label:"Jenis",type:"select",options:["Cincin","Kalung","Gelang","Anting","Liontin","Logam mulia","Lainnya"]},{key:"kadar",label:"Kadar",type:"select",options:["24K","23K","22K","18K","17K","16K","9K"]},{key:"berat",label:"Berat (gram)",type:"number",step:"0.01"},{key:"ongkos",label:"Ongkos bikin (Rp)",type:"number"},{key:"sertifikat",label:"Sertifikat / merek",type:"text",placeholder:"Contoh: Antam, UBS, surat toko"}]}}),T=e=>gt[e]?e:"umum",j=e=>{const t=Number(String(e??"").replace(",","."));return Number.isFinite(t)&&t>0?t:0};function Te(e,t){const a={};return gt[T(e)].fields.forEach(n=>{const i=t?.[n.key];if(!(i==null||i===""))if(n.type==="number"){const o=j(i);o&&(a[n.key]=Math.round(o*100)/100)}else n.type==="select"?n.options.includes(String(i))&&(a[n.key]=String(i)):n.type==="url"?/^https:\/\//i.test(String(i))&&(a[n.key]=String(i).slice(0,500)):a[n.key]=String(i).trim().slice(0,160)}),a}const v=e=>Number(e).toLocaleString("id-ID");function Pe(e,t={}){const a=T(e);return a==="properti"?[["Status",t.listing],["Lokasi",t.lokasi],["Luas tanah",t.lt&&`${v(t.lt)} m²`],["Luas bangunan",t.lb&&`${v(t.lb)} m²`],["Kamar tidur",t.kt],["Kamar mandi",t.km],["Lantai",t.lantai],["Sertifikat",t.sertifikat]].filter(([,n])=>n!==void 0&&n!==""&&n!==0).map(([n,i])=>({label:n,value:String(i)})):a==="emas"?[["Jenis",t.jenis],["Kadar",t.kadar],["Berat",t.berat&&`${v(t.berat)} gram`],["Ongkos bikin",t.ongkos&&`Rp ${v(t.ongkos)}`],["Sertifikat",t.sertifikat]].filter(([,n])=>n).map(([n,i])=>({label:n,value:String(i)})):[]}function qt(e,t={}){const a=T(e);return a==="properti"?[t.lt&&`LT ${v(t.lt)}`,t.lb&&`LB ${v(t.lb)}`,t.kt&&`${t.kt} KT`,t.km&&`${t.km} KM`,t.lokasi].filter(Boolean).join(" · "):a==="emas"?[t.kadar,t.berat&&`${v(t.berat)} gr`,t.jenis].filter(Boolean).join(" · "):""}function Ft(e={},t={}){const a=j(t?.prices?.[e.kadar]),n=j(e.berat);return!a||!n?null:Math.round(n*a+j(e.ongkos))}function ze(e){const t=Number(e)||0;return t>=1e9?`Rp ${(t/1e9).toFixed(t>=1e10?1:2).replace(/\.?0+$/,"").replace(".",",")} M`:t>=1e6?`Rp ${(t/1e6).toFixed(t>=1e8?0:1).replace(/\.0$/,"").replace(".",",")} jt`:`Rp ${v(t)}`}function De(e,t,{industry:a="umum",gold:n=null}={}){const i=T(a);return i==="umum"?e:(e??[]).map(o=>{const s=t?.get?.(String(o.id))??t?.[String(o.id)]??{},c={...o,attributes:s,spec_line:qt(i,s)};if(i==="emas"){const d=Ft(s,n);d&&(c.base_price=o.price,c.price=d,c.price_note=n?.updatedAt?`Harga emas hari ini · ${n.updatedAt}`:"Harga emas hari ini")}return!c.caption&&c.spec_line&&(c.caption=c.spec_line),c})}const X="kantoong:plan-preview",J=Object.freeze({pro:{label:"Kantoong Pro",commerce:!0,pos:!0,erpModules:null,dashboardFeatures:null},free:{label:"WEB AI BOS FREE",commerce:!1,pos:!1,erpModules:["workspace","catalog","storefront","org"],dashboardFeatures:["profile","product-catalog","wishlist","ai-chat-history","customer-support","store-map","settings","clock","calendar"]}});function Ut(){if(y?.erp_demo!==!0)return null;try{return JSON.parse(localStorage.getItem(X)||"null")}catch{return null}}function bt(){const e=Ut(),t=J[e?.package]?e.package:J[y?.package]?y.package:"pro",a=T(e?.industry??y?.industry??"umum");return{package:t,industry:a,preview:!!e,...J[t]}}function Oe(e){if(y?.erp_demo!==!0)return!1;try{e?localStorage.setItem(X,JSON.stringify(e)):localStorage.removeItem(X)}catch{return!1}return!0}function Ne(e){const t=bt().dashboardFeatures;return!t||t.includes(e)}function $e(){if(typeof document>"u")return;const e=bt();document.documentElement.dataset.plan=e.package,document.documentElement.dataset.industry=e.industry,document.documentElement.dataset.commerce=e.commerce?"on":"off"}const Q=y?.business_id??"master_template_001",yt=`kantoong:demo-attributes:${Q}`;function wt(){try{return JSON.parse(localStorage.getItem(yt)||"{}")||{}}catch{return{}}}let W=null;async function vt(){return W||(W=U(()=>import("./supabase-client-BtPJjuZk.js"),[]).then(e=>e.supabase).catch(()=>null)),W}async function He(){const e=new Map;try{const t=await vt();if(t){const{data:a,error:n}=await t.from("product_attributes").select("product_id, attributes").eq("business_id",Q);if(n)throw n;(a??[]).forEach(i=>e.set(String(i.product_id),i.attributes??{}))}}catch(t){console.info("[KANTOONG] Spesifikasi produk belum tersedia di database:",t?.message||t)}return Object.entries(wt()).forEach(([t,a])=>{e.has(t)||e.set(t,a)}),e}async function Re(e,t,{demo:a=!1}={}){const n=String(e);if(a){const s=wt();s[n]=t,localStorage.setItem(yt,JSON.stringify(s));return}const i=await vt();if(!i)throw new Error("Tidak tersambung ke server.");const{error:o}=await i.from("product_attributes").upsert({product_id:n,business_id:Q,attributes:t,updated_at:new Date().toISOString()});if(o)throw o.code==="42P01"||/product_attributes/.test(o.message)?new Error("Tabel spesifikasi belum ada: jalankan db/industry.sql di Supabase."):o}const Gt=`
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
`,Z="kantoong:assistant:memory-scope",_t=Object.freeze({store:"toko",cart:"keranjang",product:"halaman produk",dashboard:"dashboard pengguna",erp:"dashboard kerja ERP"});function P(){try{const e=localStorage.getItem(Z);return e==="network"||e==="brand"?e:null}catch{return null}}function Vt(e){try{e==="network"||e==="brand"?localStorage.setItem(Z,e):localStorage.removeItem(Z)}catch{}}function St(){return String(y?.business_id||y?.businessId||"default")}function Mt(){return String(y?.app_name||"Kantoong")}function nt(){return P()==="network"?"kantoong:chat:network":`kantoong:chat:${St()}`}function Jt(){const e=window.KantoongAssistantContext?.surface;if(e&&_t[e]){if(e==="store"){if(document.querySelector(".cart-page.is-open, #cartPage.is-open"))return"cart";if(location.hash.startsWith("#produk/"))return"product";if(document.body.classList.contains("dashboard-open"))return"dashboard"}return e}return location.pathname.includes("/erp/")?"erp":"store"}function Wt(){const e=window.KantoongAssistantContext?.page;return typeof e=="function"?String(e()||"").slice(0,120):e?String(e).slice(0,120):location.hash.startsWith("#produk/")?`halaman produk "${document.title.split(" · ")[0]}"`:location.pathname.includes("/erp/")?`menu ERP "${document.title.split(" — ")[0]}"`:""}function je(){const e=window.KantoongAssistantContext||{},t=Jt();return{surface:t,surface_label:_t[t]||t,brand:Mt(),brand_id:St(),user_name:String(e.userName||"").slice(0,60),network_memory:P()==="network",page_title:String(document.title||"").slice(0,80),page:Wt()}}const Et=window.matchMedia("(min-width: 900px)"),w=document.documentElement,xt="kantoong:assistant-dock",It=["float","side","half"],O=["side","half"],it={float:"Melayang di atas halaman",side:"Chat di samping",half:"Belah layar dua"},Yt={float:'<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="7" y="11" width="10" height="5" rx="1.5"/>',side:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M15 5v14"/>',half:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/>'},Xt='<path d="M7 7h12l-3-3M17 17H5l3 3"/>';function Zt(){try{const e=JSON.parse(localStorage.getItem(xt)||"{}");return{side:e.side==="left"?"left":"right",size:It.includes(e.size)?e.size:"side"}}catch{return{side:"right",size:"side"}}}const m=Zt();function Qt(){try{localStorage.setItem(xt,JSON.stringify(m))}catch{}}function A(e){const t=window.innerWidth;return Math.round(e==="half"?t/2:Math.min(440,Math.max(360,t*.32)))}function At(e,t){w.style.setProperty("--kc-dock-w",`${Math.round(e)}px`),w.style.setProperty("--kc-dock-pad",`${Math.round(t)}px`)}let ot=0;function Lt(){clearTimeout(ot),ot=setTimeout(()=>window.dispatchEvent(new Event("resize")),320)}function G(){w.dataset.kcDockSide=m.side,w.dataset.kcDockSize=m.size,At(A(m.size),A(m.size)),document.querySelectorAll(".kc-dock-tool[data-kc-dock-size]").forEach(e=>{e.setAttribute("aria-pressed",String(e.dataset.kcDockSize===m.size))})}function B(e){Object.assign(m,e),Qt(),G(),q(),Lt()}let Ct=null;function q(){const e=Ct;if(!e)return;const t=Et.matches&&m.size!=="float"&&!e.hidden&&e.dataset.state!=="peek"&&e.dataset.open==="true";w.classList.contains("kc-docked")!==t&&(w.classList.toggle("kc-docked",t),e.classList.toggle("kc-sheet--docked",t),Lt())}function rt(e){return`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${e}</svg>`}function te(e){const t=e.querySelector(".kc-chatbar");if(!t||t.querySelector(".kc-dock-tools"))return;const a=document.createElement("div");a.className="kc-dock-tools",a.setAttribute("role","group"),a.setAttribute("aria-label","Ukuran chat");for(const i of It){const o=document.createElement("button");o.type="button",o.className="kc-dock-tool",o.dataset.kcDockSize=i,o.title=it[i],o.setAttribute("aria-label",it[i]),o.innerHTML=rt(Yt[i]),o.addEventListener("click",()=>B({size:i})),a.appendChild(o)}const n=document.createElement("button");n.type="button",n.className="kc-dock-tool kc-dock-swap",n.title="Pindah sisi",n.setAttribute("aria-label","Pindahkan chat ke sisi lain"),n.innerHTML=rt(Xt),n.addEventListener("click",()=>B({side:m.side==="right"?"left":"right"})),a.appendChild(n),t.querySelector("#chatCloseBtn")?.before(a)}function ee(e){if(e.querySelector(".kc-dock-edge"))return;const t=document.createElement("div");t.className="kc-dock-edge",t.tabIndex=0,t.title="Tarik untuk mengubah lebar chat",t.setAttribute("role","separator"),t.setAttribute("aria-orientation","vertical"),t.setAttribute("aria-label","Ubah lebar chat (panah kiri/kanan)"),e.appendChild(t);let a=null,n=0;const i=s=>{const c=window.innerWidth,d=m.side==="right"?c-s+8:s+8;return Math.min(c*.7,Math.max(200,d))};t.addEventListener("pointerdown",s=>{s.button>0||(a=s.pointerId,n=A(m.size),t.setPointerCapture?.(a),w.classList.add("kc-dock-resizing"),s.preventDefault())}),t.addEventListener("pointermove",s=>{s.pointerId===a&&(n=i(s.clientX),At(n,n))});const o=s=>{if(s.pointerId!==a)return;if(a=null,w.classList.remove("kc-dock-resizing"),n<280){G(),window.KantoongChat?.collapse?.();return}const c=O.reduce((d,l)=>Math.abs(A(l)-n)<Math.abs(A(d)-n)?l:d);B({size:c})};t.addEventListener("pointerup",o),t.addEventListener("pointercancel",o),t.addEventListener("keydown",s=>{if(s.key!=="ArrowLeft"&&s.key!=="ArrowRight")return;s.preventDefault();const c=s.key==="ArrowLeft"==(m.side==="right"),d=O.indexOf(m.size)+(c?1:-1);d>=0&&d<O.length&&B({size:O[d]})})}function ae(e){let t="";const a=n=>{n!==t&&(t=n,window.dispatchEvent(new CustomEvent(n?"kantoong:stage-focus":"kantoong:stage-blur",{detail:{id:n}})))};e.addEventListener("pointerover",n=>{if(!w.classList.contains("kc-docked")||n.pointerType==="touch")return;const i=n.target.closest?.("#chatBox [data-product-id]");a(i?String(i.dataset.productId):"")}),e.addEventListener("pointerleave",()=>a(""))}function ne(){const e=document.getElementById("chatPanel");e&&(Ct=e,G(),te(e),ee(e),ae(e),new MutationObserver(q).observe(e,{attributes:!0,attributeFilter:["data-open","data-state","hidden"]}),Et.addEventListener("change",q),q(),window.addEventListener("kantoong:dock-throw",t=>{const a=t.detail?.side==="left"?"left":"right",n=m.size==="float"?{side:a,size:"side"}:{side:a};(n.side!==m.side||n.size)&&B(n)}),window.addEventListener("resize",()=>{w.classList.contains("kc-dock-resizing")||G()}))}const N=window.matchMedia("(hover: hover) and (pointer: fine)"),ie='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="4" width="7.5" height="7.5" rx="2"/><rect x="3" y="14.5" width="7.5" height="5.5" rx="2"/><rect x="13.5" y="14.5" width="7.5" height="5.5" rx="2"/></svg>',st=new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short"}),ct=new Intl.DateTimeFormat("id-ID",{hour:"2-digit",minute:"2-digit"});function p(e,t,a){const n=document.createElement(e);return t&&(n.className=t),a!=null&&(n.textContent=a),n}function oe(e){const t=e.find(n=>n.who==="user");if(!t)return"Chat baru";const a=String(t.text||"").replace(/\s+/g," ").trim();return a||(t.attachments?.length?"Kirim lampiran":"Chat tanpa judul")}function re(){const e=window.KantoongAIBrain,t=e?.getHistory?.()||[],n=(e?.getArchive?.()||[]).map((i,o)=>({index:o,messages:i.messages})).reverse();return n.unshift({index:-1,current:!0,messages:t}),n.map(i=>({...i,title:oe(i.messages),startedAt:Number(i.messages[0]?.timestamp)||Date.now()}))}function se(e){const t=e.who==="user"?"user":"ai",a=p("div",`kc-hcard__msg kc-hcard__msg--${t}`),n=String(e.text||"").trim();n&&a.appendChild(p("p","",n.length>90?`${n.slice(0,90)}…`:n));const i=Array.isArray(e.productIds)?e.productIds.slice(0,3):[];if(i.length){const o=p("div","kc-hcard__products");for(const s of i){const c=window.KantoongAIBrain?.describeProduct?.(s),d=p("span","kc-hcard__product");if(c?.image){const l=document.createElement("img");l.src=c.image,l.alt="",l.loading="lazy",d.appendChild(l)}else d.classList.add("is-gone"),d.title="Produk sudah tidak tersedia";o.appendChild(d)}a.appendChild(o)}return a}function ce(e){const t=p("button","kc-hcard");t.type="button",t.dataset.index=String(e.index),e.current&&t.classList.add("is-current");const a=new Date(e.startedAt);t.setAttribute("aria-label",`${e.current?"Chat sekarang: ":"Buka chat: "}${e.title}, ${st.format(a)} ${ct.format(a)}`);const n=p("span","kc-hcard__preview"),i=p("span","kc-hcard__track");return e.messages.slice(0,14).forEach(o=>i.appendChild(se(o))),n.append(i,p("span","kc-hcard__time",ct.format(a))),e.current&&n.appendChild(p("span","kc-hcard__badge","Sedang dibuka")),t.append(n,p("span","kc-hcard__title",e.title),p("span","kc-hcard__date",st.format(a))),t}function M(e,t){if(!(!e||e.classList.contains("is-live")===t)&&(e.classList.toggle("is-live",t),t)){const a=e.querySelector(".kc-hcard__preview"),n=e.querySelector(".kc-hcard__track"),i=Math.max(0,n.scrollHeight-a.clientHeight+16);e.style.setProperty("--kc-track-dist",`${-i}px`)}}function dt(e){const t=e.getBoundingClientRect(),a=t.top+t.height/2;let n=null,i=1/0;for(const o of e.querySelectorAll(".kc-hcard")){const s=o.getBoundingClientRect(),c=Math.abs(s.top+s.height/2-a);c<i&&(i=c,n=o)}e.querySelectorAll(".kc-hcard.is-live").forEach(o=>{o!==n&&M(o,!1)}),M(n,!0)}function de(){const e=document.getElementById("chatPanel"),t=e?.querySelector(".kc-chatbar");if(!e||!t||e.querySelector(".kc-history"))return;const a=t.querySelector("h2"),n=a?.textContent||"Konsultasi AI",i=p("button","kc-icon-btn kc-history-btn");i.type="button",i.title="Riwayat chat",i.setAttribute("aria-label","Riwayat chat AI"),i.setAttribute("aria-pressed","false"),i.innerHTML=ie,(t.querySelector(".kc-dock-tools")||t.querySelector("#chatCloseBtn"))?.before(i);const o=p("section","kc-history");o.setAttribute("aria-label","Riwayat chat AI");const s=p("div","kc-history__head"),c=p("p","kc-history__note","Obrolan 30 hari terakhir"),d=p("button","kc-history__new","+ Chat baru");d.type="button",s.append(c,d);const l=p("div","kc-history__grid");o.append(s,l),(e.querySelector("#chatBox")||e.lastElementChild).before(o);let h=0;const z=()=>{const u=re();l.replaceChildren(...u.map(ce)),u.length===1&&l.appendChild(p("p","kc-history__empty",'Tekan "+ Chat baru" untuk menyimpan obrolan ini. Obrolan lama akan muncul di sini.')),N.matches||requestAnimationFrame(()=>dt(o))},S=u=>{e.dataset.view=u?"history":"chat",i.setAttribute("aria-pressed",String(u)),a&&(a.textContent=u?"Riwayat Chat AI":n),u&&(z(),o.scrollTop=0)};i.addEventListener("click",()=>S(e.dataset.view!=="history")),d.addEventListener("click",()=>{window.KantoongAIBrain?.newChat?.(),S(!1)}),l.addEventListener("pointerover",u=>{if(!N.matches)return;const k=u.target.closest(".kc-hcard");l.querySelectorAll(".kc-hcard.is-live").forEach(b=>b!==k&&M(b,!1)),M(k,!0)}),l.addEventListener("pointerleave",()=>{N.matches&&l.querySelectorAll(".kc-hcard.is-live").forEach(u=>M(u,!1))}),o.addEventListener("scroll",()=>{N.matches||h||(h=requestAnimationFrame(()=>{h=0,dt(o)}))},{passive:!0}),l.addEventListener("touchstart",u=>{const k=u.target.closest(".kc-hcard");k&&(l.querySelectorAll(".kc-hcard.is-live").forEach(b=>b!==k&&M(b,!1)),M(k,!0))},{passive:!0}),l.addEventListener("click",u=>{const k=u.target.closest(".kc-hcard");k&&(k.classList.add("is-opening"),setTimeout(()=>{const b=Number(k.dataset.index);b>=0&&window.KantoongAIBrain?.openArchived?.(b),S(!1)},240))}),new MutationObserver(()=>{e.dataset.open==="false"&&e.dataset.view==="history"&&S(!1)}).observe(e,{attributes:!0,attributeFilter:["data-open"]}),e.dataset.view="chat"}const $=56,lt=56,ut=8;function le(e){return window.KantoongAIBrain?.findProduct?.(e.dataset.productId)||null}function pt(){return typeof window.KantoongEngine?.addToCart=="function"}function ue(e){const t=Math.sign(e),a=Math.abs(e);return t*lt*(1-Math.exp(-a/(lt*.9)))}function pe(e,t){const a=window.KantoongAIBrain?.describeProduct?.(e.dataset.productId)||{};window.dispatchEvent(new CustomEvent("kantoong:attach-product",{detail:{product:{id:e.dataset.productId,name:a.name||t.name||"",price:Number(t.price??t.harga)||null,image_url:a.image||t.image_url||""}}}))}function me(e){window.KantoongEngine.addToCart(e)}function he(){const e=document.getElementById("chatBox");if(!e||e.dataset.gesturesReady==="true")return;e.dataset.gesturesReady="true";let t=null,a=!1;const n=o=>{o.classList.remove("is-pulling"),o.style.removeProperty("--kc-pull"),delete o.dataset.gesture};e.addEventListener("pointerdown",o=>{if(o.pointerType==="mouse"&&o.button!==0)return;const s=o.target.closest(".ai-product-card[data-product-id]");s&&(t={card:s,id:o.pointerId,x:o.clientX,y:o.clientY,active:!1,dy:0})}),e.addEventListener("pointermove",o=>{if(!t||o.pointerId!==t.id)return;const s=o.clientX-t.x,c=o.clientY-t.y;if(!t.active){if(Math.abs(s)<ut&&Math.abs(c)<ut)return;if(Math.abs(s)>=Math.abs(c)){t=null;return}t.active=!0,t.card.classList.add("is-pulling");try{t.card.setPointerCapture(o.pointerId)}catch{}}t.dy=c>0&&!pt()?0:c;const d=ue(t.dy);t.card.style.setProperty("--kc-pull",`${d.toFixed(1)}px`),t.dy<=-$?t.card.dataset.gesture="up":t.dy>=$?t.card.dataset.gesture="down":t.card.dataset.gesture=t.dy<0?"up-hint":t.dy>0?"down-hint":"",o.preventDefault()});const i=(o,s)=>{if(!t||o.pointerId!==t.id)return;const{card:c,active:d,dy:l}=t;if(t=null,!d)return;a=!0,setTimeout(()=>{a=!1},0);const h=le(c);!s&&h&&l<=-$?(c.classList.add("is-sent-up"),pe(c,h)):!s&&h&&l>=$&&pt()&&(c.classList.add("is-sent-down"),me(h)),n(c),setTimeout(()=>c.classList.remove("is-sent-up","is-sent-down"),520)};e.addEventListener("pointerup",o=>i(o,!1)),e.addEventListener("pointercancel",o=>i(o,!0)),e.addEventListener("click",o=>{!a||!o.target.closest(".ai-product-card")||(o.preventDefault(),o.stopPropagation(),a=!1)},!0),e.addEventListener("dragstart",o=>{o.target.closest?.(".ai-product-card")&&o.preventDefault()})}const Bt=Object.freeze({hadiah:{label:"Hadiah / oleh-oleh",words:["hadiah","kado","oleh","parcel","hampers","ultah","ulang"]},hemat:{label:"Harga hemat",words:["murah","hemat","promo","diskon","voucher","terjangkau","budget"]},sehat:{label:"Sehat / diet",words:["sehat","diet","gula","kalori","protein","vegan","olahraga"]},cepat:{label:"Butuh cepat",words:["cepat","kilat","hari","besok","instan","sameday"]},banyak:{label:"Beli banyak / acara",words:["grosir","banyak","acara","kantor","arisan","reseller","partai"]},rasa:{label:"Cari rasa / varian",words:["rasa","varian","manis","pahit","segar","creamy","baru"]}}),Kt=new Map(Object.entries(Bt).flatMap(([e,t])=>t.words.map(a=>[a,e]))),Tt=new Set(["yang","dan","atau","ada","untuk","dengan","apa","saja","mau","kak","dong","nya","ini","itu","bisa","tolong","produk"]);function ke(e=[]){const t=new Set;for(const a of e)for(const n of`${a.name||""} ${a.category||""}`.toLowerCase().split(/[^a-z]+/))n.length>=3&&!Tt.has(n)&&t.add(n);return t}function fe(e,t=new Set){const a=[];for(const n of String(e||"").toLowerCase().split(/[^a-z]+/)){const i=n==="cokelat"?"coklat":n;if(!(i.length<3||Tt.has(i))&&((t.has(i)||Kt.has(i))&&!a.includes(i)&&a.push(i),a.length===5))break}return a}function mt(e){return Kt.get(e)||null}function ge(e,t,a=new Date){const n=a.getTime()-t*864e5;return e.filter(i=>new Date(i.at).getTime()>=n)}const H=(e,t)=>{const a=new Map;for(const n of e){const i=t(n);i&&a.set(i,(a.get(i)||0)+1)}return a},R=(e,t)=>[...e.entries()].sort((a,n)=>n[1]-a[1]||String(a[0]).localeCompare(String(n[0]))).slice(0,t);function be(e){return(new Date(e).getUTCHours()+7)%24}function qe(e,t=[],{days:a=30,now:n=new Date}={}){const i=ge(e,a,n),o=(r,f)=>t.find(jt=>String(jt.id)===String(r))?.name||f||"Produk",s=r=>i.filter(f=>f.kind===r),c=new Set(i.map(r=>r.session_key)).size,d=s("ask"),l=i.filter(r=>r.product_id&&r.kind!=="cart"),h=s("cart"),z=H(l,r=>String(r.product_id)),S=H(h,r=>String(r.product_id)),u=new Map(i.filter(r=>r.product_id).map(r=>[String(r.product_id),r.product_name])),k=R(z,8).map(([r,f])=>({product_id:r,name:o(r,u.get(r)),count:f,carts:S.get(r)||0})),b=R(z,50).map(([r,f])=>({product_id:r,name:o(r,u.get(r)),count:f,carts:S.get(r)||0})).filter(r=>r.count>=3&&r.carts/r.count<.2).slice(0,5),et=d.flatMap(r=>r.keywords||[]),$t=R(H(et,mt),6).map(([r,f])=>({key:r,label:Bt[r].label,count:f})),Ht=R(H(et.filter(r=>!mt(r)),r=>r),12).map(([r,f])=>({word:r,count:f})),D=Array.from({length:24},()=>0);for(const r of d)D[be(r.at)]+=1;const Rt=D.indexOf(Math.max(...D)),at=new Set(h.map(r=>r.session_key)).size;return{days:a,totals:{sessions:c,asks:d.length,recommends:s("recommend").length,carts:h.length,conversion:c?Math.round(at/c*100):0},funnel:[{key:"ask",label:"Bertanya ke AI",value:new Set(d.map(r=>r.session_key)).size},{key:"recommend",label:"Dapat rekomendasi",value:new Set(s("recommend").map(r=>r.session_key)).size},{key:"view",label:"Melihat produk",value:new Set(i.filter(r=>r.kind==="view"||r.kind==="attach").map(r=>r.session_key)).size},{key:"cart",label:"Masuk keranjang",value:at}],topProducts:k,interestedNotBought:b,needs:$t,keywords:Ht,hours:D,peakHour:d.length?Rt:null}}function ye(e){const t=new Map;for(const a of[...e].sort((n,i)=>new Date(n.at)-new Date(i.at)))t.has(a.session_key)||t.set(a.session_key,`Tamu #${t.size+1}`);return t}const ht={ask:(e,t,a)=>`${e} bertanya${a?` soal ${a}`:""}`,recommend:(e,t)=>`AI merekomendasikan ${t} ke ${e}`,attach:(e,t)=>`${e} menanyakan ${t} lebih lanjut`,view:(e,t)=>`${e} membuka detail ${t}`,cart:(e,t)=>`${e} memasukkan ${t} ke keranjang`};function Fe(e,{products:t=[],labels:a=ye(e),limit:n=30}={}){return[...e].sort((i,o)=>new Date(o.at)-new Date(i.at)).slice(0,n).map(i=>{const o=t.find(c=>String(c.id)===String(i.product_id))?.name||i.product_name||"produk",s=(i.keywords||[]).slice(0,2).join(", ");return{at:i.at,kind:i.kind,text:(ht[i.kind]||ht.ask)(a.get(i.session_key)||"Tamu",o,s)}})}const Pt=4e3,zt=20;let L=[],C=0,F=!1;function we(){try{let e=sessionStorage.getItem("kantoong:ai-session");return e||(e=`s-${Math.random().toString(36).slice(2,10)}${Date.now().toString(36).slice(-4)}`,sessionStorage.setItem("kantoong:ai-session",e)),e}catch{return null}}function ve(){return window.KantoongAIBrain?.getProducts?.()||window.KantoongState?.products||[]}function _e(e,t=""){const a=window.KantoongAIBrain?.findProduct?.(e);return String(a?.name||t||"").slice(0,120)}async function V(){if(clearTimeout(C),C=0,!L.length||F)return;const e=L.splice(0,zt);try{const{error:t}=await E.rpc("log_ai_events",{p:e});t&&(F=!0)}catch{F=!0}L.length&&(C=setTimeout(V,Pt))}function x(e,{productId:t=null,name:a="",keywords:n=[]}={}){if(F)return;const i=we();i&&(L.push({business_id:y.business_id,session_key:i,kind:e,product_id:t?String(t):null,product_name:t?_e(t,a):null,keywords:n,surface:window.KantoongAssistantContext?.surface||"store"}),L.length>=zt?V():C||(C=setTimeout(V,Pt)))}function Se(){window.__kantoongTelemetry||(window.__kantoongTelemetry=!0,window.KantoongAssistantContext?.surface!=="erp"&&(navigator.doNotTrack==="1"||window.doNotTrack==="1"||(window.addEventListener("kantoong:ai-response",e=>{const t=e.detail||{};x("ask",{keywords:fe(t.question,ke(ve()))});for(const a of(t.product_ids||[]).slice(0,6))x("recommend",{productId:a})}),window.addEventListener("kantoong:attach-product",e=>{const t=e.detail?.product;t?.id&&x("attach",{productId:t.id,name:t.name})}),window.addEventListener("kantoong:quickview-opened",e=>{const t=e.detail?.product;t?.id&&x("view",{productId:t.id,name:t.name})}),window.addEventListener("kantoong:cart-add",e=>{const t=e.detail?.product;t?.id&&x("cart",{productId:t.id,name:t.name})}),window.addEventListener("pagehide",V))))}const g=window.KantoongAssistantContext=window.KantoongAssistantContext||{};g.surface||(g.surface=location.pathname.includes("/erp/")?"erp":"store");(g.dock===!1||g.free===!0)&&(document.documentElement.dataset.kcFree="");g.free===!0&&g.dock!==!1&&(document.documentElement.dataset.kcDockable="");function Me(){if(document.getElementById("chatPanel"))return;const e=document.createElement("template");e.innerHTML=Gt.trim();const t=document.getElementById("appRoot");if(t){t.appendChild(e.content);return}const a=document.createElement("div");a.id="kantoongAssistantHost",a.className="kc-host",a.appendChild(e.content),document.body.appendChild(a)}async function Ee(){[...document.styleSheets].some(t=>String(t.href||"").includes("chat-sheet.css"))||document.querySelector('link[href*="chat-sheet.css"], style[data-vite-dev-id*="chat-sheet"]')||await U(()=>Promise.resolve({}),__vite__mapDeps([0]))}async function xe(){try{const{data:e}=await E.auth.getSession(),t=e?.session?.user;if(!t)return null;const a=t.user_metadata||{};return g.userName||(g.userName=String(a.full_name||a.name||"").trim()),t}catch{return null}}async function Ie(){if(!(window.KantoongState||document.getElementById("appRoot")))try{const{data:e}=await E.from("products").select("id, name, price, category, description, image_url").limit(60);window.KantoongState={products:e||[]}}catch{window.KantoongState={products:[]}}}function Dt(...e){const t=new Map;for(const a of e)for(const n of a||[])n&&n.id&&!t.has(n.id)&&t.set(n.id,n);return[...t.values()].sort((a,n)=>Number(a.timestamp)-Number(n.timestamp)).slice(-200)}function kt(e){try{return JSON.parse(localStorage.getItem(e)||"[]")}catch{return[]}}function Ae(){if(P()||document.querySelector(".kc-consent"))return;const e=document.getElementById("chatBox");if(!e)return;const t=document.createElement("div");t.className="kc-consent",t.setAttribute("role","region"),t.setAttribute("aria-label","Izin memori asisten");const a=document.createElement("p");a.textContent="Boleh aku mengingat obrolan kita di semua toko jaringan Kantoong? Jadi saat kamu pindah toko, aku tetap nyambung. Kamu bisa menghapusnya kapan saja lewat menu +.";const n=document.createElement("button");n.type="button",n.className="kc-consent__yes",n.textContent="Ingat di semua toko";const i=document.createElement("button");i.type="button",i.className="kc-consent__no",i.textContent=`Hanya di ${Mt()}`;const o=async c=>{const d=kt(nt());if(Vt(c),t.remove(),c==="network"){const l=Dt(kt(nt()),d);window.KantoongAIBrain?.reload?.(l),await Ot()}else window.KantoongAIBrain?.reload?.()};n.addEventListener("click",()=>o("network")),i.addEventListener("click",()=>o("brand"));const s=document.createElement("div");s.className="kc-consent__actions",s.append(n,i),t.append(a,s),e.before(t)}let _=null,K=!1,ft=0;async function Ot(){if(!_||K||P()!=="network")return;const{data:e,error:t}=await E.from("assistant_memory").select("messages").eq("user_id",_.id).maybeSingle();if(t){K=!0;return}const a=window.KantoongAIBrain?.getHistory?.()||[],n=Dt(a,e?.messages||[]);n.length!==a.length&&window.KantoongAIBrain?.reload?.(n),n.length!==(e?.messages||[]).length&&Nt(n)}function Nt(e){!_||K||P()!=="network"||(clearTimeout(ft),ft=setTimeout(async()=>{const t=(e||[]).slice(-200).map(n=>({id:n.id,who:n.who,text:String(n.text||"").slice(0,3e3),timestamp:n.timestamp,brand:n.brand,surface:n.surface,productIds:n.productIds,attachments:(n.attachments||[]).map(i=>({name:i.name,type:i.type,product:i.product}))})),{error:a}=await E.from("assistant_memory").upsert({user_id:_.id,messages:t,updated_at:new Date().toISOString()});a&&(K=!0)},1500))}window.addEventListener("kantoong:assistant-history",e=>Nt(e.detail?.history));window.addEventListener("kantoong:forget-memory",async()=>{if(window.confirm("Hapus semua memori asisten? Riwayat obrolan di semua toko Kantoong (perangkat ini"+(_?" dan akunmu":"")+") akan dihapus permanen.")){try{Object.keys(localStorage).filter(t=>t.startsWith("kantoong:chat:")).forEach(t=>localStorage.removeItem(t))}catch{}_&&!K&&await E.from("assistant_memory").delete().eq("user_id",_.id),window.KantoongAIBrain?.clearHistory?.()}});let Y=!1;const I=new Set;function tt(e,t){t?I.add(e):I.delete(e),document.body.classList.toggle("kc-overlay-open",I.size>0);const a=window.KantoongChat;a&&(I.size&&!a.isMinimized?.()?(a.minimize(),Y=!0):!I.size&&Y&&(Y=!1,a.restore?.()))}window.addEventListener("kantoong:overlay",e=>tt(e.detail?.name||"lapisan",!!e.detail?.open));window.addEventListener("kantoong:dashboard-opened",()=>tt("dashboard",!0));window.addEventListener("kantoong:dashboard-closed",()=>tt("dashboard",!1));document.addEventListener("click",e=>{if(window.KantoongEngine)return;const t=e.target.closest?.("#chatBox [data-product-id]");t&&(e.preventDefault(),window.open(`/index.html#produk/${encodeURIComponent(t.dataset.productId)}`,"_blank","noopener"))},!0);async function Le(){Me(),await Ee(),_=await xe(),await Ie(),await U(()=>import("./ai-brain-DtvVeUip.js"),__vite__mapDeps([1,2,3])),window.KantoongAIBrain?.init?.(),await U(()=>import("./chat-sheet-C945-KpI.js"),__vite__mapDeps([4,2])),g.startMinimized&&window.KantoongChat?.minimize?.(),g.dock!==!1&&ne(),de(),he(),Se(),Ae(),Ot(),window.dispatchEvent(new CustomEvent("kantoong:assistant-ready",{detail:{surface:g.surface}}))}Le();export{gt as I,Ke as P,qe as a,Fe as b,Te as c,ye as d,J as e,Ne as f,bt as g,Oe as h,De as i,ze as j,Pe as k,He as l,$e as m,Jt as n,Mt as o,nt as p,je as q,Re as s,ge as w};
