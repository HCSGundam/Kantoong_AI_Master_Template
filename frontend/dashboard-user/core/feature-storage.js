
/**
 * KANTOONG CORE
 * File: frontend/dashboard-user/core/feature-storage.js
 *
 * Tanggung jawab:
 * 1. Menyimpan preferensi fitur di browser.
 * 2. Memisahkan data berdasarkan namespace.
 * 3. Menyediakan operasi get, set, remove, dan clear.
 * 4. Menangani data JSON dengan aman.
 * 5. Mendukung TTL (masa berlaku data).
 * 6. Menyediakan fallback ketika storage tidak tersedia.
 *
 * CATATAN KEAMANAN:
 * - localStorage bukan tempat penyimpanan rahasia.
 * - Jangan simpan password, access token, session token,
 *   data pembayaran, atau data sensitif pelanggan di sini.
 * - Data bisnis penting harus tetap disimpan di backend.
 */

const STORAGE_PREFIX = "kantoong-core";
const STORAGE_VERSION = 1;

const memoryFallback = new Map();

/**
 * Memastikan nama namespace atau key valid.
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
 * Membuat nama key yang konsisten dan terisolasi
 * berdasarkan namespace.
 */
function makeStorageKey(namespace, key) {
  const safeNamespace = normalizeKey(
    namespace,
    "namespace"
  );

  const safeKey = normalizeKey(key);

  return [
    STORAGE_PREFIX,
    `v${STORAGE_VERSION}`,
    encodeURIComponent(safeNamespace),
    encodeURIComponent(safeKey),
  ].join(":");
}

/**
 * Memeriksa apakah localStorage tersedia.
 */
function getBrowserStorage() {
  try {
    if (typeof window === "undefined") {
      return null;
    }

    const storage = window.localStorage;
    const testKey = `${STORAGE_PREFIX}:storage-test`;

    storage.setItem(testKey, "1");
    storage.removeItem(testKey);

    return storage;
  } catch {
    return null;
  }
}

/**
 * Mengirim event perubahan storage.
 *
 * Event ini membantu komponen lain mengetahui perubahan
 * yang dilakukan melalui modul storage ini.
 */
function emitStorageEvent(type, detail = {}) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.dispatchEvent(
      new CustomEvent("kantoong:storage", {
        detail: {
          type,
          ...detail,
          timestamp: new Date().toISOString(),
        },
      })
    );
  } catch {
    // Storage tidak boleh gagal hanya karena event gagal.
  }
}

/**
 * Membaca record dari storage.
 */
function readRecord(storageKey) {
  const storage = getBrowserStorage();

  try {
    let rawValue;

    if (storage) {
      rawValue = storage.getItem(storageKey);
    } else {
      rawValue = memoryFallback.get(storageKey) ?? null;
    }

    if (rawValue === null || rawValue === undefined) {
      return null;
    }

    const record = JSON.parse(rawValue);

    if (
      !record ||
      typeof record !== "object" ||
      record.version !== STORAGE_VERSION ||
      !Object.prototype.hasOwnProperty.call(record, "value")
    ) {
      removeRaw(storageKey);
      return null;
    }

    if (
      typeof record.expiresAt === "number" &&
      Date.now() >= record.expiresAt
    ) {
      removeRaw(storageKey);
      return null;
    }

    return record;
  } catch {
    // Record rusak tidak boleh menghentikan aplikasi.
    removeRaw(storageKey);
    return null;
  }
}

/**
 * Menulis string mentah ke storage.
 */
function writeRaw(storageKey, rawValue) {
  const storage = getBrowserStorage();

  try {
    if (storage) {
      storage.setItem(storageKey, rawValue);
      memoryFallback.delete(storageKey);
      return {
        persisted: true,
        backend: "localStorage",
      };
    }

    memoryFallback.set(storageKey, rawValue);

    return {
      persisted: false,
      backend: "memory",
      reason: "BROWSER_STORAGE_UNAVAILABLE",
    };
  } catch (error) {
    // Jika localStorage penuh atau diblokir,
    // coba fallback ke memori selama halaman aktif.
    memoryFallback.set(storageKey, rawValue);

    return {
      persisted: false,
      backend: "memory",
      reason: "STORAGE_WRITE_FAILED",
      message:
        error instanceof Error
          ? error.message
          : "Penyimpanan browser gagal.",
    };
  }
}

