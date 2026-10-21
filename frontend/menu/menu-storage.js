
(function (window) {
  "use strict";

  if (window.KantoongMenuStorage) return;

  const DEFAULT_KEYS = {
    theme: "kantoong_customer_theme",
    preferences: "kantoong_customer_preferences",
    lastFeature: "kantoong_customer_last_feature",
    recentFeatures: "kantoong_customer_recent_features",
    dismissedNotices: "kantoong_customer_dismissed_notices"
  };

  function getConfig(key, fallback) {
    const config = window.KantoongMenuConfig;

    if (config && typeof config.get === "function") {
      return config.get("storage." + key, fallback);
    }

    return fallback;
  }

  function getKey(name) {
    if (
      Object.prototype.hasOwnProperty.call(DEFAULT_KEYS, name)
    ) {
      const configKey = {
        theme: "themeKey",
        preferences: "preferencesKey",
        lastFeature: "lastFeatureKey"
      }[name];

      return configKey
        ? getConfig(configKey, DEFAULT_KEYS[name])
        : DEFAULT_KEYS[name];
    }

    // Izinkan key aplikasi yang eksplisit.
    if (typeof name === "string" && name.trim()) {
      return name.trim();
    }

    throw new TypeError("Storage key wajib diisi.");
  }

  function getBackend(type) {
    try {
      if (type === "session") {
        return window.sessionStorage;
      }

      return window.localStorage;
    } catch (error) {
      return null;
    }
  }

  function get(key, fallback, type) {
    const storageKey = getKey(key);
    const backend = getBackend(type);

    if (!backend) return fallback === undefined ? null : fallback;

    try {
      const value = backend.getItem(storageKey);

      if (value === null) {
        return fallback === undefined ? null : fallback;
      }

      return value;
    } catch (error) {
      return fallback === undefined ? null : fallback;
    }
  }

  function set(key, value, type) {
    const storageKey = getKey(key);
    const backend = getBackend(type);

    if (!backend) return false;

    try {
      backend.setItem(storageKey, String(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function remove(key, type) {
    const storageKey = getKey(key);
    const backend = getBackend(type);

    if (!backend) return false;

    try {
      backend.removeItem(storageKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  function getJSON(key, fallback, type) {
    const value = get(key, null, type);

    if (value === null) {
      return fallback === undefined ? null : fallback;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback === undefined ? null : fallback;
    }
  }

  function setJSON(key, value, type) {
    let serialized;

    try {
      serialized = JSON.stringify(value);
    } catch (error) {
      return false;
    }

    if (serialized === undefined) {
      return false;
    }

    return set(key, serialized, type);
  }

  function has(key, type) {
    const storageKey = getKey(key);
    const backend = getBackend(type);

    if (!backend) return false;

    try {
      return backend.getItem(storageKey) !== null;
    } catch (error) {
      return false;
    }
  }

  function clear(type, options) {
    const backend = getBackend(type);

    if (!backend) return false;

    const settings = options || {};

    try {
      if (settings.all === true) {
        // Menghapus semua storage origin ini.
        backend.clear();
        return true;
      }

      // Default: hanya hapus key milik menu KANTOONG.
      Object.keys(DEFAULT_KEYS).forEach(function (name) {
        backend.removeItem(getKey(name));
      });

      return true;
    } catch (error) {
      return false;
    }
  }

  function getAll(type) {
    const backend = getBackend(type);

    if (!backend) return {};

    const result = {};

    try {
      Object.keys(DEFAULT_KEYS).forEach(function (name) {
        const key = getKey(name);
        const value = backend.getItem(key);

        if (value !== null) {
          result[name] = value;
        }
      });
    } catch (error) {
      return {};
    }

    return result;
  }

  function getStatus(type) {
    const backend = getBackend(type);

    return {
      available: Boolean(backend),
      type: type === "session" ? "sessionStorage" : "localStorage",
      managedKeys: Object.keys(DEFAULT_KEYS).length
    };
  }

  window.KantoongMenuStorage = Object.freeze({
    keys: Object.freeze({ ...DEFAULT_KEYS }),
    get,
    set,
    remove,
    getJSON,
    setJSON,
    has,
    clear,
    getAll,
    getStatus
  });
})(window);
