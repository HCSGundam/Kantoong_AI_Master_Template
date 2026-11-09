const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/chat-sheet-BHTS7snY.css","assets/ai-brain-BwHkZp3x.js","assets/supabase-client-DvLz8SWw.js","assets/chat-sheet-DlyQynfD.js"])))=>i.map(i=>d[i]);
import{supabase as A}from"./supabase-client-DvLz8SWw.js";const et="modulepreload",tt=function(e){return"/"+e},ue={},Y=function(t,a,n){let i=Promise.resolve();if(a&&a.length>0){let l=function(d){return Promise.all(d.map(m=>Promise.resolve(m).then(y=>({status:"fulfilled",value:y}),y=>({status:"rejected",reason:y}))))};document.getElementsByTagName("link");const r=document.querySelector("meta[property=csp-nonce]"),c=r?.nonce||r?.getAttribute("nonce");i=l(a.map(d=>{if(d=tt(d),d in ue)return;ue[d]=!0;const m=d.endsWith(".css"),y=m?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${d}"]${y}`))return;const p=document.createElement("link");if(p.rel=m?"stylesheet":et,m||(p.as="script"),p.crossOrigin="",p.href=d,c&&p.setAttribute("nonce",c),document.head.appendChild(p),m)return new Promise((u,k)=>{p.addEventListener("load",u),p.addEventListener("error",()=>k(new Error(`Unable to preload CSS for ${d}`)))})}))}function o(r){const c=new Event("vite:preloadError",{cancelable:!0});if(c.payload=r,window.dispatchEvent(c),!c.defaultPrevented)throw r}return i.then(r=>{for(const c of r||[])c.status==="rejected"&&o(c.reason);return t().catch(o)})},w={business_id:"master_template_001",app_name:"Miloat",theme_color_primary:"#111111",filter_by_business_id:!1,use_demo_when_empty:!0,erp_demo:!0,hero:{interval_seconds:5,slides:[{type:"none",src:"",media_label:"Foto / video brand",caption:"Premium collection",title:"Nama produk unggulan",text:"Penjelasan singkat produk atau promo yang ingin ditonjolkan brand.",ai_prompt:""},{type:"none",src:"",media_label:"Foto / video brand",caption:"Terbaru",title:"Koleksi terbaru kami",text:"Tanyakan ke asisten AI untuk dicarikan yang paling cocok.",ai_prompt:"Tolong bantu pilihkan produk terbaru yang cocok untuk saya"}]},brand_slot:{type:"marquee",label:"",speed_seconds:30,items:[{icon:"truck",title:"Pengiriman Cepat",sub:"Aman sampai tujuan"},{icon:"badge",title:"Kualitas Terjamin",sub:"Bahan pilihan terbaik"},{icon:"chat",title:"Konsultasi AI",sub:"Tanya kapan saja"},{icon:"lock",title:"Checkout Aman",sub:"Kamu yang bayar sendiri"}],text:""},featured:{eyebrow:"Produk unggulan",title:"Pilihan Terbaik",description:"Produk andalan yang dipilih langsung oleh toko.",matched_title:"Pilihan AI untuk kamu",limit:8,ask_label:"Konsultasi AI",view:"3d"},shipping:{estimate:"",from:""},rails:[{eyebrow:"Paling laris",title:"Best Seller",description:"Produk yang paling banyak dibeli pelanggan.",sort:"sales",limit:10,min_items:2},{eyebrow:"Favorit pembeli",title:"Paling Banyak Di-wishlist",description:"Produk yang paling sering disimpan pembeli.",sort:"wishlist",limit:10,min_items:2},{eyebrow:"Baru datang",title:"Produk Terbaru",description:"Koleksi terbaru yang baru masuk toko.",sort:"newest",limit:10,min_items:2}],testimonials:[],categories:{enabled:!0,title:"Kategori lain"},ai_name:"Asisten",ai_title:"Halo Kak!",ai_endpoint:"/api/chat",ai_greetings:["Mau cari produk yang cocok untuk kebutuhanmu?","Bingung memilih? Ceritakan kebutuhanmu, aku carikan."],ai_suggestions:["Bantu pilihkan sesuai kebutuhan saya","Rekomendasi budget di bawah 500 ribu","Apa produk yang paling banyak dipilih?","Cari produk yang paling hemat","Aku bingung mau pilih yang mana","Ada produk baru apa saja?","Bandingkan produk unggulan untukku","Cari hadiah untuk orang tersayang"],demo_products:[{id:"demo-1",name:"Produk Contoh Satu",price:125e4,category:"kategori a",sales_count:40,image_url:""},{id:"demo-2",name:"Produk Contoh Dua",price:75e4,category:"kategori a",sales_count:32,image_url:""},{id:"demo-3",name:"Produk Contoh Tiga",price:45e4,category:"kategori b",sales_count:25,image_url:""},{id:"demo-4",name:"Produk Contoh Empat",price:23e5,category:"kategori b",sales_count:18,image_url:""},{id:"demo-5",name:"Produk Contoh Lima",price:32e4,category:"kategori a",sales_count:9,image_url:""},{id:"demo-6",name:"Produk Contoh Enam",price:98e4,category:"kategori b",sales_count:4,image_url:""}]};typeof window<"u"&&(window.KantoongConfig=w);const ea=["id","name","price","stock","category","image_url","created_at","business_id","caption","description","sales_count","is_published","is_featured","is_hero","hero_caption","hero_text","compare_at_price","ship_estimate","ship_from","video_url","gallery","hero_image_url","sku","barcode","rating_avg","review_count"].join(", "),N=w?.business_id??"master_template_001",ne=`kantoong:storefront:${N}`,at="kantoong-storefront",Ce=Object.freeze([{kind:"terlaris",label:"Terlaris"},{kind:"terbaru",label:"Terbaru"},{kind:"promo",label:"Promo"},{kind:"termurah",label:"Termurah"},{kind:"rating",label:"Rating 4+"},{kind:"ready",label:"Ready stok"},{kind:"under",label:"Di bawah",needsValue:"price"},{kind:"keyword",label:"Kata kunci",needsValue:"text"}]),nt=Object.freeze(["terlaris","terbaru","promo","termurah","rating"]),E=(e,t=80)=>String(e??"").trim().slice(0,t);function Ae(){return{brand:{name:E(w?.app_name)||"Toko",tagline:""},catalog:{categories:{},chips:{},chipLimit:6}}}function it(e){const t=Ce.find(n=>n.kind===e?.kind);if(!t)return null;const a={kind:t.kind,label:E(e.label,30)||t.label};if(t.needsValue==="price"){const n=Math.max(0,Math.round(Number(e.value)||0));if(!n)return null;a.value=n}if(t.needsValue==="text"){const n=E(e.value,40);if(!n)return null;a.value=n}return a}function ie(e){const t=Ae(),a=e?.brand??{},n=e?.catalog??{},i={};Object.entries(n.categories??{}).forEach(([r,c])=>{const l=E(r,60);l&&(i[l]={label:E(c?.label,40),order:Number.isFinite(Number(c?.order))?Number(c.order):999,hidden:c?.hidden===!0})});const o={};return Object.entries(n.chips??{}).forEach(([r,c])=>{Array.isArray(c)&&(o[E(r,60)]=c.map(it).filter(Boolean).slice(0,20))}),{brand:{name:E(a.name,60)||t.brand.name,tagline:E(a.tagline,120)},catalog:{categories:i,chips:o,chipLimit:Math.min(20,Math.max(1,Math.round(Number(n.chipLimit)||t.catalog.chipLimit)))}}}function ot(e,t){return e?.catalog?.categories?.[t]?.label||t||"Lainnya"}function ta(e,t){const a=[...new Set((e??[]).map(i=>E(i.category,60)||"Lainnya"))],n=t?.catalog?.categories??{};return a.filter(i=>n[i]?.hidden!==!0).sort((i,o)=>(n[i]?.order??999)-(n[o]?.order??999)||i.localeCompare(o,"id")).map(i=>({key:i,label:ot(t,i)}))}function aa(e,t){const a=e?.catalog?.chips?.[t];return(Array.isArray(a)&&a.length?a:e?.catalog?.chips?.["*"]??nt.map(i=>({kind:i,label:Ce.find(o=>o.kind===i).label}))).slice(0,e?.catalog?.chipLimit??6)}const R=e=>Number(e?.price)||0;function na(e,t){const a=(e??[]).slice();if(!t)return a;switch(t.kind){case"terlaris":return a.sort((n,i)=>(Number(i.sales_count)||0)-(Number(n.sales_count)||0));case"terbaru":return a.sort((n,i)=>new Date(i.created_at??0)-new Date(n.created_at??0));case"promo":return a.filter(n=>Number(n.compare_at_price)>R(n));case"termurah":return a.sort((n,i)=>R(n)-R(i));case"rating":return a.filter(n=>Number(n.rating_avg)>=4);case"ready":return a.filter(n=>n.stock===null||n.stock===void 0||Number(n.stock)>0);case"under":return a.filter(n=>R(n)<=Number(t.value));case"keyword":{const n=String(t.value).toLowerCase();return a.filter(i=>[i.name,i.caption,i.description].join(" ").toLowerCase().includes(n))}default:return a}}function ia(e){if(e.kind==="under"&&e.value){const t=Number(e.value);return`${e.label||"Di bawah"} ${t>=1e3?`${Math.round(t/1e3)}rb`:t}`}return e.kind==="keyword"&&e.label==="Kata kunci"?e.value:e.label}function Ie(){try{return ie(JSON.parse(localStorage.getItem(ne)||"null"))}catch{return Ae()}}function rt(e){try{localStorage.setItem(ne,JSON.stringify(e))}catch{}}let f=Ie();w&&f.brand.name&&(w.app_name=f.brand.name);const te=new Set;let J=null;try{J=typeof BroadcastChannel<"u"?new BroadcastChannel(at):null}catch{J=null}function T(e,{broadcast:t=!0}={}){f=ie(e),w&&(w.app_name=f.brand.name),rt(f),t&&J?.postMessage(f),te.forEach(a=>{try{a(f)}catch(n){console.warn("[KANTOONG] Pendengar etalase gagal:",n)}}),typeof window<"u"&&window.dispatchEvent(new CustomEvent("kantoong:storefront-changed",{detail:f}))}function oa(){return f}let Q=null;function oe(){return Q||(Q=Y(()=>import("./supabase-client-DvLz8SWw.js"),[]).then(e=>e.supabase).catch(()=>null)),Q}async function st(){try{const e=await oe();if(!e)return f;const{data:t,error:a}=await e.from("storefront_settings").select("settings").eq("business_id",N).maybeSingle();if(a)throw a;t?.settings&&T(t.settings)}catch(e){console.info("[KANTOONG] Pengaturan etalase memakai salinan lokal:",e?.message||e)}return f}async function ra(e,t,{demo:a=!1}={}){if(e!=="brand"&&e!=="catalog")throw new Error("Bagian tidak dikenal.");const n=ie({...f,[e]:t});if(!a){const i=await oe();if(!i)throw new Error("Tidak tersambung ke server.");const{data:o,error:r}=await i.rpc("storefront_save",{p_business_id:N,p_section:e,p_value:n[e]});if(r)throw r;if(o?.error)throw new Error(o.error)}return T(n),f}function sa(e){return te.add(e),()=>te.delete(e)}let me=!1;async function ca(){if(!me){me=!0,J?.addEventListener("message",e=>T(e.data,{broadcast:!1})),window.addEventListener("storage",e=>{e.key===ne&&T(Ie(),{broadcast:!1})}),await st();try{(await oe())?.channel(`storefront:${N}`).on("postgres_changes",{event:"*",schema:"public",table:"storefront_settings",filter:`business_id=eq.${N}`},t=>{t.new?.settings&&T(t.new.settings)}).subscribe()}catch{}}}const re="kantoong:theme",ct=Object.freeze([{id:"store",label:"Toko & halaman produk"},{id:"dashboard",label:"Dashboard pribadi"},{id:"erp",label:"Dashboard admin (ERP)"},{id:"pos",label:"Kasir POS"}]),dt=Object.freeze([{id:"light",label:"Terang"},{id:"dark",label:"Gelap"},{id:"system",label:"Ikuti perangkat"}]),lt=new Set(dt.map(e=>e.id));function Le(){return{mode:"all",all:"system",areas:{store:"system",dashboard:"system",erp:"system",pos:"system"}}}function se(e){const t=Le();if(!e||typeof e!="object")return t;const a=(n,i)=>lt.has(n)?n:i;return{mode:e.mode==="per-area"?"per-area":"all",all:a(e.all,t.all),areas:Object.fromEntries(ct.map(n=>[n.id,a(e.areas?.[n.id],t.areas[n.id])]))}}function ut(e,t){const a=se(e);return a.mode==="all"?a.all:a.areas[t]??a.all}function mt(e,t,a=!1){const n=ut(e,t);return n==="system"?a?"dark":"light":n}function Te(){try{return se(JSON.parse(localStorage.getItem(re)||"null"))}catch{return Le()}}function ht(e){const t=se(e);try{localStorage.setItem(re,JSON.stringify(t))}catch{}return window.dispatchEvent(new CustomEvent("kantoong:theme-changed",{detail:t})),t}const Pe=typeof window<"u"&&window.matchMedia?window.matchMedia("(prefers-color-scheme: dark)"):null;let S=null;function pt(e){return mt(Te(),e,!!Pe?.matches)}function V(e){S=e;const t=pt(e),a=document.documentElement;return a.dataset.theme!==t&&(a.classList.add("kc-theme-switching"),a.dataset.theme=t,a.style.colorScheme=t,setTimeout(()=>a.classList.remove("kc-theme-switching"),350)),window.dispatchEvent(new CustomEvent("kantoong:theme-applied",{detail:{area:e,theme:t}})),t}function da(e,t){const a=Te();a.mode==="all"?a.all=t:a.areas[e]=t,ht(a),S&&V(S)}typeof window<"u"&&(window.addEventListener("storage",e=>{e.key===re&&S&&V(S)}),window.addEventListener("kantoong:theme-changed",()=>{S&&V(S)}),Pe?.addEventListener?.("change",()=>{S&&V(S)}));const gt=`
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
`,ae="kantoong:assistant:memory-scope",Be=Object.freeze({store:"toko",cart:"keranjang",product:"halaman produk",dashboard:"dashboard pengguna",erp:"dashboard kerja ERP"});function D(){try{const e=localStorage.getItem(ae);return e==="network"||e==="brand"?e:null}catch{return null}}function kt(e){try{e==="network"||e==="brand"?localStorage.setItem(ae,e):localStorage.removeItem(ae)}catch{}}function Ke(){return String(w?.business_id||w?.businessId||"default")}function Ne(){return String(w?.app_name||"Kantoong")}function he(){return D()==="network"?"kantoong:chat:network":`kantoong:chat:${Ke()}`}function ft(){const e=window.KantoongAssistantContext?.surface;if(e&&Be[e]){if(e==="store"){if(document.querySelector(".cart-page.is-open, #cartPage.is-open"))return"cart";if(location.hash.startsWith("#produk/"))return"product";if(document.body.classList.contains("dashboard-open"))return"dashboard"}return e}return location.pathname.includes("/erp/")?"erp":"store"}function bt(){const e=window.KantoongAssistantContext?.page;return typeof e=="function"?String(e()||"").slice(0,120):e?String(e).slice(0,120):location.hash.startsWith("#produk/")?`halaman produk "${document.title.split(" · ")[0]}"`:location.pathname.includes("/erp/")?`menu ERP "${document.title.split(" — ")[0]}"`:""}function la(){const e=window.KantoongAssistantContext||{},t=ft();return{surface:t,surface_label:Be[t]||t,brand:Ne(),brand_id:Ke(),user_name:String(e.userName||"").slice(0,60),network_memory:D()==="network",page_title:String(document.title||"").slice(0,80),page:bt()}}const Oe=window.matchMedia("(min-width: 900px)"),_=document.documentElement,ze="kantoong:assistant-dock",De=["float","side","half"],$=["side","half"],pe={float:"Melayang di atas halaman",side:"Chat di samping",half:"Belah layar dua"},wt={float:'<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="7" y="11" width="10" height="5" rx="1.5"/>',side:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M15 5v14"/>',half:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/>'},yt='<path d="M7 7h12l-3-3M17 17H5l3 3"/>';function vt(){try{const e=JSON.parse(localStorage.getItem(ze)||"{}");return{side:e.side==="left"?"left":"right",size:De.includes(e.size)?e.size:"side"}}catch{return{side:"right",size:"side"}}}const g=vt();function _t(){try{localStorage.setItem(ze,JSON.stringify(g))}catch{}}function P(e){const t=window.innerWidth;return Math.round(e==="half"?t/2:Math.min(440,Math.max(360,t*.32)))}function He(e,t){_.style.setProperty("--kc-dock-w",`${Math.round(e)}px`),_.style.setProperty("--kc-dock-pad",`${Math.round(t)}px`)}let ge=0;function Re(){clearTimeout(ge),ge=setTimeout(()=>window.dispatchEvent(new Event("resize")),320)}function X(){_.dataset.kcDockSide=g.side,_.dataset.kcDockSize=g.size,He(P(g.size),P(g.size)),document.querySelectorAll(".kc-dock-tool[data-kc-dock-size]").forEach(e=>{e.setAttribute("aria-pressed",String(e.dataset.kcDockSize===g.size))})}function O(e){Object.assign(g,e),_t(),X(),G(),Re()}let $e=null;function G(){const e=$e;if(!e)return;const t=Oe.matches&&g.size!=="float"&&!e.hidden&&e.dataset.state!=="peek"&&e.dataset.open==="true";_.classList.contains("kc-docked")!==t&&(_.classList.toggle("kc-docked",t),e.classList.toggle("kc-sheet--docked",t),Re())}function ke(e){return`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${e}</svg>`}function St(e){const t=e.querySelector(".kc-chatbar");if(!t||t.querySelector(".kc-dock-tools"))return;const a=document.createElement("div");a.className="kc-dock-tools",a.setAttribute("role","group"),a.setAttribute("aria-label","Ukuran chat");for(const i of De){const o=document.createElement("button");o.type="button",o.className="kc-dock-tool",o.dataset.kcDockSize=i,o.title=pe[i],o.setAttribute("aria-label",pe[i]),o.innerHTML=ke(wt[i]),o.addEventListener("click",()=>O({size:i})),a.appendChild(o)}const n=document.createElement("button");n.type="button",n.className="kc-dock-tool kc-dock-swap",n.title="Pindah sisi",n.setAttribute("aria-label","Pindahkan chat ke sisi lain"),n.innerHTML=ke(yt),n.addEventListener("click",()=>O({side:g.side==="right"?"left":"right"})),a.appendChild(n),t.querySelector("#chatCloseBtn")?.before(a)}function Et(e){if(e.querySelector(".kc-dock-edge"))return;const t=document.createElement("div");t.className="kc-dock-edge",t.tabIndex=0,t.title="Tarik untuk mengubah lebar chat",t.setAttribute("role","separator"),t.setAttribute("aria-orientation","vertical"),t.setAttribute("aria-label","Ubah lebar chat (panah kiri/kanan)"),e.appendChild(t);let a=null,n=0;const i=r=>{const c=window.innerWidth,l=g.side==="right"?c-r+8:r+8;return Math.min(c*.7,Math.max(200,l))};t.addEventListener("pointerdown",r=>{r.button>0||(a=r.pointerId,n=P(g.size),t.setPointerCapture?.(a),_.classList.add("kc-dock-resizing"),r.preventDefault())}),t.addEventListener("pointermove",r=>{r.pointerId===a&&(n=i(r.clientX),He(n,n))});const o=r=>{if(r.pointerId!==a)return;if(a=null,_.classList.remove("kc-dock-resizing"),n<280){X(),window.KantoongChat?.collapse?.();return}const c=$.reduce((l,d)=>Math.abs(P(d)-n)<Math.abs(P(l)-n)?d:l);O({size:c})};t.addEventListener("pointerup",o),t.addEventListener("pointercancel",o),t.addEventListener("keydown",r=>{if(r.key!=="ArrowLeft"&&r.key!=="ArrowRight")return;r.preventDefault();const c=r.key==="ArrowLeft"==(g.side==="right"),l=$.indexOf(g.size)+(c?1:-1);l>=0&&l<$.length&&O({size:$[l]})})}function Mt(e){let t="";const a=n=>{n!==t&&(t=n,window.dispatchEvent(new CustomEvent(n?"kantoong:stage-focus":"kantoong:stage-blur",{detail:{id:n}})))};e.addEventListener("pointerover",n=>{if(!_.classList.contains("kc-docked")||n.pointerType==="touch")return;const i=n.target.closest?.("#chatBox [data-product-id]");a(i?String(i.dataset.productId):"")}),e.addEventListener("pointerleave",()=>a(""))}function xt(){const e=document.getElementById("chatPanel");e&&($e=e,X(),St(e),Et(e),Mt(e),new MutationObserver(G).observe(e,{attributes:!0,attributeFilter:["data-open","data-state","hidden"]}),Oe.addEventListener("change",G),G(),window.addEventListener("kantoong:dock-throw",t=>{const a=t.detail?.side==="left"?"left":"right",n=g.size==="float"?{side:a,size:"side"}:{side:a};(n.side!==g.side||n.size)&&O(n)}),window.addEventListener("resize",()=>{_.classList.contains("kc-dock-resizing")||X()}))}const j=window.matchMedia("(hover: hover) and (pointer: fine)"),Ct='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="4" width="7.5" height="7.5" rx="2"/><rect x="3" y="14.5" width="7.5" height="5.5" rx="2"/><rect x="13.5" y="14.5" width="7.5" height="5.5" rx="2"/></svg>',fe=new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short"}),be=new Intl.DateTimeFormat("id-ID",{hour:"2-digit",minute:"2-digit"});function h(e,t,a){const n=document.createElement(e);return t&&(n.className=t),a!=null&&(n.textContent=a),n}function At(e){const t=e.find(n=>n.who==="user");if(!t)return"Chat baru";const a=String(t.text||"").replace(/\s+/g," ").trim();return a||(t.attachments?.length?"Kirim lampiran":"Chat tanpa judul")}function It(){const e=window.KantoongAIBrain,t=e?.getHistory?.()||[],n=(e?.getArchive?.()||[]).map((i,o)=>({index:o,messages:i.messages})).reverse();return n.unshift({index:-1,current:!0,messages:t}),n.map(i=>({...i,title:At(i.messages),startedAt:Number(i.messages[0]?.timestamp)||Date.now()}))}function Lt(e){const t=e.who==="user"?"user":"ai",a=h("div",`kc-hcard__msg kc-hcard__msg--${t}`),n=String(e.text||"").trim();n&&a.appendChild(h("p","",n.length>90?`${n.slice(0,90)}…`:n));const i=Array.isArray(e.productIds)?e.productIds.slice(0,3):[];if(i.length){const o=h("div","kc-hcard__products");for(const r of i){const c=window.KantoongAIBrain?.describeProduct?.(r),l=h("span","kc-hcard__product");if(c?.image){const d=document.createElement("img");d.src=c.image,d.alt="",d.loading="lazy",l.appendChild(d)}else l.classList.add("is-gone"),l.title="Produk sudah tidak tersedia";o.appendChild(l)}a.appendChild(o)}return a}function Tt(e){const t=h("button","kc-hcard");t.type="button",t.dataset.index=String(e.index),e.current&&t.classList.add("is-current");const a=new Date(e.startedAt);t.setAttribute("aria-label",`${e.current?"Chat sekarang: ":"Buka chat: "}${e.title}, ${fe.format(a)} ${be.format(a)}`);const n=h("span","kc-hcard__preview"),i=h("span","kc-hcard__track");return e.messages.slice(0,14).forEach(o=>i.appendChild(Lt(o))),n.append(i,h("span","kc-hcard__time",be.format(a))),e.current&&n.appendChild(h("span","kc-hcard__badge","Sedang dibuka")),t.append(n,h("span","kc-hcard__title",e.title),h("span","kc-hcard__date",fe.format(a))),t}function C(e,t){if(!(!e||e.classList.contains("is-live")===t)&&(e.classList.toggle("is-live",t),t)){const a=e.querySelector(".kc-hcard__preview"),n=e.querySelector(".kc-hcard__track"),i=Math.max(0,n.scrollHeight-a.clientHeight+16);e.style.setProperty("--kc-track-dist",`${-i}px`)}}function we(e){const t=e.getBoundingClientRect(),a=t.top+t.height/2;let n=null,i=1/0;for(const o of e.querySelectorAll(".kc-hcard")){const r=o.getBoundingClientRect(),c=Math.abs(r.top+r.height/2-a);c<i&&(i=c,n=o)}e.querySelectorAll(".kc-hcard.is-live").forEach(o=>{o!==n&&C(o,!1)}),C(n,!0)}function Pt(){const e=document.getElementById("chatPanel"),t=e?.querySelector(".kc-chatbar");if(!e||!t||e.querySelector(".kc-history"))return;const a=t.querySelector("h2"),n=a?.textContent||"Konsultasi AI",i=h("button","kc-icon-btn kc-history-btn");i.type="button",i.title="Riwayat chat",i.setAttribute("aria-label","Riwayat chat AI"),i.setAttribute("aria-pressed","false"),i.innerHTML=Ct,(t.querySelector(".kc-dock-tools")||t.querySelector("#chatCloseBtn"))?.before(i);const o=h("section","kc-history");o.setAttribute("aria-label","Riwayat chat AI");const r=h("div","kc-history__head"),c=h("p","kc-history__note","Obrolan 30 hari terakhir"),l=h("button","kc-history__new","+ Chat baru");l.type="button",r.append(c,l);const d=h("div","kc-history__grid");o.append(r,d),(e.querySelector("#chatBox")||e.lastElementChild).before(o);let m=0;const y=()=>{const u=It();d.replaceChildren(...u.map(Tt)),u.length===1&&d.appendChild(h("p","kc-history__empty",'Tekan "+ Chat baru" untuk menyimpan obrolan ini. Obrolan lama akan muncul di sini.')),j.matches||requestAnimationFrame(()=>we(o))},p=u=>{e.dataset.view=u?"history":"chat",i.setAttribute("aria-pressed",String(u)),a&&(a.textContent=u?"Riwayat Chat AI":n),u&&(y(),o.scrollTop=0)};i.addEventListener("click",()=>p(e.dataset.view!=="history")),l.addEventListener("click",()=>{window.KantoongAIBrain?.newChat?.(),p(!1)}),d.addEventListener("pointerover",u=>{if(!j.matches)return;const k=u.target.closest(".kc-hcard");d.querySelectorAll(".kc-hcard.is-live").forEach(v=>v!==k&&C(v,!1)),C(k,!0)}),d.addEventListener("pointerleave",()=>{j.matches&&d.querySelectorAll(".kc-hcard.is-live").forEach(u=>C(u,!1))}),o.addEventListener("scroll",()=>{j.matches||m||(m=requestAnimationFrame(()=>{m=0,we(o)}))},{passive:!0}),d.addEventListener("touchstart",u=>{const k=u.target.closest(".kc-hcard");k&&(d.querySelectorAll(".kc-hcard.is-live").forEach(v=>v!==k&&C(v,!1)),C(k,!0))},{passive:!0}),d.addEventListener("click",u=>{const k=u.target.closest(".kc-hcard");k&&(k.classList.add("is-opening"),setTimeout(()=>{const v=Number(k.dataset.index);v>=0&&window.KantoongAIBrain?.openArchived?.(v),p(!1)},240))}),new MutationObserver(()=>{e.dataset.open==="false"&&e.dataset.view==="history"&&p(!1)}).observe(e,{attributes:!0,attributeFilter:["data-open"]}),e.dataset.view="chat"}const q=56,ye=56,ve=8;function Bt(e){return window.KantoongAIBrain?.findProduct?.(e.dataset.productId)||null}function _e(){return typeof window.KantoongEngine?.addToCart=="function"}function Kt(e){const t=Math.sign(e),a=Math.abs(e);return t*ye*(1-Math.exp(-a/(ye*.9)))}function Nt(e,t){const a=window.KantoongAIBrain?.describeProduct?.(e.dataset.productId)||{};window.dispatchEvent(new CustomEvent("kantoong:attach-product",{detail:{product:{id:e.dataset.productId,name:a.name||t.name||"",price:Number(t.price??t.harga)||null,image_url:a.image||t.image_url||""}}}))}function Ot(e){window.KantoongEngine.addToCart(e)}function zt(){const e=document.getElementById("chatBox");if(!e||e.dataset.gesturesReady==="true")return;e.dataset.gesturesReady="true";let t=null,a=!1;const n=o=>{o.classList.remove("is-pulling"),o.style.removeProperty("--kc-pull"),delete o.dataset.gesture};e.addEventListener("pointerdown",o=>{if(o.pointerType==="mouse"&&o.button!==0)return;const r=o.target.closest(".ai-product-card[data-product-id]");r&&(t={card:r,id:o.pointerId,x:o.clientX,y:o.clientY,active:!1,dy:0})}),e.addEventListener("pointermove",o=>{if(!t||o.pointerId!==t.id)return;const r=o.clientX-t.x,c=o.clientY-t.y;if(!t.active){if(Math.abs(r)<ve&&Math.abs(c)<ve)return;if(Math.abs(r)>=Math.abs(c)){t=null;return}t.active=!0,t.card.classList.add("is-pulling");try{t.card.setPointerCapture(o.pointerId)}catch{}}t.dy=c>0&&!_e()?0:c;const l=Kt(t.dy);t.card.style.setProperty("--kc-pull",`${l.toFixed(1)}px`),t.dy<=-q?t.card.dataset.gesture="up":t.dy>=q?t.card.dataset.gesture="down":t.card.dataset.gesture=t.dy<0?"up-hint":t.dy>0?"down-hint":"",o.preventDefault()});const i=(o,r)=>{if(!t||o.pointerId!==t.id)return;const{card:c,active:l,dy:d}=t;if(t=null,!l)return;a=!0,setTimeout(()=>{a=!1},0);const m=Bt(c);!r&&m&&d<=-q?(c.classList.add("is-sent-up"),Nt(c,m)):!r&&m&&d>=q&&_e()&&(c.classList.add("is-sent-down"),Ot(m)),n(c),setTimeout(()=>c.classList.remove("is-sent-up","is-sent-down"),520)};e.addEventListener("pointerup",o=>i(o,!1)),e.addEventListener("pointercancel",o=>i(o,!0)),e.addEventListener("click",o=>{!a||!o.target.closest(".ai-product-card")||(o.preventDefault(),o.stopPropagation(),a=!1)},!0),e.addEventListener("dragstart",o=>{o.target.closest?.(".ai-product-card")&&o.preventDefault()})}const je=Object.freeze({hadiah:{label:"Hadiah / oleh-oleh",words:["hadiah","kado","oleh","parcel","hampers","ultah","ulang"]},hemat:{label:"Harga hemat",words:["murah","hemat","promo","diskon","voucher","terjangkau","budget"]},sehat:{label:"Sehat / diet",words:["sehat","diet","gula","kalori","protein","vegan","olahraga"]},cepat:{label:"Butuh cepat",words:["cepat","kilat","hari","besok","instan","sameday"]},banyak:{label:"Beli banyak / acara",words:["grosir","banyak","acara","kantor","arisan","reseller","partai"]},rasa:{label:"Cari rasa / varian",words:["rasa","varian","manis","pahit","segar","creamy","baru"]}}),qe=new Map(Object.entries(je).flatMap(([e,t])=>t.words.map(a=>[a,e]))),Fe=new Set(["yang","dan","atau","ada","untuk","dengan","apa","saja","mau","kak","dong","nya","ini","itu","bisa","tolong","produk"]);function Dt(e=[]){const t=new Set;for(const a of e)for(const n of`${a.name||""} ${a.category||""}`.toLowerCase().split(/[^a-z]+/))n.length>=3&&!Fe.has(n)&&t.add(n);return t}function Ht(e,t=new Set){const a=[];for(const n of String(e||"").toLowerCase().split(/[^a-z]+/)){const i=n==="cokelat"?"coklat":n;if(!(i.length<3||Fe.has(i))&&((t.has(i)||qe.has(i))&&!a.includes(i)&&a.push(i),a.length===5))break}return a}function Se(e){return qe.get(e)||null}function Rt(e,t,a=new Date){const n=a.getTime()-t*864e5;return e.filter(i=>new Date(i.at).getTime()>=n)}const F=(e,t)=>{const a=new Map;for(const n of e){const i=t(n);i&&a.set(i,(a.get(i)||0)+1)}return a},U=(e,t)=>[...e.entries()].sort((a,n)=>n[1]-a[1]||String(a[0]).localeCompare(String(n[0]))).slice(0,t);function $t(e){return(new Date(e).getUTCHours()+7)%24}function ua(e,t=[],{days:a=30,now:n=new Date}={}){const i=Rt(e,a,n),o=(s,b)=>t.find(Qe=>String(Qe.id)===String(s))?.name||b||"Produk",r=s=>i.filter(b=>b.kind===s),c=new Set(i.map(s=>s.session_key)).size,l=r("ask"),d=i.filter(s=>s.product_id&&s.kind!=="cart"),m=r("cart"),y=F(d,s=>String(s.product_id)),p=F(m,s=>String(s.product_id)),u=new Map(i.filter(s=>s.product_id).map(s=>[String(s.product_id),s.product_name])),k=U(y,8).map(([s,b])=>({product_id:s,name:o(s,u.get(s)),count:b,carts:p.get(s)||0})),v=U(y,50).map(([s,b])=>({product_id:s,name:o(s,u.get(s)),count:b,carts:p.get(s)||0})).filter(s=>s.count>=3&&s.carts/s.count<.2).slice(0,5),de=l.flatMap(s=>s.keywords||[]),Je=U(F(de,Se),6).map(([s,b])=>({key:s,label:je[s].label,count:b})),Xe=U(F(de.filter(s=>!Se(s)),s=>s),12).map(([s,b])=>({word:s,count:b})),H=Array.from({length:24},()=>0);for(const s of l)H[$t(s.at)]+=1;const Ze=H.indexOf(Math.max(...H)),le=new Set(m.map(s=>s.session_key)).size;return{days:a,totals:{sessions:c,asks:l.length,recommends:r("recommend").length,carts:m.length,conversion:c?Math.round(le/c*100):0},funnel:[{key:"ask",label:"Bertanya ke AI",value:new Set(l.map(s=>s.session_key)).size},{key:"recommend",label:"Dapat rekomendasi",value:new Set(r("recommend").map(s=>s.session_key)).size},{key:"view",label:"Melihat produk",value:new Set(i.filter(s=>s.kind==="view"||s.kind==="attach").map(s=>s.session_key)).size},{key:"cart",label:"Masuk keranjang",value:le}],topProducts:k,interestedNotBought:v,needs:Je,keywords:Xe,hours:H,peakHour:l.length?Ze:null}}function jt(e){const t=new Map;for(const a of[...e].sort((n,i)=>new Date(n.at)-new Date(i.at)))t.has(a.session_key)||t.set(a.session_key,`Tamu #${t.size+1}`);return t}const Ee={ask:(e,t,a)=>`${e} bertanya${a?` soal ${a}`:""}`,recommend:(e,t)=>`AI merekomendasikan ${t} ke ${e}`,attach:(e,t)=>`${e} menanyakan ${t} lebih lanjut`,view:(e,t)=>`${e} membuka detail ${t}`,cart:(e,t)=>`${e} memasukkan ${t} ke keranjang`};function ma(e,{products:t=[],labels:a=jt(e),limit:n=30}={}){return[...e].sort((i,o)=>new Date(o.at)-new Date(i.at)).slice(0,n).map(i=>{const o=t.find(c=>String(c.id)===String(i.product_id))?.name||i.product_name||"produk",r=(i.keywords||[]).slice(0,2).join(", ");return{at:i.at,kind:i.kind,text:(Ee[i.kind]||Ee.ask)(a.get(i.session_key)||"Tamu",o,r)}})}const Ue=4e3,Ve=20;let B=[],K=0,W=!1;function qt(){try{let e=sessionStorage.getItem("kantoong:ai-session");return e||(e=`s-${Math.random().toString(36).slice(2,10)}${Date.now().toString(36).slice(-4)}`,sessionStorage.setItem("kantoong:ai-session",e)),e}catch{return null}}function Ft(){return window.KantoongAIBrain?.getProducts?.()||window.KantoongState?.products||[]}function Ut(e,t=""){const a=window.KantoongAIBrain?.findProduct?.(e);return String(a?.name||t||"").slice(0,120)}async function Z(){if(clearTimeout(K),K=0,!B.length||W)return;const e=B.splice(0,Ve);try{const{error:t}=await A.rpc("log_ai_events",{p:e});t&&(W=!0)}catch{W=!0}B.length&&(K=setTimeout(Z,Ue))}function I(e,{productId:t=null,name:a="",keywords:n=[]}={}){if(W)return;const i=qt();i&&(B.push({business_id:w.business_id,session_key:i,kind:e,product_id:t?String(t):null,product_name:t?Ut(t,a):null,keywords:n,surface:window.KantoongAssistantContext?.surface||"store"}),B.length>=Ve?Z():K||(K=setTimeout(Z,Ue)))}function Vt(){window.__kantoongTelemetry||(window.__kantoongTelemetry=!0,window.KantoongAssistantContext?.surface!=="erp"&&(navigator.doNotTrack==="1"||window.doNotTrack==="1"||(window.addEventListener("kantoong:ai-response",e=>{const t=e.detail||{};I("ask",{keywords:Ht(t.question,Dt(Ft()))});for(const a of(t.product_ids||[]).slice(0,6))I("recommend",{productId:a})}),window.addEventListener("kantoong:attach-product",e=>{const t=e.detail?.product;t?.id&&I("attach",{productId:t.id,name:t.name})}),window.addEventListener("kantoong:quickview-opened",e=>{const t=e.detail?.product;t?.id&&I("view",{productId:t.id,name:t.name})}),window.addEventListener("kantoong:cart-add",e=>{const t=e.detail?.product;t?.id&&I("cart",{productId:t.id,name:t.name})}),window.addEventListener("pagehide",Z))))}const M=window.KantoongAssistantContext=window.KantoongAssistantContext||{};M.surface||(M.surface=location.pathname.includes("/erp/")?"erp":"store");M.dock===!1&&(document.documentElement.dataset.kcFree="");function Gt(){if(document.getElementById("chatPanel"))return;const e=document.createElement("template");e.innerHTML=gt.trim();const t=document.getElementById("appRoot");if(t){t.appendChild(e.content);return}const a=document.createElement("div");a.id="kantoongAssistantHost",a.className="kc-host",a.appendChild(e.content),document.body.appendChild(a)}async function Wt(){[...document.styleSheets].some(t=>String(t.href||"").includes("chat-sheet.css"))||document.querySelector('link[href*="chat-sheet.css"], style[data-vite-dev-id*="chat-sheet"]')||await Y(()=>Promise.resolve({}),__vite__mapDeps([0]))}async function Yt(){try{const{data:e}=await A.auth.getSession(),t=e?.session?.user;if(!t)return null;const a=t.user_metadata||{};return M.userName||(M.userName=String(a.full_name||a.name||"").trim()),t}catch{return null}}async function Jt(){if(!(window.KantoongState||document.getElementById("appRoot")))try{const{data:e}=await A.from("products").select("id, name, price, category, description, image_url").limit(60);window.KantoongState={products:e||[]}}catch{window.KantoongState={products:[]}}}function Ge(...e){const t=new Map;for(const a of e)for(const n of a||[])n&&n.id&&!t.has(n.id)&&t.set(n.id,n);return[...t.values()].sort((a,n)=>Number(a.timestamp)-Number(n.timestamp)).slice(-200)}function Me(e){try{return JSON.parse(localStorage.getItem(e)||"[]")}catch{return[]}}function Xt(){if(D()||document.querySelector(".kc-consent"))return;const e=document.getElementById("chatBox");if(!e)return;const t=document.createElement("div");t.className="kc-consent",t.setAttribute("role","region"),t.setAttribute("aria-label","Izin memori asisten");const a=document.createElement("p");a.textContent="Boleh aku mengingat obrolan kita di semua toko jaringan Kantoong? Jadi saat kamu pindah toko, aku tetap nyambung. Kamu bisa menghapusnya kapan saja lewat menu +.";const n=document.createElement("button");n.type="button",n.className="kc-consent__yes",n.textContent="Ingat di semua toko";const i=document.createElement("button");i.type="button",i.className="kc-consent__no",i.textContent=`Hanya di ${Ne()}`;const o=async c=>{const l=Me(he());if(kt(c),t.remove(),c==="network"){const d=Ge(Me(he()),l);window.KantoongAIBrain?.reload?.(d),await We()}else window.KantoongAIBrain?.reload?.()};n.addEventListener("click",()=>o("network")),i.addEventListener("click",()=>o("brand"));const r=document.createElement("div");r.className="kc-consent__actions",r.append(n,i),t.append(a,r),e.before(t)}let x=null,z=!1,xe=0;async function We(){if(!x||z||D()!=="network")return;const{data:e,error:t}=await A.from("assistant_memory").select("messages").eq("user_id",x.id).maybeSingle();if(t){z=!0;return}const a=window.KantoongAIBrain?.getHistory?.()||[],n=Ge(a,e?.messages||[]);n.length!==a.length&&window.KantoongAIBrain?.reload?.(n),n.length!==(e?.messages||[]).length&&Ye(n)}function Ye(e){!x||z||D()!=="network"||(clearTimeout(xe),xe=setTimeout(async()=>{const t=(e||[]).slice(-200).map(n=>({id:n.id,who:n.who,text:String(n.text||"").slice(0,3e3),timestamp:n.timestamp,brand:n.brand,surface:n.surface,productIds:n.productIds,attachments:(n.attachments||[]).map(i=>({name:i.name,type:i.type,product:i.product}))})),{error:a}=await A.from("assistant_memory").upsert({user_id:x.id,messages:t,updated_at:new Date().toISOString()});a&&(z=!0)},1500))}window.addEventListener("kantoong:assistant-history",e=>Ye(e.detail?.history));window.addEventListener("kantoong:forget-memory",async()=>{if(window.confirm("Hapus semua memori asisten? Riwayat obrolan di semua toko Kantoong (perangkat ini"+(x?" dan akunmu":"")+") akan dihapus permanen.")){try{Object.keys(localStorage).filter(t=>t.startsWith("kantoong:chat:")).forEach(t=>localStorage.removeItem(t))}catch{}x&&!z&&await A.from("assistant_memory").delete().eq("user_id",x.id),window.KantoongAIBrain?.clearHistory?.()}});let ee=!1;const L=new Set;function ce(e,t){t?L.add(e):L.delete(e),document.body.classList.toggle("kc-overlay-open",L.size>0);const a=window.KantoongChat;a&&(L.size&&!a.isMinimized?.()?(a.minimize(),ee=!0):!L.size&&ee&&(ee=!1,a.restore?.()))}window.addEventListener("kantoong:overlay",e=>ce(e.detail?.name||"lapisan",!!e.detail?.open));window.addEventListener("kantoong:dashboard-opened",()=>ce("dashboard",!0));window.addEventListener("kantoong:dashboard-closed",()=>ce("dashboard",!1));document.addEventListener("click",e=>{if(window.KantoongEngine)return;const t=e.target.closest?.("#chatBox [data-product-id]");t&&(e.preventDefault(),window.open(`/index.html#produk/${encodeURIComponent(t.dataset.productId)}`,"_blank","noopener"))},!0);async function Zt(){Gt(),await Wt(),x=await Yt(),await Jt(),await Y(()=>import("./ai-brain-BwHkZp3x.js"),__vite__mapDeps([1,2])),window.KantoongAIBrain?.init?.(),await Y(()=>import("./chat-sheet-DlyQynfD.js"),__vite__mapDeps([3,2])),M.startMinimized&&window.KantoongChat?.minimize?.(),M.dock!==!1&&xt(),Pt(),zt(),Vt(),Xt(),We(),window.dispatchEvent(new CustomEvent("kantoong:assistant-ready",{detail:{surface:M.surface}}))}Zt();export{ct as A,Ce as C,nt as D,w as K,ea as P,Y as _,V as a,da as b,ua as c,ma as d,jt as e,ra as f,oa as g,ie as h,ia as i,ht as j,dt as k,st as l,ta as m,aa as n,sa as o,na as p,ft as q,Te as r,ca as s,pt as t,Ne as u,he as v,Rt as w,la as x};
