
/**
 * ============================================================
 * KANTOONG CORE — MAIN ENGINE
 * File: frontend/js/engine.js
 *
 * Arsitektur:
 * - ES Modules
 * - Client configuration dari client-config.js
 * - Dashboard User terpisah melalui iframe
 * - Storefront tetap berjalan di index.html
 * - Integrasi Supabase
 * - Demo fallback jika data gagal dimuat atau kosong
 * - Event bridge untuk AI, pencarian, katalog, dan keranjang
 *
 * CATATAN KEAMANAN:
 * - Otorisasi wajib dilakukan di backend / Supabase RLS.
 * - business_id pada frontend bukan batas keamanan.
 * - Jangan menggunakan engine ini untuk memberi hak admin.
 * ============================================================
 */

import { supabase } from "./supabase-client.js";
import { PRODUCT_PUBLIC_COLUMNS } from "./product-columns.js";
import { applyTheme } from "./theme.js";
import { getStorefront, onStorefrontChange, startStorefrontSync } from "./storefront-settings.js";
import { renderHomePromos } from "./home-promos.js";
import { getPlan, markPlan } from "./plan.js";
import { bigPrice, enrichProducts, specRows } from "./industry.js";
import { loadAttributes } from "./product-attributes.js";
import {
  createCompareLink,
  createDoubtBanner,
  createFitCard,
  createHonestPrice,
  createOriginCard,
  honestFor,
  loadPriceHistory,
} from "./pdp-extras.js";
import { POLICY_PAGES, whatsappLink } from "./storefront-settings.js";
import { CATALOG_PARAM, mergeCatalogParams, stripCatalogParams } from "./catalog-url.js";
import { initCollections, openCollection, registerCollection } from "./collection-page.js";
import {
  clampQty,
  priceSaving,
  productJsonLd,
  pushRecent,
  relatedProducts,
  reviewSummary,
  stockState,
  timeAgo,
} from "./product-detail.js";
import CFG from "../client-config.js";
import {
  applyStoreProducts,
  detectStoreSlug,
  loadSalesStore,
  rememberSalesRef,
} from "./sales-store.js";

/* ============================================================
   01. KONFIGURASI DAN STATE
   ============================================================ */

const ENGINE_VERSION = "2.0.0";


const SELECTORS = {
  root: "#appRoot",
  hamburger: "#showcaseMenuBtn",
  dashboardHost: "#kantoongDashboardHost",
  pageScroll: "#pageScroll",

  // Hero menggunakan struktur track dan dots dari index.html.
  hero: "#heroSection",
  heroTrack: "#heroTrack",
  heroDots: "#heroDots",

  brandSlot: "#brandSlot",

  // Sesuai dengan ID yang benar di index.html.
  featured: "#featuredRail",
  categories: "#categoryList",

  productSearch: "#productSearch",
  searchButton: "#btnSearch",
  cartButton: "#btnCart",
  cartCount: "#cartCount",
  dynamicComponents: "#dynamicComponentContainer",
};

const DASHBOARD_URL = new URL(
  "./dashboard-user/dashboard-user.html",
  document.baseURI
).href;

const state = {
  initialized: false,
  salesStore: null,
  dashboardOpen: false,
  dashboardFrame: null,
  dashboardLoadPromise: null,
  products: [],
  featured: [],
  categories: [],
  matched: [],
  cart: [],
  isLoading: false,
  usingDemo: false,
  activeTenant: String(CFG?.business_id || ""),
  searchQuery: "",
  currentHeroIndex: 0,
  heroTimer: null,
};

const events = new EventTarget();

const $ = (selector, parent = document) =>
  parent.querySelector(selector);

const $$ = (selector, parent = document) =>
  Array.from(parent.querySelectorAll(selector));

function emit(name, detail = {}) {
  const event = new CustomEvent(name, { detail });

  events.dispatchEvent(event);
  window.dispatchEvent(
    new CustomEvent(`kantoong:${name}`, { detail })
  );
}

function log(...args) {
  console.info("[KANTOONG CORE]", ...args);
}

function warn(...args) {
  console.warn("[KANTOONG CORE]", ...args);
}

function reportError(message, error) {
  console.error(`[KANTOONG CORE] ${message}`, error || "");
  emit("engine-error", {
    message,
    error: error ? String(error.message || error) : null,
  });
}

function escapeText(value) {
  return String(value ?? "").trim();
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function isSafeImageURL(value) {
  if (!value) return false;

  try {
    const url = new URL(String(value), document.baseURI);
    return ["http:", "https:", "blob:"].includes(url.protocol);
  } catch {
    return false;
  }
}

/**
 * Latar blur dari foto yang sama, supaya foto bisa tampil utuh
 * (tidak terpotong) tanpa menyisakan ruang kosong yang polos.
 */
function setMediaBackdrop(container, src) {
  const url = new URL(String(src), document.baseURI).href;
  container.style.setProperty("--media-backdrop", `url(${JSON.stringify(url)})`);
  container.classList.add("has-backdrop");
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text !== undefined && text !== null) {
    element.textContent = String(text);
  }

  return element;
}

function getProductName(product) {
  return escapeText(
    product?.name ??
    product?.product_name ??
    product?.title ??
    "Produk"
  );
}

function getProductPrice(product) {
  return toNumber(
    product?.price ??
    product?.selling_price ??
    product?.harga ??
    0
  );
}

function getProductImage(product) {
  return (
    product?.image_url ??
    product?.image ??
    product?.thumbnail ??
    product?.photo_url ??
    ""
  );
}

function getProductId(product) {
  return String(
    product?.id ??
    product?.product_id ??
    product?.sku ??
    getProductName(product)
  );
}

function getProductCategory(product) {
  return escapeText(
    product?.category ??
    product?.category_name ??
    product?.kategori ??
    "Lainnya"
  );
}

/* ============================================================
   02. STATE PUBLIK UNTUK MODUL KANTOONG LAIN
   ============================================================ */

const KantoongState = {
  get products() {
    return state.products;
  },

  get featured() {
    return state.featured;
  },

  get matched() {
    return state.matched;
  },

  get cart() {
    return state.cart;
  },

  get isLoading() {
    return state.isLoading;
  },

  get usingDemo() {
    return state.usingDemo;
  },

  get activeTenant() {
    return state.activeTenant;
  },

  get dashboardOpen() {
    return state.dashboardOpen;
  },

  get agentStatus() {
    return state.agentStatus || "idle";
  },
};

window.KantoongState = KantoongState;

/* ============================================================
   03. NOTIFIKASI RINGAN
   ============================================================ */

let toastTimer = null;

function showToast(message, duration = 2600) {
  let toast = $("#kantoongEngineToast");

  if (!toast) {
    toast = makeElement("div", "kantoong-engine-toast");
    toast.id = "kantoongEngineToast";

    Object.assign(toast.style, {
      position: "fixed",
      left: "50%",
      bottom: "24px",
      transform: "translate(-50%, 12px)",
      zIndex: "100000",
      maxWidth: "calc(100vw - 32px)",
      padding: "12px 16px",
      borderRadius: "12px",
      background: "#171717",
      color: "#ffffff",
      fontSize: "14px",
      lineHeight: "1.4",
      boxShadow: "0 8px 30px rgba(0,0,0,.18)",
      opacity: "0",
      pointerEvents: "none",
      transition: "opacity .18s ease, transform .18s ease",
    });

    document.body.appendChild(toast);
  }

  toast.textContent = String(message);
  toast.style.opacity = "1";
  toast.style.transform = "translate(-50%, 0)";

  if (toastTimer) window.clearTimeout(toastTimer);

  toastTimer = window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translate(-50%, 12px)";
  }, duration);
}

window.KantoongToast = showToast;

/* ============================================================
   04. DASHBOARD USER — IFRAME HOST
   ============================================================ */

function getDashboardHost() {
  let host = $(SELECTORS.dashboardHost);

  if (!host) {
    host = makeElement("section");
    host.id = "kantoongDashboardHost";
    host.hidden = true;
    host.setAttribute("aria-hidden", "true");
    host.setAttribute("aria-label", "Dashboard User KANTOONG");

    document.body.appendChild(host);
  }

  Object.assign(host.style, {
    position: "fixed",
    inset: "0",
    zIndex: "90000",
    width: "100%",
    height: "100%",
    height: "100dvh",
    margin: "0",
    padding: "0",
    border: "0",
    overflow: "hidden",
    background: "#ffffff",
  });

  return host;
}

function getDashboardFrame() {
  const host = getDashboardHost();

  if (state.dashboardFrame?.isConnected) {
    return state.dashboardFrame;
  }

  const frame = makeElement("iframe");
  frame.id = "kantoongDashboardFrame";
  frame.title = "KANTOONG User Dashboard";
  frame.src = DASHBOARD_URL;
  frame.loading = "eager";
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  frame.setAttribute("allow", "clipboard-read; clipboard-write; camera; microphone");
  frame.setAttribute("allowfullscreen", "");

  Object.assign(frame.style, {
    display: "block",
    width: "100%",
    height: "100%",
    minHeight: "100%",
    border: "0",
    margin: "0",
    padding: "0",
    background: "#ffffff",
  });

  frame.addEventListener("load", () => {
    frame.dataset.kantoongLoaded = "true";
    log("Dokumen Dashboard User selesai dimuat.");
    emit("dashboard-document-loaded", { url: DASHBOARD_URL });
  });

  frame.addEventListener("error", () => {
    reportError(
      "Browser gagal memuat dokumen Dashboard User. Periksa path dan server Vite."
    );
    showToast("Dashboard gagal dimuat. Periksa kembali alamat halaman.");
  });

  host.replaceChildren(frame);
  state.dashboardFrame = frame;

  return frame;
}

function setPageVisibilityForDashboard(isOpen) {
  const page = $(SELECTORS.pageScroll);

  if (page) {
    page.hidden = isOpen;
    page.setAttribute("aria-hidden", String(isOpen));
  }

  
const header = $("header");
const hamburger = $(SELECTORS.hamburger);

if (header) {
  if (isOpen && header.contains(document.activeElement)) {
    hamburger?.blur();
  }

  header.hidden = isOpen;
  header.setAttribute("aria-hidden", String(isOpen));
}


  const host = getDashboardHost();

  host.hidden = !isOpen;
  host.setAttribute("aria-hidden", String(!isOpen));

  document.body.classList.toggle("kantoong-dashboard-open", isOpen);
  document.documentElement.classList.toggle(
    "kantoong-dashboard-open",
    isOpen
  );

  document.body.style.overflow = isOpen ? "hidden" : "";
  document.documentElement.style.overflow = isOpen ? "hidden" : "";

  const button = $(SELECTORS.hamburger);

  if (button) {
    button.setAttribute("aria-expanded", String(isOpen));
    button.setAttribute(
      "aria-label",
      isOpen ? "Tutup dashboard" : "Buka dashboard"
    );
  }
}


function sendDashboardOpenMessage() {
  const frame = state.dashboardFrame;

  if (!frame?.contentWindow) return;

  frame.contentWindow.postMessage(
    {
      type: "kantoong:dashboard-open",
    },
    window.location.origin
  );
}

function openDashboard() {
  if (state.dashboardOpen) return;

  try {
    const frame = getDashboardFrame();

    state.dashboardOpen = true;
    setPageVisibilityForDashboard(true);

    // Beri tahu Dashboard User bahwa pengguna ingin membukanya.
    // PERBAIKAN LAYAR PUTIH: iframe baru selalu berisi about:blank yang
    // readyState-nya sudah "complete", sehingga pengecekan lama mengirim
    // pesan ke dokumen kosong. Sekarang kita memakai penanda khusus yang
    // hanya diset saat dokumen dashboard ASLI selesai dimuat.
    if (frame.dataset.kantoongLoaded === "true") {
      sendDashboardOpenMessage();
    } else {
      frame.addEventListener("load", sendDashboardOpenMessage, {
        once: true,
      });
    }

    emit("dashboard-opened", {
      tenant: state.activeTenant,
      url: DASHBOARD_URL,
    });

    log("Dashboard User dibuka.");
  } catch (error) {
    state.dashboardOpen = false;
    setPageVisibilityForDashboard(false);

    reportError("Tidak dapat membuka Dashboard User.", error);
    showToast("Dashboard belum dapat dibuka.");
  }
}

function closeDashboard() {
  if (!state.dashboardOpen) return;

  state.dashboardOpen = false;
  setPageVisibilityForDashboard(false);
  // Katalog ditutup: link kembali bersih.
  if (new URLSearchParams(location.search).has(CATALOG_PARAM)) {
    history.replaceState(history.state, "", `${location.pathname}${stripCatalogParams(location.search)}${location.hash}`);
  }

  emit("dashboard-closed", {
    tenant: state.activeTenant,
  });

  log("Dashboard User ditutup.");
}

function toggleDashboard() {
  if (state.dashboardOpen) {
    closeDashboard();
  } else {
    openDashboard();
  }
}

window.openKantoongBentoDashboard = openDashboard;
window.closeKantoongBentoDashboard = closeDashboard;
window.toggleKantoongBentoDashboard = toggleDashboard;

/*
 * Komunikasi iframe:
 * Hanya menerima pesan dari iframe Dashboard User yang kita buat
 * dan dari origin yang sama. Pesan dari website luar diabaikan.
 *
 * Dashboard User dapat mengirim:
 * { type: "dashboard-close-request" }
 * { type: "dashboard-ready" }
 * { type: "dashboard-bootstrap-error", message: "..." }
 */
window.addEventListener("message", (event) => {
  const frame = state.dashboardFrame;

  if (!frame || event.source !== frame.contentWindow) return;
  if (event.origin !== window.location.origin) return;

  const message = event.data;

  if (!message || typeof message !== "object") return;

  switch (message.type) {
    case "dashboard-ready":
    case "kantoong:dashboard-ready":
      emit("dashboard-ready", { tenant: state.activeTenant });
      log("Dashboard User melaporkan status siap.");

      // Jaring pengaman: bila pesan "open" sebelumnya terlewat,
      // kirim lagi saat dashboard menyatakan siap.
      if (state.dashboardOpen) {
        sendDashboardOpenMessage();
      }
      setTimeout(flushDashboardFeature, 60);
      break;

    case "kantoong:dashboard-close-request":
      closeDashboard();
      break;

    // Katalog di dashboard: saringan ditulis ke alamat toko (?katalog=1&cari=…).
    case "kantoong:catalog-state": {
      const params = new URLSearchParams(String(message.params ?? "").slice(0, 600));
      if (params.get(CATALOG_PARAM) !== "1") break;
      history.replaceState(history.state, "", `${location.pathname}${mergeCatalogParams(location.search, params)}${location.hash}`);
      break;
    }

    // Dari Dashboard User: buka produk / keranjang / asisten di toko.
    case "kantoong:open-product": {
      const product = findProductById(String(message.id ?? ""));
      productPage.returnTo = String(message.from ?? "").replace(/[^a-z0-9-]/g, "");
      closeDashboard();
      if (product) setTimeout(() => openProductPage(product), 120);
      break;
    }

    case "kantoong:open-cart":
      closeDashboard();
      setTimeout(() => $(SELECTORS.cartButton)?.click(), 160);
      break;

    case "kantoong:open-assistant":
      closeDashboard();
      setTimeout(() => askConsultation(""), 160);
      break;

    case "dashboard-bootstrap-error":
    case "kantoong:dashboard-bootstrap-error":
      reportError(
        `Dashboard User mengalami error: ${escapeText(message.message)}`
      );
      break;

    default:
      // Pesan lain tidak diproses oleh engine.
      break;
  }
});

/* ============================================================
   05. TOMBOL DAN KEYBOARD
   ============================================================ */

function initDashboardControls() {
  const button = $(SELECTORS.hamburger);

  if (button && button.dataset.kantoongDashboardBound !== "true") {
    button.dataset.kantoongDashboardBound = "true";

    button.addEventListener("click", (event) => {
      event.preventDefault();
      toggleDashboard();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.dashboardOpen) {
      closeDashboard();
    }
  });

  // Dapat dipanggil modul lain tanpa bergantung pada tombol.
  document.addEventListener("kantoong:dashboard-open", openDashboard);
  document.addEventListener("kantoong:dashboard-close", closeDashboard);
}

/* ============================================================
   06. KONFIGURASI TEMA DAN SLOT BRAND
   ============================================================ */

function applyConfig() {
  const primaryColor = escapeText(CFG?.theme_color_primary || "#111111");

  document.documentElement.style.setProperty(
    "--primary-color",
    primaryColor
  );

  document.documentElement.style.setProperty(
    "--kantoong-primary",
    primaryColor
  );

  if (CFG?.app_name) {
    document.title = String(CFG.app_name);
  }

  const brandTitle = $("#brandTitle");

  if (brandTitle && CFG?.app_name) {
    // Logo dari ERP › Etalase & Brand menggantikan tulisan nama brand.
    const logo = getStorefront().brand?.logo;
    if (logo) {
      const img = document.createElement("img");
      img.className = "brand-logo";
      img.src = logo;
      img.alt = String(CFG.app_name);
      brandTitle.replaceChildren(img);
    } else {
      brandTitle.textContent = String(CFG.app_name);
    }
  }

  // Judul "Produk Unggulan" (dipakai juga oleh panel teks di dalam rail).
  const featuredTitle = $("#featuredTitle");
  const featuredEyebrow = $("#featuredEyebrow");

  if (featuredTitle && CFG?.featured?.title) {
    featuredTitle.textContent = String(CFG.featured.title);
  }

  if (featuredEyebrow && CFG?.featured?.eyebrow) {
    featuredEyebrow.textContent = String(CFG.featured.eyebrow);
  }

  const featuredText = $("#featuredText");
  if (featuredText) {
    featuredText.textContent = String(CFG?.featured?.description || "").trim();
    featuredText.hidden = !featuredText.textContent;
  }


  emit("config-applied", {
    appName: CFG?.app_name || "KANTOONG",
    tenant: state.activeTenant,
  });
}

function renderBrandSlot() {
  const slot = $(SELECTORS.brandSlot);
  const brand = CFG?.brand_slot;

  if (!slot || !brand) return;

  slot.replaceChildren();

  if (brand.type === "none") return;

  if (brand.type === "marquee" && Array.isArray(brand.items) && brand.items.length) {
    slot.appendChild(createBrandMarquee(brand));
    return;
  }

  if (brand.type === "highlights" && Array.isArray(brand.items)) {
    const highlights = makeElement("div", "brand-highlights");

    brand.items.slice(0, 4).forEach((item) => {
      const cell = makeElement("div", "brand-highlight");
      cell.appendChild(makeElement("strong", "brand-highlight__title", item?.title ?? ""));
      cell.appendChild(makeElement("span", "brand-highlight__sub", item?.sub ?? ""));
      highlights.appendChild(cell);
    });

    slot.appendChild(highlights);
    return;
  }

  const wrapper = makeElement("div", "kantoong-brand-slot");

  if (brand.image && isSafeImageURL(brand.image)) {
    const image = makeElement("img");
    image.src = brand.image;
    image.alt = escapeText(brand.alt || CFG?.app_name || "Brand");
    image.loading = "lazy";
    image.decoding = "async";
    wrapper.appendChild(image);
  }

  if (brand.title) {
    wrapper.appendChild(
      makeElement("h2", "kantoong-brand-slot__title", brand.title)
    );
  }

  if (brand.description) {
    wrapper.appendChild(
      makeElement(
        "p",
        "kantoong-brand-slot__description",
        brand.description
      )
    );
  }

  if (brand.link && isSafeImageURL(brand.link)) {
    const link = makeElement("a", "kantoong-brand-slot__link", "Lihat selengkapnya");
    link.href = brand.link;
    link.rel = "noopener noreferrer";
    wrapper.appendChild(link);
  }

  slot.appendChild(wrapper);
}