/**
 * Menghapus record dari storage dan fallback.
 */
function removeRaw(storageKey) {
  const storage = getBrowserStorage();

  try {
    if (storage) {
      storage.removeItem(storageKey);
    }
  } catch {
    // Lanjutkan pembersihan fallback.
  }

  memoryFallback.delete(storageKey);
}

/**
 * Menyimpan data dengan namespace dan key.
 *
 * options:
 * {
 *   ttlMs: 3600000
 * }
 *
 * TTL dihitung dalam milidetik.
 */
export function setFeatureStorage(
  namespace,
  key,
  value,
  options = {}
) {
  const storageKey = makeStorageKey(namespace, key);

  let serializedValue;

  try {
    serializedValue = JSON.stringify(value);
  } catch (error) {
    throw new TypeError(
      `Data tidak dapat diserialisasi ke JSON: ${
        error instanceof Error
          ? error.message
          : "format data tidak valid"
      }`
    );
  }

  if (serializedValue === undefined) {
    throw new TypeError(
      "Nilai undefined tidak dapat disimpan."
    );
  }

  const ttlMs = options.ttlMs;

  if (
    ttlMs !== undefined &&
    (
      typeof ttlMs !== "number" ||
      !Number.isFinite(ttlMs) ||
      ttlMs <= 0
    )
  ) {
    throw new TypeError(
      "ttlMs harus berupa angka positif."
    );
  }

  const now = Date.now();

  const record = {
    version: STORAGE_VERSION,
    createdAt: now,
    expiresAt:
      ttlMs === undefined
        ? null
        : now + ttlMs,
    value: JSON.parse(serializedValue),
  };

  const result = writeRaw(
    storageKey,
    JSON.stringify(record)
  );

  emitStorageEvent("storage:set", {
    namespace,
    key,
    persisted: result.persisted,
    backend: result.backend,
  });

  return result;
}

/**
 * Membaca data yang disimpan.
 *
 * Mengembalikan defaultValue jika data tidak ditemukan
 * atau sudah kedaluwarsa.
 */
export function getFeatureStorage(
  namespace,
  key,
  defaultValue = null
) {
  const storageKey = makeStorageKey(namespace, key);
  const record = readRecord(storageKey);

  return record ? record.value : defaultValue;
}

/**
 * Memeriksa apakah data tersedia dan belum kedaluwarsa.
 */
export function hasFeatureStorage(namespace, key) {
  const storageKey = makeStorageKey(namespace, key);

  return readRecord(storageKey) !== null;
}

/**
 * Menghapus satu data.
 */
export function removeFeatureStorage(namespace, key) {
  const storageKey = makeStorageKey(namespace, key);

  const existed = hasFeatureStorage(namespace, key);

  removeRaw(storageKey);

  emitStorageEvent("storage:remove", {
    namespace,
    key,
  });

  return existed;
}

/**
 * Mengambil semua data dalam namespace.
 *
 * Hanya membaca key yang menggunakan prefix modul ini.
 */
export function getFeatureStorageNamespace(namespace) {
  const safeNamespace = normalizeKey(
    namespace,
    "namespace"
  );

  const namespacePrefix = [
    STORAGE_PREFIX,
    `v${STORAGE_VERSION}`,
    encodeURIComponent(safeNamespace),
    "",
  ].join(":");

  const storage = getBrowserStorage();
  const output = {};

  if (storage) {
    try {
      const keys = [];

      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);

        if (key && key.startsWith(namespacePrefix)) {
          keys.push(key);
        }
      }

      for (const storageKey of keys) {
        const encodedKey = storageKey.slice(
          namespacePrefix.length
        );

        try {
          const key = decodeURIComponent(encodedKey);
          const record = readRecord(storageKey);

          if (record) {
            output[key] = record.value;
          }
        } catch {
          // Abaikan key yang tidak valid.
        }
      }
    } catch {
      // Lanjutkan dengan fallback memori.
    }
  }

  // Tambahkan data fallback yang mungkin belum persisten.
  for (const [storageKey] of memoryFallback.entries()) {
    if (!storageKey.startsWith(namespacePrefix)) {
      continue;
    }

    const encodedKey = storageKey.slice(
      namespacePrefix.length
    );

    try {
      const key = decodeURIComponent(encodedKey);
      const record = readRecord(storageKey);

      if (record) {
        output[key] = record.value;
      }
    } catch {
      // Abaikan data fallback yang rusak.
    }
  }

  return output;
}

