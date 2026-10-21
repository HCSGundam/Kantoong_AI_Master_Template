
(function (window, document) {
  "use strict";

  if (window.KantoongMenuEvents) return;

  const DEFAULT_EVENTS = {
    featureRequest: "kantoong:customer-feature-request",
    showCatalog: "kantoong:show-catalog",
    aiHistoryOpen: "kantoong:ai-history-open",
    themeChanged: "kantoong:theme-changed",
    menuOpened: "kantoong:menu-opened",
    menuClosed: "kantoong:menu-closed"
  };

  const listeners = new Map();
  const eventNames = Object.freeze(
    resolveEventNames()
  );

  function resolveEventNames() {
    const config = window.KantoongMenuConfig;

    if (!config || typeof config.get !== "function") {
      return { ...DEFAULT_EVENTS };
    }

    const resolved = {};

    Object.keys(DEFAULT_EVENTS).forEach(function (key) {
      resolved[key] =
        config.get("events." + key, DEFAULT_EVENTS[key]);
    });

    return resolved;
  }

  function getEventName(name) {
    if (
      typeof name !== "string" ||
      !name.trim()
    ) {
      throw new TypeError("Nama event wajib diisi.");
    }

    // Mendukung nama alias dari konfigurasi,
    // sekaligus nama event literal.
    return eventNames[name] || name.trim();
  }

  function emit(name, detail, options) {
    const eventName = getEventName(name);
    const settings = options || {};
    const target = settings.target || document;

    if (
      !target ||
      typeof target.dispatchEvent !== "function"
    ) {
      throw new TypeError("Target event tidak valid.");
    }

    const event = new CustomEvent(eventName, {
      detail: detail === undefined ? {} : detail,
      bubbles: settings.bubbles !== false,
      cancelable: settings.cancelable === true
    });

    target.dispatchEvent(event);

    return event;
  }

  function on(name, handler, options) {
    const eventName = getEventName(name);

    if (typeof handler !== "function") {
      throw new TypeError(
        "Handler event harus berupa function."
      );
    }

    const settings = options || {};
    const target = settings.target || document;

    if (
      !target ||
      typeof target.addEventListener !== "function"
    ) {
      throw new TypeError("Target listener tidak valid.");
    }

    target.addEventListener(
      eventName,
      handler,
      settings.listenerOptions
    );

    const subscription = {
      eventName,
      handler,
      target
    };

    if (!listeners.has(eventName)) {
      listeners.set(eventName, new Set());
    }

    listeners.get(eventName).add(subscription);

    let active = true;

    return function unsubscribe() {
      if (!active) return;

      active = false;

      target.removeEventListener(
        eventName,
        handler,
        settings.listenerOptions
      );

      const group = listeners.get(eventName);

      if (group) {
        group.delete(subscription);

        if (group.size === 0) {
          listeners.delete(eventName);
        }
      }
    };
  }

  function once(name, handler, options) {
    let unsubscribe = function () {};

    const wrappedHandler = function (event) {
      unsubscribe();
      handler(event);
    };

    unsubscribe = on(name, wrappedHandler, options);

    return unsubscribe;
  }

  function off(name, handler, target) {
    const eventName = getEventName(name);
    const group = listeners.get(eventName);

    if (!group) return 0;

    let removed = 0;

    Array.from(group).forEach(function (subscription) {
      const handlerMatches =
        !handler || subscription.handler === handler;

      const targetMatches =
        !target || subscription.target === target;

      if (handlerMatches && targetMatches) {
        subscription.target.removeEventListener(
          subscription.eventName,
          subscription.handler
        );

        group.delete(subscription);
        removed++;
      }
    });

    if (group.size === 0) {
      listeners.delete(eventName);
    }

    return removed;
  }

  function getNames() {
    return { ...eventNames };
  }

  function getStatus() {
    let activeListeners = 0;

    listeners.forEach(function (group) {
      activeListeners += group.size;
    });

    return {
      eventTypes: Object.keys(eventNames).length,
      trackedEventTypes: listeners.size,
      activeListeners
    };
  }

  window.KantoongMenuEvents = Object.freeze({
    names: eventNames,
    emit,
    on,
    once,
    off,
    getNames,
    getStatus
  });
})(window, document);