/* ------------------------------------------------------------
   Pita berjalan di bawah hero: bergerak kanan -> kiri tanpa henti.
   Item berupa keunggulan brand ({ icon, title, sub }) atau
   logo/nama brand ({ logo, name }). Diatur di client-config.js.
   ------------------------------------------------------------ */

const MARQUEE_ICONS = {
  truck: [
    "M3 6h11v10H3z",
    "M14 10h4l3 3v3h-7",
    "M5.5 18a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M15.5 18a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0",
  ],
  box: ["M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z", "M3 7.5 12 12l9-4.5", "M12 12v9"],
  badge: ["M12 2.5l2.4 1.8 3-.2.9 2.9 2.4 1.8-1 2.8 1 2.8-2.4 1.8-.9 2.9-3-.2L12 21.5l-2.4-1.8-3 .2-.9-2.9-2.4-1.8 1-2.8-1-2.8 2.4-1.8.9-2.9 3 .2z", "M8.8 12l2.2 2.2 4.2-4.4"],
  lock: ["M5 11h14v10H5z", "M8 11V7a4 4 0 0 1 8 0v4", "M12 15v2"],
  chat: ["M4 5h16v11H9l-5 4z"],
  heart: ["M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"],
};

function createMarqueeItem(item) {
  const cell = makeElement("div", "brand-marquee__item");

  if (item?.logo && isSafeImageURL(item.logo)) {
    const img = makeElement("img", "brand-marquee__logo");
    img.src = item.logo;
    img.alt = escapeText(item.name || "Brand");
    img.loading = "lazy";
    img.decoding = "async";
    cell.appendChild(img);
    return cell;
  }

  if (item?.icon && MARQUEE_ICONS[item.icon]) {
    cell.appendChild(makeIcon("brand-marquee__icon", MARQUEE_ICONS[item.icon]));
  }

  const text = makeElement("div", "brand-marquee__text");
  text.appendChild(
    makeElement("strong", "brand-marquee__title", item?.title || item?.name || "")
  );
  if (item?.sub) {
    text.appendChild(makeElement("span", "brand-marquee__sub", item.sub));
  }
  cell.appendChild(text);

  return cell;
}

function createBrandMarquee(brand) {
  const wrap = makeElement("div", "brand-marquee");
  wrap.setAttribute("role", "region");
  wrap.setAttribute("aria-label", brand.label || "Keunggulan brand");

  if (brand.label) {
    wrap.appendChild(makeElement("p", "brand-marquee__label", brand.label));
  }

  const viewport = makeElement("div", "brand-marquee__viewport");
  const track = makeElement("div", "brand-marquee__track");

  // Dua salinan identik: saat salinan pertama habis bergeser,
  // salinan kedua tepat menggantikannya -> terlihat tanpa ujung.
  for (let copy = 0; copy < 2; copy += 1) {
    const group = makeElement("div", "brand-marquee__group");
    if (copy === 1) group.setAttribute("aria-hidden", "true");

    // Ulang item agar satu salinan selalu lebih lebar dari layar.
    const repeat = Math.max(1, Math.ceil(8 / brand.items.length));
    for (let r = 0; r < repeat; r += 1) {
      brand.items.forEach((item) => group.appendChild(createMarqueeItem(item)));
    }

    track.appendChild(group);
  }

  const seconds = Math.max(8, toNumber(brand.speed_seconds, 30));
  track.style.setProperty("--marquee-duration", `${seconds}s`);

  viewport.appendChild(track);
  wrap.appendChild(viewport);

  return wrap;
}

/* ============================================================
   07. HERO / BANNER
   ============================================================ */

const HERO_MAX_SLIDES = 5;

/**
 * Sumber slide hero:
 * 1. Produk yang ditandai is_hero oleh owner (dashboard admin).
 * 2. Jika belum ada, slide dari client-config.js.
 */
function getHeroSlides() {
  const fromProducts = state.products
    .filter((product) => product?.is_hero === true && product?.is_demo !== true)
    .slice(0, HERO_MAX_SLIDES)
    .map((product) => ({
      type: "image",
      // Foto hero khusus (melebar) bila diunggah admin; jika tidak, foto produk.
      src: product.hero_image_url || getProductImage(product),
      caption: product.hero_caption || "Pilihan unggulan",
      title: getProductName(product),
      text: product.hero_text || product.description || "",
      ai_prompt: `Ceritakan tentang ${getProductName(product)}`,
      product_id: getProductId(product),
    }));

  if (fromProducts.length > 0) {
    return fromProducts;
  }

  const slides = CFG?.hero?.slides;

  if (Array.isArray(slides) && slides.length > 0) {
    return slides;
  }

  if (Array.isArray(CFG?.hero_slides) && CFG.hero_slides.length > 0) {
    return CFG.hero_slides;
  }

  return [
    {
      title: CFG?.app_name || "Selamat datang",
      text: "Temukan produk yang sesuai dengan kebutuhanmu.",
    },
  ];
}

function normalizeHeroSlide(raw) {
  return {
    type: raw?.type || "none",
    src: String(raw?.src ?? raw?.image ?? ""),
    mediaLabel: raw?.media_label || "Foto / video brand",
    caption: raw?.caption || "",
    title: raw?.title ?? raw?.heading ?? CFG?.app_name ?? "",
    text: raw?.text ?? raw?.subtitle ?? raw?.description ?? "",
    aiPrompt: raw?.ai_prompt || raw?.aiPrompt || "",
  };
}

/** Katalog lengkap kini ada di Dashboard User › Katalog Produk (homepage = zona promosi). */
function scrollToCatalog() {
  openDashboardFeature("product-catalog");
}

/**
 * Tombol AI di produk: LAMPIRKAN produk (foto, nama, harga) ke kotak chat,
 * tanpa mengirim. Pembeli lalu menulis sendiri keinginannya, mis.
 * "yang mirip ini tapi warna hitam". Ditangani chat-sheet.js.
 */
/**
 * Lampirkan produk ke kotak ketik chat (TIDAK mengirim, TIDAK menulis kata-kata).
 * photoIndex (0-based) = foto ke-berapa yang sedang dilihat pembeli, agar AI
 * tahu persis foto/model/warna mana yang ditanyakan (satu kartu bisa berisi
 * beberapa model, mis. "cuci gudang").
 */
function attachProductToChat(product, { photoIndex = null } = {}) {
  if (!product) return;
  emit("product-selected", { product });

  const media = getProductMedia(product);
  const picked = Number.isInteger(photoIndex) && photoIndex >= 0 ? media[photoIndex] : null;
  const photo = picked && picked.type === "image" && media.length > 1
    ? {
        photo_index: photoIndex + 1,
        photo_total: media.length,
        photo_label: picked.custom ? picked.label : "",
      }
    : {};

  window.dispatchEvent(
    new CustomEvent("kantoong:attach-product", {
      detail: {
        product: {
          id: getProductId(product),
          name: getProductName(product),
          price: getProductPrice(product),
          image_url: picked?.type === "image" ? picked.src : getProductImage(product),
          ...photo,
        },
      },
    })
  );
}

/**
 * Buka chat dengan kotak ketik KOSONG. Kalimat dari owner (ai_prompt)
 * hanya jadi petunjuk abu-abu (placeholder): tidak ditulis, tidak dikirim.
 * Pembeli sendiri yang menulis pertanyaannya.
 */
function askConsultation(hint) {
  window.dispatchEvent(
    new CustomEvent("kantoong:consult", {
      detail: { text: "", hint: String(hint || "") },
    })
  );
}

function createHeroSlide(rawSlide, index) {
  const slide = normalizeHeroSlide(rawSlide);
  const element = makeElement("article", "hero-slide");
  element.dataset.heroIndex = String(index);

  const media = makeElement("div", "hero-media");
  const showPlaceholder = () => {
    media.replaceChildren(
      makeElement("span", "hero-media__label", slide.mediaLabel)
    );
  };

  if (slide.src && isSafeImageURL(slide.src) && slide.type === "video") {
    const video = document.createElement("video");
    video.src = slide.src;
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.addEventListener("error", showPlaceholder);
    media.appendChild(video);
  } else if (slide.src && isSafeImageURL(slide.src)) {
    const image = document.createElement("img");
    image.src = slide.src;
    image.alt = slide.title;
    image.loading = index === 0 ? "eager" : "lazy";
    image.decoding = "async";
    image.addEventListener("error", showPlaceholder);
    setMediaBackdrop(media, slide.src);
    media.appendChild(image);
  } else {
    showPlaceholder();
  }

  element.appendChild(media);

  const body = makeElement("div", "hero-body");

  if (slide.caption) {
    body.appendChild(makeElement("p", "hero-eyebrow", slide.caption));
  }

  body.appendChild(makeElement("h2", "hero-title", slide.title));

  if (slide.text) {
    body.appendChild(makeElement("p", "hero-text", slide.text));
  }

  const actions = makeElement("div", "hero-actions");

  // Satu tombol pil di dalam foto (sesuai sketsa): "Chat <brand> AI".
  const askButton = makeElement(
    "button",
    "hero-cta",
    `Chat ${CFG?.app_name || "Kantoong"} AI`
  );
  askButton.type = "button";
  askButton.addEventListener("click", () => {
    // Slide produk/promo: produknya DISEMATKAN ke chat (sama seperti tombol AI di kartu produk),
    // agar AI tahu persis banner mana yang ditanyakan.
    const product = slide.product_id ? findProductById(slide.product_id) : null;
    if (product) {
      attachProductToChat(product);
      return;
    }
    askConsultation(slide.aiPrompt || slide.ai_prompt);
  });

  actions.append(askButton);
  body.appendChild(actions);
  element.appendChild(body);

  return element;
}

function updateHeroDots(activeIndex) {
  const dots = $(SELECTORS.heroDots);

  if (!dots) return;

  $$(".hero-dot", dots).forEach((dot, index) => {
    dot.classList.toggle("is-active", index === activeIndex);
  });
}

function renderHeroSlide(index, { scroll = true } = {}) {
  const slides = getHeroSlides();
  if (!slides.length) return;

  state.currentHeroIndex = (index + slides.length) % slides.length;

  const track = $(SELECTORS.heroTrack);
  const hero = $(SELECTORS.hero);

  if (scroll && track) {
    track.scrollTo({
      left: track.clientWidth * state.currentHeroIndex,
      behavior: "smooth",
    });
  }

  updateHeroDots(state.currentHeroIndex);

  if (hero) {
    hero.dataset.slideIndex = String(state.currentHeroIndex);
  }

  emit("hero-slide-changed", {
    index: state.currentHeroIndex,
    slide: slides[state.currentHeroIndex],
  });
}

function renderHero() {
  const track = $(SELECTORS.heroTrack);
  const dots = $(SELECTORS.heroDots);
  const slides = getHeroSlides();

  if (state.heroTimer) {
    window.clearInterval(state.heroTimer);
    state.heroTimer = null;
  }

  if (!track) return;

  track.replaceChildren(
    ...slides.map((slide, index) => createHeroSlide(slide, index))
  );
  track.scrollLeft = 0;

  if (dots) {
    dots.replaceChildren(
      ...slides.map(() => makeElement("span", "hero-dot"))
    );
    dots.hidden = slides.length < 2;
  }

  // Sinkronkan titik penanda saat pengguna menggeser dengan jari/mouse.
  if (track.dataset.heroBound !== "true") {
    track.dataset.heroBound = "true";

    track.addEventListener(
      "scroll",
      () => {
        const width = track.clientWidth || 1;
        const index = Math.round(track.scrollLeft / width);

        if (index !== state.currentHeroIndex) {
          state.currentHeroIndex = index;
          updateHeroDots(index);
        }
      },
      { passive: true }
    );
  }

  state.currentHeroIndex = 0;
  updateHeroDots(0);

  if (slides.length > 1) {
    const interval = Math.max(
      3000,
      toNumber(CFG?.hero?.interval_seconds, 6) * 1000
    );

    state.heroTimer = window.setInterval(() => {
      // Jangan mengganti slide saat dashboard menutupi storefront.
      if (!state.dashboardOpen && !document.hidden) {
        renderHeroSlide(state.currentHeroIndex + 1);
      }
    }, interval);
  }
}

/* ============================================================
   08. DEMO DATA
   ============================================================ */

function getDemoProducts() {
  const products = CFG?.demo_products;

  if (!Array.isArray(products)) return [];

  return products.map((product, index) => ({
    ...product,
    id: product.id ?? `demo-product-${index + 1}`,
    name: getProductName(product),
    price: getProductPrice(product),
    category: getProductCategory(product),
    is_demo: true,
  }));
}

function useDemoProducts() {
  const demoProducts = getDemoProducts();

  state.products = demoProducts;
  state.usingDemo = true;

  renderStorefront();

  emit("supabase-data-ready", {
    products: state.products,
    usingDemo: true,
    tenant: state.activeTenant,
  });

  log(`Menggunakan ${demoProducts.length} produk demo.`);
}

/* ============================================================
   09. SUPABASE — LOAD DATA PRODUK
   ============================================================ */

/*
 * Untuk tenant storefront, query membatasi business_id.
 * Supabase RLS tetap WAJIB untuk melindungi data sebenarnya.
 *
 * Kontrak yang diharapkan:
 * - tabel: products
 * - kolom tenant: business_id
 *
 * Jika nama tabel/kolom di database berbeda, sesuaikan kontrak
 * ini dengan skema Supabase yang benar.
 */

async function fetchProductsFromSupabase() {
  if (!supabase || typeof supabase.from !== "function") {
    throw new Error("Supabase client belum tersedia.");
  }

  const tenantId = state.activeTenant;

  // Filter business_id hanya dipakai bila diminta lewat client-config
  // (filter_by_business_id: true). Keamanan data tetap diatur oleh RLS.
  const filterByTenant = CFG?.filter_by_business_id === true;

  if (filterByTenant && !tenantId) {
    throw new Error(
      "business_id belum dikonfigurasi. Data produk tenant tidak dimuat."
    );
  }

  let query = supabase.from("products").select(PRODUCT_PUBLIC_COLUMNS);

  if (filterByTenant) {
    query = query.eq("business_id", tenantId);
  }

  if (typeof query.order === "function") {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;

  if (error) throw error;

  return Array.isArray(data) ? data : [];
}

async function loadProducts() {
  state.isLoading = true;

  emit("products-loading", { tenant: state.activeTenant });

  try {
    // Toko sales: hanya produk pilihan sales (kode & harga tetap dari katalog master).
    const raw = applyStoreProducts(await fetchProductsFromSupabase(), state.salesStore);
    // Paket industri: spesifikasi (properti/emas) + harga emas hari ini.
    const plan = getPlan();
    // Riwayat harga (Harga Jujur) dimuat bersamaan; gagal = tampilan lama.
    const [attrs] = await Promise.all([loadAttributes(), loadPriceHistory()]);
    const products = enrichProducts(raw, attrs, { industry: plan.industry, gold: getStorefront().catalog.gold });

    state.products = products;
    state.usingDemo = false;

    if (products.length === 0 && CFG?.use_demo_when_empty === true) {
      useDemoProducts();
      return;
    }

    renderStorefront();

    emit("supabase-data-ready", {
      products: state.products,
      usingDemo: false,
      tenant: state.activeTenant,
    });

    log(`Berhasil memuat ${products.length} produk.`);
  } catch (error) {
    reportError("Gagal mengambil produk dari Supabase.", error);

    if (CFG?.use_demo_when_empty === true) {
      useDemoProducts();
    } else {
      state.products = [];
      state.usingDemo = false;
      renderStorefront();

      showToast("Produk belum dapat dimuat. Coba lagi nanti.");

      emit("supabase-data-error", {
        message: String(error?.message || error),
        tenant: state.activeTenant,
      });
    }
  } finally {
    state.isLoading = false;

    // Hero mengikuti produk yang ditandai owner sebagai is_hero.
    renderHero();

    emit("products-loaded", {
      count: state.products.length,
      usingDemo: state.usingDemo,
      tenant: state.activeTenant,
    });
  }
}

/* ------------------------------------------------------------
   Wishlist (ikon hati). Disimpan di perangkat pembeli saja.
   ------------------------------------------------------------ */

const WISHLIST_KEY = "kantoong_wishlist";

function readWishlist() {
  try {
    const saved = JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]");
    return new Set(Array.isArray(saved) ? saved.map(String) : []);
  } catch {
    return new Set();
  }
}

const wishlist = readWishlist();

function isWishlisted(product) {
  return wishlist.has(getProductId(product));
}

function setLikeState(button, liked) {
  button.classList.toggle("is-liked", liked);
  button.setAttribute("aria-pressed", String(liked));
}

function toggleWishlist(product) {
  const id = getProductId(product);
  const added = !wishlist.has(id);

  if (added) {
    wishlist.add(id);
  } else {
    wishlist.delete(id);
  }

  try {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify([...wishlist]));
  } catch {
    // Penyimpanan diblokir (mode privat): hati tetap berfungsi selama halaman terbuka.
  }

  // Samakan semua kartu produk yang sama (bisa muncul di beberapa baris).
  document.querySelectorAll(".product-card, .quickview__card").forEach((card) => {
    if (card.dataset.productId !== id) return;

    const button = card.querySelector(".product-like");
    if (button) setLikeState(button, added);
  });

  emit("wishlist-changed", { product, added, ids: [...wishlist] });
  showToast(
    added
      ? `${getProductName(product)} disimpan ke wishlist.`
      : `${getProductName(product)} dihapus dari wishlist.`
  );
}

/** Ikon garis kecil (SVG) untuk kartu produk. */
function makeIcon(className, paths) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  if (className) svg.setAttribute("class", className);

  paths.forEach((d) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  });

  return svg;
}

const ICONS = {
  heart: ["M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"],
  bag: ["M6 8h12l-1 12H7z", "M9 8V7a3 3 0 0 1 6 0v1"],
  truck: ["M3 6h11v10H3z", "M14 10h4l3 3v3h-7", "M5.5 18a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M15.5 18a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0"],
  pin: ["M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z", "M9.5 10a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0"],
};

