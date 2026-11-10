/**
 * KANTOONG — RAPOR TAMPILAN HP vs LAPTOP (alat uji, khusus mode dev)
 * File: frontend/js/ui-audit.js  (halaman: /audit.html)
 *
 * Membuka setiap halaman di iframe 390 px & 1440 px (asal yang sama), lalu
 * memeriksa DOM di dalamnya. Pemeriksaan murni ada di auditDocument() dan
 * dites di test/ui-audit.test.js. Hasil: galeri hidup (iframe diperkecil)
 * + daftar masalah per halaman + rapor teks yang bisa disalin.
 * HANYA membaca halaman; data demo yang dibuat halaman ERP dibersihkan setelah selesai.
 */

export const SIZES = Object.freeze([
    { id: "hp", label: "HP", width: 390, height: 844 },
    { id: "laptop", label: "Laptop", width: 1440, height: 900 },
]);

const openFeature = (id) => (win) => win.dispatchEvent(new win.CustomEvent("kantoong:bento-open", { detail: { id } }));

export const PAGES = Object.freeze([
    { id: "home", area: "Toko", label: "Beranda toko", url: "/index.html" },
    { id: "info", area: "Toko", label: "Info & kebijakan", url: "/info.html?halaman=kontak" },
    { id: "verify", area: "Toko", label: "Cek keaslian dokumen", url: "/verify.html?d=doc-x&k=000000000000" },
    { id: "reset", area: "Login", label: "Buat password baru", url: "/auth/reset-password.html" },
    { id: "dash", area: "Dashboard", label: "Ruang pribadi (bento)", url: "/dashboard-user/dashboard-user.html" },
    { id: "dash-catalog", area: "Dashboard", label: "Katalog produk", url: "/dashboard-user/dashboard-user.html", action: openFeature("product-catalog") },
    { id: "dash-orders", area: "Dashboard", label: "Pesananku", url: "/dashboard-user/dashboard-user.html", action: openFeature("my-orders") },
    { id: "dash-card", area: "Dashboard", label: "Kartu Diriku", url: "/dashboard-user/dashboard-user.html", action: openFeature("my-card") },
    { id: "dash-settings", area: "Dashboard", label: "Pengaturan", url: "/dashboard-user/dashboard-user.html", action: openFeature("settings") },
    { id: "erp-login", area: "ERP", label: "Login ERP", url: "/erp/erp.html", persona: null },
    { id: "erp-command", area: "ERP", label: "Ruang Komando", url: "/erp/erp.html#/command", persona: "m-owner" },
    { id: "erp-docs", area: "ERP", label: "Dokumen & PDF", url: "/erp/erp.html#/documents", persona: "m-owner" },
    { id: "erp-tools", area: "ERP", label: "Alat PDF", url: "/erp/erp.html#/documents/alat", persona: "m-owner" },
    { id: "erp-agents", area: "ERP", label: "Agen AI", url: "/erp/erp.html#/agents", persona: "m-owner" },
    { id: "erp-approvals", area: "ERP", label: "Persetujuan", url: "/erp/erp.html#/approvals", persona: "m-owner" },
    { id: "erp-finance", area: "ERP", label: "Keuangan · Piutang", url: "/erp/erp.html#/finance/piutang", persona: "m-owner" },
    { id: "erp-inventory", area: "ERP", label: "Gudang & stok", url: "/erp/erp.html#/inventory", persona: "m-owner" },
    { id: "erp-hr", area: "ERP", label: "HR & absensi", url: "/erp/erp.html#/hr", persona: "m-owner" },
    { id: "erp-crm", area: "ERP", label: "CRM · Pipeline", url: "/erp/erp.html#/crm/pipeline", persona: "m-owner" },
    { id: "erp-storefront", area: "ERP", label: "Etalase & Brand", url: "/erp/erp.html#/storefront", persona: "m-owner" },
    { id: "erp-catalog", area: "ERP", label: "Katalog Master", url: "/erp/erp.html#/catalog", persona: "m-owner" },
    { id: "pos", area: "Kasir", label: "Kasir POS", url: "/erp/erp.html#/pos", persona: "m-dewi" },
    { id: "kitchen", area: "Kasir", label: "Dapur & Bar", url: "/erp/erp.html#/kitchen", persona: "m-dewi" },
]);

