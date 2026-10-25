
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

  if (header) {
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

function openDashboard() {
  if (state.dashboardOpen) return;

  try {
    // Siapkan frame sebelum menampilkan host.
    getDashboardFrame();

    state.dashboardOpen = true;
    setPageVisibilityForDashboard(true);

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
      emit("dashboard-ready", { tenant: state.activeTenant });
      log("Dashboard User melaporkan status siap.");
      break;

    case "dashboard-close-request":
      closeDashboard();
      break;

    case "dashboard-bootstrap-error":
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

function getHeroSlides() {
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
      subtitle: "Temukan produk yang sesuai dengan kebutuhanmu.",
    },
  ];
}

function renderHeroSlide(index) {
  const slides = getHeroSlides();
  if (!slides.length) return;

  state.currentHeroIndex = (index + slides.length) % slides.length;

  const slide = slides[state.currentHeroIndex];
  const hero = $(SELECTORS.hero);
  const title = $(SELECTORS.heroTitle);
  const subtitle = $(SELECTORS.heroSubtitle);
  const image = $(SELECTORS.heroImage);

  if (title) {
    title.textContent = escapeText(
      slide.title ?? slide.heading ?? CFG?.app_name ?? ""
    );
  }

  if (subtitle) {
    subtitle.textContent = escapeText(
      slide.subtitle ?? slide.description ?? ""
    );
  }

  if (image && slide.image && isSafeImageURL(slide.image)) {
    image.src = slide.image;
    image.alt = escapeText(slide.alt || slide.title || "Banner");
    image.loading = "eager";
  }

  if (hero) {
    hero.dataset.slideIndex = String(state.currentHeroIndex);
  }

  emit("hero-slide-changed", {
    index: state.currentHeroIndex,
    slide,
  });
}

function renderHero() {
  renderHeroSlide(0);

  if (state.heroTimer) {
    window.clearInterval(state.heroTimer);
    state.heroTimer = null;
  }

  const slides = getHeroSlides();

  if (slides.length > 1) {
    const interval = Math.max(
      3000,
      toNumber(CFG?.hero?.interval, 6000)
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

  if (!tenantId) {
    throw new Error(
      "business_id belum dikonfigurasi. Data produk tenant tidak dimuat."
    );
  }

  let query = supabase
    .from("products")
    .select("*")
    .eq("business_id", tenantId);

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
  const card = makeElement("article", "kantoong-product-card");
  card.dataset.productId = getProductId(product);

  const imageURL = getProductImage(product);

  if (imageURL && isSafeImageURL(imageURL)) {
    const image = makeElement("img", "kantoong-product-card__image");
    image.src = imageURL;
    image.alt = getProductName(product);
    image.loading = index < 4 ? "eager" : "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => {
      image.hidden = true;
    });
    card.appendChild(image);
  }

  const content = makeElement("div", "kantoong-product-card__content");

  content.appendChild(
    makeElement("h3", "kantoong-product-card__name", getProductName(product))
  );

  const category = getProductCategory(product);

  content.appendChild(
    makeElement("p", "kantoong-product-card__category", category)
  );

  content.appendChild(
    makeElement(
      "p",
      "kantoong-product-card__price",
      formatCurrency(getProductPrice(product))
    )
  );

  const addButton = makeElement(
    "button",
    "kantoong-product-card__add",
    "Tambah ke keranjang"
  );

  addButton.type = "button";
  addButton.dataset.action = "add-to-cart";
  addButton.setAttribute("aria-label", `Tambah ${getProductName(product)} ke keranjang`);

  addButton.addEventListener("click", () => {
    addToCart(product);
  });

  content.appendChild(addButton);
  card.appendChild(content);

  return card;
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


function renderProducts(productsToRender = state.products) {
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

  const source = Array.isArray(productsToRender) ? productsToRender : [];
  const products = source.length ? source : [];

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

function initAIEventBridge() {
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