function getCompareAtPrice(product) {
  const compareAt = toNumber(product?.compare_at_price ?? product?.original_price, 0);
  if (!(compareAt > 0)) return 0;
  // Harga Jujur: harga coret hanya bila produk ini benar pernah dijual
  // setinggi itu dalam 30 hari terakhir (null = riwayat belum tersedia).
  return honestFor(product, getProductPrice(product)).strike === false ? 0 : compareAt;
}

/** Persen diskon dari harga coret. 0 bila tidak ada diskon asli. */
function getDiscountPercent(product) {
  const price = getProductPrice(product);
  const compareAt = getCompareAtPrice(product);

  if (!(compareAt > price) || price <= 0) return 0;

  return Math.round((1 - price / compareAt) * 100);
}

/* ============================================================
   10. RENDER PRODUK
   ============================================================ */

function createProductCard(product, index, { direct = false } = {}) {
  const card = makeElement("article", "product-card");
  card.dataset.productId = getProductId(product);

  const name = getProductName(product);

  const thumb = makeElement("div", "product-thumb");
  const showPlaceholder = () => {
    // Label & tombol di atas foto tetap dipertahankan.
    thumb
      .querySelectorAll("img, video, .product-video-badge, .product-thumb__placeholder")
      .forEach((el) => el.remove());
    thumb.prepend(
      makeElement(
        "span",
        "product-thumb__placeholder",
        name.charAt(0).toUpperCase() || "P"
      )
    );
  };

  const imageURL = getProductImage(product);
  const videoURL = String(product?.video_url ?? "");

  if (videoURL && isSafeImageURL(videoURL)) {
    // Video produk diputar otomatis tanpa suara agar pembeli langsung paham barangnya.
    const video = document.createElement("video");
    video.src = videoURL;
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = "metadata";
    if (imageURL && isSafeImageURL(imageURL)) {
      video.poster = imageURL;
      setMediaBackdrop(thumb, imageURL);
    }
    video.addEventListener("error", showPlaceholder);
    thumb.appendChild(video);
    thumb.appendChild(makeElement("span", "product-video-badge", "▶ Video"));
  } else if (imageURL && isSafeImageURL(imageURL)) {
    const image = document.createElement("img");
    image.src = imageURL;
    image.alt = name;
    image.loading = index < 4 ? "eager" : "lazy";
    image.decoding = "async";
    image.addEventListener("error", showPlaceholder);
    setMediaBackdrop(thumb, imageURL);
    thumb.appendChild(image);
  } else {
    showPlaceholder();
  }

  // Label diskon: hanya bila harga coret asli diisi owner.
  const discount = getDiscountPercent(product);
  if (discount > 0) {
    thumb.appendChild(makeElement("span", "product-discount", `-${discount}%`));
  } else if (toNumber(product?.sales_count, 0) >= 30) {
    // Stiker Gen Z dari data ASLI (≥30 terjual), bukan karangan.
    thumb.appendChild(makeElement("span", "product-sticker", "🔥 Lagi hits"));
  }

  // Pojok kanan atas: hati (wishlist) lalu orb AI di bawahnya.
  const corner = makeElement("div", "product-corner");

  const likeButton = makeElement("button", "product-like");
  likeButton.type = "button";
  likeButton.dataset.action = "toggle-wishlist";
  likeButton.setAttribute("aria-label", `Simpan ${name} ke wishlist`);
  likeButton.appendChild(makeIcon("", ICONS.heart));
  setLikeState(likeButton, isWishlisted(product));
  likeButton.addEventListener("click", () => toggleWishlist(product));

  // Pembeda dari marketplace biasa: orb AI kecil di pojok foto.
  const askLabel = CFG?.featured?.ask_label || "Tanyakan produk ini";
  const askButton = makeElement("button", "product-ask");
  askButton.type = "button";
  askButton.dataset.action = "ask-product";
  askButton.title = askLabel;
  askButton.setAttribute("aria-label", `${askLabel}: ${name}`);
  askButton.append(
    makeElement("span", "product-ask__eye"),
    makeElement("span", "product-ask__eye")
  );
  askButton.addEventListener("click", () => {
    attachProductToChat(product);
  });

  corner.append(likeButton, askButton);
  thumb.appendChild(corner);

  card.appendChild(thumb);
  card.appendChild(createProductDetails(product));

  // Fase 1 -> 2: ketuk kartu = popup kartu besar (bukan langsung halaman produk).
  // Tombol hati & orb AI di kartu tetap bekerja sendiri.
  card.tabIndex = 0;
  card.setAttribute("aria-label", `Lihat ${name}`);
  // direct = halaman koleksi: ketuk kartu langsung ke halaman produk (seperti "Selengkapnya").
  const openCard = () => (direct ? openProductPage(product) : openQuickView(product));
  card.addEventListener("click", (event) => {
    if (event.target.closest("button, a")) return;
    openCard();
  });
  card.addEventListener("keydown", (event) => {
    if (event.target !== card || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    openCard();
  });

  return card;
}

/**
 * Isi teks kartu: rating & terjual, nama, harga (+ harga coret), pengiriman.
 * Dipakai kartu, popup, dan halaman produk agar tampilannya selalu sama.
 * HP: pengiriman di bawah garis. Desktop: pengiriman di samping harga (CSS).
 */
function createProductDetails(product) {
  const info = makeElement("div", "product-info");

  // Bukti sosial di atas nama: rating & jumlah terjual (angka asli dari database).
  info.appendChild(createProductMeta(product));

  info.appendChild(makeElement("h3", "product-name", getProductName(product)));

  // Paket industri: ringkasan spesifikasi (mis. "LT 120 · LB 90 · 3 KT" atau "24K · 2,5 gr").
  if (product?.spec_line) info.appendChild(makeElement("p", "product-spec", product.spec_line));

  const buyRow = makeElement("div", "product-buy");
  const priceWrap = makeElement("p", "product-price");
  priceWrap.appendChild(
    document.createTextNode(getPlan().industry === "properti" ? bigPrice(getProductPrice(product)) : formatCurrency(getProductPrice(product)))
  );

  if (getDiscountPercent(product) > 0) {
    priceWrap.appendChild(
      makeElement("s", "product-price__was", formatCurrency(getCompareAtPrice(product)))
    );
  }

  buyRow.appendChild(priceWrap);
  info.appendChild(buyRow);

  // Baris pengiriman: estimasi & kota asal.
  info.appendChild(createProductShipping(product));

  return info;
}

/** Angka gaya marketplace: 850, 5rb+, 1,2jt+. */
function formatSocialCount(value) {
  const number = Math.max(0, Math.floor(toNumber(value, 0)));

  if (number >= 1_000_000) {
    return `${String(Math.floor(number / 100_000) / 10).replace(".", ",")}jt+`;
  }

  if (number >= 1_000) {
    return `${Math.floor(number / 1_000)}rb+`;
  }

  return String(number);
}

/**
 * Baris "★ 4.7 (8rb) | 5rb+ terjual" — SELALU tampil agar kartu seragam.
 * Tidak pernah mengarang angka: produk tanpa ulasan tampil "★ Baru",
 * produk belum laku tampil "0 terjual". Angka diisi otomatis oleh
 * database (db/sales-and-reviews.sql).
 */
function createProductMeta(product) {
  const rating = toNumber(product?.rating ?? product?.rating_avg, 0);
  const reviews = toNumber(product?.review_count ?? product?.reviews_count, 0);
  const sold = toNumber(product?.sales_count ?? product?.sold_count, 0);

  const meta = makeElement("div", "product-meta");

  // Rating SELALU tampil (tolok ukur pembeli): "★ 4,8 (12)" atau "★ Baru" bila belum ada ulasan.
  const ratingEl = makeElement("span", `product-rating${rating > 0 ? "" : " is-empty"}`);
  ratingEl.append(makeElement("span", "product-rating__star", "★"));
  if (rating > 0) {
    ratingEl.append(
      makeElement("strong", "", rating.toFixed(1).replace(".", ",")),
      document.createTextNode(reviews > 0 ? ` (${formatSocialCount(reviews)})` : "")
    );
  } else {
    ratingEl.append(document.createTextNode("Baru"));
  }
  meta.appendChild(ratingEl);
  meta.appendChild(makeElement("span", "product-sold", sold > 0 ? `${formatSocialCount(sold)} terjual` : "Jadi yang pertama!"));
  return meta;
}

/**
 * Baris "truk ±1-2 hari | pin Jakarta" — SELALU tampil.
 * Urutan isi: data produk (admin) -> default toko (client-config.js
 * bagian shipping) -> teks netral.
 */
function createProductShipping(product) {
  const estimate =
    escapeText(product?.ship_estimate) ||
    escapeText(CFG?.shipping?.estimate) ||
    "Cek ongkir";
  const from =
    escapeText(product?.ship_from ?? product?.city) ||
    escapeText(CFG?.shipping?.from) ||
    "Indonesia";

  // Label jelas (bukan ikon saja): "Tiba ±3 hari" · "Dari Sumbersari, Band…".
  const hasEstimate = Boolean(escapeText(product?.ship_estimate) || escapeText(CFG?.shipping?.estimate));
  const estimateEl = makeElement("span", "product-ship__item product-ship__eta");
  estimateEl.append(makeIcon("product-icon", ICONS.truck), document.createTextNode(hasEstimate ? `Tiba ${estimate}` : estimate));
  estimateEl.title = hasEstimate ? `Perkiraan tiba ${estimate}` : "Ongkir dihitung saat checkout";

  const fromEl = makeElement("span", "product-ship__item product-ship__from");
  fromEl.append(makeIcon("product-icon", ICONS.pin), makeElement("span", "product-ship__text", `Dari ${from}`));
  fromEl.title = `Dikirim dari ${from}`;

  const row = makeElement("div", "product-ship");
  row.append(estimateEl, fromEl);
  return row;
}

/* ============================================================
   POPUP KARTU (fase 2) & HALAMAN PRODUK (fase 3)
   Fase 1: kartu di etalase/katalog.
   Fase 2: ketuk kartu -> popup kartu besar. Foto/video di belakang
           berganti sendiri (atau digeser), kotak info tetap diam.
   Fase 3: "Selengkapnya" -> halaman produk penuh (#produk/<id>).
   ============================================================ */

const PRODUCT_ROUTE = "#produk/";

/** Urutan media: video dulu (bila ada), lalu foto utama & foto tambahan. */
function getProductMedia(product) {
  const name = getProductName(product);
  const media = [];
  const seen = new Set();

  const push = (type, src, label) => {
    const url = String(src ?? "").trim();
    if (!url || seen.has(url) || !isSafeImageURL(url)) return;
    seen.add(url);

    const custom = escapeText(label);
    media.push({ type, src: url, label: custom || name, custom: Boolean(custom) });
  };

  push("video", product?.video_url, product?.video_label);
  push("image", getProductImage(product), product?.variant_label);
  // Foto hero (melebar) KHUSUS banner homepage — tidak dipakai di popup/halaman produk.

  // Galeri admin: [{ url, label }] (atau daftar URL lama).
  const gallery = Array.isArray(product?.gallery)
    ? product.gallery
    : Array.isArray(product?.gallery_urls)
      ? product.gallery_urls
      : [];

  gallery.forEach((item) => {
    if (typeof item === "string") push("image", item);
    else push("image", item?.url, item?.label);
  });

  return media;
}

/**
 * Galeri bergaya tumpukan kartu.
 * - Foto besar berganti dengan efek FLIP kartu (geser kiri/kanan, atau
 *   berganti sendiri tiap N detik; video diputar sampai selesai dulu).
 * - Tumpukan kartu mini dikipas: kartu aktif "tertarik keluar" ke atas.
 *   Ketuk / tarik ke atas kartu lain = tarik keluar kartu itu.
 *   Tarik ke bawah kartu aktif = masukkan lagi ke tumpukan (kembali ke awal).
 * - Tiap foto punya nama produk/varian sendiri (label), teks utama tetap.
 * Mengembalikan { element, foot, start, stop }.
 */
function createMediaGallery(product, { className = "", onChange } = {}) {
  const media = getProductMedia(product);
  const name = getProductName(product);
  const seconds = Math.max(2, toNumber(CFG?.quick_view?.slide_seconds, 4));

  const gallery = makeElement("div", `media-gallery ${className}`.trim());
  const stage = makeElement("div", "media-gallery__stage");
  const dots = makeElement("div", "media-gallery__dots");
  dots.setAttribute("aria-hidden", "true");

  // Kaki galeri: nama varian + tumpukan kartu mini.
  const foot = makeElement("div", "media-gallery__foot");
  const label = makeElement("p", "media-gallery__label");
  label.setAttribute("aria-live", "polite");
  const deck = makeElement("div", "media-deck");
  deck.style.setProperty("--n", String(Math.max(media.length, 1)));
  foot.append(label, deck);

  const posterOf = () => media.find((entry) => entry.type === "image")?.src || "";
  const cssURL = (src) => `url(${JSON.stringify(new URL(src, document.baseURI).href)})`;

  if (!media.length) {
    const empty = makeElement("div", "media-gallery__slide is-active is-empty");
    empty.appendChild(
      makeElement("span", "product-thumb__placeholder", name.charAt(0).toUpperCase() || "P")
    );
    stage.appendChild(empty);
  }

  media.forEach((item, index) => {
    const slide = makeElement("div", "media-gallery__slide");
    const bg = item.type === "video" ? posterOf() : item.src;
    if (bg) slide.style.setProperty("--slide-bg", cssURL(bg));

    if (item.type === "video") {
      const video = document.createElement("video");
      video.src = item.src;
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";
      if (posterOf()) video.poster = posterOf();
      slide.appendChild(video);
    } else {
      const image = document.createElement("img");
      image.src = item.src;
      image.alt = `${name} — ${item.label}`;
      image.decoding = "async";
      slide.appendChild(image);
    }

    stage.appendChild(slide);
    dots.appendChild(makeElement("span", "media-gallery__dot"));

    // Kartu mini di tumpukan.
    const mini = makeElement("button", "media-deck__card");
    mini.type = "button";
    mini.style.setProperty("--i", String(index));
    mini.setAttribute("aria-label", `Lihat ${item.label}`);
    if (bg) mini.style.backgroundImage = cssURL(bg);
    if (item.type === "video") mini.appendChild(makeElement("span", "media-deck__play", "▶"));
    deck.appendChild(mini);
  });

  gallery.append(stage, dots);
  if (media.length < 2) {
    dots.hidden = true;
    deck.hidden = true;
  }

  let timer = 0;
  let cleanup = 0;
  let running = false;
  let current = -1;

  const slides = () => Array.from(stage.children);

  const playActive = () => {
    slides().forEach((slide, i) => {
      const video = slide.querySelector("video");
      if (!video) return;
      if (i === current && running) {
        video.currentTime = 0;
        video.play?.()?.catch?.(() => {});
      } else {
        video.pause?.();
      }
    });
  };

  const showLabel = (index) => {
    const item = media[index];
    // Nama varian hanya tampil bila diisi owner (bukan sekadar nama produk).
    const text = item?.custom ? item.label : "";
    label.hidden = !text;
    label.textContent = text;
    label.classList.remove("is-new");
    void label.offsetWidth;
    label.classList.add("is-new");
  };

  // Video: tunggu selesai (maks 15 detik). Foto: N detik. Setelah disentuh: lebih lama.
  const schedule = (pause = false) => {
    clearTimeout(timer);
    if (!running || media.length < 2) return;

    const video = slides()[current]?.querySelector("video");
    const wait = pause ? 9000 : video ? 15000 : seconds * 1000;
    timer = setTimeout(() => goTo(current + 1, 1), wait);
    if (video) video.onended = () => goTo(current + 1, 1);
  };

  function goTo(index, dir = 1, { manual = false } = {}) {
    const list = slides();
    if (!list.length) return;

    const target = (index + list.length) % list.length;
    if (target === current) {
      schedule(manual);
      return;
    }

    const previous = list[current];
    const next = list[target];

    list.forEach((slide) => slide.classList.remove("is-entering", "is-leaving"));
    stage.dataset.dir = dir < 0 ? "prev" : "next";

    if (previous) {
      previous.classList.remove("is-active");
      previous.classList.add("is-leaving");
    }

    next.classList.add("is-active");
    if (previous) next.classList.add("is-entering");

    clearTimeout(cleanup);
    cleanup = setTimeout(() => {
      list.forEach((slide) => slide.classList.remove("is-entering", "is-leaving"));
    }, 700);

    current = target;
    Array.from(dots.children).forEach((dot, i) => dot.classList.toggle("is-active", i === target));
    Array.from(deck.children).forEach((card, i) => card.classList.toggle("is-out", i === target));
    showLabel(target);
    playActive();
    schedule(manual);
    onChange?.(target);
  }

  // Geser foto besar = flip ke kartu berikut/sebelumnya.
  let startX = 0;
  let startY = 0;
  stage.addEventListener("pointerdown", (event) => {
    startX = event.clientX;
    startY = event.clientY;
  });
  stage.addEventListener("pointerup", (event) => {
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    goTo(current + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1, { manual: true });
  });

  // Tumpukan: ketuk/tarik ke atas = keluarkan; tarik ke bawah kartu aktif = masukkan lagi.
  Array.from(deck.children).forEach((card, index) => {
    let downY = 0;
    card.addEventListener("pointerdown", (event) => {
      downY = event.clientY;
      card.setPointerCapture?.(event.pointerId);
    });
    card.addEventListener("pointerup", (event) => {
      const dy = event.clientY - downY;
      if (dy > 18 && index === current) {
        goTo(0, -1, { manual: true });
        return;
      }
      goTo(index, index >= current ? 1 : -1, { manual: true });
    });
    card.addEventListener("click", (event) => {
      if (event.detail === 0) goTo(index, index >= current ? 1 : -1, { manual: true });
    });
  });

  return {
    element: gallery,
    foot,
    media,
    get index() {
      return Math.max(0, current);
    },
    show(index) {
      goTo(index, index >= current ? 1 : -1, { manual: true });
    },
    start() {
      running = true;
      current = -1;
      slides().forEach((slide) => slide.classList.remove("is-active", "is-entering", "is-leaving"));
      goTo(0);
    },
    stop() {
      running = false;
      clearTimeout(timer);
      clearTimeout(cleanup);
      stage.querySelectorAll("video").forEach((video) => video.pause?.());
    },
  };
}

/** Baris aksi (abu, sederhana): (orb) Chat <Brand> AI | (keranjang) Keranjang. */
function createProductActions(product, { onChat } = {}) {
  const row = makeElement("div", "product-cta");
  const brand = CFG?.app_name || "Kantoong";

  const chat = makeElement("button", "product-cta__btn");
  chat.type = "button";
  const orb = makeElement("span", "product-ask product-cta__orb");
  orb.setAttribute("aria-hidden", "true");
  orb.append(makeElement("span", "product-ask__eye"), makeElement("span", "product-ask__eye"));
  chat.append(orb, makeElement("span", "", `Chat ${brand} AI`));
  chat.addEventListener("click", () => {
    onChat?.();
    attachProductToChat(product);
  });

  const cart = makeElement("button", "product-cta__btn");
  cart.type = "button";
  cart.dataset.action = "add-to-cart";
  cart.setAttribute("aria-label", `Tambah ${getProductName(product)} ke keranjang`);
  cart.append(makeIcon("product-cta__icon", ICONS.bag), makeElement("span", "", "Keranjang"));
  cart.addEventListener("click", () => addToCart(product));

  row.append(chat, makeElement("span", "product-cta__divider"), cart);
  return row;
}

/* ---------- Fase 2: popup kartu besar (gaya kartu paket wisata) ---------- */

const quickView = { root: null, gallery: null, product: null, lastFocus: null };

function closeQuickView() {
  if (!quickView.root || quickView.root.hidden) return;

  quickView.gallery?.stop();
  quickView.root.classList.remove("is-open");
  const root = quickView.root;
  setTimeout(() => {
    if (!root.classList.contains("is-open")) root.hidden = true;
  }, 220);

  quickView.lastFocus?.focus?.({ preventScroll: true });
  emit("quickview-closed", { product: quickView.product });
}

/** Teks di atas foto: kategori, nama, penjelasan, rating, kirim, harga. */
function createQuickViewText(product) {
  const box = makeElement("div", "quickview__text");
  const category = getProductCategory(product);

  if (category && category !== "Lainnya") {
    box.appendChild(makeElement("p", "quickview__eyebrow", category));
  }

  box.appendChild(makeElement("h3", "quickview__name", getProductName(product)));

  const description = escapeText(product?.description);
  if (description) {
    box.appendChild(makeElement("p", "quickview__desc", description));
  }

  box.appendChild(createProductMeta(product));
  box.appendChild(createProductShipping(product));

  const price = makeElement("div", "quickview__price");
  price.appendChild(makeElement("small", "", "Harga"));

  const now = makeElement("p", "quickview__now", formatCurrency(getProductPrice(product)));
  const discount = getDiscountPercent(product);
  if (discount > 0) {
    now.append(
      makeElement("s", "", formatCurrency(getCompareAtPrice(product))),
      makeElement("span", "quickview__off", `-${discount}%`)
    );
  }
  price.appendChild(now);
  box.appendChild(price);

  return box;
}

function openQuickView(product) {
  if (!product) return;

  const host = $("#appRoot") || document.body;

  if (!quickView.root) {
    const root = makeElement("div", "quickview");
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");

    const backdrop = makeElement("div", "quickview__backdrop");
    backdrop.addEventListener("click", closeQuickView);

    root.appendChild(backdrop);
    host.appendChild(root);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeQuickView();
    });

    quickView.root = root;
  }

  quickView.gallery?.stop();
  quickView.root.querySelector(".quickview__frame")?.remove();
  quickView.product = product;
  quickView.lastFocus = document.activeElement;

  const name = getProductName(product);
  quickView.root.setAttribute("aria-label", name);

  const frame = makeElement("div", "quickview__frame");
  const card = makeElement("article", "quickview__card");
  card.dataset.productId = getProductId(product);

  const gallery = createMediaGallery(product, { className: "quickview__media" });
  quickView.gallery = gallery;

  // Tutup: di luar kartu (pojok kanan atas), agar foto tetap bersih.
  const close = makeElement("button", "quickview__close");
  close.type = "button";
  close.setAttribute("aria-label", "Tutup");
  close.appendChild(makeIcon("", ["M6 6l12 12M18 6L6 18"]));
  close.addEventListener("click", closeQuickView);

  // Kanan atas di dalam kartu: hati (wishlist), lalu perbesar foto di bawahnya.
  const side = makeElement("div", "quickview__side");

  const like = makeElement("button", "quickview__icon product-like");
  like.type = "button";
  like.setAttribute("aria-label", `Simpan ${name} ke wishlist`);
  like.appendChild(makeIcon("", ICONS.heart));
  setLikeState(like, isWishlisted(product));
  like.addEventListener("click", () => toggleWishlist(product));

  const expand = makeElement("button", "quickview__icon quickview__expand");
  expand.type = "button";
  expand.setAttribute("aria-pressed", "false");
  expand.setAttribute("aria-label", "Perbesar foto");
  const expandIcon = ["M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"];
  const shrinkIcon = ["M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"];
  expand.appendChild(makeIcon("", expandIcon));
  expand.addEventListener("click", () => {
    const on = !card.classList.contains("is-expanded");
    card.classList.toggle("is-expanded", on);
    expand.setAttribute("aria-pressed", String(on));
    expand.setAttribute("aria-label", on ? "Tampilkan info produk" : "Perbesar foto");
    expand.replaceChildren(makeIcon("", on ? shrinkIcon : expandIcon));
  });

  side.append(like, expand);

  // Kotak putih bawah: hanya Chat AI | Keranjang + tombol hitam Selengkapnya.
  const panel = makeElement("div", "quickview__panel");
  panel.appendChild(createProductActions(product, { onChat: closeQuickView }));

  const more = makeElement("button", "quickview__more");
  more.type = "button";
  more.append(makeElement("span", "", "Selengkapnya"), makeIcon("", ["M5 12h14M13 6l6 6-6 6"]));
  more.addEventListener("click", () => openProductPage(product));
  panel.appendChild(more);

  card.append(
    gallery.element,
    makeElement("div", "quickview__shade"),
    createQuickViewText(product),
    side,
    gallery.foot,
    panel
  );

  frame.append(close, card);
  quickView.root.appendChild(frame);

  quickView.root.hidden = false;
  // Paksa browser menggambar keadaan awal dulu, lalu animasikan masuk.
  void quickView.root.offsetWidth;
  quickView.root.classList.add("is-open");
  gallery.start();
  close.focus({ preventScroll: true });

  emit("quickview-opened", { product });
}

