/**
 * KANTOONG ERP — APLIKASI UTAMA (kerangka, masuk, menu, navigasi)
 * File: frontend/erp/erp-app.js
 *
 * Alur (satu pintu login, ERP selalu minta password lagi):
 * 1. Pengguna login di web (homepage/profil). Bila ia anggota perusahaan,
 *    tombol "Masuk Dashboard ERP" muncul di profil.
 * 2. Membuka ERP SELALU meminta password lagi (core/erp-lock.js). Tanda
 *    terbuka hilang saat tab ditutup & terkunci otomatis setelah 30 menit
 *    tanpa aktivitas.
 * 3. Setelah terbuka: hanya email yang terdaftar sebagai anggota (RLS) yang
 *    melihat data. Menu dihitung dari jabatan. Halaman diganti lewat #/modul.
 * 4. Mode demo (data contoh) muncul bila client-config.js › erp_demo = true
 *    (template master / presentasi). Web klien: erp_demo = false -> demo hilang.
 */

import { applyTheme } from "../js/theme.js";
import { getPlan } from "../js/plan.js";
import { openAppearanceSheet } from "../js/appearance-panel.js";
import CFG from "../client-config.js";
import { PRODUCT_PUBLIC_COLUMNS } from "../js/product-columns.js";
import { sendPasswordReset, signInWithEmail } from "../auth/auth-service.js";
import { describePasswordError, isEmail } from "../auth/password-rules.js";
import { supabase } from "../js/supabase-client.js";
import { createSupabaseAdapter } from "./data/supabase-adapter.js";
import { createDemoAdapter, resetDemoData } from "./data/demo-adapter.js";
import { DEMO_PERSONAS } from "./data/demo-seed.js";
import { MODULES, UPCOMING_MODULES, modulesFor } from "./core/modules.js";
import { levelName } from "./core/org.js";
import { el, icon, initials, friendlyError, toast } from "./ui.js";
import { isUnlocked, lock, touch, unlock } from "./core/erp-lock.js";

import * as workspace from "./modules/workspace.js";
import * as cockpit from "./modules/cockpit.js";
import * as sales from "./modules/sales.js";
import * as team from "./modules/team.js";
import * as catalog from "./modules/catalog.js";
import * as approvals from "./modules/approvals.js";
import * as org from "./modules/org.js";
import * as inventory from "./modules/inventory.js";
import * as pos from "./modules/pos.js";
import * as kitchen from "./modules/kitchen.js";
import * as cashcontrol from "./modules/cashcontrol.js";
import * as promos from "./modules/promos.js";
import * as recipes from "./modules/recipes.js";
import * as posreport from "./modules/posreport.js";
import * as finance from "./modules/finance.js";
import * as hr from "./modules/hr.js";
import * as payroll from "./modules/payroll.js";
import * as purchasing from "./modules/purchasing.js";
import * as logistics from "./modules/logistics.js";
import * as cs from "./modules/cs.js";
import * as marketing from "./modules/marketing.js";
import * as crm from "./modules/crm.js";
import * as brain from "./modules/brain.js";
import * as analysis from "./modules/analysis.js";
import * as storefront from "./modules/storefront.js";

const RENDERERS = {
    workspace, cockpit, sales, team, catalog, approvals, org, inventory, pos, kitchen, cashcontrol, posreport, recipes, promos, finance, hr, payroll,
    purchasing, logistics, cs, marketing, crm, brain, analysis, storefront,
};
const DEMO_KEY = "kantoong_erp_demo_persona";

const $ = (id) => document.getElementById(id);

const app = {
    data: null,
    me: null,
    modules: [],
    cleanup: null,
    idleTimer: 0,
    webEmail: "",
};

const DEMO_ALLOWED = CFG.erp_demo === true;

/* ---------- Masuk ---------- */

