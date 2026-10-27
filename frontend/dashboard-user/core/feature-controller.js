
/**
 * KANTOONG CORE
 * File: frontend/dashboard-user/core/feature-controller.js
 *
 * Tanggung jawab:
 * 1. Menjadi penghubung antara registry, permission,
 *    lifecycle, dan fitur.
 * 2. Membuka, mengaktifkan, menonaktifkan, dan menutup fitur.
 * 3. Menjalankan aksi milik fitur.
 * 4. Memastikan akses diperiksa sebelum fitur dibuka.
 * 5. Menyediakan API seragam untuk dashboard dan AI Agent.
 * 6. Menyimpan konteks eksekusi tanpa mengikat controller
 *    pada tampilan tertentu.
 *
 * CATATAN:
 * - Controller frontend bukan batas keamanan backend.
 * - Operasi sensitif tetap harus divalidasi server.
 */

import {
  getFeature,
  getAllFeatures,
} from "./feature-registry.js";

import {
  canAccessFeature,
} from "./feature-permission.js";

import {
  initializeFeature,
  mountFeature,
  activateFeature,
  deactivateFeature,
  unmountFeature,
  getFeatureLifecycleState,
} from "./feature-lifecycle.js";

const controllerState = {
  initialized: false,
  context: {},
  activeFeatureId: null,
  lastAction: null,
  lastError: null,
};

const actionHandlers = new Map();
const controllerListeners = new Set();

/**
 * Normalisasi ID fitur dan aksi.
 */