/* ---------- Fase 3: halaman produk penuh ---------- */

const productPage = { root: null, gallery: null, pushed: false, observer: null, returnTo: "" };

function findProductById(productId) {
  return state.products.find((item) => getProductId(item) === String(productId));
}

function openProductPage(product) {
  if (!product) return;

  const target = `${PRODUCT_ROUTE}${encodeURIComponent(getProductId(product))}`;

  // Pakai hash agar tombol "kembali" di HP menutup halaman produk.
  if (location.hash !== target) {
    productPage.pushed = true;
    location.hash = target;
  } else {
    renderProductPage(product);
  }
}

/** Buka Dashboard User langsung di fitur tertentu (mis. Katalog Produk). */
function openDashboardFeature(featureId) {
  if (!featureId) return;
  state.pendingDashboardFeature = featureId;
  openDashboard();
  // Iframe yang sudah siap langsung menerima; yang baru dimuat menerima saat "dashboard-ready".
  setTimeout(flushDashboardFeature, 150);
}

function flushDashboardFeature() {
  const featureId = state.pendingDashboardFeature;
  const target = state.dashboardFrame?.contentWindow;
  if (!featureId || !target) return;
  try {
    if (target.document?.readyState !== "complete") return;
  } catch {
    /* beda origin: kirim saja */
  }
  state.pendingDashboardFeature = "";
  target.postMessage({ type: "kantoong:dashboard-open-feature", id: featureId }, window.location.origin);
}

/** Kembali ke fitur dashboard asal (mis. Katalog Produk) bila produk dibuka dari sana. */
function returnToDashboardFeature() {
  const featureId = productPage.returnTo;
  productPage.returnTo = "";
  openDashboardFeature(featureId);
}

function closeProductPage() {
  if (productPage.returnTo) {
    // Tutup halaman produk tanpa animasi kembali ke beranda, lalu buka lagi katalognya.
    if (productPage.pushed) {
      productPage.pushed = false;
      history.back();
    } else {
      history.replaceState(null, "", location.pathname + location.search);
      hideProductPage();
    }
    returnToDashboardFeature();
    return;
  }

  if (productPage.pushed) {
    productPage.pushed = false;
    history.back();
    return;
  }

  // Dibuka langsung dari tautan: jangan keluar dari toko, cukup hapus hash.
  history.replaceState(null, "", location.pathname + location.search);
  hideProductPage();
}

function hideProductPage() {
  document.documentElement.classList.remove("kc-pdp-open");
  productPage.gallery?.stop();
  clearProductSeo();
  if (productPage.root) productPage.root.hidden = true;
}

/* ---------- Fase 3: halaman produk ala e-commerce kelas atas ---------- */

const PDP_ICONS = {
  share: ["M12 4v11", "M8 8l4-4 4 4", "M5 13v6h14v-6"],
  shield: ["M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z", "M9 12l2 2 4-4"],
  refresh: ["M20 11a8 8 0 1 0-2.3 5.6", "M20 5v6h-6"],
  close: ["M6 6l12 12", "M18 6L6 18"],
  left: ["M15 5l-7 7 7 7"],
  right: ["M9 5l7 7-7 7"],
  expand: ["M4 9V4h5", "M20 9V4h-5", "M4 15v5h5", "M20 15v5h-5"],
  play: ["M8 5l11 7-11 7z"],
  chart: ["M4 19h16", "M5 15l4-4 3 3 6-7", "M15 7h3v3"],
  tag: ["M3 12V4h8l9 9-8 8z", "M7.5 8.5h.01"],
};

const pdp = { title: "", description: "", reviewsFor: "" };

function pdpButton(className, label, iconPaths, text) {
  const button = makeElement("button", className);
  button.type = "button";
  if (label) button.setAttribute("aria-label", label);
  if (iconPaths) button.appendChild(makeIcon("pdp-icon", iconPaths));
  if (text) button.appendChild(makeElement("span", "", text));
  return button;
}

/** Judul tab, deskripsi & data terstruktur (schema.org) untuk Google / mesin AI. */
function applyProductSeo(product) {
  if (!pdp.title) {
    pdp.title = document.title;
    pdp.description = document.querySelector('meta[name="description"]')?.content ?? "";
  }

  const brand = CFG?.app_name || "Kantoong";
  document.title = `${getProductName(product)} · ${brand}`;

  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "description";
    document.head.appendChild(meta);
  }
  meta.content = (escapeText(product?.caption) || escapeText(product?.description) || getProductName(product)).slice(0, 160);

  let script = document.getElementById("pdpJsonLd");
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "pdpJsonLd";
    document.head.appendChild(script);
  }
  const image = getProductImage(product);
  script.textContent = JSON.stringify(
    productJsonLd(product, {
      url: location.href,
      brand,
      image: isSafeImageURL(image) ? image : undefined,
    })
  );
}

function clearProductSeo() {
  document.getElementById("pdpJsonLd")?.remove();
  if (pdp.title) {
    document.title = pdp.title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = pdp.description;
  }
}

async function shareProduct(product) {
  const data = { title: getProductName(product), text: getProductName(product), url: location.href };
  try {
    if (navigator.share) {
      await navigator.share(data);
      return;
    }
    await navigator.clipboard.writeText(location.href);
    showToast("Tautan produk disalin.");
  } catch {
    /* dibatalkan user */
  }
}

/* ---------- Lihat foto layar penuh + zoom ---------- */

function openMediaLightbox(product, startIndex = 0) {
  const media = getProductMedia(product);
  if (!media.length) return;

  let index = Math.min(Math.max(0, startIndex), media.length - 1);
  const lastFocus = document.activeElement;

  const root = makeElement("div", "pdp-lightbox");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", `Foto ${getProductName(product)}`);

  const stage = makeElement("div", "pdp-lightbox__stage");
  const count = makeElement("p", "pdp-lightbox__count");
  const close = pdpButton("pdp-lightbox__btn pdp-lightbox__close", "Tutup", PDP_ICONS.close);
  const prev = pdpButton("pdp-lightbox__btn pdp-lightbox__prev", "Foto sebelumnya", PDP_ICONS.left);
  const next = pdpButton("pdp-lightbox__btn pdp-lightbox__next", "Foto berikutnya", PDP_ICONS.right);
  const strip = makeElement("div", "pdp-lightbox__strip");

  const draw = () => {
    const item = media[index];
    stage.classList.remove("is-zoomed");
    stage.replaceChildren();
    if (item.type === "video") {
      const video = document.createElement("video");
      video.src = item.src;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      stage.appendChild(video);
    } else {
      const img = document.createElement("img");
      img.src = item.src;
      img.alt = item.label;
      stage.appendChild(img);
    }
    count.textContent = `${index + 1} / ${media.length}`;
    root.querySelector(".pdp-lightbox__ask")?.toggleAttribute("hidden", item.type === "video");
    Array.from(strip.children).forEach((thumb, i) => thumb.classList.toggle("is-active", i === index));
  };

  const go = (step) => {
    index = (index + step + media.length) % media.length;
    draw();
  };

  media.forEach((item, i) => {
    const thumb = makeElement("button", "pdp-lightbox__thumb");
    thumb.type = "button";
    thumb.setAttribute("aria-label", `Foto ${i + 1}`);
    if (item.type === "video") thumb.appendChild(makeIcon("pdp-icon", PDP_ICONS.play));
    else {
      const img = document.createElement("img");
      img.src = item.src;
      img.alt = "";
      img.loading = "lazy";
      thumb.appendChild(img);
    }
    thumb.addEventListener("click", () => {
      index = i;
      draw();
    });
    strip.appendChild(thumb);
  });

  // Ketuk foto = perbesar 2,2× di titik yang diketuk; geser kursor = jelajah.
  stage.addEventListener("click", (event) => {
    const img = stage.querySelector("img");
    if (!img) return;
    const rect = stage.getBoundingClientRect();
    img.style.transformOrigin = `${((event.clientX - rect.left) / rect.width) * 100}% ${((event.clientY - rect.top) / rect.height) * 100}%`;
    stage.classList.toggle("is-zoomed");
  });
  stage.addEventListener("pointermove", (event) => {
    if (!stage.classList.contains("is-zoomed")) return;
    const img = stage.querySelector("img");
    const rect = stage.getBoundingClientRect();
    if (img) img.style.transformOrigin = `${((event.clientX - rect.left) / rect.width) * 100}% ${((event.clientY - rect.top) / rect.height) * 100}%`;
  });

  let swipeX = 0;
  stage.addEventListener("touchstart", (event) => {
    swipeX = event.touches[0].clientX;
  }, { passive: true });
  stage.addEventListener("touchend", (event) => {
    if (stage.classList.contains("is-zoomed")) return;
    const dx = event.changedTouches[0].clientX - swipeX;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
  });

  const onKey = (event) => {
    if (event.key === "Escape") shut();
    else if (event.key === "ArrowRight") go(1);
    else if (event.key === "ArrowLeft") go(-1);
  };

  function shut() {
    document.removeEventListener("keydown", onKey);
    root.classList.remove("is-open");
    setTimeout(() => root.remove(), 200);
    lastFocus?.focus?.({ preventScroll: true });
  }

  close.addEventListener("click", shut);
  prev.addEventListener("click", () => go(-1));
  next.addEventListener("click", () => go(1));
  document.addEventListener("keydown", onKey);

  if (media.length < 2) {
    prev.hidden = true;
    next.hidden = true;
    strip.hidden = true;
  }

  const askPhoto = makeElement("button", "pdp-lightbox__ask", "Tanyakan foto ini");
  askPhoto.type = "button";
  askPhoto.addEventListener("click", () => {
    const at = index;
    shut();
    attachProductToChat(product, { photoIndex: at });
  });

  root.append(stage, count, close, prev, next, askPhoto, strip);
  ($("#appRoot") || document.body).appendChild(root);
  draw();
  requestAnimationFrame(() => root.classList.add("is-open"));
  close.focus({ preventScroll: true });
}

/* ---------- Pop-up "Tunggu Kak" sebelum lanjut beli ---------- */

function openWaitDialog(product, quantity) {
  const root = makeElement("div", "pdp-wait");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "pdpWaitTitle");

  const card = makeElement("div", "pdp-wait__card");
  const orb = makeElement("span", "product-ask pdp-wait__orb");
  orb.setAttribute("aria-hidden", "true");
  orb.append(makeElement("span", "product-ask__eye"), makeElement("span", "product-ask__eye"));

  const title = makeElement("h2", "pdp-wait__title", "Tunggu sebentar, Kak");
  title.id = "pdpWaitTitle";

  const text = makeElement(
    "p",
    "pdp-wait__text",
    `Mau dicek dulu bareng asisten? Ukuran, kecocokan, dan pilihan yang lebih hemat untuk ${getProductName(product)} bisa dicek kurang dari semenit.`
  );

  const ask = pdpButton("pdp-btn pdp-btn--primary", "", null, "Tanya asisten dulu");
  const go = pdpButton("pdp-btn pdp-btn--ghost", "", null, "Lanjut ke keranjang");

  const shut = () => {
    document.removeEventListener("keydown", onKey);
    root.classList.remove("is-open");
    setTimeout(() => root.remove(), 200);
  };
  const onKey = (event) => {
    if (event.key === "Escape") shut();
  };

  ask.addEventListener("click", () => {
    shut();
    attachProductToChat(product, { photoIndex: productPage.gallery?.index ?? null });
  });
  go.addEventListener("click", () => {
    shut();
    addToCart(product, quantity);
    $(SELECTORS.cartButton)?.click();
  });
  root.addEventListener("click", (event) => {
    if (event.target === root) shut();
  });
  document.addEventListener("keydown", onKey);

  const actions = makeElement("div", "pdp-wait__actions");
  actions.append(ask, go);
  card.append(orb, title, text, actions);
  root.appendChild(card);
  ($("#appRoot") || document.body).appendChild(root);
  requestAnimationFrame(() => root.classList.add("is-open"));
  ask.focus({ preventScroll: true });
}

/* ---------- Paket Free & industri: pesan via WhatsApp, spesifikasi ---------- */

function orderViaWhatsApp(product, quantity = 1) {
  const name = getProductName(product);
  const text = `Halo ${CFG?.app_name || ""}, saya tertarik dengan ${name}${quantity > 1 ? ` (${quantity})` : ""}. Link: ${location.origin}${location.pathname}#produk/${encodeURIComponent(getProductId(product))}`;
  const link = whatsappLink(getStorefront(), text);
  if (!link) {
    showToast("Nomor WhatsApp toko belum diisi. Tanyakan lewat asisten, ya.");
    attachProductToChat(product);
    return;
  }
  window.open(link, "_blank", "noopener");
}

function createPdpSpecs(product) {
  const plan = getPlan();
  const rows = specRows(plan.industry, product?.attributes ?? {});
  if (!rows.length) return null;
  const box = makeElement("section", "pdp-specs");
  box.appendChild(makeElement("p", "pdp-eyebrow", plan.industry === "properti" ? "Detail properti" : "Detail perhiasan"));
  const list = makeElement("dl", "pdp-specs__grid");
  rows.forEach((row) => {
    const item = makeElement("div", "pdp-specs__item");
    item.append(makeElement("dt", "", row.label), makeElement("dd", "", row.value));
    list.appendChild(item);
  });
  box.appendChild(list);
  if (product?.price_note) box.appendChild(makeElement("p", "pdp-specs__note", product.price_note));
  if (plan.industry === "properti" && product?.attributes?.maps) {
    const map = makeElement("a", "pdp-specs__map", "Lihat lokasi di Google Maps ↗");
    map.href = product.attributes.maps;
    map.target = "_blank";
    map.rel = "noopener";
    box.appendChild(map);
  }
  return box;
}

