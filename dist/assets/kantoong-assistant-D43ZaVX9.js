const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/chat-sheet-Bv4LYLcg.css","assets/ai-brain-CQUyClC8.js","assets/supabase-client-DvLz8SWw.js","assets/chat-sheet-Br22DZKM.js"])))=>i.map(i=>d[i]);
import{supabase as C}from"./supabase-client-DvLz8SWw.js";const ut="modulepreload",mt=function(e){return"/"+e},ge={},W=function(t,a,n){let i=Promise.resolve();if(a&&a.length>0){let d=function(l){return Promise.all(l.map(p=>Promise.resolve(p).then(v=>({status:"fulfilled",value:v}),v=>({status:"rejected",reason:v}))))};document.getElementsByTagName("link");const r=document.querySelector("meta[property=csp-nonce]"),c=r?.nonce||r?.getAttribute("nonce");i=d(a.map(l=>{if(l=mt(l),l in ge)return;ge[l]=!0;const p=l.endsWith(".css"),v=p?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${l}"]${v}`))return;const g=document.createElement("link");if(g.rel=p?"stylesheet":ut,p||(g.as="script"),g.crossOrigin="",g.href=l,c&&g.setAttribute("nonce",c),document.head.appendChild(g),p)return new Promise((m,f)=>{g.addEventListener("load",m),g.addEventListener("error",()=>f(new Error(`Unable to preload CSS for ${l}`)))})}))}function o(r){const c=new Event("vite:preloadError",{cancelable:!0});if(c.payload=r,window.dispatchEvent(c),!c.defaultPrevented)throw r}return i.then(r=>{for(const c of r||[])c.status==="rejected"&&o(c.reason);return t().catch(o)})},w={business_id:"master_template_001",app_name:"Miloat",theme_color_primary:"#111111",filter_by_business_id:!1,use_demo_when_empty:!0,erp_demo:!0,hero:{interval_seconds:5,slides:[{type:"none",src:"",media_label:"Foto / video brand",caption:"Premium collection",title:"Nama produk unggulan",text:"Penjelasan singkat produk atau promo yang ingin ditonjolkan brand.",ai_prompt:""},{type:"none",src:"",media_label:"Foto / video brand",caption:"Terbaru",title:"Koleksi terbaru kami",text:"Tanyakan ke asisten AI untuk dicarikan yang paling cocok.",ai_prompt:"Tolong bantu pilihkan produk terbaru yang cocok untuk saya"}]},brand_slot:{type:"marquee",label:"",speed_seconds:30,items:[{icon:"truck",title:"Pengiriman Cepat",sub:"Aman sampai tujuan"},{icon:"badge",title:"Kualitas Terjamin",sub:"Bahan pilihan terbaik"},{icon:"chat",title:"Konsultasi AI",sub:"Tanya kapan saja"},{icon:"lock",title:"Checkout Aman",sub:"Kamu yang bayar sendiri"}],text:""},featured:{eyebrow:"Produk unggulan",title:"Pilihan Terbaik",description:"Produk andalan yang dipilih langsung oleh toko.",matched_title:"Pilihan AI untuk kamu",limit:8,ask_label:"Konsultasi AI",view:"3d"},shipping:{estimate:"",from:""},rails:[{eyebrow:"Paling laris",title:"Best Seller",description:"Produk yang paling banyak dibeli pelanggan.",sort:"sales",limit:10,min_items:2},{eyebrow:"Favorit pembeli",title:"Paling Banyak Di-wishlist",description:"Produk yang paling sering disimpan pembeli.",sort:"wishlist",limit:10,min_items:2},{eyebrow:"Baru datang",title:"Produk Terbaru",description:"Koleksi terbaru yang baru masuk toko.",sort:"newest",limit:10,min_items:2}],testimonials:[],categories:{enabled:!0,title:"Kategori lain"},ai_name:"Asisten",ai_title:"Halo Kak!",ai_endpoint:"/api/chat",ai_greetings:["Mau cari produk yang cocok untuk kebutuhanmu?","Bingung memilih? Ceritakan kebutuhanmu, aku carikan."],ai_suggestions:["Bantu pilihkan sesuai kebutuhan saya","Rekomendasi budget di bawah 500 ribu","Apa produk yang paling banyak dipilih?","Cari produk yang paling hemat","Aku bingung mau pilih yang mana","Ada produk baru apa saja?","Bandingkan produk unggulan untukku","Cari hadiah untuk orang tersayang"],demo_products:[{id:"demo-1",name:"Produk Contoh Satu",price:125e4,category:"kategori a",sales_count:40,image_url:""},{id:"demo-2",name:"Produk Contoh Dua",price:75e4,category:"kategori a",sales_count:32,image_url:""},{id:"demo-3",name:"Produk Contoh Tiga",price:45e4,category:"kategori b",sales_count:25,image_url:""},{id:"demo-4",name:"Produk Contoh Empat",price:23e5,category:"kategori b",sales_count:18,image_url:""},{id:"demo-5",name:"Produk Contoh Lima",price:32e4,category:"kategori a",sales_count:9,image_url:""},{id:"demo-6",name:"Produk Contoh Enam",price:98e4,category:"kategori b",sales_count:4,image_url:""}]};typeof window<"u"&&(window.KantoongConfig=w);const ka=["id","name","price","stock","category","image_url","created_at","business_id","caption","description","sales_count","is_published","is_featured","is_hero","hero_caption","hero_text","compare_at_price","ship_estimate","ship_from","video_url","gallery","hero_image_url","sku","barcode","rating_avg","review_count"].join(", "),N=w?.business_id??"master_template_001",re=`kantoong:storefront:${N}`,pt="kantoong-storefront",Te=Object.freeze([{kind:"terlaris",label:"Terlaris"},{kind:"terbaru",label:"Terbaru"},{kind:"promo",label:"Promo"},{kind:"termurah",label:"Termurah"},{kind:"rating",label:"Rating 4+"},{kind:"ready",label:"Ready stok"},{kind:"under",label:"Di bawah",needsValue:"price"},{kind:"keyword",label:"Kata kunci",needsValue:"text"}]),ht=Object.freeze(["terlaris","terbaru","promo","termurah","rating"]),u=(e,t=80)=>String(e??"").trim().slice(0,t),Ne=Object.freeze([{type:"banner",label:"Banner promo",hint:"Iklan lebar dengan tombol ajakan"},{type:"coupons",label:"Kupon & voucher",hint:"Kode yang bisa diklaim pelanggan"},{type:"jackpot",label:"Kotak hadiah misteri",hint:"Hadiah tak terduga, 1× sehari per pelanggan"},{type:"posters",label:"Poster",hint:"Kartu gambar untuk event / pengumuman"},{type:"pinned",label:"Produk pilihan admin",hint:"Produk yang disematkan admin"}]);function Oe(){return{blocks:[{type:"banner",enabled:!0,sample:!0,title:"",items:[{title:"Promo akhir pekan",text:"Diskon spesial untuk menu favoritmu. Berlaku Sabtu–Minggu.",image:"",cta:"Lihat produk",action:"catalog"},{title:"Bingung pilih?",text:"Ceritakan seleramu, asisten kami carikan yang paling pas.",image:"",cta:"Tanya asisten",action:"chat"}]},{type:"coupons",enabled:!0,sample:!0,title:"Kupon untukmu",items:[{code:"HEMAT10",title:"Diskon 10%",text:"Min. belanja Rp 50.000",expires:""},{code:"ONGKIR",title:"Gratis ongkir",text:"Untuk pesanan pertama",expires:""}]},{type:"jackpot",enabled:!0,sample:!0,title:"Kotak hadiah misteri",text:"Buka 1× sehari. Hadiahnya acak dari daftar hadiah toko.",rewards:[{label:"Diskon 5%",code:"MISTERI5",weight:40},{label:"Gratis topping",code:"TOPPING",weight:25},{label:"Diskon 15%",code:"JACKPOT15",weight:5},{label:"Belum beruntung — coba lagi besok",code:"",weight:30}]},{type:"posters",enabled:!0,sample:!0,title:"Info & event",items:[{title:"Menu baru setiap bulan",text:"Ikuti terus kejutannya.",image:""},{title:"Kemitraan reseller",text:"Hubungi kami lewat asisten.",image:""}]},{type:"pinned",enabled:!1,sample:!0,title:"Pilihan kami",productIds:[]}]}}const ke=e=>{const t=u(e,500);return/^https:\/\//i.test(t)?t:""},fe=e=>u(e,20).toUpperCase().replace(/[^A-Z0-9_-]/g,"");function be(e){const t=Ne.find(i=>i.type===e?.type);if(!t)return null;const a={type:t.type,enabled:e.enabled!==!1,sample:e.sample===!0,title:u(e.title,60)},n=Array.isArray(e.items)?e.items.slice(0,8):[];return t.type==="banner"?a.items=n.map(i=>({title:u(i?.title,60),text:u(i?.text,160),image:ke(i?.image),cta:u(i?.cta,30),action:["catalog","chat","none"].includes(i?.action)?i.action:"catalog"})).filter(i=>i.title):t.type==="coupons"?a.items=n.map(i=>({code:fe(i?.code),title:u(i?.title,40),text:u(i?.text,100),expires:u(i?.expires,10)})).filter(i=>i.code&&i.title):t.type==="posters"?a.items=n.map(i=>({title:u(i?.title,60),text:u(i?.text,120),image:ke(i?.image)})).filter(i=>i.title):t.type==="jackpot"?(a.text=u(e.text,160),a.rewards=(Array.isArray(e.rewards)?e.rewards.slice(0,10):[]).map(i=>({label:u(i?.label,50),code:fe(i?.code),weight:Math.min(100,Math.max(1,Math.round(Number(i?.weight)||1)))})).filter(i=>i.label)):t.type==="pinned"&&(a.productIds=(Array.isArray(e.productIds)?e.productIds:[]).map(i=>u(i,60)).filter(Boolean).slice(0,20)),a}function gt(e){const t=Array.isArray(e?.blocks)?e:Oe(),a=new Set,n=t.blocks.map(be).filter(i=>i&&!a.has(i.type)&&a.add(i.type));return Ne.forEach(i=>{a.has(i.type)||n.push({...be({type:i.type,enabled:!1}),enabled:!1})}),{blocks:n}}function fa(e,t=Math.random()){const a=(e??[]).filter(o=>o.weight>0),n=a.reduce((o,r)=>o+r.weight,0);if(!n)return null;let i=t*n;for(const o of a)if(i-=o.weight,i<0)return o;return a[a.length-1]}function kt(e){const t=String(e??"").trim();return/^https:\/\//i.test(t)&&t.length<=600||/^data:image\/(png|webp|jpeg);base64,[a-z0-9+/=]+$/i.test(t)&&t.length<=35e4?t:""}function De(){return{brand:{name:u(w?.app_name)||"Toko",tagline:"",logo:""},catalog:{categories:{},chips:{},chipLimit:6},home:Oe()}}function ft(e){const t=Te.find(n=>n.kind===e?.kind);if(!t)return null;const a={kind:t.kind,label:u(e.label,30)||t.label};if(t.needsValue==="price"){const n=Math.max(0,Math.round(Number(e.value)||0));if(!n)return null;a.value=n}if(t.needsValue==="text"){const n=u(e.value,40);if(!n)return null;a.value=n}return a}function se(e){const t=De(),a=e?.brand??{},n=e?.catalog??{},i={};Object.entries(n.categories??{}).forEach(([r,c])=>{const d=u(r,60);d&&(i[d]={label:u(c?.label,40),order:Number.isFinite(Number(c?.order))?Number(c.order):999,hidden:c?.hidden===!0})});const o={};return Object.entries(n.chips??{}).forEach(([r,c])=>{Array.isArray(c)&&(o[u(r,60)]=c.map(ft).filter(Boolean).slice(0,20))}),{brand:{name:u(a.name,60)||t.brand.name,tagline:u(a.tagline,120),logo:kt(a.logo)},catalog:{categories:i,chips:o,chipLimit:Math.min(20,Math.max(1,Math.round(Number(n.chipLimit)||t.catalog.chipLimit)))},home:gt(e?.home)}}function bt(e,t){return e?.catalog?.categories?.[t]?.label||t||"Lainnya"}function ba(e,t){const a=[...new Set((e??[]).map(i=>u(i.category,60)||"Lainnya"))],n=t?.catalog?.categories??{};return a.filter(i=>n[i]?.hidden!==!0).sort((i,o)=>(n[i]?.order??999)-(n[o]?.order??999)||i.localeCompare(o,"id")).map(i=>({key:i,label:bt(t,i)}))}function ya(e,t){const a=e?.catalog?.chips?.[t];return(Array.isArray(a)&&a.length?a:e?.catalog?.chips?.["*"]??ht.map(i=>({kind:i,label:Te.find(o=>o.kind===i).label}))).slice(0,e?.catalog?.chipLimit??6)}const R=e=>Number(e?.price)||0;function wa(e,t){const a=(e??[]).slice();if(!t)return a;switch(t.kind){case"terlaris":return a.sort((n,i)=>(Number(i.sales_count)||0)-(Number(n.sales_count)||0));case"terbaru":return a.sort((n,i)=>new Date(i.created_at??0)-new Date(n.created_at??0));case"promo":return a.filter(n=>Number(n.compare_at_price)>R(n));case"termurah":return a.sort((n,i)=>R(n)-R(i));case"rating":return a.filter(n=>Number(n.rating_avg)>=4);case"ready":return a.filter(n=>n.stock===null||n.stock===void 0||Number(n.stock)>0);case"under":return a.filter(n=>R(n)<=Number(t.value));case"keyword":{const n=String(t.value).toLowerCase();return a.filter(i=>[i.name,i.caption,i.description].join(" ").toLowerCase().includes(n))}default:return a}}function va(e){if(e.kind==="under"&&e.value){const t=Number(e.value);return`${e.label||"Di bawah"} ${t>=1e3?`${Math.round(t/1e3)}rb`:t}`}return e.kind==="keyword"&&e.label==="Kata kunci"?e.value:e.label}function ze(){try{return se(JSON.parse(localStorage.getItem(re)||"null"))}catch{return De()}}function yt(e){try{localStorage.setItem(re,JSON.stringify(e))}catch{}}let b=ze();w&&b.brand.name&&(w.app_name=b.brand.name);const ae=new Set;let Y=null;try{Y=typeof BroadcastChannel<"u"?new BroadcastChannel(pt):null}catch{Y=null}function P(e,{broadcast:t=!0}={}){b=se(e),w&&(w.app_name=b.brand.name),yt(b),t&&Y?.postMessage(b),ae.forEach(a=>{try{a(b)}catch(n){console.warn("[KANTOONG] Pendengar etalase gagal:",n)}}),typeof window<"u"&&window.dispatchEvent(new CustomEvent("kantoong:storefront-changed",{detail:b}))}function _a(){return b}let ee=null;function ce(){return ee||(ee=W(()=>import("./supabase-client-DvLz8SWw.js"),[]).then(e=>e.supabase).catch(()=>null)),ee}async function wt(){try{const e=await ce();if(!e)return b;const{data:t,error:a}=await e.from("storefront_settings").select("settings").eq("business_id",N).maybeSingle();if(a)throw a;t?.settings&&P(t.settings)}catch(e){console.info("[KANTOONG] Pengaturan etalase memakai salinan lokal:",e?.message||e)}return b}async function Sa(e,t,{demo:a=!1}={}){if(!["brand","catalog","home"].includes(e))throw new Error("Bagian tidak dikenal.");const n=se({...b,[e]:t});if(!a){const i=await ce();if(!i)throw new Error("Tidak tersambung ke server.");const{data:o,error:r}=await i.rpc("storefront_save",{p_business_id:N,p_section:e,p_value:n[e]});if(r)throw r;if(o?.error)throw new Error(o.error)}return P(n),b}function Ma(e){return ae.add(e),()=>ae.delete(e)}let ye=!1;async function Ea(){if(!ye){ye=!0,Y?.addEventListener("message",e=>P(e.data,{broadcast:!1})),window.addEventListener("storage",e=>{e.key===re&&P(ze(),{broadcast:!1})}),await wt();try{(await ce())?.channel(`storefront:${N}`).on("postgres_changes",{event:"*",schema:"public",table:"storefront_settings",filter:`business_id=eq.${N}`},t=>{t.new?.settings&&P(t.new.settings)}).subscribe()}catch{}}}const le="kantoong:personal",Z=Object.freeze([["Poppins","Modern","400;500;600;700"],["Inter","Modern","400;500;600;700"],["Plus Jakarta Sans","Modern","400;500;600;700"],["Manrope","Modern","400;500;600;700"],["DM Sans","Modern","400;500;600;700"],["Outfit","Modern","400;500;600;700"],["Urbanist","Modern","400;500;600;700"],["Sora","Modern","400;500;600;700"],["Lexend","Modern","400;500;600;700"],["Figtree","Modern","400;500;600;700"],["Onest","Modern","400;500;600;700"],["Montserrat","Modern","400;500;600;700"],["Raleway","Modern","400;500;600;700"],["Work Sans","Modern","400;500;600;700"],["Rubik","Modern","400;500;600;700"],["Karla","Modern","400;500;600;700"],["Mulish","Modern","400;500;600;700"],["Space Grotesk","Modern","400;500;600;700"],["IBM Plex Sans","Modern","400;500;600;700"],["Source Sans 3","Modern","400;500;600;700"],["Lato","Klasik","400;700"],["Open Sans","Klasik","400;500;600;700"],["Roboto","Klasik","400;500;700"],["Noto Sans","Klasik","400;500;600;700"],["Heebo","Klasik","400;500;600;700"],["Barlow","Klasik","400;500;600;700"],["Archivo","Klasik","400;500;600;700"],["Hanken Grotesk","Klasik","400;500;600;700"],["Albert Sans","Klasik","400;500;600;700"],["Red Hat Display","Klasik","400;500;600;700"],["Be Vietnam Pro","Klasik","400;500;600;700"],["Kanit","Klasik","400;500;600;700"],["Prompt","Klasik","400;500;600;700"],["Nunito","Bulat","400;500;600;700"],["Nunito Sans","Bulat","400;500;600;700"],["Quicksand","Bulat","400;500;600;700"],["Comfortaa","Bulat","400;500;600;700"],["Varela Round","Bulat","400"],["Josefin Sans","Bulat","400;500;600;700"],["Playfair Display","Elegan","400;500;600;700"],["Cormorant Garamond","Elegan","400;500;600;700"],["Lora","Elegan","400;500;600;700"],["Libre Baskerville","Elegan","400;700"],["Merriweather","Elegan","400;700"],["Fraunces","Elegan","400;500;600;700"],["EB Garamond","Elegan","400;500;600;700"],["DM Serif Display","Elegan","400"],["Caveat","Tulisan tangan","400;500;600;700"],["Dancing Script","Tulisan tangan","400;500;600;700"],["Space Mono","Mesin ketik","400;700"]].map(([e,t,a])=>Object.freeze({name:e,group:t,weights:a}))),He="Poppins",vt=Object.freeze([{id:"auto",label:"Ikuti tema"},{id:"dark",label:"Hitam"},{id:"light",label:"Putih"}]);function ne(e){const t=Z.some(n=>n.name===e?.font)?e.font:He,a=vt.some(n=>n.id===e?.chatSkin)?e.chatSkin:"auto";return{font:t,chatSkin:a}}function Re(){try{return ne(JSON.parse(localStorage.getItem(le)||"null"))}catch{return ne(null)}}function _t(e){const t=Z.find(a=>a.name===e)??Z[0];return`https://fonts.googleapis.com/css2?family=${encodeURIComponent(t.name).replace(/%20/g,"+")}:wght@${t.weights}&display=swap`}function xa(e="Aa Selamat sore, Kak 123"){return`https://fonts.googleapis.com/css2?${Z.map(a=>`family=${encodeURIComponent(a.name).replace(/%20/g,"+")}`).join("&")}&text=${encodeURIComponent(e)}&display=swap`}function St(e,t){let a=document.getElementById(e);a||(a=document.createElement("link"),a.id=e,a.rel="stylesheet",document.head.appendChild(a)),a.getAttribute("href")!==t&&a.setAttribute("href",t)}function ie(e=Re()){const t=document.documentElement;e.font&&e.font!==He?(St("kcUserFont",_t(e.font)),t.style.setProperty("--kc-user-font",`"${e.font}", system-ui, -apple-system, "Segoe UI", sans-serif`),t.dataset.userFont=e.font):(document.getElementById("kcUserFont")?.remove(),t.style.removeProperty("--kc-user-font"),delete t.dataset.userFont),e.chatSkin&&e.chatSkin!=="auto"?t.dataset.chatSkin=e.chatSkin:delete t.dataset.chatSkin}function Aa(e){const t=ne({...Re(),...e});try{localStorage.setItem(le,JSON.stringify(t))}catch{}return ie(t),window.dispatchEvent(new CustomEvent("kantoong:personal-changed",{detail:t})),t}typeof window<"u"&&typeof document<"u"&&(ie(),window.addEventListener("storage",e=>{e.key===le&&ie()}));const de="kantoong:theme",Mt=Object.freeze([{id:"store",label:"Toko & halaman produk"},{id:"dashboard",label:"Dashboard pribadi"},{id:"erp",label:"Dashboard admin (ERP)"},{id:"pos",label:"Kasir POS"}]),Et=Object.freeze([{id:"light",label:"Terang"},{id:"dark",label:"Gelap"},{id:"system",label:"Ikuti perangkat"}]),xt=new Set(Et.map(e=>e.id));function je(){return{mode:"all",all:"system",areas:{store:"system",dashboard:"system",erp:"system",pos:"system"}}}function ue(e){const t=je();if(!e||typeof e!="object")return t;const a=(n,i)=>xt.has(n)?n:i;return{mode:e.mode==="per-area"?"per-area":"all",all:a(e.all,t.all),areas:Object.fromEntries(Mt.map(n=>[n.id,a(e.areas?.[n.id],t.areas[n.id])]))}}function At(e,t){const a=ue(e);return a.mode==="all"?a.all:a.areas[t]??a.all}function Ct(e,t,a=!1){const n=At(e,t);return n==="system"?a?"dark":"light":n}function $e(){try{return ue(JSON.parse(localStorage.getItem(de)||"null"))}catch{return je()}}function It(e){const t=ue(e);try{localStorage.setItem(de,JSON.stringify(t))}catch{}return window.dispatchEvent(new CustomEvent("kantoong:theme-changed",{detail:t})),t}const Fe=typeof window<"u"&&window.matchMedia?window.matchMedia("(prefers-color-scheme: dark)"):null;let M=null;function Lt(e){return Ct($e(),e,!!Fe?.matches)}function G(e){M=e;const t=Lt(e),a=document.documentElement;return a.dataset.theme!==t&&(a.classList.add("kc-theme-switching"),a.dataset.theme=t,a.style.colorScheme=t,setTimeout(()=>a.classList.remove("kc-theme-switching"),350)),window.dispatchEvent(new CustomEvent("kantoong:theme-applied",{detail:{area:e,theme:t}})),t}function Ca(e,t){const a=$e();a.mode==="all"?a.all=t:a.areas[e]=t,It(a),M&&G(M)}typeof window<"u"&&(window.addEventListener("storage",e=>{e.key===de&&M&&G(M)}),window.addEventListener("kantoong:theme-changed",()=>{M&&G(M)}),Fe?.addEventListener?.("change",()=>{M&&G(M)}));const Pt=`
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
`,oe="kantoong:assistant:memory-scope",qe=Object.freeze({store:"toko",cart:"keranjang",product:"halaman produk",dashboard:"dashboard pengguna",erp:"dashboard kerja ERP"});function z(){try{const e=localStorage.getItem(oe);return e==="network"||e==="brand"?e:null}catch{return null}}function Bt(e){try{e==="network"||e==="brand"?localStorage.setItem(oe,e):localStorage.removeItem(oe)}catch{}}function Ue(){return String(w?.business_id||w?.businessId||"default")}function Ge(){return String(w?.app_name||"Kantoong")}function we(){return z()==="network"?"kantoong:chat:network":`kantoong:chat:${Ue()}`}function Kt(){const e=window.KantoongAssistantContext?.surface;if(e&&qe[e]){if(e==="store"){if(document.querySelector(".cart-page.is-open, #cartPage.is-open"))return"cart";if(location.hash.startsWith("#produk/"))return"product";if(document.body.classList.contains("dashboard-open"))return"dashboard"}return e}return location.pathname.includes("/erp/")?"erp":"store"}function Tt(){const e=window.KantoongAssistantContext?.page;return typeof e=="function"?String(e()||"").slice(0,120):e?String(e).slice(0,120):location.hash.startsWith("#produk/")?`halaman produk "${document.title.split(" · ")[0]}"`:location.pathname.includes("/erp/")?`menu ERP "${document.title.split(" — ")[0]}"`:""}function Ia(){const e=window.KantoongAssistantContext||{},t=Kt();return{surface:t,surface_label:qe[t]||t,brand:Ge(),brand_id:Ue(),user_name:String(e.userName||"").slice(0,60),network_memory:z()==="network",page_title:String(document.title||"").slice(0,80),page:Tt()}}const Ve=window.matchMedia("(min-width: 900px)"),S=document.documentElement,Je="kantoong:assistant-dock",We=["float","side","half"],j=["side","half"],ve={float:"Melayang di atas halaman",side:"Chat di samping",half:"Belah layar dua"},Nt={float:'<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="7" y="11" width="10" height="5" rx="1.5"/>',side:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M15 5v14"/>',half:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/>'},Ot='<path d="M7 7h12l-3-3M17 17H5l3 3"/>';function Dt(){try{const e=JSON.parse(localStorage.getItem(Je)||"{}");return{side:e.side==="left"?"left":"right",size:We.includes(e.size)?e.size:"side"}}catch{return{side:"right",size:"side"}}}const k=Dt();function zt(){try{localStorage.setItem(Je,JSON.stringify(k))}catch{}}function B(e){const t=window.innerWidth;return Math.round(e==="half"?t/2:Math.min(440,Math.max(360,t*.32)))}function Ye(e,t){S.style.setProperty("--kc-dock-w",`${Math.round(e)}px`),S.style.setProperty("--kc-dock-pad",`${Math.round(t)}px`)}let _e=0;function Ze(){clearTimeout(_e),_e=setTimeout(()=>window.dispatchEvent(new Event("resize")),320)}function X(){S.dataset.kcDockSide=k.side,S.dataset.kcDockSize=k.size,Ye(B(k.size),B(k.size)),document.querySelectorAll(".kc-dock-tool[data-kc-dock-size]").forEach(e=>{e.setAttribute("aria-pressed",String(e.dataset.kcDockSize===k.size))})}function O(e){Object.assign(k,e),zt(),X(),V(),Ze()}let Xe=null;function V(){const e=Xe;if(!e)return;const t=Ve.matches&&k.size!=="float"&&!e.hidden&&e.dataset.state!=="peek"&&e.dataset.open==="true";S.classList.contains("kc-docked")!==t&&(S.classList.toggle("kc-docked",t),e.classList.toggle("kc-sheet--docked",t),Ze())}function Se(e){return`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${e}</svg>`}function Ht(e){const t=e.querySelector(".kc-chatbar");if(!t||t.querySelector(".kc-dock-tools"))return;const a=document.createElement("div");a.className="kc-dock-tools",a.setAttribute("role","group"),a.setAttribute("aria-label","Ukuran chat");for(const i of We){const o=document.createElement("button");o.type="button",o.className="kc-dock-tool",o.dataset.kcDockSize=i,o.title=ve[i],o.setAttribute("aria-label",ve[i]),o.innerHTML=Se(Nt[i]),o.addEventListener("click",()=>O({size:i})),a.appendChild(o)}const n=document.createElement("button");n.type="button",n.className="kc-dock-tool kc-dock-swap",n.title="Pindah sisi",n.setAttribute("aria-label","Pindahkan chat ke sisi lain"),n.innerHTML=Se(Ot),n.addEventListener("click",()=>O({side:k.side==="right"?"left":"right"})),a.appendChild(n),t.querySelector("#chatCloseBtn")?.before(a)}function Rt(e){if(e.querySelector(".kc-dock-edge"))return;const t=document.createElement("div");t.className="kc-dock-edge",t.tabIndex=0,t.title="Tarik untuk mengubah lebar chat",t.setAttribute("role","separator"),t.setAttribute("aria-orientation","vertical"),t.setAttribute("aria-label","Ubah lebar chat (panah kiri/kanan)"),e.appendChild(t);let a=null,n=0;const i=r=>{const c=window.innerWidth,d=k.side==="right"?c-r+8:r+8;return Math.min(c*.7,Math.max(200,d))};t.addEventListener("pointerdown",r=>{r.button>0||(a=r.pointerId,n=B(k.size),t.setPointerCapture?.(a),S.classList.add("kc-dock-resizing"),r.preventDefault())}),t.addEventListener("pointermove",r=>{r.pointerId===a&&(n=i(r.clientX),Ye(n,n))});const o=r=>{if(r.pointerId!==a)return;if(a=null,S.classList.remove("kc-dock-resizing"),n<280){X(),window.KantoongChat?.collapse?.();return}const c=j.reduce((d,l)=>Math.abs(B(l)-n)<Math.abs(B(d)-n)?l:d);O({size:c})};t.addEventListener("pointerup",o),t.addEventListener("pointercancel",o),t.addEventListener("keydown",r=>{if(r.key!=="ArrowLeft"&&r.key!=="ArrowRight")return;r.preventDefault();const c=r.key==="ArrowLeft"==(k.side==="right"),d=j.indexOf(k.size)+(c?1:-1);d>=0&&d<j.length&&O({size:j[d]})})}function jt(e){let t="";const a=n=>{n!==t&&(t=n,window.dispatchEvent(new CustomEvent(n?"kantoong:stage-focus":"kantoong:stage-blur",{detail:{id:n}})))};e.addEventListener("pointerover",n=>{if(!S.classList.contains("kc-docked")||n.pointerType==="touch")return;const i=n.target.closest?.("#chatBox [data-product-id]");a(i?String(i.dataset.productId):"")}),e.addEventListener("pointerleave",()=>a(""))}function $t(){const e=document.getElementById("chatPanel");e&&(Xe=e,X(),Ht(e),Rt(e),jt(e),new MutationObserver(V).observe(e,{attributes:!0,attributeFilter:["data-open","data-state","hidden"]}),Ve.addEventListener("change",V),V(),window.addEventListener("kantoong:dock-throw",t=>{const a=t.detail?.side==="left"?"left":"right",n=k.size==="float"?{side:a,size:"side"}:{side:a};(n.side!==k.side||n.size)&&O(n)}),window.addEventListener("resize",()=>{S.classList.contains("kc-dock-resizing")||X()}))}const $=window.matchMedia("(hover: hover) and (pointer: fine)"),Ft='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="4" width="7.5" height="7.5" rx="2"/><rect x="3" y="14.5" width="7.5" height="5.5" rx="2"/><rect x="13.5" y="14.5" width="7.5" height="5.5" rx="2"/></svg>',Me=new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short"}),Ee=new Intl.DateTimeFormat("id-ID",{hour:"2-digit",minute:"2-digit"});function h(e,t,a){const n=document.createElement(e);return t&&(n.className=t),a!=null&&(n.textContent=a),n}function qt(e){const t=e.find(n=>n.who==="user");if(!t)return"Chat baru";const a=String(t.text||"").replace(/\s+/g," ").trim();return a||(t.attachments?.length?"Kirim lampiran":"Chat tanpa judul")}function Ut(){const e=window.KantoongAIBrain,t=e?.getHistory?.()||[],n=(e?.getArchive?.()||[]).map((i,o)=>({index:o,messages:i.messages})).reverse();return n.unshift({index:-1,current:!0,messages:t}),n.map(i=>({...i,title:qt(i.messages),startedAt:Number(i.messages[0]?.timestamp)||Date.now()}))}function Gt(e){const t=e.who==="user"?"user":"ai",a=h("div",`kc-hcard__msg kc-hcard__msg--${t}`),n=String(e.text||"").trim();n&&a.appendChild(h("p","",n.length>90?`${n.slice(0,90)}…`:n));const i=Array.isArray(e.productIds)?e.productIds.slice(0,3):[];if(i.length){const o=h("div","kc-hcard__products");for(const r of i){const c=window.KantoongAIBrain?.describeProduct?.(r),d=h("span","kc-hcard__product");if(c?.image){const l=document.createElement("img");l.src=c.image,l.alt="",l.loading="lazy",d.appendChild(l)}else d.classList.add("is-gone"),d.title="Produk sudah tidak tersedia";o.appendChild(d)}a.appendChild(o)}return a}function Vt(e){const t=h("button","kc-hcard");t.type="button",t.dataset.index=String(e.index),e.current&&t.classList.add("is-current");const a=new Date(e.startedAt);t.setAttribute("aria-label",`${e.current?"Chat sekarang: ":"Buka chat: "}${e.title}, ${Me.format(a)} ${Ee.format(a)}`);const n=h("span","kc-hcard__preview"),i=h("span","kc-hcard__track");return e.messages.slice(0,14).forEach(o=>i.appendChild(Gt(o))),n.append(i,h("span","kc-hcard__time",Ee.format(a))),e.current&&n.appendChild(h("span","kc-hcard__badge","Sedang dibuka")),t.append(n,h("span","kc-hcard__title",e.title),h("span","kc-hcard__date",Me.format(a))),t}function A(e,t){if(!(!e||e.classList.contains("is-live")===t)&&(e.classList.toggle("is-live",t),t)){const a=e.querySelector(".kc-hcard__preview"),n=e.querySelector(".kc-hcard__track"),i=Math.max(0,n.scrollHeight-a.clientHeight+16);e.style.setProperty("--kc-track-dist",`${-i}px`)}}function xe(e){const t=e.getBoundingClientRect(),a=t.top+t.height/2;let n=null,i=1/0;for(const o of e.querySelectorAll(".kc-hcard")){const r=o.getBoundingClientRect(),c=Math.abs(r.top+r.height/2-a);c<i&&(i=c,n=o)}e.querySelectorAll(".kc-hcard.is-live").forEach(o=>{o!==n&&A(o,!1)}),A(n,!0)}function Jt(){const e=document.getElementById("chatPanel"),t=e?.querySelector(".kc-chatbar");if(!e||!t||e.querySelector(".kc-history"))return;const a=t.querySelector("h2"),n=a?.textContent||"Konsultasi AI",i=h("button","kc-icon-btn kc-history-btn");i.type="button",i.title="Riwayat chat",i.setAttribute("aria-label","Riwayat chat AI"),i.setAttribute("aria-pressed","false"),i.innerHTML=Ft,(t.querySelector(".kc-dock-tools")||t.querySelector("#chatCloseBtn"))?.before(i);const o=h("section","kc-history");o.setAttribute("aria-label","Riwayat chat AI");const r=h("div","kc-history__head"),c=h("p","kc-history__note","Obrolan 30 hari terakhir"),d=h("button","kc-history__new","+ Chat baru");d.type="button",r.append(c,d);const l=h("div","kc-history__grid");o.append(r,l),(e.querySelector("#chatBox")||e.lastElementChild).before(o);let p=0;const v=()=>{const m=Ut();l.replaceChildren(...m.map(Vt)),m.length===1&&l.appendChild(h("p","kc-history__empty",'Tekan "+ Chat baru" untuk menyimpan obrolan ini. Obrolan lama akan muncul di sini.')),$.matches||requestAnimationFrame(()=>xe(o))},g=m=>{e.dataset.view=m?"history":"chat",i.setAttribute("aria-pressed",String(m)),a&&(a.textContent=m?"Riwayat Chat AI":n),m&&(v(),o.scrollTop=0)};i.addEventListener("click",()=>g(e.dataset.view!=="history")),d.addEventListener("click",()=>{window.KantoongAIBrain?.newChat?.(),g(!1)}),l.addEventListener("pointerover",m=>{if(!$.matches)return;const f=m.target.closest(".kc-hcard");l.querySelectorAll(".kc-hcard.is-live").forEach(_=>_!==f&&A(_,!1)),A(f,!0)}),l.addEventListener("pointerleave",()=>{$.matches&&l.querySelectorAll(".kc-hcard.is-live").forEach(m=>A(m,!1))}),o.addEventListener("scroll",()=>{$.matches||p||(p=requestAnimationFrame(()=>{p=0,xe(o)}))},{passive:!0}),l.addEventListener("touchstart",m=>{const f=m.target.closest(".kc-hcard");f&&(l.querySelectorAll(".kc-hcard.is-live").forEach(_=>_!==f&&A(_,!1)),A(f,!0))},{passive:!0}),l.addEventListener("click",m=>{const f=m.target.closest(".kc-hcard");f&&(f.classList.add("is-opening"),setTimeout(()=>{const _=Number(f.dataset.index);_>=0&&window.KantoongAIBrain?.openArchived?.(_),g(!1)},240))}),new MutationObserver(()=>{e.dataset.open==="false"&&e.dataset.view==="history"&&g(!1)}).observe(e,{attributes:!0,attributeFilter:["data-open"]}),e.dataset.view="chat"}const F=56,Ae=56,Ce=8;function Wt(e){return window.KantoongAIBrain?.findProduct?.(e.dataset.productId)||null}function Ie(){return typeof window.KantoongEngine?.addToCart=="function"}function Yt(e){const t=Math.sign(e),a=Math.abs(e);return t*Ae*(1-Math.exp(-a/(Ae*.9)))}function Zt(e,t){const a=window.KantoongAIBrain?.describeProduct?.(e.dataset.productId)||{};window.dispatchEvent(new CustomEvent("kantoong:attach-product",{detail:{product:{id:e.dataset.productId,name:a.name||t.name||"",price:Number(t.price??t.harga)||null,image_url:a.image||t.image_url||""}}}))}function Xt(e){window.KantoongEngine.addToCart(e)}function Qt(){const e=document.getElementById("chatBox");if(!e||e.dataset.gesturesReady==="true")return;e.dataset.gesturesReady="true";let t=null,a=!1;const n=o=>{o.classList.remove("is-pulling"),o.style.removeProperty("--kc-pull"),delete o.dataset.gesture};e.addEventListener("pointerdown",o=>{if(o.pointerType==="mouse"&&o.button!==0)return;const r=o.target.closest(".ai-product-card[data-product-id]");r&&(t={card:r,id:o.pointerId,x:o.clientX,y:o.clientY,active:!1,dy:0})}),e.addEventListener("pointermove",o=>{if(!t||o.pointerId!==t.id)return;const r=o.clientX-t.x,c=o.clientY-t.y;if(!t.active){if(Math.abs(r)<Ce&&Math.abs(c)<Ce)return;if(Math.abs(r)>=Math.abs(c)){t=null;return}t.active=!0,t.card.classList.add("is-pulling");try{t.card.setPointerCapture(o.pointerId)}catch{}}t.dy=c>0&&!Ie()?0:c;const d=Yt(t.dy);t.card.style.setProperty("--kc-pull",`${d.toFixed(1)}px`),t.dy<=-F?t.card.dataset.gesture="up":t.dy>=F?t.card.dataset.gesture="down":t.card.dataset.gesture=t.dy<0?"up-hint":t.dy>0?"down-hint":"",o.preventDefault()});const i=(o,r)=>{if(!t||o.pointerId!==t.id)return;const{card:c,active:d,dy:l}=t;if(t=null,!d)return;a=!0,setTimeout(()=>{a=!1},0);const p=Wt(c);!r&&p&&l<=-F?(c.classList.add("is-sent-up"),Zt(c,p)):!r&&p&&l>=F&&Ie()&&(c.classList.add("is-sent-down"),Xt(p)),n(c),setTimeout(()=>c.classList.remove("is-sent-up","is-sent-down"),520)};e.addEventListener("pointerup",o=>i(o,!1)),e.addEventListener("pointercancel",o=>i(o,!0)),e.addEventListener("click",o=>{!a||!o.target.closest(".ai-product-card")||(o.preventDefault(),o.stopPropagation(),a=!1)},!0),e.addEventListener("dragstart",o=>{o.target.closest?.(".ai-product-card")&&o.preventDefault()})}const Qe=Object.freeze({hadiah:{label:"Hadiah / oleh-oleh",words:["hadiah","kado","oleh","parcel","hampers","ultah","ulang"]},hemat:{label:"Harga hemat",words:["murah","hemat","promo","diskon","voucher","terjangkau","budget"]},sehat:{label:"Sehat / diet",words:["sehat","diet","gula","kalori","protein","vegan","olahraga"]},cepat:{label:"Butuh cepat",words:["cepat","kilat","hari","besok","instan","sameday"]},banyak:{label:"Beli banyak / acara",words:["grosir","banyak","acara","kantor","arisan","reseller","partai"]},rasa:{label:"Cari rasa / varian",words:["rasa","varian","manis","pahit","segar","creamy","baru"]}}),et=new Map(Object.entries(Qe).flatMap(([e,t])=>t.words.map(a=>[a,e]))),tt=new Set(["yang","dan","atau","ada","untuk","dengan","apa","saja","mau","kak","dong","nya","ini","itu","bisa","tolong","produk"]);function ea(e=[]){const t=new Set;for(const a of e)for(const n of`${a.name||""} ${a.category||""}`.toLowerCase().split(/[^a-z]+/))n.length>=3&&!tt.has(n)&&t.add(n);return t}function ta(e,t=new Set){const a=[];for(const n of String(e||"").toLowerCase().split(/[^a-z]+/)){const i=n==="cokelat"?"coklat":n;if(!(i.length<3||tt.has(i))&&((t.has(i)||et.has(i))&&!a.includes(i)&&a.push(i),a.length===5))break}return a}function Le(e){return et.get(e)||null}function aa(e,t,a=new Date){const n=a.getTime()-t*864e5;return e.filter(i=>new Date(i.at).getTime()>=n)}const q=(e,t)=>{const a=new Map;for(const n of e){const i=t(n);i&&a.set(i,(a.get(i)||0)+1)}return a},U=(e,t)=>[...e.entries()].sort((a,n)=>n[1]-a[1]||String(a[0]).localeCompare(String(n[0]))).slice(0,t);function na(e){return(new Date(e).getUTCHours()+7)%24}function La(e,t=[],{days:a=30,now:n=new Date}={}){const i=aa(e,a,n),o=(s,y)=>t.find(dt=>String(dt.id)===String(s))?.name||y||"Produk",r=s=>i.filter(y=>y.kind===s),c=new Set(i.map(s=>s.session_key)).size,d=r("ask"),l=i.filter(s=>s.product_id&&s.kind!=="cart"),p=r("cart"),v=q(l,s=>String(s.product_id)),g=q(p,s=>String(s.product_id)),m=new Map(i.filter(s=>s.product_id).map(s=>[String(s.product_id),s.product_name])),f=U(v,8).map(([s,y])=>({product_id:s,name:o(s,m.get(s)),count:y,carts:g.get(s)||0})),_=U(v,50).map(([s,y])=>({product_id:s,name:o(s,m.get(s)),count:y,carts:g.get(s)||0})).filter(s=>s.count>=3&&s.carts/s.count<.2).slice(0,5),pe=d.flatMap(s=>s.keywords||[]),st=U(q(pe,Le),6).map(([s,y])=>({key:s,label:Qe[s].label,count:y})),ct=U(q(pe.filter(s=>!Le(s)),s=>s),12).map(([s,y])=>({word:s,count:y})),H=Array.from({length:24},()=>0);for(const s of d)H[na(s.at)]+=1;const lt=H.indexOf(Math.max(...H)),he=new Set(p.map(s=>s.session_key)).size;return{days:a,totals:{sessions:c,asks:d.length,recommends:r("recommend").length,carts:p.length,conversion:c?Math.round(he/c*100):0},funnel:[{key:"ask",label:"Bertanya ke AI",value:new Set(d.map(s=>s.session_key)).size},{key:"recommend",label:"Dapat rekomendasi",value:new Set(r("recommend").map(s=>s.session_key)).size},{key:"view",label:"Melihat produk",value:new Set(i.filter(s=>s.kind==="view"||s.kind==="attach").map(s=>s.session_key)).size},{key:"cart",label:"Masuk keranjang",value:he}],topProducts:f,interestedNotBought:_,needs:st,keywords:ct,hours:H,peakHour:d.length?lt:null}}function ia(e){const t=new Map;for(const a of[...e].sort((n,i)=>new Date(n.at)-new Date(i.at)))t.has(a.session_key)||t.set(a.session_key,`Tamu #${t.size+1}`);return t}const Pe={ask:(e,t,a)=>`${e} bertanya${a?` soal ${a}`:""}`,recommend:(e,t)=>`AI merekomendasikan ${t} ke ${e}`,attach:(e,t)=>`${e} menanyakan ${t} lebih lanjut`,view:(e,t)=>`${e} membuka detail ${t}`,cart:(e,t)=>`${e} memasukkan ${t} ke keranjang`};function Pa(e,{products:t=[],labels:a=ia(e),limit:n=30}={}){return[...e].sort((i,o)=>new Date(o.at)-new Date(i.at)).slice(0,n).map(i=>{const o=t.find(c=>String(c.id)===String(i.product_id))?.name||i.product_name||"produk",r=(i.keywords||[]).slice(0,2).join(", ");return{at:i.at,kind:i.kind,text:(Pe[i.kind]||Pe.ask)(a.get(i.session_key)||"Tamu",o,r)}})}const at=4e3,nt=20;let K=[],T=0,J=!1;function oa(){try{let e=sessionStorage.getItem("kantoong:ai-session");return e||(e=`s-${Math.random().toString(36).slice(2,10)}${Date.now().toString(36).slice(-4)}`,sessionStorage.setItem("kantoong:ai-session",e)),e}catch{return null}}function ra(){return window.KantoongAIBrain?.getProducts?.()||window.KantoongState?.products||[]}function sa(e,t=""){const a=window.KantoongAIBrain?.findProduct?.(e);return String(a?.name||t||"").slice(0,120)}async function Q(){if(clearTimeout(T),T=0,!K.length||J)return;const e=K.splice(0,nt);try{const{error:t}=await C.rpc("log_ai_events",{p:e});t&&(J=!0)}catch{J=!0}K.length&&(T=setTimeout(Q,at))}function I(e,{productId:t=null,name:a="",keywords:n=[]}={}){if(J)return;const i=oa();i&&(K.push({business_id:w.business_id,session_key:i,kind:e,product_id:t?String(t):null,product_name:t?sa(t,a):null,keywords:n,surface:window.KantoongAssistantContext?.surface||"store"}),K.length>=nt?Q():T||(T=setTimeout(Q,at)))}function ca(){window.__kantoongTelemetry||(window.__kantoongTelemetry=!0,window.KantoongAssistantContext?.surface!=="erp"&&(navigator.doNotTrack==="1"||window.doNotTrack==="1"||(window.addEventListener("kantoong:ai-response",e=>{const t=e.detail||{};I("ask",{keywords:ta(t.question,ea(ra()))});for(const a of(t.product_ids||[]).slice(0,6))I("recommend",{productId:a})}),window.addEventListener("kantoong:attach-product",e=>{const t=e.detail?.product;t?.id&&I("attach",{productId:t.id,name:t.name})}),window.addEventListener("kantoong:quickview-opened",e=>{const t=e.detail?.product;t?.id&&I("view",{productId:t.id,name:t.name})}),window.addEventListener("kantoong:cart-add",e=>{const t=e.detail?.product;t?.id&&I("cart",{productId:t.id,name:t.name})}),window.addEventListener("pagehide",Q))))}const E=window.KantoongAssistantContext=window.KantoongAssistantContext||{};E.surface||(E.surface=location.pathname.includes("/erp/")?"erp":"store");E.dock===!1&&(document.documentElement.dataset.kcFree="");function la(){if(document.getElementById("chatPanel"))return;const e=document.createElement("template");e.innerHTML=Pt.trim();const t=document.getElementById("appRoot");if(t){t.appendChild(e.content);return}const a=document.createElement("div");a.id="kantoongAssistantHost",a.className="kc-host",a.appendChild(e.content),document.body.appendChild(a)}async function da(){[...document.styleSheets].some(t=>String(t.href||"").includes("chat-sheet.css"))||document.querySelector('link[href*="chat-sheet.css"], style[data-vite-dev-id*="chat-sheet"]')||await W(()=>Promise.resolve({}),__vite__mapDeps([0]))}async function ua(){try{const{data:e}=await C.auth.getSession(),t=e?.session?.user;if(!t)return null;const a=t.user_metadata||{};return E.userName||(E.userName=String(a.full_name||a.name||"").trim()),t}catch{return null}}async function ma(){if(!(window.KantoongState||document.getElementById("appRoot")))try{const{data:e}=await C.from("products").select("id, name, price, category, description, image_url").limit(60);window.KantoongState={products:e||[]}}catch{window.KantoongState={products:[]}}}function it(...e){const t=new Map;for(const a of e)for(const n of a||[])n&&n.id&&!t.has(n.id)&&t.set(n.id,n);return[...t.values()].sort((a,n)=>Number(a.timestamp)-Number(n.timestamp)).slice(-200)}function Be(e){try{return JSON.parse(localStorage.getItem(e)||"[]")}catch{return[]}}function pa(){if(z()||document.querySelector(".kc-consent"))return;const e=document.getElementById("chatBox");if(!e)return;const t=document.createElement("div");t.className="kc-consent",t.setAttribute("role","region"),t.setAttribute("aria-label","Izin memori asisten");const a=document.createElement("p");a.textContent="Boleh aku mengingat obrolan kita di semua toko jaringan Kantoong? Jadi saat kamu pindah toko, aku tetap nyambung. Kamu bisa menghapusnya kapan saja lewat menu +.";const n=document.createElement("button");n.type="button",n.className="kc-consent__yes",n.textContent="Ingat di semua toko";const i=document.createElement("button");i.type="button",i.className="kc-consent__no",i.textContent=`Hanya di ${Ge()}`;const o=async c=>{const d=Be(we());if(Bt(c),t.remove(),c==="network"){const l=it(Be(we()),d);window.KantoongAIBrain?.reload?.(l),await ot()}else window.KantoongAIBrain?.reload?.()};n.addEventListener("click",()=>o("network")),i.addEventListener("click",()=>o("brand"));const r=document.createElement("div");r.className="kc-consent__actions",r.append(n,i),t.append(a,r),e.before(t)}let x=null,D=!1,Ke=0;async function ot(){if(!x||D||z()!=="network")return;const{data:e,error:t}=await C.from("assistant_memory").select("messages").eq("user_id",x.id).maybeSingle();if(t){D=!0;return}const a=window.KantoongAIBrain?.getHistory?.()||[],n=it(a,e?.messages||[]);n.length!==a.length&&window.KantoongAIBrain?.reload?.(n),n.length!==(e?.messages||[]).length&&rt(n)}function rt(e){!x||D||z()!=="network"||(clearTimeout(Ke),Ke=setTimeout(async()=>{const t=(e||[]).slice(-200).map(n=>({id:n.id,who:n.who,text:String(n.text||"").slice(0,3e3),timestamp:n.timestamp,brand:n.brand,surface:n.surface,productIds:n.productIds,attachments:(n.attachments||[]).map(i=>({name:i.name,type:i.type,product:i.product}))})),{error:a}=await C.from("assistant_memory").upsert({user_id:x.id,messages:t,updated_at:new Date().toISOString()});a&&(D=!0)},1500))}window.addEventListener("kantoong:assistant-history",e=>rt(e.detail?.history));window.addEventListener("kantoong:forget-memory",async()=>{if(window.confirm("Hapus semua memori asisten? Riwayat obrolan di semua toko Kantoong (perangkat ini"+(x?" dan akunmu":"")+") akan dihapus permanen.")){try{Object.keys(localStorage).filter(t=>t.startsWith("kantoong:chat:")).forEach(t=>localStorage.removeItem(t))}catch{}x&&!D&&await C.from("assistant_memory").delete().eq("user_id",x.id),window.KantoongAIBrain?.clearHistory?.()}});let te=!1;const L=new Set;function me(e,t){t?L.add(e):L.delete(e),document.body.classList.toggle("kc-overlay-open",L.size>0);const a=window.KantoongChat;a&&(L.size&&!a.isMinimized?.()?(a.minimize(),te=!0):!L.size&&te&&(te=!1,a.restore?.()))}window.addEventListener("kantoong:overlay",e=>me(e.detail?.name||"lapisan",!!e.detail?.open));window.addEventListener("kantoong:dashboard-opened",()=>me("dashboard",!0));window.addEventListener("kantoong:dashboard-closed",()=>me("dashboard",!1));document.addEventListener("click",e=>{if(window.KantoongEngine)return;const t=e.target.closest?.("#chatBox [data-product-id]");t&&(e.preventDefault(),window.open(`/index.html#produk/${encodeURIComponent(t.dataset.productId)}`,"_blank","noopener"))},!0);async function ha(){la(),await da(),x=await ua(),await ma(),await W(()=>import("./ai-brain-CQUyClC8.js"),__vite__mapDeps([1,2])),window.KantoongAIBrain?.init?.(),await W(()=>import("./chat-sheet-Br22DZKM.js"),__vite__mapDeps([3,2])),E.startMinimized&&window.KantoongChat?.minimize?.(),E.dock!==!1&&$t(),Jt(),Qt(),ca(),pa(),ot(),window.dispatchEvent(new CustomEvent("kantoong:assistant-ready",{detail:{surface:E.surface}}))}ha();export{Mt as A,Kt as B,Te as C,ht as D,Ge as E,Z as F,we as G,Ne as H,Ia as I,w as K,ka as P,W as _,G as a,Ca as b,La as c,Pa as d,ia as e,Sa as f,_a as g,se as h,va as i,fa as j,He as k,wt as l,Aa as m,vt as n,Ma as o,xa as p,$e as q,Re as r,Ea as s,Lt as t,It as u,Et as v,aa as w,ba as x,ya as y,wa as z};
