
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
import CFG from "../client-config.js";

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
  frame.setAttribute("allow", "clipboard-read; clipboard-write");
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
      break;

    case "kantoong:dashboard-close-request":
      closeDashboard();
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
    brandTitle.textContent = String(CFG.app_name);
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

function scrollToCatalog() {
  document
    .getElementById("categorySection")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function askConsultation(text) {
  window.dispatchEvent(
    new CustomEvent("kantoong:consult", {
      detail: { text: String(text || "") },
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
  askButton.addEventListener("click", () => askConsultation(slide.aiPrompt));

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

  let query = supabase.from("products").select("*");

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
    const products = await fetchProductsFromSupabase();

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
  document.querySelectorAll(".product-card").forEach((card) => {
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
  return toNumber(product?.compare_at_price ?? product?.original_price, 0);
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

function createProductCard(product, index) {
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
    emit("product-selected", { product });
    askConsultation(`Ceritakan tentang ${name}`);
  });

  corner.append(likeButton, askButton);
  thumb.appendChild(corner);

  card.appendChild(thumb);

  const info = makeElement("div", "product-info");

  // Bukti sosial di atas nama: rating & jumlah terjual (angka asli dari database).
  info.appendChild(createProductMeta(product));

  info.appendChild(makeElement("h3", "product-name", name));

  // Harga (+ harga coret) dan tombol keranjang dalam satu baris.
  const buyRow = makeElement("div", "product-buy");
  const priceWrap = makeElement("p", "product-price");
  priceWrap.appendChild(
    document.createTextNode(formatCurrency(getProductPrice(product)))
  );

  if (discount > 0) {
    priceWrap.appendChild(
      makeElement("s", "product-price__was", formatCurrency(getCompareAtPrice(product)))
    );
  }

  buyRow.appendChild(priceWrap);

  const cartButton = makeElement("button", "product-cart", "+");
  cartButton.type = "button";
  cartButton.dataset.action = "add-to-cart";
  cartButton.setAttribute("aria-label", `Tambah ${name} ke keranjang`);
  cartButton.addEventListener("click", () => {
    addToCart(product);
  });
  buyRow.appendChild(cartButton);
  info.appendChild(buyRow);

  // Baris pengiriman di bawah garis: estimasi & kota asal.
  info.appendChild(createProductShipping(product));

  card.appendChild(info);

  return card;
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

  const ratingEl = makeElement("span", "product-rating");

  if (rating > 0) {
    ratingEl.append(
      makeElement("span", "product-rating__star", "★"),
      makeElement("strong", "", rating.toFixed(1).replace(".", ",")),
      document.createTextNode(reviews > 0 ? ` (${formatSocialCount(reviews)})` : "")
    );
  } else {
    ratingEl.classList.add("is-empty");
    ratingEl.append(
      makeElement("span", "product-rating__star", "★"),
      document.createTextNode("Baru")
    );
  }

  const soldEl = makeElement("span", "product-sold");
  soldEl.append(
    makeIcon("product-icon", ICONS.bag),
    document.createTextNode(`${formatSocialCount(sold)} terjual`)
  );

  const meta = makeElement("div", "product-meta");
  meta.append(ratingEl, soldEl);
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

  const estimateEl = makeElement("span", "product-ship__item");
  estimateEl.append(makeIcon("product-icon", ICONS.truck), document.createTextNode(estimate));

  const fromEl = makeElement("span", "product-ship__item");
  fromEl.append(makeIcon("product-icon", ICONS.pin), document.createTextNode(from));

  const row = makeElement("div", "product-ship");
  row.append(estimateEl, fromEl);
  return row;
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

const FEATURED_VIEW_KEY = "kantoong_featured_view";

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
  const spot = layout === "middle" ? "top" : layout === "end" ? "right" : "left";
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

function readFeaturedView() {
  try {
    const saved = localStorage.getItem(FEATURED_VIEW_KEY);
    if (saved === "2d" || saved === "3d") return saved;
  } catch {
    // Penyimpanan diblokir: pakai bawaan toko.
  }

  return CFG?.featured?.view === "2d" ? "2d" : "3d";
}

/* ---------- Mode 3D: komidi putar ---------- */

function getCarouselGeometry(rail) {
  const cards = getRailCards(rail);
  const count = cards.length;
  const width = cards[0]?.offsetWidth || 180;
  const step = 360 / Math.max(count, 1);

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
    let angle = ((index - state.pos) * step) % 360;
    if (angle > 180) angle -= 360;
    if (angle < -180) angle += 360;

    const radians = (angle * Math.PI) / 180;
    const facing = Math.cos(radians); // 1 = depan, -1 = belakang
    const visible = Math.abs(angle) < 125;

    card.style.transform =
      `translateX(calc(-50% + ${(Math.sin(radians) * spreadX).toFixed(1)}px)) ` +
      `translateZ(${((facing - 1) * depth).toFixed(1)}px) ` +
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

/** Ganti mode semua etalase sekaligus dan ingat pilihan pembeli. */
function setFeaturedView(view) {
  $$(".featured").forEach((section) => applyShowcaseView(section, view));

  try {
    localStorage.setItem(FEATURED_VIEW_KEY, view);
  } catch {
    // Abaikan: pilihan tetap berlaku selama halaman terbuka.
  }
}

/** Tombol 2D/3D dan panah "berikutnya" (dipasang sekali per bagian). */
function initShowcaseControls(section) {
  const rail = getShowcaseRail(section);

  if (!rail || section.dataset.controlsReady === "true") return;

  section.dataset.controlsReady = "true";
  section.dataset.view = readFeaturedView();
  initCarouselGestures(rail);

  section.querySelector(".featured-view")?.addEventListener("click", () => {
    setFeaturedView(isCarouselMode(section) ? "2d" : "3d");
  });

  section.querySelector(".featured-next")?.addEventListener("click", () => {
    if (isCarouselMode(section)) {
      const state = getCarousel(rail);
      state.pos = Math.round(state.pos) + 1;
      layoutCarousel(rail);
      return;
    }

    const cards = getRailCards(rail);
    const active = toNumber(rail.dataset.active, 0);

    if (active >= cards.length - 1) {
      rail.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }

    scrollRailToCard(rail, active + 1);
  });

  section.querySelector(".featured-float-cta")?.addEventListener("click", scrollToCatalog);
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

  const next = section.querySelector(".featured-next");
  if (next) next.hidden = cards.length < 2;

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
function createShowcaseSection({ eyebrow, title, description }) {
  const section = makeElement("section", "page-section featured product-rail-section");
  section.dataset.layout = "start";
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

  const cta = makeElement("button", "featured-float-cta", "Jelajahi sekarang →");
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

  const rails = Array.isArray(CFG?.rails) ? CFG.rails : [];

  rails.forEach((rail) => {
    const products = getRailProducts(rail);
    const minItems = Math.max(1, toNumber(rail?.min_items, 2));

    // Baris tanpa data asli disembunyikan, tidak dikarang.
    if (products.length < minItems) return;

    // Kerangka sama persis dengan Produk Unggulan (komidi putar + tulisan melompat).
    const { section, rail: list } = createShowcaseSection({
      eyebrow: rail.eyebrow,
      title: rail.title,
      description: rail.description,
    });

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

  showToast(`${getProductName(product)} ditambahkan ke keranjang.`);
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

function showAIPicks(products) {
  const title = document.getElementById("featuredTitle");
  const reset = document.getElementById("resetCatalogBtn");

  if (title) {
    if (!title.dataset.defaultText) {
      title.dataset.defaultText = title.textContent;
    }

    title.textContent = AI_PICKS_TITLE;
  }

  if (reset) {
    reset.hidden = false;
  }

  renderProducts(products);

  document
    .getElementById("featuredSection")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetAIPicks() {
  const title = document.getElementById("featuredTitle");
  const reset = document.getElementById("resetCatalogBtn");

  if (title?.dataset.defaultText) {
    title.textContent = title.dataset.defaultText;
  }

  if (reset) {
    reset.hidden = true;
  }

  renderProducts();
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

    await loadProducts();

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