/* ---------- Bagian-bagian halaman ---------- */

function createPdpGallery(product) {
  const wrap = makeElement("div", "pdp-gallery");
  const thumbs = makeElement("div", "pdp-thumbs");
  thumbs.setAttribute("role", "tablist");
  thumbs.setAttribute("aria-label", "Pilih foto");

  const gallery = createMediaGallery(product, {
    className: "product-page__media",
    onChange(index) {
      Array.from(thumbs.children).forEach((thumb, i) => {
        thumb.classList.toggle("is-active", i === index);
        thumb.setAttribute("aria-selected", String(i === index));
      });
    },
  });

  const hero = makeElement("div", "product-page__hero");
  hero.append(gallery.element, gallery.foot);

  const discount = getDiscountPercent(product);
  if (discount > 0) hero.appendChild(makeElement("span", "product-discount", `-${discount}%`));

  const zoom = pdpButton("pdp-zoom", "Lihat foto layar penuh", PDP_ICONS.expand);
  zoom.addEventListener("click", (event) => {
    event.stopPropagation();
    openMediaLightbox(product, gallery.index);
  });
  hero.appendChild(zoom);
  hero.addEventListener("dblclick", () => openMediaLightbox(product, gallery.index));

  gallery.media.forEach((item, i) => {
    const thumb = makeElement("button", "pdp-thumb");
    thumb.type = "button";
    thumb.setAttribute("role", "tab");
    thumb.setAttribute("aria-label", `Foto ${i + 1}`);
    if (item.type === "video") {
      thumb.classList.add("is-video");
      thumb.appendChild(makeIcon("pdp-icon", PDP_ICONS.play));
    } else {
      const img = document.createElement("img");
      img.src = item.src;
      img.alt = "";
      img.loading = "lazy";
      thumb.appendChild(img);
    }
    thumb.addEventListener("click", () => gallery.show(i));
    thumbs.appendChild(thumb);
  });

  wrap.append(hero);
  if (gallery.media.length > 1) wrap.append(thumbs);
  return { element: wrap, gallery };
}

function createPdpSummary(product) {
  const box = makeElement("div", "pdp-summary");
  const plan = getPlan();

  // Harga paling atas, besar, TANPA kotak (gaya marketplace).
  const priceRow = makeElement("div", "pdp-price");
  priceRow.appendChild(makeElement("p", "pdp-price__now", plan.industry === "properti" ? bigPrice(getProductPrice(product)) : formatCurrency(getProductPrice(product))));
  if (plan.industry === "properti" && product?.attributes?.listing === "Disewakan") {
    priceRow.appendChild(makeElement("span", "pdp-price__unit", "per tahun"));
  }
  // Harga Jujur hanya untuk TOKO EMAS (harga harian): ikon kecil di samping harga -> pop-up.
  if (plan.industry === "emas" && createHonestPrice(product, getProductPrice(product), formatCurrency)) {
    const info = pdpButton("pdp-honest-btn", "Lihat riwayat harga 30 hari", PDP_ICONS.chart);
    info.addEventListener("click", () => openHonestPopup(product));
    priceRow.appendChild(info);
  }
  box.appendChild(priceRow);

  const saving = priceSaving(getProductPrice(product), getCompareAtPrice(product));
  if (saving > 0) {
    const was = makeElement("p", "pdp-price__was");
    was.append(
      makeElement("span", "pdp-price__off", `${getDiscountPercent(product)}%`),
      makeElement("s", "", formatCurrency(getCompareAtPrice(product)))
    );
    box.appendChild(was);
  }

  box.appendChild(makeElement("h1", "pdp-name", getProductName(product)));

  // Rating & terjual (angka asli). Klik = loncat ke ulasan.
  const meta = createProductMeta(product);
  meta.classList.add("pdp-meta");
  const reviews = toNumber(product?.review_count, 0);
  const link = makeElement("button", "pdp-meta__link", reviews > 0 ? `${reviews} ulasan` : "Belum ada ulasan");
  link.type = "button";
  link.addEventListener("click", () => {
    productPage.root?.querySelector(".pdp-reviews-sec")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  meta.appendChild(link);
  box.appendChild(meta);

  // Produk kolaborasi antar brand Kantoong (atribut collab_with di product_attributes).
  const collab = escapeText(product?.attributes?.collab_with);
  if (collab) {
    const tag = makeElement("p", "pdp-collab");
    tag.append(makeElement("strong", "", "Produk kolaborasi kami"), makeElement("span", "", ` bersama ${collab}`));
    box.appendChild(tag);
  }

  const caption = escapeText(product?.caption);
  if (caption) box.appendChild(makeElement("p", "pdp-caption", caption));

  return box;
}

/** Pop-up Harga Jujur (toko emas): latar gelap buram, grafik 30 hari. */
function openHonestPopup(product) {
  const honest = createHonestPrice(product, getProductPrice(product), formatCurrency);
  if (!honest) return;
  const pop = makeElement("div", "pdp-pop");
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-modal", "true");
  pop.setAttribute("aria-label", "Riwayat harga");
  const card = makeElement("div", "pdp-pop__card");
  const x = pdpButton("pdp-pop__x", "Tutup", PDP_ICONS.close);
  const shut = () => {
    pop.classList.remove("is-open");
    setTimeout(() => pop.remove(), 220);
  };
  x.addEventListener("click", shut);
  pop.addEventListener("click", (event) => {
    if (event.target === pop) shut();
  });
  card.append(x, honest);
  pop.appendChild(card);
  (productPage.root || document.body).appendChild(pop);
  requestAnimationFrame(() => pop.classList.add("is-open"));
}

/** Promo, pengiriman & estimasi tiba, stok (tulisan), jumlah — gaya marketplace. */
function createPdpInfo(product) {
  const box = makeElement("section", "pdp-info");
  const stock = stockState(product?.stock);
  const plan = getPlan();
  const row = (iconPaths, title, ...lines) => {
    const r = makeElement("div", "pdp-info__row");
    const body = makeElement("div", "pdp-info__body");
    body.appendChild(makeElement("strong", "", title));
    lines.filter(Boolean).forEach((line) => body.appendChild(makeElement("span", "", line)));
    r.append(makeIcon("pdp-icon", iconPaths), body);
    return r;
  };

  const saving = priceSaving(getProductPrice(product), getCompareAtPrice(product));
  if (saving > 0) box.appendChild(row(PDP_ICONS.tag, "Promo", `Hemat ${formatCurrency(saving)} untuk produk ini`));

  if (plan.commerce && plan.industry !== "properti") {
    const estimate = escapeText(product?.ship_estimate) || escapeText(CFG?.shipping?.estimate) || "";
    const from = escapeText(product?.ship_from) || escapeText(CFG?.shipping?.from) || "Indonesia";
    box.appendChild(row(ICONS.truck, "Pengiriman", `Dikirim dari ${from}`, estimate ? `Estimasi tiba ${estimate}` : "Estimasi tiba muncul saat checkout", "Ongkir dihitung saat checkout"));
  }

  // Stok = tulisan biasa (angka stok detail ada di ERP).
  box.appendChild(makeElement("p", `pdp-stocktext pdp-stocktext--${stock.key}`, stock.label));

  let qty = clampQty(1, stock.max);
  if (plan.commerce && plan.industry !== "properti" && stock.key !== "out") {
    const q = makeElement("div", "pdp-info__qty");
    const stepper = makeElement("div", "pdp-qty");
    stepper.setAttribute("role", "group");
    stepper.setAttribute("aria-label", "Jumlah");
    const minus = pdpButton("pdp-qty__btn", "Kurangi", null, "−");
    const value = makeElement("output", "pdp-qty__value", String(qty));
    const plus = pdpButton("pdp-qty__btn", "Tambah", null, "+");
    const sync = () => {
      value.textContent = String(qty);
      minus.disabled = qty <= 1;
      plus.disabled = qty >= stock.max;
    };
    minus.addEventListener("click", () => { qty = clampQty(qty - 1, stock.max); sync(); });
    plus.addEventListener("click", () => { qty = clampQty(qty + 1, stock.max); sync(); });
    stepper.append(minus, value, plus);
    sync();
    q.append(makeElement("span", "", "Jumlah"), stepper);
    box.appendChild(q);
  }
  return { box, getQty: () => qty };
}

/** Ulasan pembeli — naik ke atas, langsung terlihat (tidak di tab). */
function createPdpReviewsSection(product) {
  const sec = makeElement("section", "pdp-sec pdp-reviews-sec");
  const n = toNumber(product?.review_count, 0);
  sec.appendChild(makeElement("h2", "pdp-sec__title", n ? `Ulasan pembeli (${n})` : "Ulasan pembeli"));
  const list = makeElement("div", "pdp-reviews");
  sec.appendChild(list);
  loadProductReviews(product, list);
  return sec;
}

function createPdpDetailSections(product) {
  const out = [];
  const specRows = createSpecTable(product);
  const industrySpecs = createPdpSpecs(product);
  if (industrySpecs || specRows.children.length) {
    const sec = makeElement("section", "pdp-sec");
    sec.appendChild(makeElement("h2", "pdp-sec__title", "Spesifikasi"));
    if (industrySpecs) sec.appendChild(industrySpecs);
    if (specRows.children.length) sec.appendChild(specRows);
    out.push(sec);
  }
  const description = escapeText(product?.description);
  const about = makeElement("section", "pdp-sec pdp-about");
  about.append(makeElement("h2", "pdp-sec__title", "Deskripsi"),
    makeElement("p", "", description || escapeText(product?.caption) || "Deskripsi belum diisi. Tanyakan detailnya ke asisten."));
  out.push(about);
  return out;
}

/** Bar bawah (menempel): kiri Chat <brand> AI (garis bercahaya bergerak), kanan + Keranjang (hitam solid). */
function createPdpBottomBar(product, getQty) {
  const bar = makeElement("div", "pdp-cta");
  const chat = makeElement("button", "pdp-cta__chat");
  chat.type = "button";
  const orb = makeElement("span", "product-ask pdp-cta__orb");
  orb.setAttribute("aria-hidden", "true");
  orb.append(makeElement("span", "product-ask__eye"), makeElement("span", "product-ask__eye"));
  chat.append(orb, makeElement("span", "", `Chat ${CFG?.app_name || "Kantoong"} AI`));
  chat.addEventListener("click", () => attachProductToChat(product, { photoIndex: productPage.gallery?.index ?? null }));

  const plan = getPlan();
  const stock = stockState(product?.stock);
  let main;
  if (!plan.commerce || plan.industry === "properti") {
    main = pdpButton("pdp-cta__main", "", null, plan.industry === "properti" ? "Jadwalkan survei" : "Pesan via WhatsApp");
    main.addEventListener("click", () => {
      if (plan.industry === "properti") {
        const link = whatsappLink(getStorefront(), `Halo, saya ingin jadwalkan survei untuk ${getProductName(product)}. ${location.href}`);
        if (link) window.open(link, "_blank", "noopener");
        else orderViaWhatsApp(product, 1);
      } else {
        orderViaWhatsApp(product, getQty());
      }
    });
  } else if (stock.key === "out") {
    main = pdpButton("pdp-cta__main", "", null, "Stok habis");
    main.disabled = true;
  } else {
    main = pdpButton("pdp-cta__main", `Tambah ${getProductName(product)} ke keranjang`, null, "+ Keranjang");
    main.dataset.action = "add-to-cart";
    main.addEventListener("click", () => addToCart(product, getQty()));
  }
  bar.append(chat, main);
  return bar;
}

function createPdpAssurance(product) {
  const list = makeElement("ul", "pdp-assure");
  const policy = CFG?.policies || {};

  const items = [
    [PDP_ICONS.refresh, "Tukar & retur", escapeText(policy.returns) || "Tanyakan kebijakan tukar ke toko lewat asisten"],
    [PDP_ICONS.shield, "Pembayaran aman", "Pembayaran selalu kamu lakukan sendiri. Asisten tidak pernah membayar atas namamu."],
  ];

  items.forEach(([icon, title, text]) => {
    const li = makeElement("li", "pdp-assure__item");
    const body = makeElement("div", "");
    body.append(makeElement("strong", "", title), makeElement("span", "", text));
    li.append(makeIcon("pdp-icon", icon), body);
    list.appendChild(li);
  });

  return list;
}

function createSpecTable(product) {
  const rows = [
    ["Kategori", getProductCategory(product)],
    ["SKU", escapeText(product?.sku)],
    ["Barcode", escapeText(product?.barcode)],
    ["Ketersediaan", stockState(product?.stock).label],
    ["Dikirim dari", escapeText(product?.ship_from) || escapeText(CFG?.shipping?.from)],
    ["Estimasi kirim", escapeText(product?.ship_estimate) || escapeText(CFG?.shipping?.estimate)],
  ].filter(([, value]) => value && value !== "Lainnya");

  const table = makeElement("dl", "pdp-spec");
  rows.forEach(([key, value]) => {
    const row = makeElement("div", "pdp-spec__row");
    row.append(makeElement("dt", "", key), makeElement("dd", "", value));
    table.appendChild(row);
  });
  return table;
}

function renderReviewList(container, product, reviews) {
  container.replaceChildren();
  const summary = reviewSummary(reviews);

  if (!summary.total) {
    const empty = makeElement("div", "pdp-reviews__empty");
    empty.append(
      makeElement("strong", "", "Belum ada ulasan"),
      makeElement("span", "", "Jadilah yang pertama! Ulasan bisa ditulis setelah pesananmu tiba — cuma dari pembeli asli, jadi semuanya jujur ✨")
    );
    container.appendChild(empty);
    return;
  }

  const head = makeElement("div", "pdp-reviews__head");
  const score = makeElement("div", "pdp-reviews__score");
  score.append(
    makeElement("strong", "", summary.avg.toFixed(1).replace(".", ",")),
    makeElement("span", "pdp-stars", "★★★★★"),
    makeElement("small", "", `${summary.total} ulasan`)
  );
  score.querySelector(".pdp-stars").style.setProperty("--fill", `${(summary.avg / 5) * 100}%`);

  const bars = makeElement("div", "pdp-reviews__bars");
  summary.bars.forEach((bar) => {
    const row = makeElement("div", "pdp-bar");
    const track = makeElement("span", "pdp-bar__track");
    const fill = makeElement("span", "pdp-bar__fill");
    fill.style.width = `${bar.pct}%`;
    track.appendChild(fill);
    row.append(makeElement("span", "", `${bar.star}★`), track, makeElement("span", "pdp-bar__n", String(bar.count)));
    bars.appendChild(row);
  });
  head.append(score, bars);
  container.appendChild(head);

  const list = makeElement("ul", "pdp-reviews__list");
  reviews.slice(0, 20).forEach((review) => {
    const li = makeElement("li", "pdp-review");
    const top = makeElement("div", "pdp-review__top");
    const stars = Math.round(toNumber(review?.rating, 0));
    top.append(
      makeElement("strong", "", escapeText(review?.reviewer_label) || "Pembeli"),
      makeElement("span", "pdp-review__badge", "Pembeli terverifikasi"),
      makeElement("span", "pdp-review__time", timeAgo(review?.created_at))
    );
    li.append(top, makeElement("span", "pdp-review__stars", "★".repeat(stars) + "☆".repeat(5 - stars)));
    const comment = escapeText(review?.comment);
    if (comment) li.appendChild(makeElement("p", "", comment));
    list.appendChild(li);
  });
  container.appendChild(list);
}

async function loadProductReviews(product, container) {
  const id = getProductId(product);
  pdp.reviewsFor = id;
  container.replaceChildren(makeElement("p", "pdp-muted", "Memuat ulasan…"));

  let reviews = [];
  try {
    if (supabase && typeof supabase.from === "function" && toNumber(product?.review_count, 0) > 0) {
      const { data, error } = await supabase
        .from("product_reviews")
        .select("rating, comment, reviewer_label, created_at")
        .eq("product_id", id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      reviews = Array.isArray(data) ? data : [];
    }
  } catch (error) {
    warn("Ulasan gagal dimuat:", error?.message || error);
  }

  if (pdp.reviewsFor !== id) return; // user sudah pindah produk
  renderReviewList(container, product, reviews);
}

function createMiniCard(product) {
  const card = makeElement("button", "pdp-mini");
  card.type = "button";
  card.dataset.productId = getProductId(product);
  card.setAttribute("aria-label", `Lihat ${getProductName(product)}`);

  const thumb = makeElement("span", "pdp-mini__img");
  const src = getProductImage(product);
  if (isSafeImageURL(src)) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.loading = "lazy";
    thumb.appendChild(img);
  }
  const discount = getDiscountPercent(product);
  if (discount > 0) thumb.appendChild(makeElement("span", "pdp-mini__off", `-${discount}%`));

  const rating = toNumber(product?.rating_avg ?? product?.rating, 0);
  card.append(
    thumb,
    makeElement("span", "pdp-mini__name", getProductName(product)),
    makeElement("span", "pdp-mini__price", formatCurrency(getProductPrice(product))),
    makeElement("span", "pdp-mini__meta", `${rating > 0 ? `★ ${rating.toFixed(1).replace(".", ",")} · ` : ""}${formatSocialCount(product?.sales_count)} terjual`)
  );
  card.addEventListener("click", () => openProductPage(product));
  return card;
}

function createPdpRail(title, products) {
  if (!products.length) return null;
  const section = makeElement("section", "pdp-rail");
  section.appendChild(makeElement("h2", "pdp-rail__title", title));
  const track = makeElement("div", "pdp-rail__track");
  products.forEach((p) => track.appendChild(createMiniCard(p)));
  section.appendChild(track);
  return section;
}

/** Pembantu untuk tampilan Bandingkan / Ruang Ragu (js/pdp-extras.js). */
function pdpCtx() {
  return {
    industry: getPlan().industry,
    nameOf: getProductName,
    imageOf: getProductImage,
    isSafeImage: isSafeImageURL,
    priceOf: getProductPrice,
    money: formatCurrency,
    find: findProductById,
    open: openProductPage,
  };
}

/** Lawan banding: terakhir dilihat dulu, lalu produk serupa. */
function compareCandidates(product) {
  const id = getProductId(product);
  const recent = pushRecent(null).map(findProductById).filter(Boolean);
  const similar = relatedProducts(product, state.products, { limit: 10, idOf: getProductId });
  return [...recent, ...similar].filter((p) => getProductId(p) !== id);
}

function renderProductPage(product) {
  closeQuickView();

  const host = $("#appRoot") || document.body;

  if (!productPage.root) {
    productPage.root = makeElement("section", "product-page pdp");
    productPage.root.setAttribute("aria-label", "Detail produk");
    host.appendChild(productPage.root);
  }

  productPage.gallery?.stop();

  const id = getProductId(product);
  const page = productPage.root;
  page.replaceChildren();
  page.dataset.productId = id;

  // Bar atas: kembali, jejak halaman, bagikan, wishlist.
  const bar = makeElement("div", "product-page__bar pdp-bar");
  const back = pdpButton("quickview__icon product-page__back", "Kembali", PDP_ICONS.left);
  back.addEventListener("click", closeProductPage);

  const crumb = makeElement("nav", "pdp-crumb");
  crumb.setAttribute("aria-label", "Jejak halaman");
  const home = makeElement("button", "pdp-crumb__link", "Beranda");
  home.type = "button";
  home.addEventListener("click", closeProductPage);
  crumb.appendChild(home);
  const category = getProductCategory(product);
  if (category && category !== "Lainnya") {
    const cat = makeElement("button", "pdp-crumb__link", category);
    cat.type = "button";
    cat.addEventListener("click", () => {
      closeProductPage();
      setTimeout(() => {
        filterByCategory(category);
        scrollToCatalog();
      }, 60);
    });
    crumb.append(makeElement("span", "pdp-crumb__sep", "/"), cat);
  }
  crumb.append(makeElement("span", "pdp-crumb__sep", "/"), makeElement("span", "pdp-crumb__here", getProductName(product)));

  const share = pdpButton("quickview__icon pdp-bar__icon", "Bagikan produk", PDP_ICONS.share);
  share.addEventListener("click", () => shareProduct(product));
  const like = pdpButton("quickview__icon pdp-bar__icon product-like", "Simpan ke wishlist", ICONS.heart);
  setLikeState(like, isWishlisted(product));
  like.addEventListener("click", () => {
    toggleWishlist(product);
    setLikeState(like, isWishlisted(product));
  });
  bar.append(back, crumb, makeElement("span", "pdp-bar__space"), share, like);

  const { element: galleryEl, gallery } = createPdpGallery(product);
  productPage.gallery = gallery;

  const body = makeElement("div", "product-page__body pdp-body");
  const info = createPdpInfo(product);
  body.append(createPdpSummary(product), info.box);
  const fit = createFitCard(product);
  if (fit) body.append(fit);
  body.append(createPdpReviewsSection(product), ...createPdpDetailSections(product));
  const origin = createOriginCard(product);
  if (origin) body.append(origin);
  body.append(createCompareLink(pdpCtx(), product, () => compareCandidates(product)), createPdpAssurance(product));

  // Ruang Ragu: bolak-balik A → B → A dalam 30 menit = tawarkan perbandingan.
  const doubt = createDoubtBanner(pdpCtx(), product);
  if (doubt) body.prepend(doubt);

  const main = makeElement("div", "pdp-main");
  main.append(galleryEl, body);

  const below = makeElement("div", "pdp-below");

  const related = createPdpRail("Produk serupa", relatedProducts(product, state.products, { limit: 10, idOf: getProductId }));
  if (related) below.appendChild(related);

  const recent = pushRecent(id)
    .filter((x) => x !== id)
    .map(findProductById)
    .filter(Boolean)
    .slice(0, 10);
  const recentRail = createPdpRail("Terakhir kamu lihat", recent);
  if (recentRail) below.appendChild(recentRail);

  page.append(bar, main, below, createPdpBottomBar(product, info.getQty));
  productPage.observer?.disconnect();
  // Asisten: orb & kotak "Hai Kak" disembunyikan di halaman produk (chat lewat tombol bawah).
  document.documentElement.classList.add("kc-pdp-open");

  page.hidden = false;
  page.scrollTop = 0;
  gallery.start();
  applyProductSeo(product);

  emit("product-page-opened", { product });
}

/** Buka/tutup halaman produk mengikuti alamat (#produk/<id>). */
function syncProductRoute() {
  if (!location.hash.startsWith(PRODUCT_ROUTE)) {
    hideProductPage();
    return;
  }

  const id = decodeURIComponent(location.hash.slice(PRODUCT_ROUTE.length));
  const product = findProductById(id);

  if (product) {
    renderProductPage(product);
  } else {
    hideProductPage();
  }
}

function initProductRoute() {
  window.addEventListener("hashchange", syncProductRoute);
}

function isFeaturedProduct(product) {
  return (
    product?.featured === true ||
    product?.is_featured === true ||
    product?.isFeatured === true
  );
}

/**
 * Etalase awal: produk yang ditandai owner sebagai unggulan.
 * Jika belum ada yang ditandai, tampilkan beberapa produk pertama.
 */
function getFeaturedProducts() {
  const featured = state.products.filter(isFeaturedProduct);

  if (featured.length > 0) {
    return featured;
  }

  const limit = Math.max(1, toNumber(CFG?.featured?.limit, 8));

  return state.products.slice(0, limit);
}

function getProductContainer() {
  return (
    $("#featuredRail") ||
    $("#featuredProducts") ||
    $("#featured") ||
    $("#productGrid") ||
    $("#productsGrid") ||
    $("#productList") ||
    $("[data-kantoong-products]")
  );
}


function renderProducts(productsToRender, target) {
  const container = target || getProductContainer();

  state.featured = state.products.filter(
    (product) =>
      product?.featured === true ||
      product?.is_featured === true ||
      product?.isFeatured === true
  );

  if (!container) {
    warn(
      "Container produk tidak ditemukan. Periksa ID pada index.html."
    );

    emit("products-render-skipped", {
      reason: "container-not-found",
    });

    return;
  }

  // Tanpa argumen = etalase unggulan. Dengan argumen = hasil filter/cari/AI.
  const products = Array.isArray(productsToRender)
    ? productsToRender
    : getFeaturedProducts();

  container.replaceChildren();

  if (!products.length) {
    container.appendChild(
      makeElement(
        "p",
        "kantoong-empty-state",
        state.isLoading
          ? "Sedang memuat produk..."
          : "Belum ada produk yang tersedia."
      )
    );

    return;
  }

  const fragment = document.createDocumentFragment();

  products.forEach((product, index) => {
    fragment.appendChild(createProductCard(product, index));
  });

  container.appendChild(fragment);

  if (container.classList.contains("featured-rail")) {
    decorateShowcaseRail(container);
  }

  emit("products-rendered", {
    count: products.length,
    products,
  });
}

/* ------------------------------------------------------------
   ETALASE "HIDUP" (Produk Unggulan, Best Seller, Produk Terbaru, ...)
   Setiap bagian bertanda .featured punya:
   - mode 2D: baris geser; kartu fokus membesar; tulisan melompat
     memutar kiri (awal) -> atas (tengah) -> kanan (ujung);
   - mode 3D: KOMIDI PUTAR — kartu melingkar, tulisan diam di kiri,
     geser jari = memutar lingkaran;
   - tombol 2D/3D (label = mode tujuan), titik posisi, panah berikutnya.
   ------------------------------------------------------------ */

// Pilihan 2D/3D disimpan PER BAGIAN: { featured: "3d", "rail-sales": "2d", ... }
const SHOWCASE_VIEWS_KEY = "kantoong_showcase_views";

/** Status putaran komidi putar per baris. */
const carouselStates = new WeakMap();

function getCarousel(rail) {
  if (!carouselStates.has(rail)) {
    carouselStates.set(rail, {
      pos: 0,          // posisi putaran dalam satuan kartu (boleh pecahan)
      dragging: false,
      moved: false,
      startX: 0,
      startPos: 0,
      pointerId: null,
    });
  }

  return carouselStates.get(rail);
}

function getShowcase(element) {
  return element?.closest?.(".featured") || null;
}

function getShowcaseRail(section) {
  return section?.querySelector(".featured-rail") || null;
}

function isCarouselMode(section) {
  return section?.dataset.view === "3d";
}

function getRailCards(rail) {
  return [...rail.children].filter((el) => el.classList.contains("product-card"));
}

function setActiveDot(section, activeIndex) {
  $$(".featured-dot", section).forEach((dot, index) => {
    dot.classList.toggle("is-active", index === activeIndex);
  });
}

function updateRailFocus(rail) {
  const section = getShowcase(rail);

  if (isCarouselMode(section)) return;

  const cards = getRailCards(rail);

  if (!cards.length) return;

  const max = rail.scrollWidth - rail.clientWidth;
  const progress = max > 1 ? Math.min(1, Math.max(0, rail.scrollLeft / max)) : 0;

  const centerOf = (card) => card.offsetLeft + card.offsetWidth / 2;
  const first = centerOf(cards[0]);
  const last = centerOf(cards[cards.length - 1]);
  const focusX = first + (last - first) * progress;
  const step = cards[0].offsetWidth || 1;

  let activeIndex = 0;
  let nearest = Infinity;

  cards.forEach((card, index) => {
    const distance = Math.abs(centerOf(card) - focusX);
    const focus = 1 - Math.min(1, distance / step);

    card.style.setProperty("--focus", focus.toFixed(3));
    card.classList.toggle("is-focus", focus > 0.5);

    if (distance < nearest) {
      nearest = distance;
      activeIndex = index;
    }
  });

  rail.dataset.active = String(activeIndex);

  if (!section) return;

  const panel = rail.querySelector(".featured-panel");
  const edge = (panel?.offsetWidth || 0) * 0.6;
  let layout = "middle";

  if (!panel || max <= 1 || rail.scrollLeft <= edge) {
    layout = "start";
  } else if (rail.scrollLeft >= max - edge) {
    layout = "end";
  }

  if (section.dataset.layout !== layout) {
    section.dataset.layout = layout;
    positionFeaturedFloat(section);
  }

  setActiveDot(section, activeIndex);
}

function enhanceRail(rail) {
  if (!rail) return;

  if (rail.dataset.focusReady !== "true") {
    rail.dataset.focusReady = "true";
    rail.classList.add("rail--focus");

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        updateRailFocus(rail);
      });
    };

    rail.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
  }

  updateRailFocus(rail);
  // Ukuran kartu baru pasti setelah foto/huruf termuat.
  requestAnimationFrame(() => updateRailFocus(rail));
}

