
(function (window) {
  "use strict";

  const CONFIG = {
    appName: "KANTOONG",
    moduleName: "Customer Menu",
    version: "1.0.0",

    // Pengaturan tampilan
    ui: {
      animationDuration: 250,
      toastDuration: 3000,
      drawerId: "sampleDrawer",
      overlayId: "sampleOverlay",
      defaultTheme: "light",
      themes: ["light", "dark"]
    },

    // Pengaturan menu
    menu: {
      searchable: true,
      closeOnFeatureSelect: true,
      closeOnOverlayClick: true,
      closeOnEscape: true,
      rememberLastFeature: false,
      defaultCategory: "all"
    },

    // Pengaturan navigasi
    navigation: {
      mode: "event",
      fallbackRoute: null,
      preserveMenuState: false
    },

    // Pengaturan fitur
    features: {
      allowDisabledFeatures: false,
      showUnavailableFeatures: true,
      strictRegistration: true
    },

    // Penyimpanan preferensi
    storage: {
      themeKey: "kantoong_customer_theme",
      preferencesKey: "kantoong_customer_preferences",
      lastFeatureKey: "kantoong_customer_last_feature"
    },

    // Nama event internal aplikasi
    events: {
      featureRequest: "kantoong:customer-feature-request",
      showCatalog: "kantoong:show-catalog",
      aiHistoryOpen: "kantoong:ai-history-open",
      themeChanged: "kantoong:theme-changed",
      menuOpened: "kantoong:menu-opened",
      menuClosed: "kantoong:menu-closed"
    },

    // Pengaturan debugging
    debug: {
      enabled: false,
      logEvents: false,
      logNavigation: false
    }
  };

  function clone(value) {
    if (Array.isArray(value)) {
      return value.map(clone);
    }

    if (value && typeof value === "object") {
      const result = {};

      Object.keys(value).forEach(function (key) {
        result[key] = clone(value[key]);
      });

      return result;
    }

    return value;
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object") {
      return value;
    }

    Object.keys(value).forEach(function (key) {
      deepFreeze(value[key]);
    });

    return Object.freeze(value);
  }

  function get(path, fallback) {
    if (typeof path !== "string" || !path.trim()) {
      return fallback;
    }

    const value = path
      .split(".")
      .reduce(function (current, key) {
        if (
          current === null ||
          current === undefined ||
          !Object.prototype.hasOwnProperty.call(current, key)
        ) {
          return undefined;
        }

        return current[key];
      }, CONFIG);

    return value === undefined ? fallback : value;
  }

  function getAll() {
    return clone(CONFIG);
  }

  function isDebugEnabled() {
    return CONFIG.debug.enabled === true;
  }

  function log() {
    if (!isDebugEnabled()) return;

    const args = Array.prototype.slice.call(arguments);
    console.log("[KANTOONG]", ...args);
  }

  deepFreeze(CONFIG);

  window.KantoongMenuConfig = Object.freeze({
    get: get,
    getAll: getAll,
    isDebugEnabled: isDebugEnabled,
    log: log
  });
})(window);
