
/**
 * KANTOONG CORE
 * File: frontend/dashboard-user/core/feature-state.js
 *
 * Tanggung jawab:
 * 1. Menyimpan state global dan state masing-masing fitur.
 * 2. Mendukung get, set, update, dan reset state.
 * 3. Memberi tahu subscriber ketika state berubah.
 * 4. Mendukung namespace agar state fitur tidak tercampur.
 * 5. Mendukung transaksi update sederhana.
 * 6. Menyediakan API yang bisa digunakan UI, fitur, dan AI adapter.
 *
 * CATATAN:
 * - State disimpan di memori.
 * - State tidak otomatis tersimpan ke database.
 * - Jangan menyimpan token rahasia atau data sensitif di sini.
 */

const stateStore = new Map();
const subscribers = new Map();
const transactionDepth = new Map();

const RESERVED_GLOBAL_NAMESPACE = "global";

/**
 * Menormalisasi nama namespace atau key.
 */
function normalizeKey(value, label = "key") {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(
      `${label} harus berupa string yang tidak kosong.`
    );
  }

  return value.trim();
}

/**
 * Membuat state awal untuk namespace.
 */
function ensureNamespace(namespace) {
  const normalizedNamespace = normalizeKey(
    namespace,
    "namespace"
  );

  if (!stateStore.has(normalizedNamespace)) {
    stateStore.set(normalizedNamespace, new Map());
  }

  if (!subscribers.has(normalizedNamespace)) {
    subscribers.set(normalizedNamespace, new Set());
  }

  if (!transactionDepth.has(normalizedNamespace)) {
    transactionDepth.set(normalizedNamespace, 0);
  }

  return normalizedNamespace;
}

/**
 * Mengambil Map state untuk namespace.
 */
function getNamespaceStore(namespace) {
  const normalizedNamespace = ensureNamespace(namespace);

  return stateStore.get(normalizedNamespace);
}

/**
 * Membuat salinan dangkal state berbentuk object.
 *
 * Ini bukan deep clone. Untuk state bertingkat,
 * gunakan update immutable dan hindari mengubah object
 * yang sudah tersimpan secara langsung.
 */
function namespaceToObject(namespace) {
  const store = getNamespaceStore(namespace);

  return Object.fromEntries(store.entries());
}

/**
 * Memberi tahu subscriber tentang perubahan state.
 */
function notifySubscribers(namespace, change) {
  if ((transactionDepth.get(namespace) ?? 0) > 0) {
    return;
  }

  const listeners = subscribers.get(namespace);

  if (!listeners) {
    return;
  }

  const event = Object.freeze({
    namespace,
    ...change,
    timestamp: new Date().toISOString(),
  });

  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.error(
        "[KANTOONG FeatureState] Subscriber gagal:",
        error
      );
    }
  }
}

/**
 * Mengambil nilai state.
 *
 * getState("profile", "data")
 */
export function getState(namespace, key) {
  const store = getNamespaceStore(namespace);
  const normalizedKey = normalizeKey(key);

  return store.get(normalizedKey);
}

/**
 * Memeriksa apakah key tersedia di namespace.
 */
export function hasState(namespace, key) {
  const store = getNamespaceStore(namespace);
  const normalizedKey = normalizeKey(key);

  return store.has(normalizedKey);
}

/**
 * Mengatur nilai state.
 *
 * setState("profile", "loading", true)
 */
export function setState(namespace, key, value) {
  const normalizedNamespace = ensureNamespace(namespace);
  const normalizedKey = normalizeKey(key);

  const store = stateStore.get(normalizedNamespace);
  const previousValue = store.get(normalizedKey);
  const existed = store.has(normalizedKey);

  if (existed && Object.is(previousValue, value)) {
    return value;
  }

  store.set(normalizedKey, value);

  notifySubscribers(normalizedNamespace, {
    type: "state:changed",
    key: normalizedKey,
    value,
    previousValue,
  });

  return value;
}

/**
 * Menghapus satu key state.
 */
