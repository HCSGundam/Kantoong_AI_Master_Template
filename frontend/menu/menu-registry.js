
(function (window) {
  "use strict";

  const REGISTRY = new Map();

  function normalizeId(id) {
    return String(id || "")
      .trim()
      .toLowerCase();
  }

  function register(feature) {
    if (!feature || typeof feature !== "object") {
      throw new TypeError(
        "Feature harus berupa object."
      );
    }

    const id = normalizeId(feature.id);

    if (!id) {
      throw new Error(
        "Feature wajib memiliki id."
      );
    }

    if (!feature.title || !String(feature.title).trim()) {
      throw new Error(
        `Feature "${id}" wajib memiliki title.`
      );
    }

    if (REGISTRY.has(id)) {
      throw new Error(
        `Feature "${id}" sudah terdaftar.`
      );
    }

    const entry = Object.freeze({
      id,
      title: String(feature.title).trim(),
      description: String(feature.description || ""),
      category: String(feature.category || "general"),
      icon: String(feature.icon || "grid-2x2"),
      enabled: feature.enabled !== false,
      status: feature.status || "available",
      route: feature.route || null,
      handler:
        typeof feature.handler === "function"
          ? feature.handler
          : null
    });

    REGISTRY.set(id, entry);

    return entry;
  }

  function get(id) {
    return REGISTRY.get(normalizeId(id)) || null;
  }

  function getAll(options) {
    const settings = options || {};

    let features = Array.from(REGISTRY.values());

    if (settings.enabledOnly) {
      features = features.filter(
        (feature) => feature.enabled
      );
    }

    if (settings.category) {
      const category = normalizeId(settings.category);

      features = features.filter(
        (feature) =>
          normalizeId(feature.category) === category
      );
    }

    return features;
  }

  function has(id) {
    return REGISTRY.has(normalizeId(id));
  }

  function update(id, changes) {
    const key = normalizeId(id);
    const current = REGISTRY.get(key);

    if (!current) {
      return null;
    }

    if (!changes || typeof changes !== "object") {
      throw new TypeError(
        "Changes harus berupa object."
      );
    }

    const updated = Object.freeze({
      ...current,
      ...changes,
      id: current.id
    });

    REGISTRY.set(key, updated);

    return updated;
  }

  function unregister(id) {
    return REGISTRY.delete(normalizeId(id));
  }

  function clear() {
    REGISTRY.clear();
  }

  function getStatus() {
    const features = getAll();

    return {
      total: features.length,
      enabled: features.filter(
        (feature) => feature.enabled
      ).length,
      disabled: features.filter(
        (feature) => !feature.enabled
      ).length,
      categories: [
        ...new Set(
          features.map((feature) => feature.category)
        )
      ]
    };
  }

  window.KantoongMenuRegistry = Object.freeze({
    register,
    get,
    getAll,
    has,
    update,
    unregister,
    clear,
    getStatus
  });
})(window);
