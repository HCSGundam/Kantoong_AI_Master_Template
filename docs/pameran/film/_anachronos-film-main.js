/**
 * ANACHRONOS — VERSI FILM PAMERAN (salinan khusus, bukan aplikasi asli).
 * Mesin 3D asli + HUD asli, dikendalikan film lewat postMessage:
 *   { ax: "play", seq: "orbit" | "dive" | "organs" | "cinema" }
 * Kursor emas bergerak ke label bola yang SEBENARNYA lalu "memencet"-nya.
 */

import "./styles.css";
import { ORGANS, buildBrands, formatRupiah } from "./data/brands.js";
import { createEngine } from "./three/engine.js";
import { iconSvg } from "./three/icons.js";
import { createHud } from "./ui/hud.js";
import { createInspector } from "./ui/inspector.js";

const brands = buildBrands();
const stage = document.getElementById("axStage");
const labelLayer = document.getElementById("axLabels");
let engine = null;

const hud = createHud({
    top: document.getElementById("axTop"),
    bottom: document.getElementById("axHud"),
    stats: [
        { label: "NEURONS", value: "360" },
        { label: "KANTOONG", value: String(brands.length) },
        { label: "AGENTS", value: "10" },
        { label: "LOG WINDOW", value: "1 WEEK" },
        { label: "ACTIVE NODE", value: "MALL" },
    ],
    onCrumb: () => {},
});

const inspector = createInspector(document.getElementById("axInspector"), brands, {
    back: () => engine.back(),
    openBrand: (brand) => engine.openBrand(brand),
    openOrgan: (key) => engine.openOrgan(key),
    openProduct: (product) => engine.openProduct(product),
});

/* ---------- Label (sama dengan aplikasi asli) ---------- */
const pool = [];
let lastItems = [];
let hotName = null;
function node(index) {
    if (!pool[index]) { const element = document.createElement("div"); labelLayer.appendChild(element); pool[index] = element; }
    return pool[index];
}
function fill(element, kind, key, build) {
    if (element.dataset.key === key && element.dataset.kind === kind) return;
    element.dataset.key = key; element.dataset.kind = kind;
    element.className = `ax-label ax-label--${kind}`;
    element.replaceChildren(...build());
}
const text = (tag, className, value) => { const e = document.createElement(tag); if (className) e.className = className; e.textContent = value; return e; };
function renderLabels(items) {
    lastItems = items;
    items.forEach((item, index) => {
        const element = node(index);
        element.hidden = false;
        element.style.transform = `translate(${item.x.toFixed(1)}px, ${item.y.toFixed(1)}px)`;
        element.style.opacity = String(item.alpha);
        if (item.kind === "formula") fill(element, "formula", item.text, () => [document.createTextNode(item.text)]);
        else if (item.kind === "scan") fill(element, "scan", `${item.code}|${item.leaves}`, () => {
            const head = document.createElement("div");
            head.append(text("strong", "", item.code), text("span", "", "SCANNING"));
            return [head, text("small", "", `${item.leaves.toLocaleString("en-US")} leaves / links attached`)];
        });
        else if (item.kind === "brand") fill(element, "brand", item.name, () => [text("strong", "", item.name), text("small", "", item.sub)]);
        else if (item.kind === "organ") fill(element, "organ", `${item.name}|${item.value}`, () => {
            const row = document.createElement("div"); row.append(iconSvg(item.icon), text("strong", "", item.name));
            return [row, text("small", "", `${item.value} ${item.unit}`)];
        });
        else if (item.kind === "product") fill(element, "product", item.name, () => [text("strong", "", item.name), text("small", "", formatRupiah(item.price))]);
        element.classList.toggle("is-hot", Boolean(item.hot) || (hotName && item.name === hotName));
    });
    for (let index = items.length; index < pool.length; index++) pool[index].hidden = true;
}

function onState(state) {
    inspector.render(state);
    const crumbs = [{ label: "MALL", level: "mall" }];
    if (state.brand) crumbs.push({ label: state.brand.name.toUpperCase(), level: "brand" });
    if (state.organ) crumbs.push({ label: ORGANS[state.organ].label.toUpperCase(), level: "organ" });
    if (state.product) crumbs.push({ label: state.product.name.toUpperCase(), level: "product" });
    hud.setCrumbs(crumbs);
    hud.setStat("ACTIVE NODE", state.brand ? state.brand.name.toUpperCase() : "MALL");
    document.body.dataset.level = state.level;
}

engine = createEngine(stage, brands, { onState, onLabels: renderLabels });
document.body.dataset.hud = "hidden"; // film: panel bawah disembunyikan
document.getElementById("axHudToggle").hidden = true;