export function deleteState(namespace, key) {
  const normalizedNamespace = ensureNamespace(namespace);
  const normalizedKey = normalizeKey(key);

  const store = stateStore.get(normalizedNamespace);

  if (!store.has(normalizedKey)) {
    return false;
  }

  const previousValue = store.get(normalizedKey);

  store.delete(normalizedKey);

  notifySubscribers(normalizedNamespace, {
    type: "state:deleted",
    key: normalizedKey,
    previousValue,
  });

  return true;
}

/**
 * Mengambil seluruh state dari satu namespace.
 */
export function getNamespaceState(namespace) {
  return namespaceToObject(namespace);
}

/**
 * Mengatur beberapa key sekaligus.
 *
 * setNamespaceState("profile", {
 *   loading: false,
 *   data: profileData
 * })
 */
export function setNamespaceState(namespace, values = {}) {
  if (
    !values ||
    typeof values !== "object" ||
    Array.isArray(values)
  ) {
    throw new TypeError(
      "values harus berupa object."
    );
  }

  const normalizedNamespace = ensureNamespace(namespace);
  const store = stateStore.get(normalizedNamespace);
  const changes = [];

  for (const [key, value] of Object.entries(values)) {
    const normalizedKey = normalizeKey(key);

    const existed = store.has(normalizedKey);
    const previousValue = store.get(normalizedKey);

    if (existed && Object.is(previousValue, value)) {
      continue;
    }

    store.set(normalizedKey, value);

    changes.push({
      key: normalizedKey,
      value,
      previousValue,
    });
  }

  if (changes.length > 0) {
    notifySubscribers(normalizedNamespace, {
      type: "state:batch-changed",
      changes,
      state: namespaceToObject(normalizedNamespace),
    });
  }

  return namespaceToObject(normalizedNamespace);
}

/**
 * Memperbarui state berdasarkan nilai sebelumnya.
 *
 * updater dapat berupa object atau function.
 */
export function updateState(
  namespace,
  updater
) {
  const currentState = getNamespaceState(namespace);

  const nextState =
    typeof updater === "function"
      ? updater({ ...currentState })
      : updater;

  if (
    !nextState ||
    typeof nextState !== "object" ||
    Array.isArray(nextState)
  ) {
    throw new TypeError(
      "Updater harus menghasilkan object state."
    );
  }

  return setNamespaceState(namespace, nextState);
}

/**
 * Mengosongkan semua key dalam namespace.
 */
export function clearNamespaceState(namespace) {
  const normalizedNamespace = ensureNamespace(namespace);
  const store = stateStore.get(normalizedNamespace);

  if (store.size === 0) {
    return false;
  }

  const previousState = namespaceToObject(normalizedNamespace);

  store.clear();

  notifySubscribers(normalizedNamespace, {
    type: "state:cleared",
    previousState,
  });

  return true;
}

/**
 * Reset namespace ke nilai awal.
 */
export function resetNamespaceState(
  namespace,
  initialState = {}
) {
  if (
    !initialState ||
    typeof initialState !== "object" ||
    Array.isArray(initialState)
  ) {
    throw new TypeError(
      "initialState harus berupa object."
    );
  }

  const normalizedNamespace = ensureNamespace(namespace);
  const store = stateStore.get(normalizedNamespace);
  const previousState = namespaceToObject(normalizedNamespace);

  store.clear();

  for (const [key, value] of Object.entries(initialState)) {
    store.set(normalizeKey(key), value);
  }

  notifySubscribers(normalizedNamespace, {
    type: "state:reset",
    previousState,
    state: namespaceToObject(normalizedNamespace),
  });

  return namespaceToObject(normalizedNamespace);
}

/**
 * Berlangganan perubahan state dalam satu namespace.
 *
 * Mengembalikan fungsi unsubscribe.
 */
export function subscribeState(namespace, listener) {
  const normalizedNamespace = ensureNamespace(namespace);

  if (typeof listener !== "function") {
    throw new TypeError(
      "Listener harus berupa function."
    );
  }

  const listeners = subscribers.get(normalizedNamespace);

  listeners.add(listener);

  return function unsubscribe() {
    return listeners.delete(listener);
  };
}

/**
 * Berlangganan perubahan satu key tertentu.
 */