function showLogin(message = "", { email = "" } = {}) {
    stopIdleWatch();
    $("appView").hidden = true;
    $("loginView").hidden = false;
    document.title = "Kantoong ERP";

    const note = $("loginMessage");
    note.hidden = !message;
    note.textContent = message;
    delete note.dataset.kind;

    // Sudah login di web: email dikunci, cukup masukkan password lagi.
    app.webEmail = email;
    const emailInput = $("loginEmail");
    emailInput.value = email || emailInput.value;
    emailInput.readOnly = Boolean(email);
    $("loginSwitch").hidden = !email;
    $("loginTitle").textContent = email ? "Konfirmasi password untuk membuka ERP" : "Masuk ke dashboard kerjamu";
    $("loginPassword").value = "";
    (email ? $("loginPassword") : emailInput).focus();

    $("loginDemo").hidden = !DEMO_ALLOWED;
    const host = $("demoPersonas");
    host.replaceChildren(
        ...DEMO_PERSONAS.map((persona) =>
            el("button", { class: "erp-persona", type: "button", onclick: () => startDemo(persona.id) },
                el("strong", { text: persona.label }),
                el("small", { text: persona.note })
            )
        )
    );
}

async function loadRealProducts() {
    try {
        const { data } = await supabase.from("products").select(PRODUCT_PUBLIC_COLUMNS).limit(40);
        return data || [];
    } catch {
        return [];
    }
}

async function startDemo(personaId) {
    try {
        sessionStorage.setItem(DEMO_KEY, personaId);
    } catch {
        // abaikan
    }

    const adapter = createDemoAdapter({ meId: personaId, realProducts: await loadRealProducts() });
    const session = await adapter.getSession();
    if (session.status !== "member") {
        resetDemoData();
        showLogin("Data demo dipulihkan. Pilih peran lagi.");
        return;
    }
    start(adapter, session.member);
}

/* ---------- Kerangka aplikasi ---------- */

function renderNav() {
    const current = currentModuleKey();

    $("navList").replaceChildren(
        ...app.modules.map((module) =>
            el("a", {
                class: "erp-nav__item",
                href: `#/${module.key}`,
                "aria-current": module.key === current ? "page" : null,
                title: module.hint,
            }, icon(module.icon), el("span", { text: module.label }))
        )
    );

    $("navUpcoming").replaceChildren(
        ...UPCOMING_MODULES.map((module) =>
            el("li", {}, el("span", { text: module.label }), el("small", { text: `Fase ${module.phase}` }))
        )
    );
}

function renderTopbar() {
    const me = app.me;
    $("userChip").replaceChildren(
        el("span", { class: "erp-avatar", text: initials(me.full_name) }),
        el("span", { class: "erp-user__text" },
            el("strong", { text: me.full_name }),
            el("small", { text: `${me.position_title} · ${levelName(me.level)}` })
        )
    );

    const isDemo = app.data.mode === "demo";
    $("demoBadge").hidden = !isDemo;

    const switcher = $("personaSwitch");
    switcher.hidden = !isDemo;
    if (isDemo) {
        switcher.replaceChildren(
            ...DEMO_PERSONAS.map((persona) =>
                el("option", { value: persona.id, selected: persona.id === me.id }, `Peran: ${persona.label}`)
            ),
            el("option", { value: "__reset" }, "Pulihkan data demo")
        );
    }
}