export const ISSUE_LABELS = Object.freeze({
    overflow: "Halaman melebar ke samping",
    nulltext: "Teks null/undefined/NaN",
    clipped: "Teks terpotong tanpa \"…\"",
    small: "Tombol terlalu kecil (< 32 px)",
    covered: "Tombol tertutup elemen lain",
    image: "Gambar gagal dimuat",
    error: "Error di konsol",
});

const visible = (node, win) => {
    const rect = node.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return false;
    const style = win.getComputedStyle(node);
    return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0.05;
};

const describe = (node) => {
    const id = node.id ? `#${node.id}` : "";
    const cls = typeof node.className === "string" && node.className.trim() ? `.${node.className.trim().split(/\s+/).slice(0, 2).join(".")}` : "";
    const text = String(node.textContent || node.getAttribute?.("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 40);
    return `${node.tagName.toLowerCase()}${id}${cls}${text ? ` "${text}"` : ""}`;
};

/** Pemeriksaan satu dokumen. Mengembalikan { issue: [contoh, …] }. */
export function auditDocument(doc, win, { mobile = false, errors = [] } = {}) {
    const out = { overflow: [], nulltext: [], clipped: [], small: [], covered: [], image: [], error: errors.slice(0, 5) };
    const vw = win.innerWidth;

    // 1. Melebar ke samping
    if (doc.documentElement.scrollWidth > vw + 1) {
        const wide = [...doc.body.querySelectorAll("*")].filter((n) => {
            const r = n.getBoundingClientRect();
            if (r.right <= vw + 1 || r.width < 1) return false;
            // Di dalam wadah geser horizontal yang disengaja: bukan masalah.
            for (let p = n.parentElement; p && p !== doc.body; p = p.parentElement) {
                const ox = win.getComputedStyle(p).overflowX;
                if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") return false;
            }
            return true;
        });
        out.overflow.push(`lebar ${doc.documentElement.scrollWidth}px > layar ${vw}px`, ...wide.slice(0, 4).map(describe));
    }

    // 2. Teks null/undefined/NaN
    const walker = doc.createTreeWalker(doc.body, 4);
    for (let t = walker.nextNode(); t && out.nulltext.length < 6; t = walker.nextNode()) {
        if (/(^|[^\w])(null|undefined|NaN)([^\w]|$)/.test(t.nodeValue) && t.parentElement && !t.parentElement.closest("script,style,textarea,input,code,pre") && visible(t.parentElement, win)) {
            out.nulltext.push(`${describe(t.parentElement)}: "${t.nodeValue.trim().slice(0, 50)}"`);
        }
    }

    // 3. Teks terpotong tanpa elipsis
    doc.body.querySelectorAll("h1,h2,h3,h4,p,span,strong,small,a,button,label,li,dd,td").forEach((n) => {
        if (out.clipped.length >= 6 || !n.childNodes.length || n.children.length > 2) return;
        if (!n.textContent.trim() || !visible(n, win)) return;
        const s = win.getComputedStyle(n);
        const hidden = s.overflow === "hidden" || s.overflowX === "hidden";
        if (hidden && n.scrollWidth > n.clientWidth + 2 && s.textOverflow !== "ellipsis" && !s.webkitLineClamp?.match?.(/\d/)) out.clipped.push(describe(n));
    });

    // 4. Tombol kecil (HP) & 5. tertutup elemen lain
    const interactive = [...doc.body.querySelectorAll("button, a[href], [role=button], input:not([type=hidden]), select")].filter((n) => visible(n, win));
    interactive.forEach((n) => {
        const r = n.getBoundingClientRect();
        if (mobile && out.small.length < 8 && (r.width < 32 || r.height < 32) && !n.closest("p, li > a, .erp-table, table")) out.small.push(`${describe(n)} ${Math.round(r.width)}×${Math.round(r.height)}`);
        // Tersembunyi di dalam pita geser/wadah terpotong = bukan "tertutup".
        const clippedByParent = () => {
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            for (let p = n.parentElement; p && p !== doc.body; p = p.parentElement) {
                const st = win.getComputedStyle(p);
                if (/(auto|scroll|hidden|clip)/.test(st.overflow + st.overflowX + st.overflowY)) {
                    const pr = p.getBoundingClientRect();
                    if (cx < pr.left || cx > pr.right || cy < pr.top || cy > pr.bottom) return true;
                }
            }
            return false;
        };
        if (out.covered.length < 6 && r.top >= 0 && r.bottom <= win.innerHeight && r.left >= 0 && r.right <= vw && !clippedByParent()) {
            const top = doc.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            if (top && top !== n && !n.contains(top) && !top.contains(n)) {
                const fixed = (el) => {
                    for (let p = el; p && p !== doc.body; p = p.parentElement) {
                        const pos = win.getComputedStyle(p).position;
                        if (pos === "fixed" || pos === "sticky") return p;
                    }
                    return null;
                };
                const cover = fixed(top);
                // Pop-up/lembar yang sengaja menutup halaman (dialog, izin) bukan bug.
                const modal = cover?.closest?.('[role="dialog"], [aria-modal="true"], dialog, .kc-aiperm, .kc-lang, .ap-sheet');
                if (cover && !modal && !cover.contains(n)) out.covered.push(`${describe(n)} ditutup ${describe(cover)}`);
            }
        }
    });

    // 6. Gambar rusak
    doc.querySelectorAll("img").forEach((img) => {
        if (out.image.length < 5 && img.complete && img.naturalWidth === 0 && img.getAttribute("src") && visible(img, win)) out.image.push(img.getAttribute("src").slice(0, 80));
    });

    return out;
}

export function score(result) {
    const weight = { overflow: 10, nulltext: 6, error: 6, covered: 3, clipped: 2, image: 3, small: 1 };
    return Object.entries(result).reduce((n, [k, list]) => n + (list.length ? weight[k] * Math.min(list.length, 5) : 0), 0);
}

/* ---------------- Halaman audit (browser) ---------------- */

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = new Map();

function loadFrame(page, size) {
    return new Promise((resolve) => {
        const frame = el("iframe", "au-frame");
        frame.style.width = `${size.width}px`;
        frame.style.height = `${size.height}px`;
        frame.setAttribute("title", `${page.label} (${size.label})`);
        const errors = [];
        let hooked = false;
        const hook = () => {
            if (hooked) return;
            try {
                const w = frame.contentWindow;
                if (!w || w.location.href === "about:blank") return;
                hooked = true;
                w.addEventListener("error", (e) => errors.push(String(e.message || e.error || "error").slice(0, 140)));
                w.addEventListener("unhandledrejection", (e) => errors.push(`Promise: ${String(e.reason?.message || e.reason).slice(0, 140)}`));
                const orig = w.console.error.bind(w.console);
                w.console.error = (...args) => {
                    errors.push(args.map(String).join(" ").slice(0, 140));
                    orig(...args);
                };
            } catch {
                // asal berbeda: lewati
            }
        };
        const poll = setInterval(hook, 30);
        frame.addEventListener("load", async () => {
            hook();
            clearInterval(poll);
            await sleep(1800);
            try {
                page.action?.(frame.contentWindow);
            } catch {
                // abaikan
            }
            await sleep(page.action ? 1600 : 400);
            resolve({ frame, errors });
        }, { once: true });
        frame.src = page.url;
        $("auStage").append(frame);
    });
}

async function auditPage(page) {
    try {
        if (page.persona === null) sessionStorage.removeItem("kantoong_erp_demo_persona");
        else if (page.persona) sessionStorage.setItem("kantoong_erp_demo_persona", page.persona);
    } catch {
        // abaikan
    }
    const row = {};
    for (const size of SIZES) {
        const { frame, errors } = await loadFrame(page, size);
        try {
            row[size.id] = auditDocument(frame.contentDocument, frame.contentWindow, { mobile: size.id === "hp", errors });
        } catch (error) {
            row[size.id] = { error: [`Tidak bisa diperiksa: ${error.message}`], overflow: [], nulltext: [], clipped: [], small: [], covered: [], image: [] };
        }
        frame.remove();
    }
    results.set(page.id, row);
    drawRow(page);
    drawSummary();
}

function issueList(result) {
    const list = el("ul", "au-issues");
    Object.entries(result).forEach(([key, items]) => {
        if (!items.length) return;
        const li = el("li", `au-issue au-issue--${key}`);
        li.append(el("strong", "", `${ISSUE_LABELS[key]} (${items.length})`));
        const sub = el("ul");
        items.slice(0, 5).forEach((t) => sub.append(el("li", "", t)));
        li.append(sub);
        list.append(li);
    });
    if (!list.children.length) list.append(el("li", "au-ok", "✓ Tidak ada masalah terdeteksi"));
    return list;
}

function preview(page, size) {
    const wrap = el("div", `au-preview au-preview--${size.id}`);
    const scale = size.id === "hp" ? 0.5 : 0.27;
    wrap.style.width = `${size.width * scale}px`;
    wrap.style.height = `${size.height * scale}px`;
    const btn = el("button", "au-btn au-btn--sm", "Lihat langsung");
    btn.type = "button";
    btn.addEventListener("click", () => {
        if (page.persona) sessionStorage.setItem("kantoong_erp_demo_persona", page.persona);
        const frame = el("iframe", "au-live");
        frame.style.width = `${size.width}px`;
        frame.style.height = `${size.height}px`;
        frame.style.transform = `scale(${scale})`;
        frame.src = page.url;
        if (page.action) frame.addEventListener("load", () => setTimeout(() => page.action(frame.contentWindow), 1800), { once: true });
        wrap.replaceChildren(frame);
    });
    wrap.append(btn);
    return wrap;
}

function drawRow(page) {
    const row = results.get(page.id);
    let card = document.querySelector(`[data-page="${page.id}"]`);
    if (!card) {
        card = el("article", "au-card");
        card.dataset.page = page.id;
        $("auList").append(card);
    }
    const total = row ? score(row.hp) + score(row.laptop) : null;
    card.replaceChildren(
        el("header", "au-card__head",
            el("span", "au-area", page.area),
            el("h2", "", page.label),
            el("code", "", page.url),
            el("span", `au-score ${total == null ? "" : total === 0 ? "is-good" : total < 12 ? "is-warn" : "is-bad"}`, total == null ? "belum diuji" : total === 0 ? "Bersih" : `Skor masalah ${total}`)),
        el("div", "au-card__grid",
            ...SIZES.map((size) => {
                const col = el("section", "au-col");
                col.append(el("h3", "", `${size.label} · ${size.width}px`), preview(page, size), row ? issueList(row[size.id]) : el("p", "au-muted", "—"));
                return col;
            })));
}

function drawSummary() {
    const totals = { hp: 0, laptop: 0 };
    const byKey = {};
    results.forEach((row) => {
        SIZES.forEach((s) => {
            totals[s.id] += score(row[s.id]);
            Object.entries(row[s.id]).forEach(([k, v]) => {
                if (v.length) byKey[k] = (byKey[k] || 0) + 1;
            });
        });
    });
    $("auSummary").replaceChildren(
        el("p", "", `${results.size}/${PAGES.length} halaman diuji · skor masalah HP ${totals.hp} · Laptop ${totals.laptop}`),
        el("p", "au-muted", Object.entries(byKey).map(([k, n]) => `${ISSUE_LABELS[k]}: ${n} tampilan`).join(" · ") || "Belum ada masalah."));
}

export function reportText() {
    const lines = [];
    PAGES.forEach((page) => {
        const row = results.get(page.id);
        if (!row) return;
        SIZES.forEach((s) => {
            Object.entries(row[s.id]).forEach(([k, list]) => {
                if (list.length) lines.push(`[${page.id} · ${s.label}] ${ISSUE_LABELS[k]}: ${list.join(" | ")}`);
            });
        });
    });
    return lines.join("\n") || "Bersih.";
}

async function runAll() {
    $("auRun").disabled = true;
    const keepDemo = localStorage.getItem("kantoong_erp_demo_v1");
    const keepPersona = sessionStorage.getItem("kantoong_erp_demo_persona");
    for (const page of PAGES) {
        $("auRun").textContent = `Menguji ${page.label}…`;
        await auditPage(page);
    }
    // Kembalikan data demo & peran seperti semula (audit hanya membaca).
    try {
        if (keepDemo == null) localStorage.removeItem("kantoong_erp_demo_v1");
        else localStorage.setItem("kantoong_erp_demo_v1", keepDemo);
        if (keepPersona == null) sessionStorage.removeItem("kantoong_erp_demo_persona");
        else sessionStorage.setItem("kantoong_erp_demo_persona", keepPersona);
    } catch {
        // abaikan
    }
    $("auRun").disabled = false;
    $("auRun").textContent = "▶ Jalankan ulang";
    document.body.dataset.done = "1";
    window.__auditReport = reportText();
}

if (typeof document !== "undefined" && document.getElementById("auList")) {
    PAGES.forEach(drawRow);
    $("auRun").addEventListener("click", runAll);
    $("auCopy").addEventListener("click", () => navigator.clipboard?.writeText(reportText()));
    if (new URLSearchParams(location.search).has("auto")) runAll();
}