export function subscribeStateKey(
  namespace,
  key,
  listener
) {
  const normalizedKey = normalizeKey(key);

  if (typeof listener !== "function") {
    throw new TypeError(
      "Listener harus berupa function."
    );
  }

  return subscribeState(namespace, (event) => {
    if (event.key === normalizedKey) {
      listener(event);
      return;
    }

    if (
      Array.isArray(event.changes) &&
      event.changes.some(
        (change) => change.key === normalizedKey
      )
    ) {
      listener(event);
      return;
    }

    // Perubahan/reset/clear memengaruhi key tersebut
    // meskipun event tidak memiliki satu key spesifik.
    if (
      event.type === "state:reset" ||
      event.type === "state:cleared"
    ) {
      listener(event);
    }
  });
}

/**
 * Transaksi update sederhana.
 *
 * Subscriber tidak diberi notifikasi selama transaksi.
 * Setelah transaksi selesai, satu event transaksi dikirim.
 *
 * Catatan: callback wajib sinkron. Ini bukan transaksi
 * database dan tidak menyediakan rollback otomatis.
 */
export function transactionState(
  namespace,
  callback
) {
  const normalizedNamespace = ensureNamespace(namespace);

  if (typeof callback !== "function") {
    throw new TypeError(
      "Callback transaksi harus berupa function."
    );
  }

  const before = namespaceToObject(normalizedNamespace);

  transactionDepth.set(
    normalizedNamespace,
    (transactionDepth.get(normalizedNamespace) ?? 0) + 1
  );

  let result;

  try {
    result = callback({
      get: (key) => getState(normalizedNamespace, key),
      set: (key, value) =>
        setState(normalizedNamespace, key, value),
      delete: (key) =>
        deleteState(normalizedNamespace, key),
      getAll: () => namespaceToObject(normalizedNamespace),
      update: (updater) =>
        updateState(normalizedNamespace, updater),
    });

    if (result && typeof result.then === "function") {
      throw new TypeError(
        "transactionState hanya menerima callback sinkron."
      );
    }
  } catch (error) {
    // Pulihkan snapshot jika callback gagal.
    const store = stateStore.get(normalizedNamespace);

    store.clear();

    for (const [key, value] of Object.entries(before)) {
      store.set(key, value);
    }

    throw error;
  } finally {
    const nextDepth = Math.max(
      0,
      (transactionDepth.get(normalizedNamespace) ?? 1) - 1
    );

    transactionDepth.set(normalizedNamespace, nextDepth);

    if (nextDepth === 0) {
      const after = namespaceToObject(normalizedNamespace);

      notifySubscribers(normalizedNamespace, {
        type: "state:transaction",
        previousState: before,
        state: after,
      });
    }
  }

  return result;
}

/**
 * Mengambil ringkasan state yang tersedia.
 *
 * Tidak mengembalikan isi nilai state.
 */
export function getFeatureStateSummary() {
  const namespaces = [];

  for (const [namespace, store] of stateStore.entries()) {
    namespaces.push({
      namespace,
      keyCount: store.size,
      subscriberCount:
        subscribers.get(namespace)?.size ?? 0,
    });
  }

  return {
    namespaceCount: namespaces.length,
    totalKeys: namespaces.reduce(
      (total, item) => total + item.keyCount,
      0
    ),
    namespaces,
  };
}

/**
 * Menghapus seluruh state dan subscriber dalam memori.
 * Gunakan hanya saat reset atau pengujian.
 */
export function resetAllFeatureState() {
  stateStore.clear();
  subscribers.clear();
  transactionDepth.clear();
}

/**
 * API publik.
 */
const FeatureState = Object.freeze({
  get: getState,
  has: hasState,
  set: setState,
  delete: deleteState,
  getNamespace: getNamespaceState,
  setNamespace: setNamespaceState,
  update: updateState,
  clearNamespace: clearNamespaceState,
  resetNamespace: resetNamespaceState,
  subscribe: subscribeState,
  subscribeKey: subscribeStateKey,
  transaction: transactionState,
  getSummary: getFeatureStateSummary,
  resetAll: resetAllFeatureState,
  globalNamespace: RESERVED_GLOBAL_NAMESPACE,
});

export default FeatureState;
