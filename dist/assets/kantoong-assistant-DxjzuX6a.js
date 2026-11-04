const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/chat-sheet-BPcBjAPg.css","assets/ai-brain-DLi-eZqG.js","assets/client-config-C5cOf8VT.js","assets/preload-helper-BXl3LOEh.js","assets/supabase-client-vYFxeodt.js","assets/chat-sheet-Ct4eW2Kg.js"])))=>i.map(i=>d[i]);
import{_ as V}from"./preload-helper-BXl3LOEh.js";import{s as M}from"./supabase-client-vYFxeodt.js";import{K as R}from"./client-config-C5cOf8VT.js";const we=Object.freeze({persen:"Persen (%)",nominal:"Potongan Rp"});function Bt(t){return String(t??"").trim().toUpperCase()}function ye(t){return/^[A-Z0-9]{3,20}$/.test(Bt(t))}function Kt(t,e){const a=Math.max(0,Math.round(Number(e)||0));if(!t)return 0;const n=t.kind==="persen"?Math.min(Math.round(a*Number(t.value)/100),Number(t.max_discount)||1/0):Math.round(Number(t.value)||0);return Math.max(0,Math.min(a,n))}function ve(t,e,a=new Date){return!t||!t.is_active?{valid:!1,message:"Kode voucher tidak ditemukan."}:t.starts_at&&a<new Date(t.starts_at)?{valid:!1,message:"Voucher belum berlaku."}:t.ends_at&&a>new Date(t.ends_at)?{valid:!1,message:"Voucher sudah berakhir."}:t.quota&&t.used>=t.quota?{valid:!1,message:"Kuota voucher sudah habis."}:(Number(e)||0)<(Number(t.min_purchase)||0)?{valid:!1,message:`Minimal belanja Rp ${Number(t.min_purchase).toLocaleString("id-ID")}.`}:{valid:!0,discount:Kt(t,e)}}function _e(t){if(!t)return"";const e=n=>`Rp ${Number(n).toLocaleString("id-ID")}`,a=t.kind==="persen"?`${String(t.value).replace(".",",")}%${t.max_discount?` maks ${e(t.max_discount)}`:""}`:`Potongan ${e(t.value)}`;return t.min_purchase>0?`${a} · min. belanja ${e(t.min_purchase)}`:a}const ut=Object.freeze({hadiah:{label:"Hadiah / oleh-oleh",words:["hadiah","kado","oleh","parcel","hampers","ultah","ulang"]},hemat:{label:"Harga hemat",words:["murah","hemat","promo","diskon","voucher","terjangkau","budget"]},sehat:{label:"Sehat / diet",words:["sehat","diet","gula","kalori","protein","vegan","olahraga"]},cepat:{label:"Butuh cepat",words:["cepat","kilat","hari","besok","instan","sameday"]},banyak:{label:"Beli banyak / acara",words:["grosir","banyak","acara","kantor","arisan","reseller","partai"]},rasa:{label:"Cari rasa / varian",words:["rasa","varian","manis","pahit","segar","creamy","baru"]}}),lt=new Map(Object.entries(ut).flatMap(([t,e])=>e.words.map(a=>[a,t]))),mt=new Set(["yang","dan","atau","ada","untuk","dengan","apa","saja","mau","kak","dong","nya","ini","itu","bisa","tolong","produk"]);function Tt(t=[]){const e=new Set;for(const a of t)for(const n of`${a.name||""} ${a.category||""}`.toLowerCase().split(/[^a-z]+/))n.length>=3&&!mt.has(n)&&e.add(n);return e}function zt(t,e=new Set){const a=[];for(const n of String(t||"").toLowerCase().split(/[^a-z]+/)){const i=n==="cokelat"?"coklat":n;if(!(i.length<3||mt.has(i))&&((e.has(i)||lt.has(i))&&!a.includes(i)&&a.push(i),a.length===5))break}return a}function Z(t){return lt.get(t)||null}function Pt(t,e,a=new Date){const n=a.getTime()-e*864e5;return t.filter(i=>new Date(i.at).getTime()>=n)}const z=(t,e)=>{const a=new Map;for(const n of t){const i=e(n);i&&a.set(i,(a.get(i)||0)+1)}return a},P=(t,e)=>[...t.entries()].sort((a,n)=>n[1]-a[1]||String(a[0]).localeCompare(String(n[0]))).slice(0,e);function Dt(t){return(new Date(t).getUTCHours()+7)%24}function Me(t,e=[],{days:a=30,now:n=new Date}={}){const i=Pt(t,a,n),o=(s,f)=>e.find(Lt=>String(Lt.id)===String(s))?.name||f||"Produk",r=s=>i.filter(f=>f.kind===s),c=new Set(i.map(s=>s.session_key)).size,d=r("ask"),u=i.filter(s=>s.product_id&&s.kind!=="cart"),p=r("cart"),K=z(u,s=>String(s.product_id)),v=z(p,s=>String(s.product_id)),l=new Map(i.filter(s=>s.product_id).map(s=>[String(s.product_id),s.product_name])),k=P(K,8).map(([s,f])=>({product_id:s,name:o(s,l.get(s)),count:f,carts:v.get(s)||0})),g=P(K,50).map(([s,f])=>({product_id:s,name:o(s,l.get(s)),count:f,carts:v.get(s)||0})).filter(s=>s.count>=3&&s.carts/s.count<.2).slice(0,5),W=d.flatMap(s=>s.keywords||[]),It=P(z(W,Z),6).map(([s,f])=>({key:s,label:ut[s].label,count:f})),At=P(z(W.filter(s=>!Z(s)),s=>s),12).map(([s,f])=>({word:s,count:f})),T=Array.from({length:24},()=>0);for(const s of d)T[Dt(s.at)]+=1;const Ct=T.indexOf(Math.max(...T)),Y=new Set(p.map(s=>s.session_key)).size;return{days:a,totals:{sessions:c,asks:d.length,recommends:r("recommend").length,carts:p.length,conversion:c?Math.round(Y/c*100):0},funnel:[{key:"ask",label:"Bertanya ke AI",value:new Set(d.map(s=>s.session_key)).size},{key:"recommend",label:"Dapat rekomendasi",value:new Set(r("recommend").map(s=>s.session_key)).size},{key:"view",label:"Melihat produk",value:new Set(i.filter(s=>s.kind==="view"||s.kind==="attach").map(s=>s.session_key)).size},{key:"cart",label:"Masuk keranjang",value:Y}],topProducts:k,interestedNotBought:g,needs:It,keywords:At,hours:T,peakHour:d.length?Ct:null}}function Nt(t){const e=new Map;for(const a of[...t].sort((n,i)=>new Date(n.at)-new Date(i.at)))e.has(a.session_key)||e.set(a.session_key,`Tamu #${e.size+1}`);return e}const X={ask:(t,e,a)=>`${t} bertanya${a?` soal ${a}`:""}`,recommend:(t,e)=>`AI merekomendasikan ${e} ke ${t}`,attach:(t,e)=>`${t} menanyakan ${e} lebih lanjut`,view:(t,e)=>`${t} membuka detail ${e}`,cart:(t,e)=>`${t} memasukkan ${e} ke keranjang`};function Se(t,{products:e=[],labels:a=Nt(t),limit:n=30}={}){return[...t].sort((i,o)=>new Date(o.at)-new Date(i.at)).slice(0,n).map(i=>{const o=e.find(c=>String(c.id)===String(i.product_id))?.name||i.product_name||"produk",r=(i.keywords||[]).slice(0,2).join(", ");return{at:i.at,kind:i.kind,text:(X[i.kind]||X.ask)(a.get(i.session_key)||"Tamu",o,r)}})}const Ht=`
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
`,U="kantoong:assistant:memory-scope",ht=Object.freeze({store:"toko",cart:"keranjang",product:"halaman produk",dashboard:"dashboard pengguna",erp:"dashboard kerja ERP"});function B(){try{const t=localStorage.getItem(U);return t==="network"||t==="brand"?t:null}catch{return null}}function Ot(t){try{t==="network"||t==="brand"?localStorage.setItem(U,t):localStorage.removeItem(U)}catch{}}function pt(){return String(R?.business_id||R?.businessId||"default")}function kt(){return String(R?.app_name||"Kantoong")}function J(){return B()==="network"?"kantoong:chat:network":`kantoong:chat:${pt()}`}function $t(){const t=window.KantoongAssistantContext?.surface;if(t&&ht[t]){if(t==="store"){if(document.querySelector(".cart-page.is-open, #cartPage.is-open"))return"cart";if(location.hash.startsWith("#produk/"))return"product";if(document.body.classList.contains("dashboard-open"))return"dashboard"}return t}return location.pathname.includes("/erp/")?"erp":"store"}function xe(){const t=window.KantoongAssistantContext||{},e=$t();return{surface:e,surface_label:ht[e]||e,brand:kt(),brand_id:pt(),user_name:String(t.userName||"").slice(0,60),network_memory:B()==="network",page_title:String(document.title||"").slice(0,80)}}const ft=window.matchMedia("(min-width: 900px)"),b=document.documentElement,gt="kantoong:assistant-dock",bt=["float","side","half"],D=["side","half"],Q={float:"Melayang di atas halaman",side:"Chat di samping",half:"Belah layar dua"},Rt={float:'<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="7" y="11" width="10" height="5" rx="1.5"/>',side:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M15 5v14"/>',half:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/>'},qt='<path d="M7 7h12l-3-3M17 17H5l3 3"/>';function jt(){try{const t=JSON.parse(localStorage.getItem(gt)||"{}");return{side:t.side==="left"?"left":"right",size:bt.includes(t.size)?t.size:"side"}}catch{return{side:"right",size:"side"}}}const h=jt();function Ft(){try{localStorage.setItem(gt,JSON.stringify(h))}catch{}}function E(t){const e=window.innerWidth;return Math.round(t==="half"?e/2:Math.min(440,Math.max(360,e*.32)))}function wt(t,e){b.style.setProperty("--kc-dock-w",`${Math.round(t)}px`),b.style.setProperty("--kc-dock-pad",`${Math.round(e)}px`)}let tt=0;function yt(){clearTimeout(tt),tt=setTimeout(()=>window.dispatchEvent(new Event("resize")),320)}function q(){b.dataset.kcDockSide=h.side,b.dataset.kcDockSize=h.size,wt(E(h.size),E(h.size)),document.querySelectorAll(".kc-dock-tool[data-kc-dock-size]").forEach(t=>{t.setAttribute("aria-pressed",String(t.dataset.kcDockSize===h.size))})}function C(t){Object.assign(h,t),Ft(),q(),O(),yt()}let vt=null;function O(){const t=vt;if(!t)return;const e=ft.matches&&h.size!=="float"&&!t.hidden&&t.dataset.state!=="peek"&&t.dataset.open==="true";b.classList.contains("kc-docked")!==e&&(b.classList.toggle("kc-docked",e),t.classList.toggle("kc-sheet--docked",e),yt())}function et(t){return`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${t}</svg>`}function Vt(t){const e=t.querySelector(".kc-chatbar");if(!e||e.querySelector(".kc-dock-tools"))return;const a=document.createElement("div");a.className="kc-dock-tools",a.setAttribute("role","group"),a.setAttribute("aria-label","Ukuran chat");for(const i of bt){const o=document.createElement("button");o.type="button",o.className="kc-dock-tool",o.dataset.kcDockSize=i,o.title=Q[i],o.setAttribute("aria-label",Q[i]),o.innerHTML=et(Rt[i]),o.addEventListener("click",()=>C({size:i})),a.appendChild(o)}const n=document.createElement("button");n.type="button",n.className="kc-dock-tool kc-dock-swap",n.title="Pindah sisi",n.setAttribute("aria-label","Pindahkan chat ke sisi lain"),n.innerHTML=et(qt),n.addEventListener("click",()=>C({side:h.side==="right"?"left":"right"})),a.appendChild(n),e.querySelector("#chatCloseBtn")?.before(a)}function Ut(t){if(t.querySelector(".kc-dock-edge"))return;const e=document.createElement("div");e.className="kc-dock-edge",e.tabIndex=0,e.title="Tarik untuk mengubah lebar chat",e.setAttribute("role","separator"),e.setAttribute("aria-orientation","vertical"),e.setAttribute("aria-label","Ubah lebar chat (panah kiri/kanan)"),t.appendChild(e);let a=null,n=0;const i=r=>{const c=window.innerWidth,d=h.side==="right"?c-r+8:r+8;return Math.min(c*.7,Math.max(200,d))};e.addEventListener("pointerdown",r=>{r.button>0||(a=r.pointerId,n=E(h.size),e.setPointerCapture?.(a),b.classList.add("kc-dock-resizing"),r.preventDefault())}),e.addEventListener("pointermove",r=>{r.pointerId===a&&(n=i(r.clientX),wt(n,n))});const o=r=>{if(r.pointerId!==a)return;if(a=null,b.classList.remove("kc-dock-resizing"),n<280){q(),window.KantoongChat?.collapse?.();return}const c=D.reduce((d,u)=>Math.abs(E(u)-n)<Math.abs(E(d)-n)?u:d);C({size:c})};e.addEventListener("pointerup",o),e.addEventListener("pointercancel",o),e.addEventListener("keydown",r=>{if(r.key!=="ArrowLeft"&&r.key!=="ArrowRight")return;r.preventDefault();const c=r.key==="ArrowLeft"==(h.side==="right"),d=D.indexOf(h.size)+(c?1:-1);d>=0&&d<D.length&&C({size:D[d]})})}function Gt(t){let e="";const a=n=>{n!==e&&(e=n,window.dispatchEvent(new CustomEvent(n?"kantoong:stage-focus":"kantoong:stage-blur",{detail:{id:n}})))};t.addEventListener("pointerover",n=>{if(!b.classList.contains("kc-docked")||n.pointerType==="touch")return;const i=n.target.closest?.("#chatBox [data-product-id]");a(i?String(i.dataset.productId):"")}),t.addEventListener("pointerleave",()=>a(""))}function Wt(){const t=document.getElementById("chatPanel");t&&(vt=t,q(),Vt(t),Ut(t),Gt(t),new MutationObserver(O).observe(t,{attributes:!0,attributeFilter:["data-open","data-state","hidden"]}),ft.addEventListener("change",O),O(),window.addEventListener("kantoong:dock-throw",e=>{const a=e.detail?.side==="left"?"left":"right",n=h.size==="float"?{side:a,size:"side"}:{side:a};(n.side!==h.side||n.size)&&C(n)}),window.addEventListener("resize",()=>{b.classList.contains("kc-dock-resizing")||q()}))}const N=window.matchMedia("(hover: hover) and (pointer: fine)"),Yt='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="4" width="7.5" height="7.5" rx="2"/><rect x="3" y="14.5" width="7.5" height="5.5" rx="2"/><rect x="13.5" y="14.5" width="7.5" height="5.5" rx="2"/></svg>',at=new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short"}),nt=new Intl.DateTimeFormat("id-ID",{hour:"2-digit",minute:"2-digit"});function m(t,e,a){const n=document.createElement(t);return e&&(n.className=e),a!=null&&(n.textContent=a),n}function Zt(t){const e=t.find(n=>n.who==="user");if(!e)return"Chat baru";const a=String(e.text||"").replace(/\s+/g," ").trim();return a||(e.attachments?.length?"Kirim lampiran":"Chat tanpa judul")}function Xt(){const t=window.KantoongAIBrain,e=t?.getHistory?.()||[],n=(t?.getArchive?.()||[]).map((i,o)=>({index:o,messages:i.messages})).reverse();return n.unshift({index:-1,current:!0,messages:e}),n.map(i=>({...i,title:Zt(i.messages),startedAt:Number(i.messages[0]?.timestamp)||Date.now()}))}function Jt(t){const e=t.who==="user"?"user":"ai",a=m("div",`kc-hcard__msg kc-hcard__msg--${e}`),n=String(t.text||"").trim();n&&a.appendChild(m("p","",n.length>90?`${n.slice(0,90)}…`:n));const i=Array.isArray(t.productIds)?t.productIds.slice(0,3):[];if(i.length){const o=m("div","kc-hcard__products");for(const r of i){const c=window.KantoongAIBrain?.describeProduct?.(r),d=m("span","kc-hcard__product");if(c?.image){const u=document.createElement("img");u.src=c.image,u.alt="",u.loading="lazy",d.appendChild(u)}else d.classList.add("is-gone"),d.title="Produk sudah tidak tersedia";o.appendChild(d)}a.appendChild(o)}return a}function Qt(t){const e=m("button","kc-hcard");e.type="button",e.dataset.index=String(t.index),t.current&&e.classList.add("is-current");const a=new Date(t.startedAt);e.setAttribute("aria-label",`${t.current?"Chat sekarang: ":"Buka chat: "}${t.title}, ${at.format(a)} ${nt.format(a)}`);const n=m("span","kc-hcard__preview"),i=m("span","kc-hcard__track");return t.messages.slice(0,14).forEach(o=>i.appendChild(Jt(o))),n.append(i,m("span","kc-hcard__time",nt.format(a))),t.current&&n.appendChild(m("span","kc-hcard__badge","Sedang dibuka")),e.append(n,m("span","kc-hcard__title",t.title),m("span","kc-hcard__date",at.format(a))),e}function _(t,e){if(!(!t||t.classList.contains("is-live")===e)&&(t.classList.toggle("is-live",e),e)){const a=t.querySelector(".kc-hcard__preview"),n=t.querySelector(".kc-hcard__track"),i=Math.max(0,n.scrollHeight-a.clientHeight+16);t.style.setProperty("--kc-track-dist",`${-i}px`)}}function it(t){const e=t.getBoundingClientRect(),a=e.top+e.height/2;let n=null,i=1/0;for(const o of t.querySelectorAll(".kc-hcard")){const r=o.getBoundingClientRect(),c=Math.abs(r.top+r.height/2-a);c<i&&(i=c,n=o)}t.querySelectorAll(".kc-hcard.is-live").forEach(o=>{o!==n&&_(o,!1)}),_(n,!0)}function te(){const t=document.getElementById("chatPanel"),e=t?.querySelector(".kc-chatbar");if(!t||!e||t.querySelector(".kc-history"))return;const a=e.querySelector("h2"),n=a?.textContent||"Konsultasi AI",i=m("button","kc-icon-btn kc-history-btn");i.type="button",i.title="Riwayat chat",i.setAttribute("aria-label","Riwayat chat AI"),i.setAttribute("aria-pressed","false"),i.innerHTML=Yt,(e.querySelector(".kc-dock-tools")||e.querySelector("#chatCloseBtn"))?.before(i);const o=m("section","kc-history");o.setAttribute("aria-label","Riwayat chat AI");const r=m("div","kc-history__head"),c=m("p","kc-history__note","Obrolan 30 hari terakhir"),d=m("button","kc-history__new","+ Chat baru");d.type="button",r.append(c,d);const u=m("div","kc-history__grid");o.append(r,u),(t.querySelector("#chatBox")||t.lastElementChild).before(o);let p=0;const K=()=>{const l=Xt();u.replaceChildren(...l.map(Qt)),l.length===1&&u.appendChild(m("p","kc-history__empty",'Tekan "+ Chat baru" untuk menyimpan obrolan ini. Obrolan lama akan muncul di sini.')),N.matches||requestAnimationFrame(()=>it(o))},v=l=>{t.dataset.view=l?"history":"chat",i.setAttribute("aria-pressed",String(l)),a&&(a.textContent=l?"Riwayat Chat AI":n),l&&(K(),o.scrollTop=0)};i.addEventListener("click",()=>v(t.dataset.view!=="history")),d.addEventListener("click",()=>{window.KantoongAIBrain?.newChat?.(),v(!1)}),u.addEventListener("pointerover",l=>{if(!N.matches)return;const k=l.target.closest(".kc-hcard");u.querySelectorAll(".kc-hcard.is-live").forEach(g=>g!==k&&_(g,!1)),_(k,!0)}),u.addEventListener("pointerleave",()=>{N.matches&&u.querySelectorAll(".kc-hcard.is-live").forEach(l=>_(l,!1))}),o.addEventListener("scroll",()=>{N.matches||p||(p=requestAnimationFrame(()=>{p=0,it(o)}))},{passive:!0}),u.addEventListener("touchstart",l=>{const k=l.target.closest(".kc-hcard");k&&(u.querySelectorAll(".kc-hcard.is-live").forEach(g=>g!==k&&_(g,!1)),_(k,!0))},{passive:!0}),u.addEventListener("click",l=>{const k=l.target.closest(".kc-hcard");k&&(k.classList.add("is-opening"),setTimeout(()=>{const g=Number(k.dataset.index);g>=0&&window.KantoongAIBrain?.openArchived?.(g),v(!1)},240))}),new MutationObserver(()=>{t.dataset.open==="false"&&t.dataset.view==="history"&&v(!1)}).observe(t,{attributes:!0,attributeFilter:["data-open"]}),t.dataset.view="chat"}const H=56,ot=56,st=8;function ee(t){return window.KantoongAIBrain?.findProduct?.(t.dataset.productId)||null}function rt(){return typeof window.KantoongEngine?.addToCart=="function"}function ae(t){const e=Math.sign(t),a=Math.abs(t);return e*ot*(1-Math.exp(-a/(ot*.9)))}function ne(t,e){const a=window.KantoongAIBrain?.describeProduct?.(t.dataset.productId)||{};window.dispatchEvent(new CustomEvent("kantoong:attach-product",{detail:{product:{id:t.dataset.productId,name:a.name||e.name||"",price:Number(e.price??e.harga)||null,image_url:a.image||e.image_url||""}}}))}function ie(t){window.KantoongEngine.addToCart(t)}function oe(){const t=document.getElementById("chatBox");if(!t||t.dataset.gesturesReady==="true")return;t.dataset.gesturesReady="true";let e=null,a=!1;const n=o=>{o.classList.remove("is-pulling"),o.style.removeProperty("--kc-pull"),delete o.dataset.gesture};t.addEventListener("pointerdown",o=>{if(o.pointerType==="mouse"&&o.button!==0)return;const r=o.target.closest(".ai-product-card[data-product-id]");r&&(e={card:r,id:o.pointerId,x:o.clientX,y:o.clientY,active:!1,dy:0})}),t.addEventListener("pointermove",o=>{if(!e||o.pointerId!==e.id)return;const r=o.clientX-e.x,c=o.clientY-e.y;if(!e.active){if(Math.abs(r)<st&&Math.abs(c)<st)return;if(Math.abs(r)>=Math.abs(c)){e=null;return}e.active=!0,e.card.classList.add("is-pulling");try{e.card.setPointerCapture(o.pointerId)}catch{}}e.dy=c>0&&!rt()?0:c;const d=ae(e.dy);e.card.style.setProperty("--kc-pull",`${d.toFixed(1)}px`),e.dy<=-H?e.card.dataset.gesture="up":e.dy>=H?e.card.dataset.gesture="down":e.card.dataset.gesture=e.dy<0?"up-hint":e.dy>0?"down-hint":"",o.preventDefault()});const i=(o,r)=>{if(!e||o.pointerId!==e.id)return;const{card:c,active:d,dy:u}=e;if(e=null,!d)return;a=!0,setTimeout(()=>{a=!1},0);const p=ee(c);!r&&p&&u<=-H?(c.classList.add("is-sent-up"),ne(c,p)):!r&&p&&u>=H&&rt()&&(c.classList.add("is-sent-down"),ie(p)),n(c),setTimeout(()=>c.classList.remove("is-sent-up","is-sent-down"),520)};t.addEventListener("pointerup",o=>i(o,!1)),t.addEventListener("pointercancel",o=>i(o,!0)),t.addEventListener("click",o=>{!a||!o.target.closest(".ai-product-card")||(o.preventDefault(),o.stopPropagation(),a=!1)},!0),t.addEventListener("dragstart",o=>{o.target.closest?.(".ai-product-card")&&o.preventDefault()})}const _t=4e3,Mt=20;let I=[],A=0,$=!1;function se(){try{let t=sessionStorage.getItem("kantoong:ai-session");return t||(t=`s-${Math.random().toString(36).slice(2,10)}${Date.now().toString(36).slice(-4)}`,sessionStorage.setItem("kantoong:ai-session",t)),t}catch{return null}}function re(){return window.KantoongAIBrain?.getProducts?.()||window.KantoongState?.products||[]}function ce(t,e=""){const a=window.KantoongAIBrain?.findProduct?.(t);return String(a?.name||e||"").slice(0,120)}async function j(){if(clearTimeout(A),A=0,!I.length||$)return;const t=I.splice(0,Mt);try{const{error:e}=await M.rpc("log_ai_events",{p:t});e&&($=!0)}catch{$=!0}I.length&&(A=setTimeout(j,_t))}function S(t,{productId:e=null,name:a="",keywords:n=[]}={}){if($)return;const i=se();i&&(I.push({business_id:R.business_id,session_key:i,kind:t,product_id:e?String(e):null,product_name:e?ce(e,a):null,keywords:n,surface:window.KantoongAssistantContext?.surface||"store"}),I.length>=Mt?j():A||(A=setTimeout(j,_t)))}function de(){window.__kantoongTelemetry||(window.__kantoongTelemetry=!0,window.KantoongAssistantContext?.surface!=="erp"&&(navigator.doNotTrack==="1"||window.doNotTrack==="1"||(window.addEventListener("kantoong:ai-response",t=>{const e=t.detail||{};S("ask",{keywords:zt(e.question,Tt(re()))});for(const a of(e.product_ids||[]).slice(0,6))S("recommend",{productId:a})}),window.addEventListener("kantoong:attach-product",t=>{const e=t.detail?.product;e?.id&&S("attach",{productId:e.id,name:e.name})}),window.addEventListener("kantoong:quickview-opened",t=>{const e=t.detail?.product;e?.id&&S("view",{productId:e.id,name:e.name})}),window.addEventListener("kantoong:cart-add",t=>{const e=t.detail?.product;e?.id&&S("cart",{productId:e.id,name:e.name})}),window.addEventListener("pagehide",j))))}const w=window.KantoongAssistantContext=window.KantoongAssistantContext||{};w.surface||(w.surface=location.pathname.includes("/erp/")?"erp":"store");w.dock===!1&&(document.documentElement.dataset.kcFree="");function ue(){if(document.getElementById("chatPanel"))return;const t=document.createElement("template");t.innerHTML=Ht.trim();const e=document.getElementById("appRoot");if(e){e.appendChild(t.content);return}const a=document.createElement("div");a.id="kantoongAssistantHost",a.className="kc-host",a.appendChild(t.content),document.body.appendChild(a)}async function le(){[...document.styleSheets].some(e=>String(e.href||"").includes("chat-sheet.css"))||document.querySelector('link[href*="chat-sheet.css"], style[data-vite-dev-id*="chat-sheet"]')||await V(()=>Promise.resolve({}),__vite__mapDeps([0]))}async function me(){try{const{data:t}=await M.auth.getSession(),e=t?.session?.user;if(!e)return null;const a=e.user_metadata||{};return w.userName||(w.userName=String(a.full_name||a.name||"").trim()),e}catch{return null}}async function he(){if(!(window.KantoongState||document.getElementById("appRoot")))try{const{data:t}=await M.from("products").select("id, name, price, category, description, image_url").limit(60);window.KantoongState={products:t||[]}}catch{window.KantoongState={products:[]}}}function St(...t){const e=new Map;for(const a of t)for(const n of a||[])n&&n.id&&!e.has(n.id)&&e.set(n.id,n);return[...e.values()].sort((a,n)=>Number(a.timestamp)-Number(n.timestamp)).slice(-200)}function ct(t){try{return JSON.parse(localStorage.getItem(t)||"[]")}catch{return[]}}function pe(){if(B()||document.querySelector(".kc-consent"))return;const t=document.getElementById("chatBox");if(!t)return;const e=document.createElement("div");e.className="kc-consent",e.setAttribute("role","region"),e.setAttribute("aria-label","Izin memori asisten");const a=document.createElement("p");a.textContent="Boleh aku mengingat obrolan kita di semua toko jaringan Kantoong? Jadi saat kamu pindah toko, aku tetap nyambung. Kamu bisa menghapusnya kapan saja lewat menu +.";const n=document.createElement("button");n.type="button",n.className="kc-consent__yes",n.textContent="Ingat di semua toko";const i=document.createElement("button");i.type="button",i.className="kc-consent__no",i.textContent=`Hanya di ${kt()}`;const o=async c=>{const d=ct(J());if(Ot(c),e.remove(),c==="network"){const u=St(ct(J()),d);window.KantoongAIBrain?.reload?.(u),await xt()}else window.KantoongAIBrain?.reload?.()};n.addEventListener("click",()=>o("network")),i.addEventListener("click",()=>o("brand"));const r=document.createElement("div");r.className="kc-consent__actions",r.append(n,i),e.append(a,r),t.before(e)}let y=null,L=!1,dt=0;async function xt(){if(!y||L||B()!=="network")return;const{data:t,error:e}=await M.from("assistant_memory").select("messages").eq("user_id",y.id).maybeSingle();if(e){L=!0;return}const a=window.KantoongAIBrain?.getHistory?.()||[],n=St(a,t?.messages||[]);n.length!==a.length&&window.KantoongAIBrain?.reload?.(n),n.length!==(t?.messages||[]).length&&Et(n)}function Et(t){!y||L||B()!=="network"||(clearTimeout(dt),dt=setTimeout(async()=>{const e=(t||[]).slice(-200).map(n=>({id:n.id,who:n.who,text:String(n.text||"").slice(0,3e3),timestamp:n.timestamp,brand:n.brand,surface:n.surface,productIds:n.productIds,attachments:(n.attachments||[]).map(i=>({name:i.name,type:i.type,product:i.product}))})),{error:a}=await M.from("assistant_memory").upsert({user_id:y.id,messages:e,updated_at:new Date().toISOString()});a&&(L=!0)},1500))}window.addEventListener("kantoong:assistant-history",t=>Et(t.detail?.history));window.addEventListener("kantoong:forget-memory",async()=>{if(window.confirm("Hapus semua memori asisten? Riwayat obrolan di semua toko Kantoong (perangkat ini"+(y?" dan akunmu":"")+") akan dihapus permanen.")){try{Object.keys(localStorage).filter(e=>e.startsWith("kantoong:chat:")).forEach(e=>localStorage.removeItem(e))}catch{}y&&!L&&await M.from("assistant_memory").delete().eq("user_id",y.id),window.KantoongAIBrain?.clearHistory?.()}});let F=!1;const x=new Set;function G(t,e){e?x.add(t):x.delete(t),document.body.classList.toggle("kc-overlay-open",x.size>0);const a=window.KantoongChat;a&&(x.size&&!a.isMinimized?.()?(a.minimize(),F=!0):!x.size&&F&&(F=!1,a.restore?.()))}window.addEventListener("kantoong:overlay",t=>G(t.detail?.name||"lapisan",!!t.detail?.open));window.addEventListener("kantoong:dashboard-opened",()=>G("dashboard",!0));window.addEventListener("kantoong:dashboard-closed",()=>G("dashboard",!1));document.addEventListener("click",t=>{if(window.KantoongEngine)return;const e=t.target.closest?.("#chatBox [data-product-id]");e&&(t.preventDefault(),window.open(`/index.html#produk/${encodeURIComponent(e.dataset.productId)}`,"_blank","noopener"))},!0);async function ke(){ue(),await le(),y=await me(),await he(),await V(()=>import("./ai-brain-DLi-eZqG.js"),__vite__mapDeps([1,2,3,4])),window.KantoongAIBrain?.init?.(),await V(()=>import("./chat-sheet-Ct4eW2Kg.js"),__vite__mapDeps([5,2])),w.startMinimized&&window.KantoongChat?.minimize?.(),w.dock!==!1&&Wt(),te(),oe(),de(),pe(),xt(),window.dispatchEvent(new CustomEvent("kantoong:assistant-ready",{detail:{surface:w.surface}}))}ke();export{we as V,Se as a,$t as b,ve as c,_e as d,kt as e,xe as f,Nt as g,J as h,ye as i,Bt as n,Me as s,Kt as v,Pt as w};