/**
 * Menghapus seluruh data dalam satu namespace.
 */
export function clearFeatureStorageNamespace(namespace) {
  const safeNamespace = normalizeKey(
    namespace,
    "namespace"
  );

  const namespacePrefix = [
    STORAGE_PREFIX,
    `v${STORAGE_VERSION}`,
    encodeURIComponent(safeNamespace),
    "",
  ].join(":");

  const keysToRemove = new Set();
  const storage = getBrowserStorage();

  if (storage) {
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);

        if (key && key.startsWith(namespacePrefix)) {
          keysToRemove.add(key);
        }
      }
    } catch {
      // Tetap bersihkan fallback di bawah.
    }
  }

  for (const key of memoryFallback.keys()) {
    if (key.startsWith(namespacePrefix)) {
      keysToRemove.add(key);
    }
  }

  for (const key of keysToRemove) {
    removeRaw(key);
  }

  emitStorageEvent("storage:namespace-cleared", {
    namespace: safeNamespace,
    removedCount: keysToRemove.size,
  });

  return keysToRemove.size;
}

/**
 * Menghapus seluruh data milik modul ini.
 *
 * Tidak menghapus data aplikasi lain atau data
 * localStorage yang tidak menggunakan prefix KANTOONG.
 */
export function clearAllFeatureStorage() {
  const storage = getBrowserStorage();
  const keysToRemove = new Set();

  if (storage) {
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);

        if (
          key &&
          key.startsWith(`${STORAGE_PREFIX}:`)
        ) {
          keysToRemove.add(key);
        }
      }
    } catch {
      // Tetap lanjutkan pembersihan fallback.
    }
  }

  for (const key of memoryFallback.keys()) {
    if (key.startsWith(`${STORAGE_PREFIX}:`)) {
      keysToRemove.add(key);
    }
  }

  for (const key of keysToRemove) {
    removeRaw(key);
  }

  emitStorageEvent("storage:cleared", {
    removedCount: keysToRemove.size,
  });

  return keysToRemove.size;
}

/**
 * Mengambil metadata satu record tanpa mengembalikan nilainya.
 */
export function getFeatureStorageMetadata(
  namespace,
  key
) {
  const storageKey = makeStorageKey(namespace, key);
  const record = readRecord(storageKey);

  if (!record) {
    return null;
  }

  return {
    namespace,
    key,
    version: record.version,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    expired: false,
  };
}

/**
 * Ringkasan penggunaan storage.
 *
 * Tidak mengembalikan nilai data yang tersimpan.
 */
export function getFeatureStorageSummary() {
  const storage = getBrowserStorage();
  const keys = new Set();

  if (storage) {
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);

        if (
          key &&
          key.startsWith(`${STORAGE_PREFIX}:`)
        ) {
          keys.add(key);
        }
      }
    } catch {
      // Abaikan kegagalan pembacaan metadata.
    }
  }

  for (const key of memoryFallback.keys()) {
    if (key.startsWith(`${STORAGE_PREFIX}:`)) {
      keys.add(key);
    }
  }

  return {
    prefix: STORAGE_PREFIX,
    version: STORAGE_VERSION,
    entryCount: keys.size,
    backendAvailable: storage !== null,
    fallbackEntryCount: memoryFallback.size,
  };
}

/**
 * API publik.
 */
const FeatureStorage = Object.freeze({
  set: setFeatureStorage,
  get: getFeatureStorage,
  has: hasFeatureStorage,
  remove: removeFeatureStorage,
  getNamespace: getFeatureStorageNamespace,
  clearNamespace: clearFeatureStorageNamespace,
  clearAll: clearAllFeatureStorage,
  getMetadata: getFeatureStorageMetadata,
  getSummary: getFeatureStorageSummary,
});

export default FeatureStorage;
