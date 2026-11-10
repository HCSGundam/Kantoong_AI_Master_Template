/**
 * KANTOONG — PITA STATUS SINYAL (semua halaman, dimuat lewat theme.js)
 * File: frontend/js/net-status.js
 *
 * Saat internet pengguna putus: pita kecil muncul, halaman TETAP jalan dengan
 * data terakhir (dashboard: pesanan tersimpan di perangkat pemiliknya; Sinyal
 * dihitung dari data di perangkat; chat AI memakai jawaban cadangan lokal;
 * kasir POS mengantrikan transaksi). Saat online lagi: pita "Online lagi ✓".
 * Toko & dashboard pakai bahasa santai; ERP/kasir tetap formal.
 */

const COPY = {
    casual: { off: "Sinyalmu lagi hilang 📡 — tenang, data terakhir tetap tampil.", on: "Kamu online lagi ✓" },
    formal: { off: "Koneksi terputus. Data terakhir tetap ditampilkan; perubahan dikirim saat kembali online.", on: "Koneksi kembali normal." },
};

let bar = null;
let hideTimer = 0;

function tone() {
    return location.pathname.includes("/erp/") ? "formal" : "casual";
}

function show(state) {
    if (!document.body) return;
    if (!bar) {
        bar = document.createElement("div");
        bar.className = "kc-net";
        bar.setAttribute("role", "status");
        bar.setAttribute("aria-live", "polite");
        document.body.append(bar);
    }
    clearTimeout(hideTimer);
    bar.dataset.state = state;
    bar.textContent = COPY[tone()][state];
    bar.classList.add("is-on");
    document.documentElement.dataset.offline = state === "off" ? "true" : "false";
    if (state === "on") hideTimer = setTimeout(() => bar?.classList.remove("is-on"), 2600);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
    if (!document.getElementById("kcNetStyle")) {
        const style = document.createElement("style");
        style.id = "kcNetStyle";
        style.textContent = `
.kc-net{position:fixed;left:50%;top:calc(10px + env(safe-area-inset-top,0px));z-index:2147483600;max-width:min(92vw,520px);padding:9px 16px;
color:#f1ead9;background:#16130e;border:1px solid rgb(232 214 166 / 35%);border-radius:999px;font:500 12.5px/1.4 "Poppins",system-ui,sans-serif;
box-shadow:0 14px 34px -14px rgb(0 0 0 / 55%);transform:translate(-50%,-140%);opacity:0;transition:transform .35s cubic-bezier(.2,.8,.2,1),opacity .25s ease;pointer-events:none;text-align:center}
.kc-net.is-on{transform:translate(-50%,0);opacity:1}
.kc-net[data-state="on"]{color:#16130e;background:#e8d6a6;border-color:transparent}`;
        document.head.append(style);
    }
    window.addEventListener("offline", () => show("off"));
    window.addEventListener("online", () => show("on"));
    const boot = () => {
        if (navigator.onLine === false) show("off");
    };
    if (document.body) boot();
    else document.addEventListener("DOMContentLoaded", boot, { once: true });
}
