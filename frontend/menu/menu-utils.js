
(function (window, document) {
  "use strict";

  // Jangan menimpa modul jika sudah pernah dimuat.
  if (window.KantoongMenuUtils) return;

  // =========================================
  // STRING UTILITIES
  // =========================================

  function toString(value, fallback) {
    if (value === null || value === undefined) {
      return fallback || "";
    }

    return String(value);
  }

  function normalizeId(value) {
    return toString(value)
      .trim()
      .toLowerCase();
  }

  function capitalize(value) {
    const text = toString(value).trim();

    if (!text) return "";

    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function truncate(value, maxLength, suffix) {
    const text = toString(value);
    const limit = Number(maxLength);

    if (!Number.isFinite(limit) || limit < 0) {
      return text;
    }

    if (text.length <= limit) return text;

    return text.slice(0, limit) + (suffix || "...");
  }

  // =========================================
  // HTML UTILITIES
  // =========================================

  function escapeHTML(value) {
    return toString(value).replace(/[&<>"']/g, function (char) {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      };

      return entities[char];
    });
  }

  function setText(element, value) {
    if (!element) return false;

    element.textContent = toString(value);
    return true;
  }

  function setHTML(element, value) {
    if (!element) return false;

    // Hanya gunakan untuk HTML yang memang tepercaya.
    // Untuk teks dari pengguna/API, gunakan setText().
    element.innerHTML = toString(value);

    return true;
  }

  // =========================================
  // DOM UTILITIES
  // =========================================

  function getElement(selector, root) {
    if (!selector) return null;

    const scope = root || document;

    if (typeof selector !== "string") {
      return selector && selector.nodeType ? selector : null;
    }

    try {
      return scope.querySelector(selector);
    } catch (error) {
      return null;
    }
  }

  function getElements(selector, root) {
    if (!selector) return [];

    const scope = root || document;

    try {
      return Array.from(scope.querySelectorAll(selector));
    } catch (error) {
      return [];
    }
  }

  function createElement(tagName, options) {
    const tag = toString(tagName).trim().toLowerCase();

    if (!/^[a-z][a-z0-9-]*$/.test(tag)) {
      throw new Error("Nama tag HTML tidak valid.");
    }

    const settings = options || {};
    const element = document.createElement(tag);

    if (settings.className) {
      element.className = settings.className;
    }

    if (settings.text !== undefined) {
      element.textContent = toString(settings.text);
    }

    if (settings.attributes) {
      Object.entries(settings.attributes).forEach(
        function (entry) {
          const name = entry[0];
          const value = entry[1];

          // Hindari event handler inline dan atribut berbahaya.
          if (
            /^on/i.test(name) ||
            name.toLowerCase() === "srcdoc"
          ) {
            return;
          }

          if (value !== null && value !== undefined) {
            element.setAttribute(name, String(value));
          }
        }
      );
    }

    return element;
  }

  function addClass(element, className) {
    if (!element || !className) return false;

    element.classList.add(className);
    return true;
  }

  function removeClass(element, className) {
    if (!element || !className) return false;

    element.classList.remove(className);
    return true;
  }

  function toggleClass(element, className, force) {
    if (!element || !className) return false;

    return element.classList.toggle(className, force);
  }

  // =========================================
  // EVENT UTILITIES
  // =========================================

  function emit(eventName, detail, target) {
    if (!eventName) return false;

    const destination = target || document;

    destination.dispatchEvent(
      new CustomEvent(eventName, {
        detail: detail === undefined ? {} : detail,
        bubbles: true
      })
    );

    return true;
  }

  function on(target, eventName, handler, options) {
    if (!target || !eventName || typeof handler !== "function") {
      return function () {};
    }

    target.addEventListener(eventName, handler, options);

    // Kembalikan fungsi untuk melepas listener.
    return function unsubscribe() {
      target.removeEventListener(
        eventName,
        handler,
        options
      );
    };
  }

  // =========================================
  // STORAGE UTILITIES
  // =========================================

  function getStorage(storageType) {
    try {
      return storageType === "session"
        ? window.sessionStorage
        : window.localStorage;
    } catch (error) {
      return null;
    }
  }

  function storageGet(key, fallback, storageType) {
    const storage = getStorage(storageType);

    if (!storage) return fallback;

    try {
      const value = storage.getItem(key);

      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function storageSet(key, value, storageType) {
    const storage = getStorage(storageType);

    if (!storage) return false;

    try {
      storage.setItem(key, String(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function storageRemove(key, storageType) {
    const storage = getStorage(storageType);

    if (!storage) return false;

    try {
      storage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  function storageGetJSON(key, fallback, storageType) {
    const value = storageGet(key, null, storageType);

    if (value === null) return fallback;

    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function storageSetJSON(key, value, storageType) {
    try {
      return storageSet(
        key,
        JSON.stringify(value),
        storageType
      );
    } catch (error) {
      return false;
    }
  }

  // =========================================
  // NUMBER & DATE UTILITIES
  // =========================================

  function formatCurrency(value, currency, locale) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) return "-";

    try {
      return new Intl.NumberFormat(locale || "id-ID", {
        style: "currency",
        currency: currency || "IDR",
        maximumFractionDigits: 0
      }).format(amount);
    } catch (error) {
      return String(amount);
    }
  }

  function formatNumber(value, locale) {
    const number = Number(value);

    if (!Number.isFinite(number)) return "-";

    return new Intl.NumberFormat(locale || "id-ID")
      .format(number);
  }

  function formatDate(value, options) {
    const date = value instanceof Date
      ? value
      : new Date(value);

    if (Number.isNaN(date.getTime())) return "-";

    return new Intl.DateTimeFormat(
      "id-ID",
      options || {
        day: "numeric",
        month: "long",
        year: "numeric"
      }
    ).format(date);
  }

  // =========================================
  // ASYNC UTILITIES
  // =========================================

  function debounce(callback, delay) {
    let timeoutId;

    return function () {
      const context = this;
      const args = arguments;

      window.clearTimeout(timeoutId);

      timeoutId = window.setTimeout(function () {
        callback.apply(context, args);
      }, Math.max(0, Number(delay) || 0));
    };
  }

  function once(callback) {
    let called = false;
    let result;

    return function () {
      if (called) return result;

      called = true;
      result = callback.apply(this, arguments);

      return result;
    };
  }

  // =========================================
  // GENERAL UTILITIES
  // =========================================

  function isObject(value) {
    return value !== null &&
      typeof value === "object" &&
      !Array.isArray(value);
  }

  function clone(value) {
    if (Array.isArray(value)) {
      return value.map(clone);
    }

    if (isObject(value)) {
      const result = {};

      Object.keys(value).forEach(function (key) {
        result[key] = clone(value[key]);
      });

      return result;
    }

    return value;
  }

  function generateId(prefix) {
    const randomPart =
      Math.random().toString(36).slice(2, 10);

    return (prefix || "ktg") + "-" + randomPart;
  }

  function log() {
    const config = window.KantoongMenuConfig;

    if (
      !config ||
      typeof config.isDebugEnabled !== "function" ||
      !config.isDebugEnabled()
    ) {
      return;
    }

    console.log.apply(
      console,
      ["[KANTOONG MENU]"].concat(
        Array.from(arguments)
      )
    );
  }

  // =========================================
  // PUBLIC API
  // =========================================

  window.KantoongMenuUtils = Object.freeze({
    // String
    toString,
    normalizeId,
    capitalize,
    truncate,

    // HTML
    escapeHTML,
    setText,
    setHTML,

    // DOM
    getElement,
    getElements,
    createElement,
    addClass,
    removeClass,
    toggleClass,

    // Events
    emit,
    on,

    // Storage
    storageGet,
    storageSet,
    storageRemove,
    storageGetJSON,
    storageSetJSON,

    // Number & date
    formatCurrency,
    formatNumber,
    formatDate,

    // Async
    debounce,
    once,

    // General
    isObject,
    clone,
    generateId,
    log
  });
})(window, document);