/** Geser rail sampai kartu ke-index berada di tengah. */
function scrollRailToCard(rail, index) {
  const card = getRailCards(rail)[index];

  if (!card) return;

  rail.scrollTo({
    left: card.offsetLeft + card.offsetWidth / 2 - rail.clientWidth / 2,
    behavior: "smooth",
  });
}

/**
 * Ruang kosong selebar panel teks di dalam rail (kiri & kanan).
 * Tulisannya sendiri satu blok (.featured-float) yang melompat ke sini.
 */
function createFeaturedPanel(position) {
  const panel = makeElement("div", `featured-panel featured-panel--${position}`);
  panel.setAttribute("aria-hidden", "true");
  return panel;
}

/**
 * Tulisan etalase "melompat memutar": kiri (awal) -> atas (tengah)
 * -> kanan (ujung), seperti berjalan di pinggir lingkaran.
 * Mode 3D: tulisan diam di kiri.
 */
function positionFeaturedFloat(section) {
  const float = section?.querySelector(".featured-float");
  const cta = section?.querySelector(".featured-float-cta");
  const stage = section?.querySelector(".featured-stage");

  if (!section || !float || !cta || !stage) return;

  const carouselMode = isCarouselMode(section);
  const layout = carouselMode ? "start" : section.dataset.layout || "start";
  // HP (layar sempit): tulisan SELALU di atas agar tidak menabrak kartu yang sedang digeser.
  const narrow = section.clientWidth < 700;
  const spot = narrow ? "top" : layout === "middle" ? "top" : layout === "end" ? "right" : "left";
  section.dataset.textSpot = spot;

  const pad = parseFloat(getComputedStyle(section).getPropertyValue("--page-pad")) || 16;
  const width = section.clientWidth;
  const panel = carouselMode
    ? section.querySelector(".featured-panel--side")
    : section.querySelector(".featured-rail > .featured-panel");
  const panelWidth = panel?.offsetWidth || 124;

  float.style.width = spot === "top" ? "" : `${panelWidth}px`;

  const floatHeight = float.offsetHeight;
  const ctaHeight = cta.offsetHeight;
  let floatX;
  let floatY;
  let ctaX;
  let ctaY;

  if (spot === "top") {
    const head = section.querySelector(".featured-head");
    floatX = pad;
    floatY = (head?.offsetTop || 0) + 2;
    ctaX = width - pad - cta.offsetWidth;
    ctaY = floatY + floatHeight - ctaHeight;
  } else {
    const block = floatHeight + 10 + ctaHeight;
    floatX = spot === "right" ? width - pad - panelWidth : pad;
    floatY = stage.offsetTop + Math.max(0, (stage.offsetHeight - block) / 2);
    ctaX = floatX;
    ctaY = floatY + floatHeight + 10;
  }

  float.style.left = `${floatX}px`;
  float.style.top = `${floatY}px`;
  cta.style.left = `${ctaX}px`;
  cta.style.top = `${ctaY}px`;

  // Animasi baru aktif setelah posisi pertama terpasang (tanpa kedip saat dibuka).
  if (section.dataset.floatReady !== "true") {
    requestAnimationFrame(() => {
      section.dataset.floatReady = "true";
    });
  }
}