/* ---------- Kursor film ---------- */
const css = document.createElement("style");
css.textContent = `
.fx-cur { position:fixed; left:0; top:0; width:46px; height:46px; margin:-23px 0 0 -23px; border-radius:50%; border:2.5px solid #ffe2a0; background:rgb(255 200 90 / 18%);
  box-shadow:0 0 24px rgb(255 190 80 / 70%), inset 0 0 12px rgb(255 220 150 / 50%); z-index:50; pointer-events:none; opacity:0;
  transition: transform .5s cubic-bezier(.4,0,.2,1), opacity .4s; }
.fx-cur::after { content:""; position:absolute; left:50%; top:50%; width:8px; height:8px; margin:-4px; border-radius:50%; background:#fff3cf; }
.fx-rip { position:fixed; width:20px; height:20px; margin:-10px; border-radius:50%; border:2px solid #ffe2a0; z-index:49; pointer-events:none; animation: fxrip .9s ease-out forwards; }
@keyframes fxrip { to { transform: scale(7); opacity:0; } }
.ax-hud, .ax-insp, .cx-launch, .ax-top { transition: opacity .8s; }
body.fx-cine .ax-hud, body.fx-cine .ax-insp, body.fx-cine .cx-launch { opacity:0; }
`;
document.head.append(css);
const cur = document.createElement("div"); cur.className = "fx-cur"; document.body.append(cur);
let pos = { x: innerWidth * 0.7, y: innerHeight * 0.8 };
cur.style.transform = `translate(${pos.x}px, ${pos.y}px)`;

let token = 0; // naik setiap urutan baru: urutan lama berhenti sendiri
const wait = (ms, t) => new Promise((resolve, reject) => setTimeout(() => (t === token ? resolve() : reject(new Error("batal"))), ms));
const showCursor = (on) => { cur.style.opacity = on ? "1" : "0"; };
function moveTo(x, y) { pos = { x, y }; cur.style.transform = `translate(${x}px, ${y}px)`; }
function ripple() {
    const r = document.createElement("div"); r.className = "fx-rip"; r.style.left = `${pos.x}px`; r.style.top = `${pos.y}px`;
    document.body.append(r); setTimeout(() => r.remove(), 1000);
    cur.animate([{ transform: `translate(${pos.x}px, ${pos.y}px) scale(1)` }, { transform: `translate(${pos.x}px, ${pos.y}px) scale(.65)` }, { transform: `translate(${pos.x}px, ${pos.y}px) scale(1)` }], { duration: 320 });
}
/** Cari label asli lalu arahkan kursor ke sana (mengikuti bola yang bergerak). */
async function aimAt(kind, name, t, ms = 1500) {
    const find = () => lastItems.find((item) => item.kind === kind && (!name || item.name === name));
    let target = find();
    for (let i = 0; i < 25 && !target; i++) { await wait(100, t); target = find(); }
    if (!target) return false;
    hotName = target.name;
    const end = performance.now() + ms;
    while (performance.now() < end) {
        const live = find() || target;
        moveTo(live.x + 4, live.y + 2);
        await wait(110, t);
    }
    return true;
}
const brandBy = (id) => brands.find((b) => b.id === id);
async function ensureMall(t) {
    if (engine.state.level !== "mall") { engine.goMall(); await wait(2300, t); }
}

const SEQ = {
    // Putaran cepat di lapis mall.
    async orbit(t) {
        showCursor(false); hotName = null;
        await ensureMall(t);
    },
    // Kursor pencet brand -> masuk neuron -> pencet organ.
    async dive(t) {
        hotName = null;
        await ensureMall(t);
        showCursor(true);
        await aimAt("brand", "Aurum Jewelry", t, 1100);
        ripple(); await wait(150, t);
        engine.openBrand(brandBy("aurum")); hotName = null;
        await wait(2100, t);
        await aimAt("organ", "Konsultasi AI", t, 900);
        ripple(); await wait(150, t);
        engine.openOrgan("chat"); hotName = null;
        await wait(700, t); showCursor(false);
    },
    // Organ lain -> produk.
    async organs(t) {
        hotName = null;
        if (!engine.state.brand) { await ensureMall(t); engine.openBrand(brandBy("aurum")); await wait(1900, t); }
        if (engine.state.level !== "brand") { engine.openBrand(engine.state.brand); await wait(1700, t); }
        showCursor(true);
        await aimAt("organ", "Produk", t, 900); ripple(); await wait(150, t);
        engine.openOrgan("product"); hotName = null; await wait(1900, t);
        await aimAt("product", null, t, 900); ripple(); await wait(150, t);
        const first = lastItems.find((item) => item.kind === "product");
        const product = engine.state.brand.products.find((p) => p.name === first?.name) || engine.state.brand.products[0];
        engine.openProduct(product); hotName = null;
        await wait(700, t); showCursor(false);
    },
    // Brand lain, lalu naik melihat seluruh otak.
    async cinema(t) {
        showCursor(false); hotName = null;
        engine.openBrand(brandBy("noir")); await wait(2600, t);
        engine.goMall();
    },
};

window.addEventListener("message", (event) => {
    const data = event.data;
    if (data?.ax === "sleep") { window.__axSleep = Boolean(data.on); return; }
    if (!data || data.ax !== "play" || !SEQ[data.seq]) return;
    window.__axSleep = false;
    const t = ++token;
    SEQ[data.seq](t).catch(() => {});
});
// Bisa juga dibuka langsung: index.html#dive
if (location.hash.slice(1) && SEQ[location.hash.slice(1)]) setTimeout(() => { const t = ++token; SEQ[location.hash.slice(1)](t).catch(() => {}); }, 1500);
window.parent?.postMessage({ ax: "ready" }, "*");