function normalizeId(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

/**
 * Membuat error dengan kode yang bisa ditangani UI.
 */
function createControllerError(code, message, details = {}) {
  const error = new Error(message);

  error.name = "FeatureControllerError";
  error.code = code;
  error.details = details;

  return error;
}

/**
 * Mengirim informasi perubahan state ke subscriber.
 */
function emitControllerEvent(type, detail = {}) {
  const event = Object.freeze({
    type,
    detail,
    timestamp: new Date().toISOString(),
  });

  for (const listener of controllerListeners) {
    try {
      listener(event);
    } catch (error) {
      console.error(
        "[KANTOONG FeatureController] Listener gagal:",
        error
      );
    }
  }

  return event;
}

/**
 * Memperbarui konteks eksekusi controller.
 *
 * Contoh:
 * setControllerContext({
 *   user: {
 *     id: "user-uuid",
 *     authenticated: true,
 *     roles: ["customer"],
 *     permissions: []
 *   },
 *   rootElement: document.querySelector("#dashboardRoot")
 * });
 *
 * Pastikan data autentikasi dan role berasal dari sumber
 * yang telah diverifikasi, bukan input pengguna mentah.
 */
export function setControllerContext(context = {}) {
  if (!context || typeof context !== "object") {
    throw new TypeError(
      "Controller context harus berupa object."
    );
  }

  controllerState.context = {
    ...controllerState.context,
    ...context,
  };

  emitControllerEvent("context:updated", {
    hasUser: Boolean(controllerState.context.user),
    hasRootElement: Boolean(
      controllerState.context.rootElement
    ),
  });

  return getControllerContext();
}

/**
 * Mengambil salinan dangkal dari konteks.
 */
export function getControllerContext() {
  return {
    ...controllerState.context,
  };
}

/**
 * Inisialisasi controller.
 */
export function initializeFeatureController(
  options = {}
) {
  if (controllerState.initialized && !options.force) {
    return getFeatureControllerState();
  }

  if (options.context) {
    setControllerContext(options.context);
  }

  controllerState.initialized = true;
  controllerState.lastError = null;

  emitControllerEvent("controller:initialized");

  return getFeatureControllerState();
}

/**
 * Memastikan fitur terdaftar.
 */
function resolveFeature(featureId) {
  const id = normalizeId(featureId);

  if (!id) {
    throw createControllerError(
      "INVALID_FEATURE_ID",
      "ID fitur tidak valid."
    );
  }

  const feature = getFeature(id);

  if (!feature) {
    throw createControllerError(
      "FEATURE_NOT_FOUND",
      `Fitur "${id}" tidak ditemukan di registry.`,
      { featureId: id }
    );
  }

  return feature;
}

/**
 * Menyiapkan context khusus untuk sebuah fitur.
 */
function createFeatureContext(feature, overrides = {}) {
  return {
    ...controllerState.context,
    ...overrides,
    feature,
    featureId: feature.id,
    controller: FeatureController,
    emit: (type, detail = {}) =>
      emitControllerEvent(type, {
        featureId: feature.id,
        ...detail,
      }),
  };
}

/**
 * Memeriksa izin sebelum melakukan operasi fitur.
 */
async function assertFeatureAccess(feature, context) {
  const result = await canAccessFeature(
    feature,
    context
  );

  if (!result.allowed) {
    emitControllerEvent("feature:access-denied", {
      featureId: feature.id,
      reason: result.reason,
    });

    throw createControllerError(
      "FEATURE_ACCESS_DENIED",
      `Akses ke fitur "${feature.id}" ditolak.`,
      {
        featureId: feature.id,
        reason: result.reason,
      }
    );
  }

  return result;
}

/**
 * Menjalankan inisialisasi fitur jika diperlukan.
 */
export async function prepareFeature(
  featureId,
  options = {}
) {
  const feature = resolveFeature(featureId);
  const context = createFeatureContext(
    feature,
    options.context
  );

  await assertFeatureAccess(feature, context);

  const lifecycleState = getFeatureLifecycleState(
    feature.id
  );

  if (!lifecycleState) {
    // Pendaftaran lifecycle dilakukan eksplisit oleh controller.
    const { registerFeatureLifecycle } = await import(
      "./feature-lifecycle.js"
    );

    registerFeatureLifecycle(feature);
  }

  const result = await initializeFeature(
    feature,
    context
  );

  emitControllerEvent("feature:prepared", {
    featureId: feature.id,
  });

  return {
    feature,
    result,
  };
}

/**
 * Membuka dan memasang fitur pada target element.
 *
 * options:
 * {
 *   element: HTMLElement,
 *   context: object,
 *   activate: true
 * }
 */

export async function openFeature(
  featureId,
  options = {}
) {
  const feature = resolveFeature(featureId);

  if (
    feature.enabled === false ||
    feature.status === "disabled" ||
    feature.status === "deprecated"
  ) {
    throw createControllerError(
      "FEATURE_DISABLED",
      `Fitur "${feature.id}" tidak tersedia.`,
      { featureId: feature.id }
    );
  }

  const targetElement =
    options.element ??
    options.context?.rootElement ??
    controllerState.context.rootElement ??
    null;

  if (!targetElement) {
    throw createControllerError(
      "MOUNT_TARGET_REQUIRED",
      "Target element wajib diberikan untuk membuka fitur.",
      { featureId: feature.id }
    );
  }

  const context = createFeatureContext(feature, {
    ...options.context,
    element: targetElement,
    rootElement: targetElement,
  });

  await assertFeatureAccess(feature, context);

  // Siapkan lifecycle sebelum mount.
  let lifecycleState = getFeatureLifecycleState(
    feature.id
  );

  if (!lifecycleState) {
    const { registerFeatureLifecycle } = await import(
      "./feature-lifecycle.js"
    );

    registerFeatureLifecycle(feature);
  }

  await initializeFeature(feature, context);

  // Jika ada fitur aktif lain, nonaktifkan terlebih dahulu.
  const previousFeatureId =
    controllerState.activeFeatureId;

  if (
    previousFeatureId &&
    previousFeatureId !== feature.id
  ) {
    await closeFeature(previousFeatureId, {
      unmount: false,
      context: options.context,
    });
  }

  await mountFeature(feature, targetElement, context);

  if (options.activate !== false) {
    await activateFeature(feature, context);
    controllerState.activeFeatureId = feature.id;
  }

  emitControllerEvent("feature:opened", {
    featureId: feature.id,
    active: options.activate !== false,
  });

  return {
    featureId: feature.id,
    mounted: true,
    active: options.activate !== false,
    lifecycle: getFeatureLifecycleState(feature.id),
  };
}

/**
 * Menutup atau menonaktifkan fitur.
 *
 * unmount: true  -> lepaskan fitur dari DOM.
 * unmount: false -> pertahankan mount untuk penggunaan ulang.
 */
export async function closeFeature(
  featureId,
  options = {}
) {
  const feature = resolveFeature(featureId);
  const context = createFeatureContext(
    feature,
    options.context
  );

  const lifecycleState = getFeatureLifecycleState(
    feature.id
  );

  if (!lifecycleState) {
    return {
      featureId: feature.id,
      closed: true,
      skipped: true,
    };
  }

  if (
    lifecycleState.status === "active" ||
    lifecycleState.status === "activating"
  ) {
    await deactivateFeature(feature, context);
  }

  if (options.unmount !== false) {
    await unmountFeature(feature, context);
  }

  if (controllerState.activeFeatureId === feature.id) {
    controllerState.activeFeatureId = null;
  }

  emitControllerEvent("feature:closed", {
    featureId: feature.id,
    unmounted: options.unmount !== false,
  });

  return {
    featureId: feature.id,
    closed: true,
    unmounted: options.unmount !== false,
  };
}

/**
 * Menjalankan aksi yang didefinisikan oleh fitur.
 *
 * Fitur dapat menyediakan:
 * feature.actions = {
 *   refresh: async (context) => { ... }
 * }
 *
 * Atau mendaftarkan handler melalui
 * registerFeatureAction().
 */
export async function executeFeatureAction(
  featureId,
  actionName,
  payload = {},
  options = {}
) {
  const feature = resolveFeature(featureId);
  const normalizedAction = normalizeId(actionName);

  if (!normalizedAction) {
    throw createControllerError(
      "INVALID_ACTION",
      "Nama aksi tidak valid."
    );
  }

  const context = createFeatureContext(
    feature,
    options.context
  );

  await assertFeatureAccess(feature, context);

  const handlerKey = `${feature.id}:${normalizedAction}`;
  const registeredHandler = actionHandlers.get(handlerKey);

  const featureActions =
    feature.actions &&
    typeof feature.actions === "object"
      ? feature.actions
      : {};

  const featureHandler =
    featureActions[normalizedAction];

  const handler = registeredHandler ?? featureHandler;

  if (typeof handler !== "function") {
    throw createControllerError(
      "ACTION_NOT_FOUND",
      `Aksi "${normalizedAction}" tidak tersedia pada fitur "${feature.id}".`,
      {
        featureId: feature.id,
        actionName: normalizedAction,
      }
    );
  }

  const actionContext = {
    ...context,
    payload,
    actionName: normalizedAction,
  };

  controllerState.lastAction = {
    featureId: feature.id,
    actionName: normalizedAction,
    startedAt: new Date().toISOString(),
  };

  emitControllerEvent("feature:action-started", {
    featureId: feature.id,
    actionName: normalizedAction,
  });

  try {
    const result = await handler(actionContext);

    controllerState.lastAction = {
      ...controllerState.lastAction,
      completedAt: new Date().toISOString(),
      success: true,
    };

    emitControllerEvent("feature:action-completed", {
      featureId: feature.id,
      actionName: normalizedAction,
    });

    return result;
  } catch (error) {
    controllerState.lastError = {
      featureId: feature.id,
      actionName: normalizedAction,
      message:
        error instanceof Error
          ? error.message
          : "Aksi fitur gagal.",
      timestamp: new Date().toISOString(),
    };

    emitControllerEvent("feature:action-failed", {
      featureId: feature.id,
      actionName: normalizedAction,
      message: controllerState.lastError.message,
    });

    throw error;
  }
}

/**
 * Mendaftarkan handler aksi eksternal.
 *
 * Cocok untuk menghubungkan UI, integrasi, atau
 * AI Agent melalui daftar aksi yang diizinkan.
 */
export function registerFeatureAction(
  featureId,
  actionName,
  handler,
  options = {}
) {
  const id = normalizeId(featureId);
  const action = normalizeId(actionName);

  if (!id || !action) {
    throw new TypeError(
      "featureId dan actionName wajib valid."
    );
  }

  if (typeof handler !== "function") {
    throw new TypeError(
      "Handler aksi harus berupa function."
    );
  }

  const key = `${id}:${action}`;

  if (actionHandlers.has(key) && !options.replace) {
    throw createControllerError(
      "ACTION_ALREADY_REGISTERED",
      `Handler "${key}" sudah terdaftar.`
    );
  }

  actionHandlers.set(key, handler);

  return function unregisterAction() {
    if (actionHandlers.get(key) !== handler) {
      return false;
    }

    actionHandlers.delete(key);
    return true;
  };
}

/**
 * Mengembalikan daftar fitur yang tersedia di registry.
 *
 * Daftar ini belum berarti semua fitur boleh diakses.
 * Izin tetap harus diperiksa sebelum setiap operasi.
 */
export function getControllerFeatures() {
  return getAllFeatures();
}

/**
 * Mengambil status controller.
 */
export function getFeatureControllerState() {
  return {
    initialized: controllerState.initialized,
    activeFeatureId: controllerState.activeFeatureId,
    lastAction: controllerState.lastAction
      ? { ...controllerState.lastAction }
      : null,
    lastError: controllerState.lastError
      ? { ...controllerState.lastError }
      : null,
  };
}

/**
 * Subscribe terhadap event controller.
 */
export function subscribeFeatureController(listener) {
  if (typeof listener !== "function") {
    throw new TypeError(
      "Listener harus berupa function."
    );
  }

  controllerListeners.add(listener);

  return function unsubscribe() {
    return controllerListeners.delete(listener);
  };
}

/**
 * Reset state controller untuk testing.
 *
 * Tidak menghapus registry atau data backend.
 */
export function resetFeatureControllerState() {
  controllerState.initialized = false;
  controllerState.context = {};
  controllerState.activeFeatureId = null;
  controllerState.lastAction = null;
  controllerState.lastError = null;

  actionHandlers.clear();
  controllerListeners.clear();
}

/**
 * API publik.
 */
const FeatureController = Object.freeze({
  initialize: initializeFeatureController,
  setContext: setControllerContext,
  getContext: getControllerContext,
  prepare: prepareFeature,
  open: openFeature,
  close: closeFeature,
  executeAction: executeFeatureAction,
  registerAction: registerFeatureAction,
  getFeatures: getControllerFeatures,
  getState: getFeatureControllerState,
  subscribe: subscribeFeatureController,
  reset: resetFeatureControllerState,
});

export default FeatureController;