function readShowcaseViews() {
  try {
    const saved = JSON.parse(localStorage.getItem(SHOWCASE_VIEWS_KEY) || "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    // Penyimpanan diblokir/rusak: pakai bawaan toko.
    return {};
  }
}

function readFeaturedView(key) {
  const saved = readShowcaseViews()[key];
  if (saved === "2d" || saved === "3d") return saved;

  return CFG?.featured?.view === "2d" ? "2d" : "3d";
}

/* ---------- Mode 3D: komidi putar ---------- */

function getCarouselGeometry(rail) {
  const cards = getRailCards(rail);
  const count = cards.length;
  const width = cards[0]?.offsetWidth || 180;
  // Minimal 5 "kursi" di lingkaran: baris berisi 2-4 produk tetap
  // memperlihatkan kartu samping, sama seperti Produk Unggulan.
  const step = 360 / Math.max(count, 5);

  return { cards, count, width, step };
}

function layoutCarousel(rail, { animate = true } = {}) {
  const section = getShowcase(rail);

  if (!isCarouselMode(section)) return;

  const { cards, count, step, width } = getCarouselGeometry(rail);

  if (!count) return;

  const state = getCarousel(rail);

  rail.classList.toggle("is-animating", animate);

  // Lingkaran dibuat lonjong agar kartu samping mengintip di belakang
  // kartu depan (tidak keluar layar HP); di laptop menyebar lebih lebar.
  const stageWidth = rail.clientWidth || width;
  const spreadX = Math.max(width * 0.46, Math.min(stageWidth * 0.4, width * 1.4));
  const depth = width * 1.1;

  let tallest = 0;

  cards.forEach((card, index) => {
    // Jarak urutan terpendek ke kartu depan (berputar melingkar).
    let offset = (((index - state.pos) % count) + count) % count;
    if (offset > count / 2) offset -= count;

    const angle = offset * step;

    const radians = (angle * Math.PI) / 180;
    const facing = Math.cos(radians); // 1 = depan, -1 = belakang
    const visible = Math.abs(angle) < 125;

    // Posisi dibulatkan ke piksel utuh: angka pecahan membuat kartu 3D
    // tampak bergetar/kabur di layar laptop.
    card.style.transform =
      `translateX(calc(-50% + ${Math.round(Math.sin(radians) * spreadX)}px)) ` +
      `translateZ(${Math.round((facing - 1) * depth)}px) ` +
      `rotateY(${(angle * 0.55).toFixed(1)}deg)`;
    card.style.opacity = visible ? String(0.35 + 0.65 * Math.max(0, facing)) : "0";
    card.style.zIndex = String(Math.round(100 + facing * 100));
    card.style.pointerEvents = visible ? "" : "none";
    card.classList.toggle("is-focus", Math.abs(angle) < step / 2);
    card.setAttribute("aria-hidden", String(!visible));

    tallest = Math.max(tallest, card.offsetHeight);
  });

  rail.style.height = `${tallest + 40}px`;

  const active = ((Math.round(state.pos) % count) + count) % count;
  rail.dataset.active = String(active);
  setActiveDot(section, active);
}

/** Putar ke kartu tertentu lewat jalur terpendek. */
function rotateCarouselTo(rail, index) {
  const { count } = getCarouselGeometry(rail);

  if (!count) return;

  const state = getCarousel(rail);
  const current = Math.round(state.pos);
  let diff = (index - (((current % count) + count) % count)) % count;
  if (diff > count / 2) diff -= count;
  if (diff < -count / 2) diff += count;

  state.pos = current + diff;
  layoutCarousel(rail);
}

function clearCarouselStyles(rail) {
  rail.style.height = "";
  rail.classList.remove("is-animating");

  getRailCards(rail).forEach((card) => {
    card.style.transform = "";
    card.style.opacity = "";
    card.style.zIndex = "";
    card.style.pointerEvents = "";
    card.removeAttribute("aria-hidden");
  });
}

function initCarouselGestures(rail) {
  if (rail.dataset.carouselReady === "true") return;
  rail.dataset.carouselReady = "true";

  const state = getCarousel(rail);
  const active = () => isCarouselMode(getShowcase(rail));

  rail.addEventListener("pointerdown", (event) => {
    if (!active() || event.button > 0) return;

    state.dragging = true;
    state.moved = false;
    state.startX = event.clientX;
    state.startPos = state.pos;
    state.pointerId = event.pointerId;
  });

  rail.addEventListener("pointermove", (event) => {
    if (!state.dragging || event.pointerId !== state.pointerId) return;

    const dx = event.clientX - state.startX;

    if (!state.moved && Math.abs(dx) > 6) {
      state.moved = true;
      rail.setPointerCapture?.(event.pointerId);
    }

    if (!state.moved) return;

    const { width } = getCarouselGeometry(rail);
    // Geser ke kiri = lingkaran berputar, kartu kanan maju ke depan.
    state.pos = state.startPos - dx / (width * 0.9);
    layoutCarousel(rail, { animate: false });
  });

  const release = () => {
    if (!state.dragging) return;

    state.dragging = false;

    if (state.moved) {
      state.pos = Math.round(state.pos);
      layoutCarousel(rail);
    }
  };

  rail.addEventListener("pointerup", release);
  rail.addEventListener("pointercancel", release);

  // Usap dua jari di touchpad laptop (kiri-kanan) = memutar, tanpa ditekan.
  // Usapan atas-bawah dibiarkan untuk scroll halaman.
  // Getaran kecil jari yang diam di touchpad DIABAIKAN: putaran baru
  // dimulai setelah usapan mendatar terkumpul > WHEEL_START px.
  const WHEEL_START = 14;
  let wheelSnap = 0;
  let wheelPending = 0;
  let wheelTurning = false;

  rail.addEventListener(
    "wheel",
    (event) => {
      if (!active() || state.dragging) return;

      const px = event.deltaMode === 1 ? event.deltaX * 16 : event.deltaX;
      const py = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;

      // Harus jelas mendatar, bukan scroll atas-bawah yang sedikit miring.
      if (Math.abs(px) < 1 || Math.abs(px) < Math.abs(py) * 1.5) return;

      event.preventDefault();

      clearTimeout(wheelSnap);
      wheelSnap = setTimeout(() => {
        wheelPending = 0;
        if (!wheelTurning) return;
        wheelTurning = false;
        state.pos = Math.round(state.pos);
        layoutCarousel(rail);
      }, 160);

      if (!wheelTurning) {
        wheelPending += px;
        if (Math.abs(wheelPending) < WHEEL_START) return;
        wheelTurning = true;
      }

      const { width } = getCarouselGeometry(rail);
      state.pos += px / (width * 0.9);
      layoutCarousel(rail, { animate: false });
    },
    { passive: false }
  );

  // Setelah memutar, ketukan tidak dianggap klik tombol di kartu.
  // Ketuk kartu samping = putar kartu itu ke depan.
  rail.addEventListener(
    "click",
    (event) => {
      if (!active()) return;

      if (state.moved) {
        event.preventDefault();
        event.stopPropagation();
        state.moved = false;
        return;
      }

      const card = event.target.closest(".product-card");

      if (card && !card.classList.contains("is-focus")) {
        event.preventDefault();
        event.stopPropagation();
        rotateCarouselTo(rail, getRailCards(rail).indexOf(card));
      }
    },
    true
  );

  window.addEventListener("resize", () => {
    layoutCarousel(rail, { animate: false });
    positionFeaturedFloat(getShowcase(rail));
  });
}

/* ---------- Pergantian mode & kontrol ---------- */

function refreshShowcaseView(section) {
  const rail = getShowcaseRail(section);

  if (!rail) return;

  if (isCarouselMode(section)) {
    rail.scrollLeft = 0;
    layoutCarousel(rail, { animate: false });
  } else {
    clearCarouselStyles(rail);
    updateRailFocus(rail);
  }

  positionFeaturedFloat(section);
}

function applyShowcaseView(section, view) {
  const toggle = section.querySelector(".featured-view");

  section.dataset.view = view;

  if (toggle) {
    // Label = mode tujuan: saat 3D tertulis "2D", saat 2D tertulis "3D".
    toggle.textContent = view === "3d" ? "2D" : "3D";
    toggle.setAttribute("aria-pressed", String(view === "3d"));
    toggle.setAttribute(
      "aria-label",
      view === "3d" ? "Tampilan 3D aktif, ketuk untuk 2D" : "Tampilan 2D aktif, ketuk untuk 3D"
    );
  }

  refreshShowcaseView(section);
}

/** Ganti mode SATU etalase saja (tiap bagian punya pilihan sendiri). */
function setShowcaseView(section, view) {
  applyShowcaseView(section, view);

  try {
    const views = readShowcaseViews();
    views[section.dataset.viewKey || section.id || "featured"] = view;
    localStorage.setItem(SHOWCASE_VIEWS_KEY, JSON.stringify(views));
  } catch {
    // Abaikan: pilihan tetap berlaku selama halaman terbuka.
  }
}

/**
 * Panah "<" / ">" satu langkah. 3D: putar satu kartu. 2D: geser selebar
 * satu kartu (bukan "kartu ke tengah": di layar lebar kartu berikutnya
 * sering sudah di kiri, sehingga tujuannya minus dan rail tidak bergerak).
 * Mentok di ujung = kembali ke ujung lainnya.
 */
function stepShowcase(section, direction) {
  const rail = getShowcaseRail(section);

  if (!rail) return;

  if (isCarouselMode(section)) {
    const state = getCarousel(rail);
    state.pos = Math.round(state.pos) + direction;
    layoutCarousel(rail);
    return;
  }

  const cards = getRailCards(rail);
  const step =
    (cards[1] ? cards[1].offsetLeft - cards[0].offsetLeft : 0) ||
    cards[0]?.offsetWidth ||
    rail.clientWidth * 0.8;
  const max = rail.scrollWidth - rail.clientWidth;

  if (direction > 0 && rail.scrollLeft >= max - 2) {
    rail.scrollTo({ left: 0, behavior: "smooth" });
  } else if (direction < 0 && rail.scrollLeft <= 2) {
    rail.scrollTo({ left: max, behavior: "smooth" });
  } else {
    rail.scrollBy({ left: direction * step, behavior: "smooth" });
  }
}

/** Panah "sebelumnya" di kiri: dibuat di sini agar ada di semua etalase. */
function ensurePrevButton(section) {
  const next = section.querySelector(".featured-next");

  if (!next || section.querySelector(".featured-prev")) return;

  const prev = makeElement("button", "featured-prev");
  prev.type = "button";
  prev.hidden = next.hidden;
  prev.setAttribute("aria-label", "Produk sebelumnya");
  prev.appendChild(makeIcon("", ["M15 5l-7 7 7 7"]));
  next.before(prev);
}

/** Tombol 2D/3D dan panah "<" / ">" (dipasang sekali per bagian). */
function initShowcaseControls(section) {
  const rail = getShowcaseRail(section);

  if (!rail || section.dataset.controlsReady === "true") return;

  section.dataset.controlsReady = "true";
  section.dataset.view = readFeaturedView(section.dataset.viewKey || section.id || "featured");
  initCarouselGestures(rail);
  ensurePrevButton(section);

  section.querySelector(".featured-view")?.addEventListener("click", () => {
    setShowcaseView(section, isCarouselMode(section) ? "2d" : "3d");
  });

  section.querySelector(".featured-next")?.addEventListener("click", () => stepShowcase(section, 1));
  section.querySelector(".featured-prev")?.addEventListener("click", () => stepShowcase(section, -1));

  // "Jelajahi sekarang" = halaman koleksi SENDIRI (isi bagian ini saja), bukan katalog utama.
  const key = registerShowcaseCollection(section);
  section.querySelector(".featured-float-cta")?.addEventListener("click", () => openCollection(key));
}

/** Daftarkan bagian etalase sebagai koleksi (#koleksi/<kunci>). */
function registerShowcaseCollection(section) {
  const text = (selector) => section.querySelector(selector)?.textContent?.trim() || "";
  return registerCollection(section.dataset.viewKey || section.id || "pilihan", {
    title: text(".featured-float h2") || "Koleksi",
    eyebrow: text(".featured-float__eyebrow"),
    description: text(".featured-float__text"),
    getProducts: () => section.__kcProducts ?? getFeaturedProducts(),
  });
}

/** Dipanggil setiap kali kartu baru dirender ke rail etalase. */
function decorateShowcaseRail(rail) {
  const section = getShowcase(rail);
  const cards = getRailCards(rail);

  if (!section) return;

  initShowcaseControls(section);

  if (cards.length) {
    rail.prepend(createFeaturedPanel("start"));
    rail.appendChild(createFeaturedPanel("end"));
  }

  // Ruang tulisan yang DIAM di kiri untuk mode 3D.
  section.querySelector(".featured-panel--side")?.remove();
  if (cards.length) {
    section.querySelector(".featured-stage")?.before(createFeaturedPanel("side"));
  }

  const dots = section.querySelector(".featured-dots");
  if (dots) {
    dots.replaceChildren(...cards.map(() => makeElement("span", "featured-dot")));
  }

  const controls = section.querySelector(".featured-controls");
  if (controls) controls.hidden = cards.length < 2;

  section.querySelectorAll(".featured-next, .featured-prev").forEach((arrow) => {
    arrow.hidden = cards.length < 2;
  });

  getCarousel(rail).pos = 0;
  rail.scrollLeft = 0;
  section.dataset.layout = "start";

  enhanceRail(rail);
  applyShowcaseView(section, section.dataset.view === "2d" ? "2d" : "3d");

  // Ukuran kartu pasti setelah foto termuat.
  const relayout = () => {
    layoutCarousel(rail, { animate: false });
    positionFeaturedFloat(section);
  };

  requestAnimationFrame(relayout);
  rail.querySelectorAll("img").forEach((image) => {
    image.addEventListener("load", relayout, { once: true });
  });
}

/** Membuat kerangka etalase (sama dengan Produk Unggulan) untuk baris lain. */
function createShowcaseSection({ key, eyebrow, title, description }) {
  const section = makeElement("section", "page-section featured product-rail-section");
  section.dataset.layout = "start";
  section.dataset.viewKey = key || title || "rail";
  section.setAttribute("aria-label", title || "Produk");

  const head = makeElement("div", "featured-head");
  head.setAttribute("aria-hidden", "true");

  const float = makeElement("div", "featured-float");
  float.append(
    makeElement("p", "featured-float__eyebrow", eyebrow || ""),
    makeElement("h2", "", title || "Produk")
  );

  if (description) {
    float.appendChild(makeElement("p", "featured-float__text", description));
  }

  const cta = makeElement("button", "featured-float-cta", "Cek semuanya →");
  cta.type = "button";

  const stage = makeElement("div", "featured-stage");
  const rail = makeElement("div", "rail scroll-x product-rail featured-rail");

  const next = makeElement("button", "featured-next");
  next.type = "button";
  next.hidden = true;
  next.setAttribute("aria-label", "Produk berikutnya");
  next.appendChild(makeIcon("", ["M9 5l7 7-7 7"]));

  stage.append(rail, next);

  const controls = makeElement("div", "featured-controls");
  controls.hidden = true;

  const toggle = makeElement("button", "featured-view", "2D");
  toggle.type = "button";

  const dots = makeElement("div", "featured-dots");
  dots.setAttribute("aria-hidden", "true");

  controls.append(toggle, dots);
  section.append(head, float, cta, stage, controls);

  return { section, rail };
}

/* ------------------------------------------------------------
   Baris geser tambahan + katalog pusat
   ------------------------------------------------------------ */

/**
 * Cara mengurutkan tiap baris. Hanya produk yang punya data asli
 * yang masuk (misalnya Best Seller butuh angka terjual > 0).
 */
const RAIL_SORTERS = {
  sales: {
    value: (product) => toNumber(product?.sales_count ?? product?.sold_count, 0),
  },
  wishlist: {
    value: (product) =>
      toNumber(product?.wishlist_count ?? product?.wishlists_count, 0),
  },
  newest: {
    value: (product) => {
      const time = Date.parse(product?.created_at ?? product?.createdAt ?? "");
      return Number.isFinite(time) ? time : 0;
    },
  },
};

function getRailProducts(rail) {
  const sorter = RAIL_SORTERS[rail?.sort];
  if (!sorter) return [];

  const limit = Math.max(1, toNumber(rail?.limit, 10));

  return state.products
    .map((product) => ({ product, score: sorter.value(product) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.product);
}

/** Baris geser ke samping: Best Seller, Wishlist, Terbaru, dst. */
function renderRails() {
  const host = $("#extraRails");
  if (!host) return;

  host.replaceChildren();

  // Rel produk (Best Seller, Terbaru, dll.) kini bagian dari homepage yang
  // diatur di ERP › Etalase & Brand (blok "Rel produk"), bukan client-config.
  const rails = [];

  rails.forEach((rail) => {
    const products = getRailProducts(rail);
    const minItems = Math.max(1, toNumber(rail?.min_items, 2));

    // Baris tanpa data asli disembunyikan, tidak dikarang.
    if (products.length < minItems) return;

    // Kerangka sama persis dengan Produk Unggulan (komidi putar + tulisan melompat).
    const { section, rail: list } = createShowcaseSection({
      key: `rail-${rail.sort || rail.title}`,
      eyebrow: rail.eyebrow,
      title: rail.title,
      description: rail.description,
    });

    section.__kcProducts = products;
    host.appendChild(section);
    renderProducts(products, list);
  });
}

/** Katalog pusat: semua produk brand, tersusun ke bawah. */
function renderCatalog(products = state.products) {
  const grid = $("#catalogGrid");
  if (!grid) return;

  renderProducts(products, grid);
}

function renderStorefront() {
  renderProducts();
  renderCategories();
  renderRails();
  renderCatalog();
  renderPromos();
}

/** Footer toko: nama, kontak, jam buka, & tautan halaman kebijakan (syarat Google). */
function renderFooter() {
  const root = $("#storeFooter");
  if (!root) return;
  const settings = getStorefront();
  const brand = settings.brand ?? {};
  const contact = brand.contact ?? {};
  const infoUrl = (slug) => new URL(`./info.html?halaman=${slug}`, document.baseURI).href;

  const col = (title, ...nodes) => {
    const box = makeElement("div", "kc-footer__col");
    box.appendChild(makeElement("p", "kc-footer__title", title));
    nodes.filter(Boolean).forEach((n) => box.appendChild(n));
    return box;
  };
  const link = (text, href, external = false) => {
    const a = makeElement("a", "kc-footer__link", text);
    a.href = href;
    if (external) {
      a.target = "_blank";
      a.rel = "noopener";
    }
    return a;
  };

  const brandCol = makeElement("div", "kc-footer__brand");
  brandCol.append(makeElement("p", "kc-footer__name", brand.name || CFG?.app_name || "Toko"));
  if (brand.tagline) brandCol.append(makeElement("p", "kc-footer__tagline", brand.tagline));

  const wa = whatsappLink(settings);
  const contactCol = col("Hubungi kami",
    wa ? link(`WhatsApp ${contact.whatsapp}`, wa, true) : null,
    contact.email ? link(contact.email, `mailto:${contact.email}`) : null,
    contact.phone ? link(`Telepon ${contact.phone}`, `tel:${contact.phone}`) : null,
    contact.instagram ? link(`Instagram @${contact.instagram}`, `https://instagram.com/${contact.instagram}`, true) : null,
    (!wa && !contact.email && !contact.phone) ? makeElement("p", "kc-footer__text", "Tanya apa saja lewat asisten di bawah.") : null);

  const placeCol = col("Kunjungi",
    contact.address ? makeElement("p", "kc-footer__text", [contact.address, contact.city].filter(Boolean).join(", ")) : null,
    contact.hours ? makeElement("p", "kc-footer__text", `Jam buka: ${contact.hours}`) : null,
    contact.maps ? link("Buka di Google Maps", contact.maps, true) : link("Kontak & lokasi", infoUrl("kontak")));

  const infoCol = col("Info", ...POLICY_PAGES.map((page) => link(page.label, infoUrl(page.slug))));

  const bottom = makeElement("div", "kc-footer__bottom");
  bottom.append(makeElement("span", "", `© ${new Date().getFullYear()} ${brand.name || CFG?.app_name || ""}`), makeElement("span", "", "Pembayaran selalu kamu lakukan sendiri · Data dilindungi UU PDP"));

  const grid = makeElement("div", "kc-footer__grid");
  grid.append(brandCol, contactCol, placeCol, infoCol);
  // Kredit pembuat platform: logo resmi Kantoong (simbol kecil) + nama.
  const credit = makeElement("div", "kc-footer__credit");
  credit.setAttribute("translate", "no");
  const creditLogo = makeElement("img", "kc-footer__credit-logo");
  creditLogo.src = "/brand/kantoong-simbol-128.webp";
  creditLogo.alt = "Logo Kantoong";
  creditLogo.width = 22;
  creditLogo.height = 19;
  creditLogo.decoding = "async";
  creditLogo.addEventListener("error", () => creditLogo.remove(), { once: true });
  credit.append(makeElement("span", "kc-footer__credit-by", "Dibuat oleh"), creditLogo, makeElement("strong", "kc-footer__credit-name", "KANTOONG KENZO AI"));
  root.replaceChildren(grid, bottom, credit);

  // Data terstruktur toko untuk Google & mesin AI (GEO).
  let ld = document.getElementById("storeJsonLd");
  if (!ld) {
    ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.id = "storeJsonLd";
    document.head.appendChild(ld);
  }
  ld.textContent = JSON.stringify(JSON.parse(JSON.stringify({
    "@context": "https://schema.org",
    "@type": contact.address ? "Store" : "Organization",
    name: brand.name || CFG?.app_name,
    description: brand.tagline || undefined,
    url: CFG?.site_url || location.origin,
    logo: /^https:/.test(brand.logo || "") ? brand.logo : undefined,
    telephone: contact.phone || contact.whatsapp || undefined,
    email: contact.email || undefined,
    address: contact.address ? { "@type": "PostalAddress", streetAddress: contact.address, addressLocality: contact.city || undefined, addressCountry: "ID" } : undefined,
    openingHours: contact.hours || undefined,
    sameAs: contact.instagram ? [`https://instagram.com/${contact.instagram}`] : undefined,
  })));
}

/** Zona promosi homepage (banner, kupon, kotak misteri, poster, produk pilihan). */
function renderPromos() {
  const root = $("#homePromos");
  if (!root) return;
  renderHomePromos(root, {
    home: getStorefront().home,
    products: state.products,
    showSamples: CFG?.erp_demo === true,
    renderRail(block, products) {
      const { section, rail } = createShowcaseSection({
        key: `rail-${block.id}`,
        eyebrow: block.eyebrow,
        title: block.title || "Produk",
        description: block.text,
      });
      section.__kcProducts = products;
      // Komidi putar butuh elemen sudah ada di halaman sebelum diisi.
      setTimeout(() => renderProducts(products, rail), 0);
      return section;
    },
    onAction(action) {
      if (action.type === "catalog") openDashboardFeature("product-catalog");
      else if (action.type === "chat") askConsultation(action.hint);
      else if (action.type === "product") openProductPage(action.product);
      else if (action.type === "coupon") showToast(`Kode ${action.code} diklaim & disalin. Pakai saat checkout.`);
      else if (action.type === "jackpot" && action.result?.code) showToast(`Selamat! ${action.result.label} · kode ${action.result.code}`);
    },
  });
}

/* ============================================================
   11. KATEGORI
   ============================================================ */

function renderCategories() {
  const container = $(SELECTORS.categories);

  state.categories = [
    ...new Set(
      state.products
        .map(getProductCategory)
        .filter((category) => category && category !== "Lainnya")
    ),
  ];

  if (!container) return;

  container.replaceChildren();

  const fragment = document.createDocumentFragment();

  const allButton = makeElement("button", "kantoong-category-chip", "Semua");
  allButton.type = "button";
  allButton.dataset.category = "all";
  allButton.setAttribute("aria-pressed", "true");

  allButton.addEventListener("click", () => {
    filterByCategory("all");
    scrollToCatalog();
  });

  fragment.appendChild(allButton);

  state.categories.forEach((category) => {
    const button = makeElement(
      "button",
      "kantoong-category-chip",
      category
    );

    button.type = "button";
    button.dataset.category = category;
    button.setAttribute("aria-pressed", "false");

    button.addEventListener("click", () => {
      filterByCategory(category);
      scrollToCatalog();
    });

    fragment.appendChild(button);
  });

  container.appendChild(fragment);
}

function filterByCategory(category) {
  const selected = String(category || "all");

  const products =
    selected === "all"
      ? state.products
      : state.products.filter(
          (product) => getProductCategory(product) === selected
        );

  renderCatalog(products);

  const catalogTitle = $("#catalogTitle");
  if (catalogTitle) {
    catalogTitle.textContent = selected === "all" ? "Semua Produk" : selected;
  }

  $$(SELECTORS.categories + " [data-category]").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.category === selected)
    );
  });

  emit("category-selected", {
    category: selected,
    products,
  });
}