function currentModuleKey() {
    const key = location.hash.replace(/^#\/?/, "").split("/")[0];
    return app.modules.some((module) => module.key === key) ? key : "workspace";
}

async function renderPage() {
    // ERP sudah dikunci / keluar demo: jangan gambar ulang (cegah error dari pengisian otomatis).
    if (!app.data) return;
    const key = currentModuleKey();
    const module = MODULES.find((entry) => entry.key === key);
    const root = $("pageRoot");

    app.cleanup?.();
    app.cleanup = null;

    // Judul cukup sekali (judul besar di halaman); bilah atas tidak mengulanginya.
    document.title = `${module.label} — Kantoong ERP`;
    renderNav();
    closeNav();

    root.replaceChildren(el("p", { class: "erp-loading", text: "Memuat…" }));

    const ctx = {
        data: app.data,
        me: app.me,
        rerender: renderPage,
        onCleanup(fn) {
            app.cleanup = fn;
        },
    };

    try {
        const view = await RENDERERS[key].render(ctx);
        root.replaceChildren(view);
    } catch (error) {
        console.error("[ERP]", error);
        root.replaceChildren(
            el("div", { class: "erp-card erp-card--error" },
                el("h2", { text: "Halaman gagal dimuat" }),
                el("p", { text: friendlyError(error) })
            )
        );
    }

    root.focus({ preventScroll: true });
}

/* ---------- Kunci otomatis saat tidak aktif ---------- */

function stopIdleWatch() {
    clearInterval(app.idleTimer);
    app.idleTimer = 0;
}

function startIdleWatch(userId) {
    stopIdleWatch();
    app.idleTimer = setInterval(() => {
        if (!isUnlocked(userId)) lockErp("ERP terkunci otomatis karena 30 menit tidak ada aktivitas.");
    }, 30000);
}

let lastTouch = 0;
function onActivity() {
    if (app.data?.mode !== "supabase" || Date.now() - lastTouch < 15000) return;
    lastTouch = Date.now();
    touch();
}

function lockErp(message) {
    lock();
    app.cleanup?.();
    app.cleanup = null;
    app.data = null;
    tryRealSession(message);
}

function start(adapter, member, userId = null) {
    if (adapter.mode === "supabase") startIdleWatch(userId);
    app.data = adapter;
    app.me = member;
    // Paket (Pro/Free): Free hanya katalog, etalase, akun & tim (js/plan.js).
    app.modules = modulesFor(member, getPlan().erpModules);
    // Add-on (mis. Anachronos Analysis) dibaca dari pusat; menu ikut muncul begitu aktif.
    Promise.resolve(adapter.listAddons?.()).catch(() => []).then((addons) => {
        if (app.data !== adapter) return;
        member.addons = Array.isArray(addons) ? addons : [];
        const next = modulesFor(member, getPlan().erpModules);
        if (next.length !== app.modules.length) {
            app.modules = next;
            renderTopbar();
            renderPage();
        }
    });

    $("loginView").hidden = true;
    $("appView").hidden = false;

    renderTopbar();
    renderPage();
}

/* ---------- Menu kiri: desktop = ciutkan, ponsel = laci ---------- */

const NAV_COLLAPSED_KEY = "kantoong:erp-nav-collapsed";
const isPhoneLayout = () => window.matchMedia("(max-width: 899px)").matches;

function setNavCollapsed(collapsed, remember = true) {
    document.body.classList.toggle("nav-collapsed", collapsed);
    $("navToggle").setAttribute("aria-expanded", String(!collapsed));
    $("navToggle").setAttribute("aria-label", collapsed ? "Buka menu" : "Tutup menu");
    if (!remember) return;
    try {
        localStorage.setItem(NAV_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
        // Penyimpanan diblokir: pilihan berlaku selama halaman terbuka.
    }
}

function toggleNav() {
    if (isPhoneLayout()) {
        if (document.body.classList.contains("nav-open")) closeNav();
        else openNav();
    } else {
        setNavCollapsed(!document.body.classList.contains("nav-collapsed"));
    }
}

function openNav() {
    document.body.classList.add("nav-open");
    $("navBackdrop").hidden = false;
    $("navToggle").setAttribute("aria-expanded", "true");
}

function closeNav() {
    document.body.classList.remove("nav-open");
    $("navBackdrop").hidden = true;
    // Desktop: status tombol mengikuti menu kiri (terbuka kecuali diciutkan).
    const expanded = !isPhoneLayout() && !document.body.classList.contains("nav-collapsed");
    $("navToggle").setAttribute("aria-expanded", String(expanded));
}

/* ---------- Mulai ---------- */

async function boot() {
    $("navToggle").addEventListener("click", toggleNav);
    let collapsed = false;
    try {
        collapsed = localStorage.getItem(NAV_COLLAPSED_KEY) === "1";
    } catch {
        collapsed = false;
    }
    setNavCollapsed(collapsed, false);
    $("navBackdrop").addEventListener("click", closeNav);
    $("appearanceBtn")?.addEventListener("click", openAppearanceSheet);
    window.addEventListener("hashchange", () => app.data && renderPage());
    // Tema: ERP dan kasir bisa diatur terpisah (js/theme.js).
    const themeArea = () => (/^#\/?pos(\/|$)/.test(location.hash) ? "pos" : "erp");
    applyTheme(themeArea());
    window.addEventListener("hashchange", () => applyTheme(themeArea()));

    ["pointerdown", "keydown", "scroll"].forEach((type) =>
        window.addEventListener(type, onActivity, { passive: true, capture: true })
    );

    // Kunci: ERP dikunci, kembali ke toko (sesi web tetap).
    $("logoutBtn").addEventListener("click", async () => {
        if (app.data?.mode === "demo") {
            try {
                sessionStorage.removeItem(DEMO_KEY);
            } catch {
                // abaikan
            }
            // Hentikan pengisian ulang otomatis halaman yang sedang terbuka.
            app.cleanup?.();
            app.cleanup = null;
            app.data = null;
            location.hash = "";
            showLogin();
            return;
        }
        lock();
        location.assign("/");
    });

    // Bukan akunku: keluar dari web, lalu masuk dengan akun lain.
    $("loginSwitch").addEventListener("click", async () => {
        lock();
        await supabase.auth.signOut();
        showLogin("Silakan masuk dengan akun perusahaanmu.");
    });

    $("personaSwitch").addEventListener("change", (event) => {
        const value = event.target.value;
        if (value === "__reset") {
            resetDemoData();
            toast("Data demo dipulihkan ke awal.");
            startDemo(app.me.id);
            return;
        }
        location.hash = "";
        startDemo(value);
    });

    // Lupa password: link "buat password baru" dikirim ke email yang tertulis.
    $("loginForgot").addEventListener("click", async (event) => {
        const button = event.currentTarget;
        const note = $("loginMessage");
        const email = $("loginEmail").value.trim();
        const say = (text, kind = "") => {
            note.textContent = text;
            note.hidden = !text;
            note.dataset.kind = kind;
        };
        if (!isEmail(email)) {
            say("Tulis email akunmu dulu, lalu klik \"Lupa password?\".");
            $("loginEmail").focus();
            return;
        }
        button.disabled = true;
        say("Mengirim link…", "info");
        try {
            await sendPasswordReset(email);
            say("✔ Kalau email itu terdaftar, link untuk membuat password baru sudah dikirim. Cek kotak masuk (dan folder spam).", "success");
        } catch (error) {
            say(describePasswordError(error));
        } finally {
            button.disabled = false;
        }
    });

    $("loginForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = event.submitter;
        button.disabled = true;

        const email = $("loginEmail").value.trim().toLowerCase();

        try {
            // Satu pintu: password harus milik akun yang sedang login di web.
            if (app.webEmail && email !== app.webEmail.toLowerCase()) {
                throw new Error(`Gunakan akun yang sedang login di web (${app.webEmail}).`);
            }

            const user = await signInWithEmail(email, $("loginPassword").value);
            unlock(user.id);
            await tryRealSession();
        } catch (error) {
            const text = /invalid login/i.test(error?.message || "")
                ? "Email atau password salah."
                : friendlyError(error);
            showLogin(text, { email: app.webEmail });
        } finally {
            button.disabled = false;
        }
    });

    // Demo yang sedang berjalan tetap terbuka saat halaman dimuat ulang.
    let persona = null;
    try {
        persona = sessionStorage.getItem(DEMO_KEY);
    } catch {
        persona = null;
    }

    if (persona && DEMO_ALLOWED) {
        await startDemo(persona);
        return;
    }

    await tryRealSession();
}

async function tryRealSession(lockMessage = "") {
    const adapter = createSupabaseAdapter();

    try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;

        if (!user) {
            showLogin(lockMessage);
            return;
        }

        // Sudah login di web, tapi ERP belum dibuka dengan password di tab ini.
        if (!isUnlocked(user.id)) {
            showLogin(lockMessage || "Demi keamanan, masukkan password-mu lagi untuk membuka ERP.", { email: user.email || "" });
            return;
        }

        const session = await adapter.getSession();

        if (session.status === "member") {
            start(adapter, session.member, user.id);
            return;
        }

        if (session.status === "not-installed") {
            showLogin("Database ERP belum dipasang. Jalankan db/erp-foundation.sql di Supabase, atau coba mode demo.");
            return;
        }

        if (session.status === "no-member") {
            lock();
            showLogin("Akunmu belum terdaftar sebagai anggota perusahaan. Minta owner/HR menambahkan emailmu.", { email: user.email || "" });
            return;
        }

        showLogin();
    } catch (error) {
        console.error("[ERP]", error);
        showLogin(friendlyError(error));
    }
}

boot();
