
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
      src: getProductImage(product),
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

function scrollToFeatured() {
  document
    .getElementById("featuredSection")
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

  const productButton = makeElement(
    "button",
    "hero-cta hero-cta--primary",
    "Lihat produk \u2192"
  );
  productButton.type = "button";
  productButton.addEventListener("click", scrollToFeatured);

  const askButton = makeElement(
    "button",
    "hero-cta",
    "\u2726 Konsultasi AI"
  );
  askButton.type = "button";
  askButton.addEventListener("click", () => askConsultation(slide.aiPrompt));

  actions.append(productButton, askButton);
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

  renderProducts();
  renderCategories();

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

    renderProducts();
    renderCategories();

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
      renderProducts();
      renderCategories();

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

/* ============================================================
   10. RENDER PRODUK
   ============================================================ */

function createProductCard(product, index) {
  const card = makeElement("article", "product-card");
  card.dataset.productId = getProductId(product);

  const name = getProductName(product);

  const thumb = makeElement("div", "product-thumb");
  const showPlaceholder = () => {
    thumb.replaceChildren(
      makeElement(
        "span",
        "product-thumb__placeholder",
        name.charAt(0).toUpperCase() || "P"
      )
    );
  };

  const imageURL = getProductImage(product);

  if (imageURL && isSafeImageURL(imageURL)) {
    const image = document.createElement("img");
    image.src = imageURL;
    image.alt = name;
    image.loading = index < 4 ? "eager" : "lazy";
    image.decoding = "async";
    image.addEventListener("error", showPlaceholder);
    thumb.appendChild(image);
  } else {
    showPlaceholder();
  }

  card.appendChild(thumb);
  card.appendChild(makeElement("h3", "product-name", name));
  card.appendChild(
    makeElement("p", "product-price", formatCurrency(getProductPrice(product)))
  );

  const actions = makeElement("div", "product-actions");

  const askButton = makeElement(
    "button",
    "product-ask",
    CFG?.featured?.ask_label || "Tanyakan produk ini"
  );
  askButton.type = "button";
  askButton.dataset.action = "ask-product";
  askButton.addEventListener("click", () => {
    emit("product-selected", { product });
    askConsultation(`Ceritakan tentang ${name}`);
  });

  const cartButton = makeElement("button", "product-cart", "+");
  cartButton.type = "button";
  cartButton.dataset.action = "add-to-cart";
  cartButton.setAttribute("aria-label", `Tambah ${name} ke keranjang`);
  cartButton.addEventListener("click", () => {
    addToCart(product);
  });

  actions.append(askButton, cartButton);
  card.appendChild(actions);

  return card;
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


function renderProducts(productsToRender) {
  const container = getProductContainer();

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

  emit("products-rendered", {
    count: products.length,
    products,
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

  renderProducts(products);

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

  renderProducts(state.matched);

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

    renderProducts(state.products);

    const container = getProductContainer();

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
    renderProducts(state.products);
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