/* ============================================================
   12. PENCARIAN PRODUK
   ============================================================ */

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("id-ID")
    .trim();
}

function searchProducts(query) {
  const normalized = normalizeSearchText(query);

  state.searchQuery = String(query ?? "");
  state.matched = !normalized
    ? [...state.products]
    : state.products.filter((product) => {
        const searchable = [
          getProductName(product),
          getProductCategory(product),
          product?.description,
          product?.sku,
          product?.brand,
        ]
          .map(normalizeSearchText)
          .join(" ");

        return searchable.includes(normalized);
      });

  renderCatalog(state.matched);
  $("#categorySection")?.scrollIntoView({ behavior: "smooth", block: "start" });

  emit("matched", {
    query: state.searchQuery,
    products: state.matched,
    count: state.matched.length,
  });

  emit("search-completed", {
    query: state.searchQuery,
    products: state.matched,
    count: state.matched.length,
  });

  return state.matched;
}

/* ------------------------------------------------------------
   Toko per sales: kantoong.id/nama-sales (nanti nama-sales.kantoong.id).
   Nama toko tampil di header; pesanan dari sini tercatat atas nama sales.
   ------------------------------------------------------------ */

async function initSalesStore() {
  const slug = detectStoreSlug();
  if (!slug) return;

  const store = await loadSalesStore(slug);
  if (!store) {
    log(`Toko sales "${slug}" tidak ditemukan; menampilkan toko utama.`);
    return;
  }

  state.salesStore = store;
  rememberSalesRef(store.slug);

  const brandTitle = $("#brandTitle");
  if (brandTitle) brandTitle.textContent = store.display_name;
  document.title = `${store.display_name} · ${CFG?.app_name || "Kantoong"}`;

  emit("sales-store-ready", { slug: store.slug, name: store.display_name });
}

/* ------------------------------------------------------------
   Tulisan "naik dari bawah" saat discroll (gaya Canva).
   Judul hero, judul etalase, dan judul bagian muncul bertahap.
   Tulisan yang keluar layar ke bawah/samping disiapkan lagi,
   jadi animasinya terulang saat dilihat kembali.
   ------------------------------------------------------------ */

const REVEAL_SELECTOR = [
  ".hero-eyebrow",
  ".hero-title",
  ".hero-text",
  ".hero-actions",
  ".category-strip",
  ".featured-float > *",
  ".featured-float-cta",
  ".section-head h2",
  ".kantoong-brand-slot__title",
].join(",");

function initScrollReveal() {
  const root = document.getElementById("pageScroll");

  if (
    !root ||
    typeof IntersectionObserver === "undefined" ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const el = entry.target;

        if (entry.isIntersecting) {
          el.classList.add("is-revealed");
          return;
        }

        // Sudah lewat ke atas: tetap tampil (meski terlewat cepat).
        // Di bawah/samping layar: siapkan ulang agar animasinya terulang.
        const rootTop = entry.rootBounds?.top ?? 0;
        el.classList.toggle(
          "is-revealed",
          entry.boundingClientRect.bottom <= rootTop
        );
      });
    },
    { root, threshold: 0.15 }
  );

  const watch = (scope) => {
    const found = scope.matches?.(REVEAL_SELECTOR)
      ? [scope]
      : Array.from(scope.querySelectorAll?.(REVEAL_SELECTOR) || []);

    found.forEach((el) => {
      if (el.classList.contains("reveal")) return;

      // Jeda bertingkat antar-saudara: eyebrow -> judul -> teks -> tombol.
      const siblings = Array.from(el.parentElement?.children || []).filter(
        (node) => node.matches(REVEAL_SELECTOR)
      );
      const order = Math.max(0, siblings.indexOf(el));

      el.style.setProperty("--reveal-delay", `${Math.min(order, 5) * 90}ms`);
      el.classList.add("reveal");
      observer.observe(el);
    });
  };

  watch(root);

  // Hero, etalase, dan katalog dirender belakangan: pantau elemen baru.
  new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (node.nodeType === 1) watch(node);
      });
    });
  }).observe(root, { childList: true, subtree: true });
}

function initSearch() {
  const searchInput =
    $(SELECTORS.productSearch) ||
    $("#searchInput") ||
    $("#searchProducts") ||
    $('input[type="search"]');

  const searchButton = $(SELECTORS.searchButton);

  if (!searchInput) {
    if (searchButton) {
      searchButton.addEventListener("click", () => {
        // Cari = buka Katalog Produk lengkap (kotak cari, filter, saran per kategori).
        openDashboardFeature("product-catalog");
        emit("search-open-requested", {});
        document.dispatchEvent(
          new CustomEvent("kantoong:search-open-requested")
        );
      });
    }

    return;
  }

  const runSearch = () => {
    searchProducts(searchInput.value);
  };

  searchInput.addEventListener("input", runSearch);

  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runSearch();
    }

    if (event.key === "Escape") {
      searchInput.value = "";
      runSearch();
      searchInput.blur();
    }
  });

  if (searchButton) {
    searchButton.addEventListener("click", (event) => {
      event.preventDefault();
      runSearch();
    });
  }

  document.addEventListener("kantoong:search", (event) => {
    const query = event.detail?.query;

    if (typeof query !== "string") return;

    searchInput.value = query;
    searchProducts(query);
  });
}

window.KantoongSearch = {
  search: searchProducts,
  filterByCategory,
};

/* ============================================================
   13. KERANJANG
   ============================================================ */

function updateCartCount() {
  const countElement = $(SELECTORS.cartCount);

  const count = state.cart.reduce(
    (total, item) => total + toNumber(item.quantity, 1),
    0
  );

  if (countElement) {
    countElement.textContent = String(count);
    countElement.setAttribute("aria-label", `${count} produk di keranjang`);
  }

  emit("cart-updated", {
    cart: state.cart,
    count,
  });
}

function addToCart(product, quantity = 1) {
  if (!product || typeof product !== "object") return;

  // Paket WEB AI BOS FREE: tanpa keranjang — pesan lewat WhatsApp.
  if (!getPlan().commerce) {
    orderViaWhatsApp(product, quantity);
    return;
  }

  const id = getProductId(product);
  const amount = Math.max(1, Math.floor(toNumber(quantity, 1)));

  const existing = state.cart.find(
    (item) => getProductId(item.product) === id
  );

  if (existing) {
    existing.quantity += amount;
  } else {
    state.cart.push({
      product,
      quantity: amount,
      addedAt: new Date().toISOString(),
    });
  }

  updateCartCount();

  emit("cart-add", {
    product,
    quantity: amount,
    cart: state.cart,
  });

  // Notifikasi "masuk keranjang" ditampilkan cart/cart.js setelah barang
  // benar-benar masuk; engine tidak menampilkan notifikasi kedua.
}

function initCart() {
  const cartButton = $(SELECTORS.cartButton);

  if (cartButton) {
    cartButton.addEventListener("click", (event) => {
      emit("cart-open-requested", { cart: state.cart });

      document.dispatchEvent(
        new CustomEvent("kantoong:cart-open-requested", {
          detail: { cart: state.cart },
        })
      );

      // Biarkan modul cart/cart.js menangani UI keranjang.
      // Engine tidak membuat modal keranjang kedua.
    });
  }

  document.addEventListener("kantoong:cart-add-requested", (event) => {
    const product = event.detail?.product;
    const quantity = event.detail?.quantity ?? 1;

    if (product) addToCart(product, quantity);
  });

  updateCartCount();
}

window.KantoongCartBridge = {
  add: addToCart,

  getItems() {
    return state.cart;
  },

  getCount() {
    return state.cart.reduce(
      (total, item) => total + toNumber(item.quantity, 1),
      0
    );
  },

  clear() {
    state.cart = [];
    updateCartCount();
  },
};

/* ============================================================
   14. JEMBATAN EVENT UNTUK AI COMPANION
   ============================================================ */

/*
 * Engine hanya menyediakan event bridge.
 * Ini BUKAN koneksi LLM/API dan tidak mengklaim agent AI sudah aktif.
 * AI Companion dapat mendengarkan event berikut lalu memanggil backend
 * melalui modul AI yang memiliki autentikasi dan otorisasi tersendiri.
 */

/* ------------------------------------------------------------
   Produk pilihan AI: etalase di belakang chat berganti otomatis
   ------------------------------------------------------------ */

const AI_PICKS_TITLE = "Pilihan AI untuk kamu";
const AI_PICKS_EYEBROW = "✦ Dari obrolanmu";
const AI_PICKS_TEXT = "Kartu yang menyala dipilih AI untukmu. Ketuk untuk melihat detailnya.";

/** Ganti teks etalase; teks asli toko disimpan agar bisa dikembalikan. */
function swapFeaturedText(id, text) {
  const element = document.getElementById(id);

  if (!element) return;

  if (element.dataset.defaultText === undefined) {
    element.dataset.defaultText = element.textContent;
    element.dataset.defaultHidden = String(element.hidden);
  }

  if (text === null) {
    element.textContent = element.dataset.defaultText;
    element.hidden = element.dataset.defaultHidden === "true";
  } else {
    element.textContent = text;
    element.hidden = false;
  }
}

function showAIPicks(products) {
  const section = document.getElementById("featuredSection");
  const reset = document.getElementById("resetCatalogBtn");

  swapFeaturedText("featuredTitle", AI_PICKS_TITLE);
  swapFeaturedText("featuredEyebrow", AI_PICKS_EYEBROW);
  swapFeaturedText("featuredText", AI_PICKS_TEXT);

  if (section) section.dataset.aiPicks = "true";

  if (reset) {
    reset.hidden = false;
  }

  renderProducts(products);

  section?.scrollIntoView({ behavior: "smooth", block: "start" });

  // Kartu pilihan AI MENYALA TERUS ("ini yang kumaksud") sampai diklik
  // atau etalase dikembalikan ke awal. Dipasang langsung (kartu sudah
  // dirender), tidak menunggu frame berikutnya.
  $$("#featuredSection .product-card").forEach((card) => {
    card.classList.add("is-ai-pick");
  });

  if (section) requestAnimationFrame(() => positionFeaturedFloat(section));
}

/** Sorot satu kartu produk di halaman (bukan di chat). id kosong = lepas sorotan. */
function focusStageCard(id) {
  $$(".product-card.is-stage-focus").forEach((card) => card.classList.remove("is-stage-focus"));

  if (!id) return;

  const cards = $$(`.product-card[data-product-id="${CSS.escape(id)}"]`)
    .filter((card) => !card.closest("#chatPanel"));
  const card = cards.find((item) => item.closest(".featured-rail")) || cards[0];

  if (!card) return;

  card.classList.add("is-stage-focus");

  const rail = card.closest(".featured-rail");

  if (rail && isCarouselMode(getShowcase(rail))) {
    rotateCarouselTo(rail, getRailCards(rail).indexOf(card));
  } else if (rail) {
    scrollRailToCard(rail, getRailCards(rail).indexOf(card));
  }

  (rail || card).scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function resetAIPicks() {
  const section = document.getElementById("featuredSection");
  const reset = document.getElementById("resetCatalogBtn");

  swapFeaturedText("featuredTitle", null);
  swapFeaturedText("featuredEyebrow", null);
  swapFeaturedText("featuredText", null);

  if (section) delete section.dataset.aiPicks;

  if (reset) {
    reset.hidden = true;
  }

  renderProducts();

  if (section) requestAnimationFrame(() => positionFeaturedFloat(section));
}

function initAIEventBridge() {
  document.addEventListener("kantoong:ai-matched", (event) => {
    const ids = Array.isArray(event.detail?.ids)
      ? event.detail.ids.map(String)
      : [];

    const picks = ids.length
      ? state.products.filter((product) =>
          ids.includes(String(getProductId(product)))
        )
      : Array.isArray(event.detail?.products)
        ? event.detail.products
        : [];

    if (picks.length > 0) {
      showAIPicks(picks);
    }
  });

  document
    .getElementById("resetCatalogBtn")
    ?.addEventListener("click", resetAIPicks);

  // Panggung: kartu produk di chat disorot -> kartu yang sama di halaman
  // diputar/digeser ke depan dan menyala (desktop, chat di samping).
  window.addEventListener("kantoong:stage-focus", (event) => {
    focusStageCard(String(event.detail?.id ?? ""));
  });
  window.addEventListener("kantoong:stage-blur", () => focusStageCard(""));

  // Kartu pilihan AI yang menyala padam setelah user mengkliknya.
  document.addEventListener(
    "click",
    (event) => {
      event.target.closest?.(".product-card.is-ai-pick")?.classList.remove("is-ai-pick");
    },
    true
  );

  document.addEventListener("kantoong:ai-search", (event) => {
    const query = event.detail?.query;

    if (typeof query !== "string" || !query.trim()) return;

    emit("ai-search-requested", {
      query: query.trim(),
      tenant: state.activeTenant,
    });

    searchProducts(query);
  });

  document.addEventListener("kantoong:show-catalog", () => {
    closeDashboard();

    renderCatalog(state.products);

    const container = $("#categorySection") || getProductContainer();

    container?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    emit("catalog-shown", { count: state.products.length });
  });

  document.addEventListener("kantoong:consult", (event) => {
    emit("consult-requested", {
      ...event.detail,
      tenant: state.activeTenant,
    });
  });

  document.addEventListener("kantoong:product-select", (event) => {
    const productId = String(event.detail?.productId ?? "");

    const product = state.products.find(
      (item) => getProductId(item) === productId
    );

    if (product) {
      emit("product-selected", { product });
    }
  });

  window.KantoongAIEvents = {
    emit,
    on(eventName, callback) {
      events.addEventListener(eventName, callback);
      return () => events.removeEventListener(eventName, callback);
    },
  };

  emit("kantoong-ai-ready", {
    engineVersion: ENGINE_VERSION,
    bridgeReady: true,
    agentConnected: false,
  });
}

/* ============================================================
   15. KOMPATIBILITAS DENGAN MODUL LAMA
   ============================================================ */

function initCompatibilityEvents() {
  // Mempertahankan beberapa nama event lama tanpa memuat ulang drawer.
  document.addEventListener("kantoong:open-dashboard", openDashboard);
  document.addEventListener("kantoong:close-dashboard", closeDashboard);

  // Aksi katalog tetap tersedia untuk modul AI lama.
  document.addEventListener("kantoong:show-products", () => {
    renderCatalog(state.products);
  });

  // API global yang sengaja dibatasi ke fungsi storefront.
  window.KantoongEngine = {
    version: ENGINE_VERSION,

    openDashboard,
    closeDashboard,
    toggleDashboard,

    searchProducts,
    filterByCategory,
    addToCart,

    // Popup kartu & halaman produk (berdasarkan id produk).
    openQuickView(productId) {
      openQuickView(findProductById(productId));
    },
    closeQuickView,
    openProductPage(productId) {
      openProductPage(findProductById(productId));
    },

    reloadProducts: loadProducts,

    getState() {
      return {
        productCount: state.products.length,
        cartCount: window.KantoongCartBridge.getCount(),
        usingDemo: state.usingDemo,
        isLoading: state.isLoading,
        activeTenant: state.activeTenant,
        dashboardOpen: state.dashboardOpen,
      };
    },

    on: window.KantoongAIEvents?.on,
  };
}

/* ============================================================
   16. INISIALISASI ENGINE
   ============================================================ */

/**
 * Testimoni pembeli dari client-config.js (CFG.testimonials).
 * Hanya ulasan asli dari brand; bila kosong, bagiannya disembunyikan.
 */
function renderTestimonials() {
  const section = $("#testimonialSection");
  const list = $("#testimonialList");
  const items = Array.isArray(CFG?.testimonials) ? CFG.testimonials : [];

  if (!section || !list) return;

  section.hidden = items.length === 0;
  list.replaceChildren();

  items.slice(0, 12).forEach((item) => {
    const card = makeElement("article", "testimonial-card");
    const rating = Math.max(0, Math.min(5, Math.round(toNumber(item?.rating, 5))));

    card.appendChild(
      makeElement("p", "testimonial-card__stars", "★".repeat(rating) + "☆".repeat(5 - rating))
    );
    card.appendChild(makeElement("p", "testimonial-card__text", `“${item?.text ?? ""}”`));

    const who = makeElement("p", "testimonial-card__who");
    who.appendChild(makeElement("strong", "", item?.name ?? "Pembeli"));
    if (item?.product) {
      who.appendChild(makeElement("span", "", ` · ${item.product}`));
    }
    card.appendChild(who);

    list.appendChild(card);
  });
}

async function initKantoongEngine() {
  if (state.initialized) {
    log("Engine sudah diinisialisasi; inisialisasi ganda diabaikan.");
    return;
  }

  state.initialized = true;

  // Tema gelap/terang toko (diatur di Dashboard › Pengaturan, js/theme.js).
  applyTheme("store");
  // Paket (Pro/Free) & industri: CSS menyembunyikan keranjang di paket Free.
  markPlan();

  // Nama brand diatur owner di ERP › Etalase & Brand; berubah realtime.
  onStorefrontChange(() => {
    applyConfig();
    renderPromos();
    renderFooter();
  });
  renderFooter();
  startStorefrontSync();

  try {
    log(`Memulai engine versi ${ENGINE_VERSION}...`);

    applyConfig();
    renderHero();
    renderBrandSlot();
    renderTestimonials();

    initDashboardControls();
    initSearch();
    initCart();
    initAIEventBridge();
    initCompatibilityEvents();
    initScrollReveal();
    initProductRoute();

    await initSalesStore();
    await loadProducts();

    // Tautan langsung ke halaman produk (#produk/<id>) setelah data siap.
    syncProductRoute();

    // Halaman koleksi tiap bagian homepage (#koleksi/<kunci>).
    initCollections({
      makeCard: (product, index) => createProductCard(product, index, { direct: true }),
      onAllProducts: () => openDashboardFeature("product-catalog"),
    });

    // Link katalog (?katalog=1&cari=…): buka Dashboard › Katalog Produk dengan saringan yang sama.
    if (new URLSearchParams(location.search).get(CATALOG_PARAM) === "1") {
      try {
        sessionStorage.setItem("kantoong:catalog-url", location.search.slice(1, 600));
      } catch {
        /* penyimpanan diblokir: katalog tetap terbuka tanpa saringan */
      }
      openDashboardFeature("product-catalog");
    }

    emit("engine-ready", {
      version: ENGINE_VERSION,
      tenant: state.activeTenant,
      productCount: state.products.length,
      usingDemo: state.usingDemo,
    });

    log("Engine berhasil diinisialisasi.");
  } catch (error) {
    reportError("Inisialisasi engine gagal.", error);
    showToast("Sebagian fitur toko gagal dimuat.");
  }
}

/* ============================================================
   17. START
   ============================================================ */

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initKantoongEngine,
    { once: true }
  );
} else {
  initKantoongEngine();
}
