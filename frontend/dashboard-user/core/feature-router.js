
/**
 * KANTOONG CORE
 * File: frontend/dashboard-user/core/feature-router.js
 *
 * Tanggung jawab:
 * 1. Mengatur navigasi antarfitur.
 * 2. Menormalisasi permintaan navigasi.
 * 3. Memastikan fitur tersedia sebelum dibuka.
 * 4. Meneruskan permintaan ke Feature Controller.
 * 5. Menyimpan riwayat navigasi dalam memori.
 * 6. Menyediakan API navigasi untuk Dashboard dan UI.
 *
 * CATATAN:
 * Router bukan lapisan otorisasi backend.
 * Akses tetap diperiksa oleh Feature Controller,
 * Feature Permission, dan backend.
 */

import {
  getFeature,
  getAllFeatures,
} from "./feature-registry.js";

import {
  openFeature,
  closeFeature,
  getFeatureControllerState,
  subscribeFeatureController,
} from "./feature-controller.js";

const routerState = {
  initialized: false,
  currentRoute: null,
  previousRoute: null,
  navigationCount: 0,
  lastError: null,
};

const routeHistory = [];
const routeListeners = new Set();

const MAX_HISTORY = 50;

/**
 * Normalisasi ID fitur.
 */
function normalizeFeatureId(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

/**
 * Membuat error router dengan kode yang konsisten.
 */
function createRouterError(code, message, details = {}) {
  const error = new Error(message);

  error.name = "FeatureRouterError";
  error.code = code;
  error.details = details;

  return error;
}

/**
 * Mengambil path yang didefinisikan oleh fitur.
 *
 * Jika fitur tidak menentukan route, gunakan
 * /features/{featureId}.
 */
function getFeaturePath(feature) {
  const configuredPath =
    typeof feature.route === "string"
      ? feature.route
      : typeof feature.path === "string"
        ? feature.path
        : "";

  const path = configuredPath.trim();

  if (!path) {
    return `/features/${encodeURIComponent(feature.id)}`;
  }

  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * Membuat objek route standar.
 */
function createRoute(feature, options = {}) {
  return Object.freeze({
    featureId: feature.id,
    path: getFeaturePath(feature),
    title: feature.name,
    params:
      options.params &&
      typeof options.params === "object"
        ? { ...options.params }
        : {},
    state:
      options.state &&
      typeof options.state === "object"
        ? { ...options.state }
        : {},
    timestamp: new Date().toISOString(),
  });
}

/**
 * Mengirim event navigasi kepada subscriber.
 */
function emitRouteEvent(type, detail = {}) {
  const event = Object.freeze({
    type,
    detail,
    timestamp: new Date().toISOString(),
  });

  for (const listener of routeListeners) {
    try {
      listener(event);
    } catch (error) {
      console.error(
        "[KANTOONG FeatureRouter] Listener gagal:",
        error
      );
    }
  }

  return event;
}

/**
 * Menambahkan route ke riwayat navigasi.
 */
function recordHistory(route) {
  routeHistory.push(route);

  if (routeHistory.length > MAX_HISTORY) {
    routeHistory.splice(
      0,
      routeHistory.length - MAX_HISTORY
    );
  }
}

/**
 * Mencari fitur berdasarkan ID.
 */
function resolveFeature(featureId) {
  const id = normalizeFeatureId(featureId);

  if (!id) {
    throw createRouterError(
      "INVALID_ROUTE",
      "ID fitur untuk navigasi tidak valid."
    );
  }

  const feature = getFeature(id);

  if (!feature) {
    throw createRouterError(
      "FEATURE_NOT_FOUND",
      `Fitur "${id}" tidak ditemukan.`,
      { featureId: id }
    );
  }

  return feature;
}

/**
 * Navigasi menuju fitur berdasarkan ID.
 *
 * options:
 * {
 *   element: HTMLElement,
 *   context: object,
 *   params: object,
 *   state: object,
 *   activate: true
 * }
 */
export async function navigateToFeature(
  featureId,
  options = {}
) {
  const feature = resolveFeature(featureId);

  if (feature.enabled === false || feature.status === "disabled") {
    throw createRouterError(
      "FEATURE_DISABLED",
      `Fitur "${feature.id}" sedang dinonaktifkan.`,
      { featureId: feature.id }
    );
  }

  const route = createRoute(feature, options);

  routerState.lastError = null;

  emitRouteEvent("navigation:started", {
    route,
  });

  try {
    const controllerResult = await openFeature(
      feature.id,
      options
    );

    routerState.previousRoute =
      routerState.currentRoute;

    routerState.currentRoute = route;
    routerState.navigationCount += 1;

    recordHistory(route);

    emitRouteEvent("navigation:completed", {
      route,
      controllerResult,
    });

    return {
      success: true,
      route,
      controllerResult,
    };
  } catch (error) {
    routerState.lastError = {
      featureId: feature.id,
      message:
        error instanceof Error
          ? error.message
          : "Navigasi gagal.",
      code: error?.code ?? "NAVIGATION_FAILED",
      timestamp: new Date().toISOString(),
    };

    emitRouteEvent("navigation:failed", {
      route,
      error: routerState.lastError,
    });

    throw error;
  }
}

/**
 * Menutup fitur yang sedang aktif.
 */
export async function navigateBack(options = {}) {
  const currentRoute = routerState.currentRoute;

  if (!currentRoute) {
    return {
      success: false,
      reason: "NO_ACTIVE_ROUTE",
    };
  }

  try {
    await closeFeature(currentRoute.featureId, {
      unmount: options.unmount !== false,
      context: options.context,
    });

    routerState.previousRoute = currentRoute;
    routerState.currentRoute = null;

    emitRouteEvent("navigation:back", {
      closedFeatureId: currentRoute.featureId,
    });

    return {
      success: true,
      closedFeatureId: currentRoute.featureId,
    };
  } catch (error) {
    routerState.lastError = {
      featureId: currentRoute.featureId,
      message:
        error instanceof Error
          ? error.message
          : "Gagal menutup fitur.",
      code: error?.code ?? "NAVIGATION_BACK_FAILED",
      timestamp: new Date().toISOString(),
    };

    throw error;
  }
}

/**
 * Mengarahkan navigasi ke route sebelumnya.
 *
 * Jika fitur sebelumnya sudah tidak tersedia,
 * fungsi mengembalikan hasil gagal tanpa membuka fitur lain.
 */
export async function navigateToPrevious(options = {}) {
  const previousRoute = routerState.previousRoute;

  if (!previousRoute) {
    return {
      success: false,
      reason: "NO_PREVIOUS_ROUTE",
    };
  }

  return navigateToFeature(
    previousRoute.featureId,
    {
      ...options,
      params: previousRoute.params,
      state: previousRoute.state,
    }
  );
}

/**
 * Mencari fitur yang dapat dijadikan tujuan navigasi.
 *
 * Pencarian ini hanya menemukan kandidat berdasarkan
 * metadata. Izin tetap diperiksa saat fitur dibuka.
 */
export function findFeatureRoutes(query = "") {
  const normalizedQuery =
    typeof query === "string"
      ? query.trim().toLowerCase()
      : "";

  const features = getAllFeatures();

  const results = features
    .filter((feature) => {
      if (
        feature.enabled === false ||
        feature.status === "disabled"
      ) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchableText = [
        feature.id,
        feature.name,
        feature.description,
        feature.category,
        ...(Array.isArray(feature.tags)
          ? feature.tags
          : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    })
    .map((feature) => ({
      featureId: feature.id,
      path: getFeaturePath(feature),
      title: feature.name,
      description: feature.description ?? "",
      category: feature.category ?? "general",
      icon: feature.icon ?? null,
    }));

  return results;
}

/**
 * Mengambil route aktif.
 */
export function getCurrentRoute() {
  return routerState.currentRoute
    ? {
        ...routerState.currentRoute,
        params: { ...routerState.currentRoute.params },
        state: { ...routerState.currentRoute.state },
      }
    : null;
}

/**
 * Mengambil riwayat navigasi.
 */
export function getRouteHistory(options = {}) {
  const limit = Number.isInteger(options.limit)
    ? Math.max(0, options.limit)
    : MAX_HISTORY;

  return routeHistory
    .slice(-limit)
    .map((route) => ({
      ...route,
      params: { ...route.params },
      state: { ...route.state },
    }));
}

/**
 * Mengambil informasi route berdasarkan ID fitur.
 */
export function getFeatureRoute(featureId) {
  const feature = resolveFeature(featureId);

  return {
    featureId: feature.id,
    path: getFeaturePath(feature),
    title: feature.name,
    enabled:
      feature.enabled !== false &&
      feature.status !== "disabled",
  };
}

/**
 * Subscribe terhadap event router.
 */
export function subscribeFeatureRouter(listener) {
  if (typeof listener !== "function") {
    throw new TypeError(
      "Listener router harus berupa function."
    );
  }

  routeListeners.add(listener);

  return function unsubscribe() {
    return routeListeners.delete(listener);
  };
}

/**
 * Inisialisasi router.
 *
 * Tidak membuka fitur secara otomatis.
 */
export function initializeFeatureRouter() {
  if (routerState.initialized) {
    return getFeatureRouterState();
  }

  routerState.initialized = true;

  emitRouteEvent("router:initialized", {
    availableFeatures: getAllFeatures().length,
  });

  return getFeatureRouterState();
}

/**
 * Mengambil status router.
 */
export function getFeatureRouterState() {
  return {
    initialized: routerState.initialized,
    currentRoute: getCurrentRoute(),
    previousRoute: routerState.previousRoute
      ? { ...routerState.previousRoute }
      : null,
    navigationCount: routerState.navigationCount,
    historyLength: routeHistory.length,
    activeFeatureId:
      getFeatureControllerState().activeFeatureId,
    lastError: routerState.lastError
      ? { ...routerState.lastError }
      : null,
  };
}

/**
 * Reset state router untuk testing.
 *
 * Tidak menghapus fitur dari registry atau database.
 */
export function resetFeatureRouterState() {
  routerState.initialized = false;
  routerState.currentRoute = null;
  routerState.previousRoute = null;
  routerState.navigationCount = 0;
  routerState.lastError = null;

  routeHistory.length = 0;
  routeListeners.clear();
}

/**
 * API publik.
 */
const FeatureRouter = Object.freeze({
  initialize: initializeFeatureRouter,
  navigate: navigateToFeature,
  back: navigateBack,
  previous: navigateToPrevious,
  find: findFeatureRoutes,
  getCurrent: getCurrentRoute,
  getHistory: getRouteHistory,
  getFeatureRoute,
  getState: getFeatureRouterState,
  subscribe: subscribeFeatureRouter,
  reset: resetFeatureRouterState,
});

export default FeatureRouter;
