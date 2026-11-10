const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/chat-sheet-D-2G7aRn.css","assets/ai-brain-BX7jb6Tq.js","assets/theme-fiW6i87O.js","assets/theme-DEI-fNwG.css","assets/supabase-client-V_xEgetV.js","assets/chat-sheet-CG1Ks4n1.js","assets/web-camera-CsE5c4Bk.js"])))=>i.map(i=>d[i]);
import{K as S}from"./theme-fiW6i87O.js";import{supabase as A}from"./supabase-client-V_xEgetV.js";const at="modulepreload",nt=function(e){return"/"+e},de={},W=function(t,a,i){let n=Promise.resolve();if(a&&a.length>0){let d=function(l){return Promise.all(l.map(p=>Promise.resolve(p).then(v=>({status:"fulfilled",value:v}),v=>({status:"rejected",reason:v}))))};document.getElementsByTagName("link");const s=document.querySelector("meta[property=csp-nonce]"),c=s?.nonce||s?.getAttribute("nonce");n=d(a.map(l=>{if(l=nt(l),l in de)return;de[l]=!0;const p=l.endsWith(".css"),v=p?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${l}"]${v}`))return;const g=document.createElement("link");if(g.rel=p?"stylesheet":at,p||(g.as="script"),g.crossOrigin="",g.href=l,c&&g.setAttribute("nonce",c),document.head.appendChild(g),p)return new Promise((m,f)=>{g.addEventListener("load",m),g.addEventListener("error",()=>f(new Error(`Unable to preload CSS for ${l}`)))})}))}function r(s){const c=new Event("vite:preloadError",{cancelable:!0});if(c.payload=s,window.dispatchEvent(c),!c.defaultPrevented)throw s}return n.then(s=>{for(const c of s||[])c.status==="rejected"&&r(c.reason);return t().catch(r)})},N=S?.business_id??"master_template_001",ne=`kantoong:storefront:${N}`,it="kantoong-storefront",Ie=Object.freeze([{kind:"terlaris",label:"Terlaris"},{kind:"terbaru",label:"Terbaru"},{kind:"promo",label:"Promo"},{kind:"termurah",label:"Termurah"},{kind:"rating",label:"Rating 4+"},{kind:"ready",label:"Ready stok"},{kind:"under",label:"Di bawah",needsValue:"price"},{kind:"keyword",label:"Kata kunci",needsValue:"text"}]),rt=Object.freeze(["terlaris","terbaru","promo","termurah","rating"]),u=(e,t=80)=>String(e??"").trim().slice(0,t),st=Object.freeze([{type:"rail",label:"Rel produk",hint:"Kartu produk 3D: terlaris, terbaru, diskon, per kategori, atau pilihanmu"},{type:"media",label:"Galeri bebas",hint:"Gambar apa saja dengan rasio pilihanmu: logo mitra, lookbook, testimoni foto…"},{type:"banner",label:"Banner promo",hint:"Iklan lebar dengan tombol ajakan"},{type:"coupons",label:"Kupon & voucher",hint:"Kode yang bisa diklaim pelanggan"},{type:"jackpot",label:"Kotak hadiah misteri",hint:"Hadiah tak terduga, 1× sehari per pelanggan"},{type:"posters",label:"Poster",hint:"Kartu gambar untuk event / pengumuman"},{type:"text",label:"Teks & pengumuman",hint:"Judul, paragraf, dan tombol ajakan"},{type:"pinned",label:"Produk pilihan (baris kecil)",hint:"Baris produk sederhana yang kamu sematkan"}]),ot=Object.freeze([{id:"terlaris",label:"Terlaris"},{id:"wishlist",label:"Paling banyak di-wishlist"},{id:"terbaru",label:"Terbaru"},{id:"diskon",label:"Sedang diskon"},{id:"rating",label:"Rating tertinggi"},{id:"kategori",label:"Satu kategori"},{id:"manual",label:"Pilih sendiri"}]),ct=Object.freeze(["1:1","4:5","3:4","2:3","9:16","4:3","16:9","21:9","3:1"]),lt=Object.freeze([{id:"geser",label:"Geser ke samping"},{id:"grid",label:"Grid"}]);let dt=0;const ie=e=>`${e}-${Date.now().toString(36)}-${(dt++).toString(36)}`;function da(e,t=""){const a={id:ie(e),type:e,enabled:!0,sample:!1,title:""};return e==="rail"?{...a,eyebrow:"",text:"",source:"terlaris",category:"",productIds:[],limit:10}:e==="media"?t==="logos"?{...a,title:"Bekerja sama dengan",ratio:"1:1",layout:"geser",columns:6,fit:"contain",items:[]}:{...a,ratio:"4:5",layout:"grid",columns:3,fit:"cover",items:[]}:e==="jackpot"?{...a,title:"Kotak hadiah misteri",text:"",rewards:[]}:e==="text"?{...a,text:"",cta:"",action:"none"}:e==="pinned"?{...a,productIds:[]}:{...a,items:[]}}function Ae(){const e=t=>({...t,sample:!0});return{blocks:[e({id:"rail-terlaris",type:"rail",enabled:!0,title:"Best Seller",eyebrow:"Lagi rame 🔥",text:"Yang paling banyak di-checkout pembeli lain.",source:"terlaris",category:"",productIds:[],limit:10}),e({id:"banner-1",type:"banner",enabled:!0,title:"",items:[{title:"Weekend mode: ON",text:"Diskon spesial buat menu favoritmu, khusus Sabtu–Minggu.",image:"",cta:"Cek produknya",action:"catalog"},{title:"Masih galau?",text:"Spill seleramu, asisten kami carikan yang paling pas.",image:"",cta:"Tanya asisten",action:"chat"}]}),e({id:"rail-wishlist",type:"rail",enabled:!0,title:"Paling Bikin Ngiler",eyebrow:"Incaran banyak orang",text:"Yang paling sering disimpan ke wishlist.",source:"wishlist",category:"",productIds:[],limit:10}),e({id:"coupons-1",type:"coupons",enabled:!0,title:"Kupon buat kamu",items:[{code:"HEMAT10",title:"Diskon 10%",text:"Min. belanja Rp 50.000",expires:""},{code:"ONGKIR",title:"Gratis ongkir",text:"Untuk pesanan pertama",expires:""}]}),e({id:"jackpot-1",type:"jackpot",enabled:!0,title:"Kotak hadiah misteri",text:"Buka 1× sehari. Hoki-hokian, hadiahnya acak!",rewards:[{label:"Diskon 5%",code:"MISTERI5",weight:40},{label:"Gratis topping",code:"TOPPING",weight:25},{label:"Diskon 15%",code:"JACKPOT15",weight:5},{label:"Belum beruntung — coba lagi besok",code:"",weight:30}]}),e({id:"rail-terbaru",type:"rail",enabled:!0,title:"Baru Mendarat",eyebrow:"Fresh drop",text:"Koleksi terbaru yang baru masuk toko.",source:"terbaru",category:"",productIds:[],limit:10}),e({id:"media-logos",type:"media",enabled:!0,title:"Bekerja sama dengan",ratio:"1:1",layout:"geser",columns:6,fit:"contain",items:[{title:"Mitra A",text:"",image:"",link:""},{title:"Mitra B",text:"",image:"",link:""},{title:"Mitra C",text:"",image:"",link:""}]}),e({id:"posters-1",type:"posters",enabled:!0,title:"Kabar terbaru",items:[{title:"Menu baru tiap bulan",text:"Stay tuned, kejutannya nggak berhenti.",image:""},{title:"Mau jadi reseller?",text:"Chat asisten, kita ngobrol bareng.",image:""}]})]}}const X=e=>{const t=String(e??"").trim();return/^https:\/\//i.test(t)&&t.length<=600||/^data:image\/(png|webp|jpeg);base64,[a-z0-9+/=]+$/i.test(t)&&t.length<=4e5?t:""},ut=e=>{const t=String(e??"").trim();return/^https:\/\//i.test(t)?t.slice(0,500):""},ue=e=>u(e,20).toUpperCase().replace(/[^A-Z0-9_-]/g,""),mt=(e,t)=>/^[a-z0-9-]{3,60}$/i.test(String(e??""))?String(e):ie(t);function pt(e){const t=st.find(n=>n.type===e?.type);if(!t)return null;const a={id:mt(e.id,t.type),type:t.type,enabled:e.enabled!==!1,sample:e.sample===!0,title:u(e.title,60)},i=Array.isArray(e.items)?e.items.slice(0,24):[];switch(t.type){case"banner":a.items=i.map(n=>({title:u(n?.title,60),text:u(n?.text,160),image:X(n?.image),cta:u(n?.cta,30),action:["catalog","chat","none"].includes(n?.action)?n.action:"catalog"})).filter(n=>n.title);break;case"coupons":a.items=i.map(n=>({code:ue(n?.code),title:u(n?.title,40),text:u(n?.text,100),expires:u(n?.expires,10)})).filter(n=>n.code&&n.title);break;case"posters":a.items=i.map(n=>({title:u(n?.title,60),text:u(n?.text,120),image:X(n?.image)})).filter(n=>n.title);break;case"media":a.ratio=ct.includes(e.ratio)?e.ratio:"1:1",a.layout=lt.some(n=>n.id===e.layout)?e.layout:"grid",a.columns=Math.min(8,Math.max(1,Math.round(Number(e.columns)||3))),a.fit=e.fit==="contain"?"contain":"cover",a.items=i.map(n=>({title:u(n?.title,60),text:u(n?.text,120),image:X(n?.image),link:ut(n?.link)})).filter(n=>n.title||n.image);break;case"jackpot":a.text=u(e.text,160),a.rewards=(Array.isArray(e.rewards)?e.rewards.slice(0,10):[]).map(n=>({label:u(n?.label,50),code:ue(n?.code),weight:Math.min(100,Math.max(1,Math.round(Number(n?.weight)||1)))})).filter(n=>n.label);break;case"text":a.text=u(e.text,600),a.cta=u(e.cta,30),a.action=["catalog","chat","none"].includes(e.action)?e.action:"none";break;case"rail":a.eyebrow=u(e.eyebrow,40),a.text=u(e.text,160),a.source=ot.some(n=>n.id===e.source)?e.source:"terlaris",a.category=u(e.category,60),a.limit=Math.min(30,Math.max(1,Math.round(Number(e.limit)||10))),a.productIds=(Array.isArray(e.productIds)?e.productIds:[]).map(n=>u(n,60)).filter(Boolean).slice(0,30);break;case"pinned":a.productIds=(Array.isArray(e.productIds)?e.productIds:[]).map(n=>u(n,60)).filter(Boolean).slice(0,20);break}return a}function ht(e){const t=Array.isArray(e?.blocks)?e:Ae(),a=new Set;return{blocks:t.blocks.slice(0,40).map(pt).filter(Boolean).map(n=>(a.has(n.id)&&(n.id=ie(n.type)),a.add(n.id),n))}}function ua(e,t){const a=(t??[]).filter(r=>r&&r.is_published!==!1),i=r=>Number(r.price)||0,n=e.limit||10;switch(e.source){case"terlaris":return a.filter(r=>Number(r.sales_count)>0).sort((r,s)=>s.sales_count-r.sales_count).slice(0,n);case"wishlist":return a.filter(r=>Number(r.wishlist_count)>0).sort((r,s)=>s.wishlist_count-r.wishlist_count).slice(0,n);case"terbaru":return a.slice().sort((r,s)=>new Date(s.created_at??0)-new Date(r.created_at??0)).slice(0,n);case"diskon":return a.filter(r=>Number(r.compare_at_price)>i(r)).slice(0,n);case"rating":return a.filter(r=>Number(r.rating_avg)>0).sort((r,s)=>s.rating_avg-r.rating_avg).slice(0,n);case"kategori":return a.filter(r=>String(r.category??"").trim()===e.category).slice(0,n);case"manual":{const r=new Map(a.map(s=>[String(s.id),s]));return e.productIds.map(s=>r.get(s)).filter(Boolean)}default:return[]}}function ma(e,t=Math.random()){const a=(e??[]).filter(r=>r.weight>0),i=a.reduce((r,s)=>r+s.weight,0);if(!i)return null;let n=t*i;for(const r of a)if(n-=r.weight,n<0)return r;return a[a.length-1]}const pa=Object.freeze([{slug:"kontak",key:"contact",label:"Kontak & lokasi"},{slug:"retur",key:"returns",label:"Tukar & retur"},{slug:"pengiriman",key:"shipping",label:"Pengiriman"},{slug:"syarat",key:"terms",label:"Syarat & ketentuan"},{slug:"privasi",key:"privacy",label:"Kebijakan privasi"}]);function gt(e="Toko kami"){return{returns:`Kami ingin kamu puas dengan setiap pembelian di ${e}.

• Penukaran/retur dapat diajukan paling lambat 3 hari setelah barang diterima.
• Barang harus dalam kondisi asli, belum dipakai, dan lengkap dengan kemasan.
• Sertakan nomor pesanan serta foto/video saat membuka paket.
• Bila barang rusak atau salah kirim karena kesalahan kami, ongkos kirim penukaran kami tanggung.
• Dana dikembalikan ke metode pembayaran semula paling lambat 7 hari kerja setelah retur disetujui.

Hubungi kami lewat halaman Kontak untuk mengajukan retur.`,shipping:`• Pesanan diproses pada hari kerja, paling lambat 1×24 jam setelah pembayaran diterima.
• Estimasi tiba tergantung kurir dan kota tujuan, tampil saat checkout.
• Nomor resi dikirim begitu paket diserahkan ke kurir dan bisa dilacak di Dashboard › Lacak Paket.
• Ongkos kirim dihitung otomatis sesuai berat dan tujuan.`,terms:`Dengan berbelanja di ${e}, kamu menyetujui ketentuan berikut:

• Harga dan stok dapat berubah sewaktu-waktu sebelum pesanan dibayar.
• Foto produk diusahakan sesuai aslinya; perbedaan warna kecil bisa terjadi karena layar.
• Pembayaran selalu dilakukan oleh pembeli sendiri. Asisten AI hanya membantu memilih dan tidak pernah membayar atas namamu.
• Kami berhak membatalkan pesanan yang terindikasi penipuan.`,privacy:`${e} menjaga data pribadimu sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.

• Data yang kami simpan: nama, kontak, alamat pengiriman, dan riwayat pesanan — hanya untuk memproses pesananmu.
• Ingatan asisten AI lintas toko hanya aktif bila kamu mengizinkannya, dan bisa dihapus kapan saja (per toko, per jenis, atau semuanya).
• Kami tidak menjual datamu dan tidak memakai sidik jari perangkat untuk melacakmu.
• Kamu berhak melihat, mengunduh, dan meminta penghapusan datamu lewat Dashboard › Pengaturan atau halaman Kontak.`}}const x=(e,t)=>String(e??"").replace(/\r/g,"").trim().slice(0,t);function Ce(e){const t=e??{},a=n=>String(n??"").replace(/[^\d+]/g,"").slice(0,20),i=String(t.email??"").trim().slice(0,120);return{whatsapp:a(t.whatsapp),phone:a(t.phone),email:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i)?i:"",address:x(t.address,300),city:x(t.city,80),hours:x(t.hours,120),maps:/^https:\/\//i.test(String(t.maps??""))?String(t.maps).slice(0,500):"",instagram:x(t.instagram,60).replace(/^@/,"")}}function Le(e){const t=e??{};return{returns:x(t.returns,5e3),shipping:x(t.shipping,5e3),terms:x(t.terms,5e3),privacy:x(t.privacy,5e3)}}function ha(e,t){return e?.brand?.policies?.[t]||gt(e?.brand?.name)[t]||""}function ga(e,t=""){let a=String(e?.brand?.contact?.whatsapp??"").replace(/\D/g,"");return a?(a.startsWith("0")&&(a=`62${a.slice(1)}`),`https://wa.me/${a}${t?`?text=${encodeURIComponent(t)}`:""}`):""}const kt=Object.freeze(["24K","23K","22K","18K","17K","16K","9K"]);function Be(e){const t={};return kt.forEach(a=>{const i=Math.round(Number(e?.prices?.[a])||0);i>0&&(t[a]=Math.min(i,1e8))}),{prices:t,updatedAt:x(e?.updatedAt,30)}}function ft(e){const t=String(e??"").trim();return/^https:\/\//i.test(t)&&t.length<=600||/^data:image\/(png|webp|jpeg);base64,[a-z0-9+/=]+$/i.test(t)&&t.length<=35e4?t:""}function Ke(){return{brand:{name:u(S?.app_name)||"Toko",tagline:"",logo:"",contact:Ce(null),policies:Le(null)},catalog:{categories:{},chips:{},chipLimit:6,gold:Be(null)},home:Ae()}}function bt(e){const t=Ie.find(i=>i.kind===e?.kind);if(!t)return null;const a={kind:t.kind,label:u(e.label,30)||t.label};if(t.needsValue==="price"){const i=Math.max(0,Math.round(Number(e.value)||0));if(!i)return null;a.value=i}if(t.needsValue==="text"){const i=u(e.value,40);if(!i)return null;a.value=i}return a}function re(e){const t=Ke(),a=e?.brand??{},i=e?.catalog??{},n={};Object.entries(i.categories??{}).forEach(([s,c])=>{const d=u(s,60);d&&(n[d]={label:u(c?.label,40),order:Number.isFinite(Number(c?.order))?Number(c.order):999,hidden:c?.hidden===!0})});const r={};return Object.entries(i.chips??{}).forEach(([s,c])=>{Array.isArray(c)&&(r[u(s,60)]=c.map(bt).filter(Boolean).slice(0,20))}),{brand:{name:u(a.name,60)||t.brand.name,tagline:u(a.tagline,120),logo:ft(a.logo),contact:Ce(a.contact),policies:Le(a.policies)},catalog:{categories:n,chips:r,chipLimit:Math.min(20,Math.max(1,Math.round(Number(i.chipLimit)||t.catalog.chipLimit))),gold:Be(i.gold)},home:ht(e?.home)}}function yt(e,t){return e?.catalog?.categories?.[t]?.label||t||"Lainnya"}function ka(e,t){const a=[...new Set((e??[]).map(n=>u(n.category,60)||"Lainnya"))],i=t?.catalog?.categories??{};return a.filter(n=>i[n]?.hidden!==!0).sort((n,r)=>(i[n]?.order??999)-(i[r]?.order??999)||n.localeCompare(r,"id")).map(n=>({key:n,label:yt(t,n)}))}function fa(e,t){const a=e?.catalog?.chips?.[t];return(Array.isArray(a)&&a.length?a:e?.catalog?.chips?.["*"]??rt.map(n=>({kind:n,label:Ie.find(r=>r.kind===n).label}))).slice(0,e?.catalog?.chipLimit??6)}const $=e=>Number(e?.price)||0;function ba(e,t){const a=(e??[]).slice();if(!t)return a;switch(t.kind){case"terlaris":return a.sort((i,n)=>(Number(n.sales_count)||0)-(Number(i.sales_count)||0));case"terbaru":return a.sort((i,n)=>new Date(n.created_at??0)-new Date(i.created_at??0));case"promo":return a.filter(i=>Number(i.compare_at_price)>$(i));case"termurah":return a.sort((i,n)=>$(i)-$(n));case"rating":return a.filter(i=>Number(i.rating_avg)>=4);case"ready":return a.filter(i=>i.stock===null||i.stock===void 0||Number(i.stock)>0);case"under":return a.filter(i=>$(i)<=Number(t.value));case"keyword":{const i=String(t.value).toLowerCase();return a.filter(n=>[n.name,n.caption,n.description].join(" ").toLowerCase().includes(i))}default:return a}}function ya(e){if(e.kind==="under"&&e.value){const t=Number(e.value);return`${e.label||"Di bawah"} ${t>=1e3?`${Math.round(t/1e3)}rb`:t}`}return e.kind==="keyword"&&e.label==="Kata kunci"?e.value:e.label}function Te(){try{return re(JSON.parse(localStorage.getItem(ne)||"null"))}catch{return Ke()}}function wt(e){try{localStorage.setItem(ne,JSON.stringify(e))}catch{}}let b=Te();S&&b.brand.name&&(S.app_name=b.brand.name);const te=new Set;let Y=null;try{Y=typeof BroadcastChannel<"u"?new BroadcastChannel(it):null}catch{Y=null}function B(e,{broadcast:t=!0}={}){b=re(e),S&&(S.app_name=b.brand.name),wt(b),t&&Y?.postMessage(b),te.forEach(a=>{try{a(b)}catch(i){console.warn("[KANTOONG] Pendengar etalase gagal:",i)}}),typeof window<"u"&&window.dispatchEvent(new CustomEvent("kantoong:storefront-changed",{detail:b}))}function wa(){return b}let Q=null;function se(){return Q||(Q=W(()=>import("./supabase-client-V_xEgetV.js"),[]).then(e=>e.supabase).catch(()=>null)),Q}async function vt(){try{const e=await se();if(!e)return b;const{data:t,error:a}=await e.from("storefront_settings").select("settings").eq("business_id",N).maybeSingle();if(a)throw a;t?.settings&&B(t.settings)}catch(e){console.info("[KANTOONG] Pengaturan etalase memakai salinan lokal:",e?.message||e)}return b}async function va(e,t,{demo:a=!1}={}){if(!["brand","catalog","home"].includes(e))throw new Error("Bagian tidak dikenal.");const i=re({...b,[e]:t});if(!a){const n=await se();if(!n)throw new Error("Tidak tersambung ke server.");const{data:r,error:s}=await n.rpc("storefront_save",{p_business_id:N,p_section:e,p_value:i[e]});if(s)throw s;if(r?.error==="Bagian tidak dikenal.")throw new Error("Database belum diperbarui: jalankan ULANG file db/storefront.sql di Supabase › SQL Editor, lalu simpan lagi.");if(r?.error)throw new Error(r.error)}return B(i),b}function _a(e){return te.add(e),()=>te.delete(e)}let me=!1;async function Sa(){if(!me){me=!0,Y?.addEventListener("message",e=>B(e.data,{broadcast:!1})),window.addEventListener("storage",e=>{e.key===ne&&B(Te(),{broadcast:!1})}),await vt();try{(await se())?.channel(`storefront:${N}`).on("postgres_changes",{event:"*",schema:"public",table:"storefront_settings",filter:`business_id=eq.${N}`},t=>{t.new?.settings&&B(t.new.settings)}).subscribe()}catch{}}}const ae="kantoong:assistant:memory-scope",Pe=Object.freeze({store:"toko",cart:"keranjang",product:"halaman produk",dashboard:"dashboard pengguna",erp:"dashboard kerja ERP"});function z(){try{const e=localStorage.getItem(ae);return e==="network"||e==="brand"?e:null}catch{return null}}function _t(e){try{e==="network"||e==="brand"?localStorage.setItem(ae,e):localStorage.removeItem(ae)}catch{}}function Ne(){return String(S?.business_id||S?.businessId||"default")}function Oe(){return String(S?.app_name||"Kantoong")}function pe(){return z()==="network"?"kantoong:chat:network":`kantoong:chat:${Ne()}`}function St(){const e=window.KantoongAssistantContext?.surface;if(e&&Pe[e]){if(e==="store"){if(document.querySelector(".cart-page.is-open, #cartPage.is-open"))return"cart";if(location.hash.startsWith("#produk/"))return"product";if(document.body.classList.contains("dashboard-open"))return"dashboard"}return e}return location.pathname.includes("/erp/")?"erp":"store"}function Mt(){const e=window.KantoongAssistantContext?.page;return typeof e=="function"?String(e()||"").slice(0,120):e?String(e).slice(0,120):location.hash.startsWith("#produk/")?`halaman produk "${document.title.split(" · ")[0]}"`:location.pathname.includes("/erp/")?`menu ERP "${document.title.split(" — ")[0]}"`:""}function Ma(){const e=window.KantoongAssistantContext||{},t=St();return{surface:t,surface_label:Pe[t]||t,brand:Oe(),brand_id:Ne(),user_name:String(e.userName||"").slice(0,60),network_memory:z()==="network",page_title:String(document.title||"").slice(0,80),page:Mt(),dashboard_state:typeof e.state=="function"?String(e.state()||"").slice(0,2500):"",targets:typeof e.targets=="function"?e.targets().slice(0,120).map(a=>String(a).slice(0,60)):[]}}const xt=`
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
                <strong id="peekTitle">Hai, Kak! 👋</strong>
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
`,De=window.matchMedia("(min-width: 900px)"),M=document.documentElement,ze="kantoong:assistant-dock",je=["float","side","half"],R=["side","half"],he={float:"Melayang di atas halaman",side:"Chat di samping",half:"Belah layar dua"},Et={float:'<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="7" y="11" width="10" height="5" rx="1.5"/>',side:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M15 5v14"/>',half:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/>'},It='<path d="M7 7h12l-3-3M17 17H5l3 3"/>';function At(){try{const e=JSON.parse(localStorage.getItem(ze)||"{}");return{side:e.side==="left"?"left":"right",size:je.includes(e.size)?e.size:"side"}}catch{return{side:"right",size:"side"}}}const k=At();function Ct(){try{localStorage.setItem(ze,JSON.stringify(k))}catch{}}function K(e){const t=window.innerWidth;return Math.round(e==="half"?t/2:Math.min(440,Math.max(360,t*.32)))}function $e(e,t){M.style.setProperty("--kc-dock-w",`${Math.round(e)}px`),M.style.setProperty("--kc-dock-pad",`${Math.round(t)}px`)}let ge=0;function Re(){clearTimeout(ge),ge=setTimeout(()=>window.dispatchEvent(new Event("resize")),320)}function J(){M.dataset.kcDockSide=k.side,M.dataset.kcDockSize=k.size,$e(K(k.size),K(k.size)),document.querySelectorAll(".kc-dock-tool[data-kc-dock-size]").forEach(e=>{e.setAttribute("aria-pressed",String(e.dataset.kcDockSize===k.size))})}function O(e){Object.assign(k,e),Ct(),J(),G(),Re()}let He=null;function G(){const e=He;if(!e)return;const t=De.matches&&k.size!=="float"&&!e.hidden&&e.dataset.state!=="peek"&&e.dataset.open==="true";M.classList.contains("kc-docked")!==t&&(M.classList.toggle("kc-docked",t),e.classList.toggle("kc-sheet--docked",t),Re())}function ke(e){return`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${e}</svg>`}function Lt(e){const t=e.querySelector(".kc-chatbar");if(!t||t.querySelector(".kc-dock-tools"))return;const a=document.createElement("div");a.className="kc-dock-tools",a.setAttribute("role","group"),a.setAttribute("aria-label","Ukuran chat");for(const n of je){const r=document.createElement("button");r.type="button",r.className="kc-dock-tool",r.dataset.kcDockSize=n,r.title=he[n],r.setAttribute("aria-label",he[n]),r.innerHTML=ke(Et[n]),r.addEventListener("click",()=>O({size:n})),a.appendChild(r)}const i=document.createElement("button");i.type="button",i.className="kc-dock-tool kc-dock-swap",i.title="Pindah sisi",i.setAttribute("aria-label","Pindahkan chat ke sisi lain"),i.innerHTML=ke(It),i.addEventListener("click",()=>O({side:k.side==="right"?"left":"right"})),a.appendChild(i),t.querySelector("#chatCloseBtn")?.before(a)}function Bt(e){if(e.querySelector(".kc-dock-edge"))return;const t=document.createElement("div");t.className="kc-dock-edge",t.tabIndex=0,t.title="Tarik untuk mengubah lebar chat",t.setAttribute("role","separator"),t.setAttribute("aria-orientation","vertical"),t.setAttribute("aria-label","Ubah lebar chat (panah kiri/kanan)"),e.appendChild(t);let a=null,i=0;const n=s=>{const c=window.innerWidth,d=k.side==="right"?c-s+8:s+8;return Math.min(c*.7,Math.max(200,d))};t.addEventListener("pointerdown",s=>{s.button>0||(a=s.pointerId,i=K(k.size),t.setPointerCapture?.(a),M.classList.add("kc-dock-resizing"),s.preventDefault())}),t.addEventListener("pointermove",s=>{s.pointerId===a&&(i=n(s.clientX),$e(i,i))});const r=s=>{if(s.pointerId!==a)return;if(a=null,M.classList.remove("kc-dock-resizing"),i<280){J(),window.KantoongChat?.collapse?.();return}const c=R.reduce((d,l)=>Math.abs(K(l)-i)<Math.abs(K(d)-i)?l:d);O({size:c})};t.addEventListener("pointerup",r),t.addEventListener("pointercancel",r),t.addEventListener("keydown",s=>{if(s.key!=="ArrowLeft"&&s.key!=="ArrowRight")return;s.preventDefault();const c=s.key==="ArrowLeft"==(k.side==="right"),d=R.indexOf(k.size)+(c?1:-1);d>=0&&d<R.length&&O({size:R[d]})})}function Kt(e){let t="";const a=i=>{i!==t&&(t=i,window.dispatchEvent(new CustomEvent(i?"kantoong:stage-focus":"kantoong:stage-blur",{detail:{id:i}})))};e.addEventListener("pointerover",i=>{if(!M.classList.contains("kc-docked")||i.pointerType==="touch")return;const n=i.target.closest?.("#chatBox [data-product-id]");a(n?String(n.dataset.productId):"")}),e.addEventListener("pointerleave",()=>a(""))}function Tt(){const e=document.getElementById("chatPanel");e&&(He=e,J(),Lt(e),Bt(e),Kt(e),new MutationObserver(G).observe(e,{attributes:!0,attributeFilter:["data-open","data-state","hidden"]}),De.addEventListener("change",G),G(),window.addEventListener("kantoong:dock-throw",t=>{const a=t.detail?.side==="left"?"left":"right",i=k.size==="float"?{side:a,size:"side"}:{side:a};(i.side!==k.side||i.size)&&O(i)}),window.addEventListener("resize",()=>{M.classList.contains("kc-dock-resizing")||J()}))}const H=window.matchMedia("(hover: hover) and (pointer: fine)"),Pt='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="4" width="7.5" height="7.5" rx="2"/><rect x="3" y="14.5" width="7.5" height="5.5" rx="2"/><rect x="13.5" y="14.5" width="7.5" height="5.5" rx="2"/></svg>',fe=new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short"}),be=new Intl.DateTimeFormat("id-ID",{hour:"2-digit",minute:"2-digit"});function h(e,t,a){const i=document.createElement(e);return t&&(i.className=t),a!=null&&(i.textContent=a),i}function Nt(e){const t=e.find(i=>i.who==="user");if(!t)return"Chat baru";const a=String(t.text||"").replace(/\s+/g," ").trim();return a||(t.attachments?.length?"Kirim lampiran":"Chat tanpa judul")}function Ot(){const e=window.KantoongAIBrain,t=e?.getHistory?.()||[],i=(e?.getArchive?.()||[]).map((n,r)=>({index:r,messages:n.messages})).reverse();return i.unshift({index:-1,current:!0,messages:t}),i.map(n=>({...n,title:Nt(n.messages),startedAt:Number(n.messages[0]?.timestamp)||Date.now()}))}function Dt(e){const t=e.who==="user"?"user":"ai",a=h("div",`kc-hcard__msg kc-hcard__msg--${t}`),i=String(e.text||"").trim();i&&a.appendChild(h("p","",i.length>90?`${i.slice(0,90)}…`:i));const n=Array.isArray(e.productIds)?e.productIds.slice(0,3):[];if(n.length){const r=h("div","kc-hcard__products");for(const s of n){const c=window.KantoongAIBrain?.describeProduct?.(s),d=h("span","kc-hcard__product");if(c?.image){const l=document.createElement("img");l.src=c.image,l.alt="",l.loading="lazy",d.appendChild(l)}else d.classList.add("is-gone"),d.title="Produk sudah tidak tersedia";r.appendChild(d)}a.appendChild(r)}return a}function zt(e){const t=h("button","kc-hcard");t.type="button",t.dataset.index=String(e.index),e.current&&t.classList.add("is-current");const a=new Date(e.startedAt);t.setAttribute("aria-label",`${e.current?"Chat sekarang: ":"Buka chat: "}${e.title}, ${fe.format(a)} ${be.format(a)}`);const i=h("span","kc-hcard__preview"),n=h("span","kc-hcard__track");return e.messages.slice(0,14).forEach(r=>n.appendChild(Dt(r))),i.append(n,h("span","kc-hcard__time",be.format(a))),e.current&&i.appendChild(h("span","kc-hcard__badge","Sedang dibuka")),t.append(i,h("span","kc-hcard__title",e.title),h("span","kc-hcard__date",fe.format(a))),t}function I(e,t){if(!(!e||e.classList.contains("is-live")===t)&&(e.classList.toggle("is-live",t),t)){const a=e.querySelector(".kc-hcard__preview"),i=e.querySelector(".kc-hcard__track"),n=Math.max(0,i.scrollHeight-a.clientHeight+16);e.style.setProperty("--kc-track-dist",`${-n}px`)}}function ye(e){const t=e.getBoundingClientRect(),a=t.top+t.height/2;let i=null,n=1/0;for(const r of e.querySelectorAll(".kc-hcard")){const s=r.getBoundingClientRect(),c=Math.abs(s.top+s.height/2-a);c<n&&(n=c,i=r)}e.querySelectorAll(".kc-hcard.is-live").forEach(r=>{r!==i&&I(r,!1)}),I(i,!0)}function jt(){const e=document.getElementById("chatPanel"),t=e?.querySelector(".kc-chatbar");if(!e||!t||e.querySelector(".kc-history"))return;const a=t.querySelector("h2"),i=a?.textContent||"Konsultasi AI",n=h("button","kc-icon-btn kc-history-btn");n.type="button",n.title="Riwayat chat",n.setAttribute("aria-label","Riwayat chat AI"),n.setAttribute("aria-pressed","false"),n.innerHTML=Pt,(t.querySelector(".kc-dock-tools")||t.querySelector("#chatCloseBtn"))?.before(n);const r=h("section","kc-history");r.setAttribute("aria-label","Riwayat chat AI");const s=h("div","kc-history__head"),c=h("p","kc-history__note","Obrolan 30 hari terakhir"),d=h("button","kc-history__new","+ Chat baru");d.type="button",s.append(c,d);const l=h("div","kc-history__grid");r.append(s,l),(e.querySelector("#chatBox")||e.lastElementChild).before(r);let p=0;const v=()=>{const m=Ot();l.replaceChildren(...m.map(zt)),m.length===1&&l.appendChild(h("p","kc-history__empty",'Tekan "+ Chat baru" untuk menyimpan obrolan ini. Obrolan lama akan muncul di sini.')),H.matches||requestAnimationFrame(()=>ye(r))},g=m=>{e.dataset.view=m?"history":"chat",n.setAttribute("aria-pressed",String(m)),a&&(a.textContent=m?"Riwayat Chat AI":i),m&&(v(),r.scrollTop=0)};n.addEventListener("click",()=>g(e.dataset.view!=="history")),d.addEventListener("click",()=>{window.KantoongAIBrain?.newChat?.(),g(!1)}),l.addEventListener("pointerover",m=>{if(!H.matches)return;const f=m.target.closest(".kc-hcard");l.querySelectorAll(".kc-hcard.is-live").forEach(_=>_!==f&&I(_,!1)),I(f,!0)}),l.addEventListener("pointerleave",()=>{H.matches&&l.querySelectorAll(".kc-hcard.is-live").forEach(m=>I(m,!1))}),r.addEventListener("scroll",()=>{H.matches||p||(p=requestAnimationFrame(()=>{p=0,ye(r)}))},{passive:!0}),l.addEventListener("touchstart",m=>{const f=m.target.closest(".kc-hcard");f&&(l.querySelectorAll(".kc-hcard.is-live").forEach(_=>_!==f&&I(_,!1)),I(f,!0))},{passive:!0}),l.addEventListener("click",m=>{const f=m.target.closest(".kc-hcard");f&&(f.classList.add("is-opening"),setTimeout(()=>{const _=Number(f.dataset.index);_>=0&&window.KantoongAIBrain?.openArchived?.(_),g(!1)},240))}),new MutationObserver(()=>{e.dataset.open==="false"&&e.dataset.view==="history"&&g(!1)}).observe(e,{attributes:!0,attributeFilter:["data-open"]}),e.dataset.view="chat"}const q=56,we=56,ve=8;function $t(e){return window.KantoongAIBrain?.findProduct?.(e.dataset.productId)||null}function _e(){return typeof window.KantoongEngine?.addToCart=="function"}function Rt(e){const t=Math.sign(e),a=Math.abs(e);return t*we*(1-Math.exp(-a/(we*.9)))}function Ht(e,t){const a=window.KantoongAIBrain?.describeProduct?.(e.dataset.productId)||{};window.dispatchEvent(new CustomEvent("kantoong:attach-product",{detail:{product:{id:e.dataset.productId,name:a.name||t.name||"",price:Number(t.price??t.harga)||null,image_url:a.image||t.image_url||""}}}))}function qt(e){window.KantoongEngine.addToCart(e)}function Ft(){const e=document.getElementById("chatBox");if(!e||e.dataset.gesturesReady==="true")return;e.dataset.gesturesReady="true";let t=null,a=!1;const i=r=>{r.classList.remove("is-pulling"),r.style.removeProperty("--kc-pull"),delete r.dataset.gesture};e.addEventListener("pointerdown",r=>{if(r.pointerType==="mouse"&&r.button!==0)return;const s=r.target.closest(".ai-product-card[data-product-id]");s&&(t={card:s,id:r.pointerId,x:r.clientX,y:r.clientY,active:!1,dy:0})}),e.addEventListener("pointermove",r=>{if(!t||r.pointerId!==t.id)return;const s=r.clientX-t.x,c=r.clientY-t.y;if(!t.active){if(Math.abs(s)<ve&&Math.abs(c)<ve)return;if(Math.abs(s)>=Math.abs(c)){t=null;return}t.active=!0,t.card.classList.add("is-pulling");try{t.card.setPointerCapture(r.pointerId)}catch{}}t.dy=c>0&&!_e()?0:c;const d=Rt(t.dy);t.card.style.setProperty("--kc-pull",`${d.toFixed(1)}px`),t.dy<=-q?t.card.dataset.gesture="up":t.dy>=q?t.card.dataset.gesture="down":t.card.dataset.gesture=t.dy<0?"up-hint":t.dy>0?"down-hint":"",r.preventDefault()});const n=(r,s)=>{if(!t||r.pointerId!==t.id)return;const{card:c,active:d,dy:l}=t;if(t=null,!d)return;a=!0,setTimeout(()=>{a=!1},0);const p=$t(c);!s&&p&&l<=-q?(c.classList.add("is-sent-up"),Ht(c,p)):!s&&p&&l>=q&&_e()&&(c.classList.add("is-sent-down"),qt(p)),i(c),setTimeout(()=>c.classList.remove("is-sent-up","is-sent-down"),520)};e.addEventListener("pointerup",r=>n(r,!1)),e.addEventListener("pointercancel",r=>n(r,!0)),e.addEventListener("click",r=>{!a||!r.target.closest(".ai-product-card")||(r.preventDefault(),r.stopPropagation(),a=!1)},!0),e.addEventListener("dragstart",r=>{r.target.closest?.(".ai-product-card")&&r.preventDefault()})}const qe=Object.freeze({hadiah:{label:"Hadiah / oleh-oleh",words:["hadiah","kado","oleh","parcel","hampers","ultah","ulang"]},hemat:{label:"Harga hemat",words:["murah","hemat","promo","diskon","voucher","terjangkau","budget"]},sehat:{label:"Sehat / diet",words:["sehat","diet","gula","kalori","protein","vegan","olahraga"]},cepat:{label:"Butuh cepat",words:["cepat","kilat","hari","besok","instan","sameday"]},banyak:{label:"Beli banyak / acara",words:["grosir","banyak","acara","kantor","arisan","reseller","partai"]},rasa:{label:"Cari rasa / varian",words:["rasa","varian","manis","pahit","segar","creamy","baru"]}}),Ut=Object.freeze({harga:{label:"Kemahalan",words:["mahal","kemahalan","kemahalan","overprice","kurangin","nego","potongan"]},ukuran:{label:"Ukuran tidak cocok / tidak ada",words:["ukuran","size","kekecilan","kebesaran","sempit","longgar","kecil","besar"]},ongkir:{label:"Ongkir mahal",words:["ongkir","ongkos","pengiriman","kirim"]},stok:{label:"Stok habis",words:["habis","stok","kosong","restok","ready"]},waktu:{label:"Pengiriman lama",words:["lama","telat","lambat","kapan","sampai"]},ragu:{label:"Ragu kualitas",words:["ori","asli","kualitas","bagus","awet","garansi","palsu","review"]},warna:{label:"Warna / model tidak ada",words:["warna","model","motif","varian"]}}),Fe=new Map(Object.entries(Ut).flatMap(([e,t])=>t.words.map(a=>[a,e])));function Gt(e){return Fe.get(e)||null}const Ue=new Map(Object.entries(qe).flatMap(([e,t])=>t.words.map(a=>[a,e]))),Ge=new Set(["yang","dan","atau","ada","untuk","dengan","apa","saja","mau","kak","dong","nya","ini","itu","bisa","tolong","produk"]);function Vt(e=[]){const t=new Set;for(const a of e)for(const i of`${a.name||""} ${a.category||""}`.toLowerCase().split(/[^a-z]+/))i.length>=3&&!Ge.has(i)&&t.add(i);return t}function Wt(e,t=new Set){const a=[];for(const i of String(e||"").toLowerCase().split(/[^a-z]+/)){const n=i==="cokelat"?"coklat":i;if(!(n.length<3||Ge.has(n))&&((t.has(n)||Ue.has(n)||Fe.has(n))&&!a.includes(n)&&a.push(n),a.length===5))break}return a}function Se(e){return Ue.get(e)||null}function Yt(e,t,a=new Date){const i=a.getTime()-t*864e5;return e.filter(n=>new Date(n.at).getTime()>=i)}const F=(e,t)=>{const a=new Map;for(const i of e){const n=t(i);n&&a.set(n,(a.get(n)||0)+1)}return a},U=(e,t)=>[...e.entries()].sort((a,i)=>i[1]-a[1]||String(a[0]).localeCompare(String(i[0]))).slice(0,t);function Jt(e){return(new Date(e).getUTCHours()+7)%24}function xa(e,t=[],{days:a=30,now:i=new Date}={}){const n=Yt(e,a,i),r=(o,y)=>t.find(tt=>String(tt.id)===String(o))?.name||y||"Produk",s=o=>n.filter(y=>y.kind===o),c=new Set(n.map(o=>o.session_key)).size,d=s("ask"),l=n.filter(o=>o.product_id&&o.kind!=="cart"),p=s("cart"),v=F(l,o=>String(o.product_id)),g=F(p,o=>String(o.product_id)),m=new Map(n.filter(o=>o.product_id).map(o=>[String(o.product_id),o.product_name])),f=U(v,8).map(([o,y])=>({product_id:o,name:r(o,m.get(o)),count:y,carts:g.get(o)||0})),_=U(v,50).map(([o,y])=>({product_id:o,name:r(o,m.get(o)),count:y,carts:g.get(o)||0})).filter(o=>o.count>=3&&o.carts/o.count<.2).slice(0,5),ce=d.flatMap(o=>o.keywords||[]),Xe=U(F(ce,Se),6).map(([o,y])=>({key:o,label:qe[o].label,count:y})),Qe=U(F(ce.filter(o=>!Se(o)&&!Gt(o)),o=>o),12).map(([o,y])=>({word:o,count:y})),j=Array.from({length:24},()=>0);for(const o of d)j[Jt(o.at)]+=1;const et=j.indexOf(Math.max(...j)),le=new Set(p.map(o=>o.session_key)).size;return{days:a,totals:{sessions:c,asks:d.length,recommends:s("recommend").length,carts:p.length,conversion:c?Math.round(le/c*100):0},funnel:[{key:"ask",label:"Bertanya ke AI",value:new Set(d.map(o=>o.session_key)).size},{key:"recommend",label:"Dapat rekomendasi",value:new Set(s("recommend").map(o=>o.session_key)).size},{key:"view",label:"Melihat produk",value:new Set(n.filter(o=>o.kind==="view"||o.kind==="attach").map(o=>o.session_key)).size},{key:"cart",label:"Masuk keranjang",value:le}],topProducts:f,interestedNotBought:_,needs:Xe,keywords:Qe,hours:j,peakHour:d.length?et:null}}function Zt(e){const t=new Map;for(const a of[...e].sort((i,n)=>new Date(i.at)-new Date(n.at)))t.has(a.session_key)||t.set(a.session_key,`Tamu #${t.size+1}`);return t}const Me={ask:(e,t,a)=>`${e} bertanya${a?` soal ${a}`:""}`,recommend:(e,t)=>`AI merekomendasikan ${t} ke ${e}`,attach:(e,t)=>`${e} menanyakan ${t} lebih lanjut`,view:(e,t)=>`${e} membuka detail ${t}`,cart:(e,t)=>`${e} memasukkan ${t} ke keranjang`};function Ea(e,{products:t=[],labels:a=Zt(e),limit:i=30}={}){return[...e].sort((n,r)=>new Date(r.at)-new Date(n.at)).slice(0,i).map(n=>{const r=t.find(c=>String(c.id)===String(n.product_id))?.name||n.product_name||"produk",s=(n.keywords||[]).slice(0,2).join(", ");return{at:n.at,kind:n.kind,text:(Me[n.kind]||Me.ask)(a.get(n.session_key)||"Tamu",r,s)}})}const Ve=4e3,We=20;let T=[],P=0,V=!1;function Xt(){try{let e=sessionStorage.getItem("kantoong:ai-session");return e||(e=`s-${Math.random().toString(36).slice(2,10)}${Date.now().toString(36).slice(-4)}`,sessionStorage.setItem("kantoong:ai-session",e)),e}catch{return null}}function Qt(){return window.KantoongAIBrain?.getProducts?.()||window.KantoongState?.products||[]}function ea(e,t=""){const a=window.KantoongAIBrain?.findProduct?.(e);return String(a?.name||t||"").slice(0,120)}async function Z(){if(clearTimeout(P),P=0,!T.length||V)return;const e=T.splice(0,We);try{const{error:t}=await A.rpc("log_ai_events",{p:e});t&&(V=!0)}catch{V=!0}T.length&&(P=setTimeout(Z,Ve))}function C(e,{productId:t=null,name:a="",keywords:i=[]}={}){if(V)return;const n=Xt();n&&(T.push({business_id:S.business_id,session_key:n,kind:e,product_id:t?String(t):null,product_name:t?ea(t,a):null,keywords:i,surface:window.KantoongAssistantContext?.surface||"store"}),T.length>=We?Z():P||(P=setTimeout(Z,Ve)))}function ta(){window.__kantoongTelemetry||(window.__kantoongTelemetry=!0,window.KantoongAssistantContext?.surface!=="erp"&&(navigator.doNotTrack==="1"||window.doNotTrack==="1"||(window.addEventListener("kantoong:ai-response",e=>{const t=e.detail||{};C("ask",{keywords:Wt(t.question,Vt(Qt()))});for(const a of(t.product_ids||[]).slice(0,6))C("recommend",{productId:a})}),window.addEventListener("kantoong:attach-product",e=>{const t=e.detail?.product;t?.id&&C("attach",{productId:t.id,name:t.name})}),window.addEventListener("kantoong:quickview-opened",e=>{const t=e.detail?.product;t?.id&&C("view",{productId:t.id,name:t.name})}),window.addEventListener("kantoong:cart-add",e=>{const t=e.detail?.product;t?.id&&C("cart",{productId:t.id,name:t.name})}),window.addEventListener("pagehide",Z))))}const w=window.KantoongAssistantContext=window.KantoongAssistantContext||{};w.surface||(w.surface=location.pathname.includes("/erp/")?"erp":"store");(w.dock===!1||w.free===!0)&&(document.documentElement.dataset.kcFree="");w.free===!0&&w.dock!==!1&&(document.documentElement.dataset.kcDockable="");function aa(){if(document.getElementById("chatPanel"))return;const e=document.createElement("template");e.innerHTML=xt.trim();const t=document.getElementById("appRoot");if(t){t.appendChild(e.content);return}const a=document.createElement("div");a.id="kantoongAssistantHost",a.className="kc-host",a.appendChild(e.content),document.body.appendChild(a)}async function na(){[...document.styleSheets].some(t=>String(t.href||"").includes("chat-sheet.css"))||document.querySelector('link[href*="chat-sheet.css"], style[data-vite-dev-id*="chat-sheet"]')||await W(()=>Promise.resolve({}),__vite__mapDeps([0]))}async function ia(){try{const{data:e}=await A.auth.getSession(),t=e?.session?.user;if(!t)return null;const a=t.user_metadata||{};return w.userName||(w.userName=String(a.full_name||a.name||"").trim()),t}catch{return null}}async function ra(){if(!(window.KantoongState||document.getElementById("appRoot")))try{const{data:e}=await A.from("products").select("id, name, price, category, description, image_url").limit(60);window.KantoongState={products:e||[]}}catch{window.KantoongState={products:[]}}}function Ye(...e){const t=new Map;for(const a of e)for(const i of a||[])i&&i.id&&!t.has(i.id)&&t.set(i.id,i);return[...t.values()].sort((a,i)=>Number(a.timestamp)-Number(i.timestamp)).slice(-200)}function xe(e){try{return JSON.parse(localStorage.getItem(e)||"[]")}catch{return[]}}function sa(){if(z()||document.querySelector(".kc-consent"))return;const e=document.getElementById("chatBox");if(!e)return;const t=document.createElement("div");t.className="kc-consent",t.setAttribute("role","region"),t.setAttribute("aria-label","Izin memori asisten");const a=document.createElement("p");a.textContent="Boleh aku mengingat obrolan kita di semua toko jaringan Kantoong? Jadi saat kamu pindah toko, aku tetap nyambung. Kamu bisa menghapusnya kapan saja lewat menu +.";const i=document.createElement("button");i.type="button",i.className="kc-consent__yes",i.textContent="Ingat di semua toko";const n=document.createElement("button");n.type="button",n.className="kc-consent__no",n.textContent=`Hanya di ${Oe()}`;const r=async c=>{const d=xe(pe());if(_t(c),t.remove(),c==="network"){const l=Ye(xe(pe()),d);window.KantoongAIBrain?.reload?.(l),await Je()}else window.KantoongAIBrain?.reload?.()};i.addEventListener("click",()=>r("network")),n.addEventListener("click",()=>r("brand"));const s=document.createElement("div");s.className="kc-consent__actions",s.append(i,n),t.append(a,s),e.before(t)}let E=null,D=!1,Ee=0;async function Je(){if(!E||D||z()!=="network")return;const{data:e,error:t}=await A.from("assistant_memory").select("messages").eq("user_id",E.id).maybeSingle();if(t){D=!0;return}const a=window.KantoongAIBrain?.getHistory?.()||[],i=Ye(a,e?.messages||[]);i.length!==a.length&&window.KantoongAIBrain?.reload?.(i),i.length!==(e?.messages||[]).length&&Ze(i)}function Ze(e){!E||D||z()!=="network"||(clearTimeout(Ee),Ee=setTimeout(async()=>{const t=(e||[]).slice(-200).map(i=>({id:i.id,who:i.who,text:String(i.text||"").slice(0,3e3),timestamp:i.timestamp,brand:i.brand,surface:i.surface,productIds:i.productIds,attachments:(i.attachments||[]).map(n=>({name:n.name,type:n.type,product:n.product}))})),{error:a}=await A.from("assistant_memory").upsert({user_id:E.id,messages:t,updated_at:new Date().toISOString()});a&&(D=!0)},1500))}window.addEventListener("kantoong:assistant-history",e=>Ze(e.detail?.history));window.addEventListener("kantoong:forget-memory",async()=>{if(window.confirm("Hapus semua memori asisten? Riwayat obrolan di semua toko Kantoong (perangkat ini"+(E?" dan akunmu":"")+") akan dihapus permanen.")){try{Object.keys(localStorage).filter(t=>t.startsWith("kantoong:chat:")).forEach(t=>localStorage.removeItem(t))}catch{}E&&!D&&await A.from("assistant_memory").delete().eq("user_id",E.id),window.KantoongAIBrain?.clearHistory?.()}});let ee=!1;const L=new Set;function oe(e,t){t?L.add(e):L.delete(e),document.body.classList.toggle("kc-overlay-open",L.size>0);const a=window.KantoongChat;a&&(L.size&&!a.isMinimized?.()?(a.minimize(),ee=!0):!L.size&&ee&&(ee=!1,a.restore?.()))}window.addEventListener("kantoong:overlay",e=>oe(e.detail?.name||"lapisan",!!e.detail?.open));window.addEventListener("kantoong:dashboard-opened",()=>oe("dashboard",!0));window.addEventListener("kantoong:dashboard-closed",()=>oe("dashboard",!1));document.addEventListener("click",e=>{if(window.KantoongEngine)return;const t=e.target.closest?.("#chatBox [data-product-id]");t&&(e.preventDefault(),window.open(`/index.html#produk/${encodeURIComponent(t.dataset.productId)}`,"_blank","noopener"))},!0);async function oa(){aa(),await na(),E=await ia(),await ra(),await W(()=>import("./ai-brain-BX7jb6Tq.js"),__vite__mapDeps([1,2,3,4])),window.KantoongAIBrain?.init?.(),await W(()=>import("./chat-sheet-CG1Ks4n1.js"),__vite__mapDeps([5,6,2,3])),w.startMinimized&&window.KantoongChat?.minimize?.(),w.dock!==!1&&Tt(),jt(),Ft(),ta(),sa(),Je(),window.dispatchEvent(new CustomEvent("kantoong:assistant-ready",{detail:{surface:w.surface}}))}oa();export{pe as A,Ma as B,Ie as C,rt as D,kt as G,st as H,ct as M,Ut as O,pa as P,ot as R,W as _,_t as a,z as b,xa as c,Yt as d,Gt as e,Ea as f,wa as g,Zt as h,da as i,lt as j,gt as k,vt as l,va as m,re as n,_a as o,ha as p,ya as q,ka as r,Sa as s,fa as t,ba as u,ua as v,ga as w,ma as x,St as y,Oe as z};
