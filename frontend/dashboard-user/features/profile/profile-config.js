
/**
 * ============================================================
 * KANTOONG CORE — PROFILE CONFIG
 * File: frontend/dashboard-user/features/profile/profile-config.js
 *
 * Tanggung jawab:
 * - Menyediakan konfigurasi default Profile.
 * - Memisahkan pengaturan UI dari logika fitur.
 * - Menentukan informasi profil yang ditampilkan.
 * - Menyediakan opsi fitur yang dapat diatur per tenant.
 *
 * Prinsip:
 * - Tidak menyimpan data pribadi pengguna.
 * - Tidak menaruh rahasia atau API key di frontend.
 * - Tidak mengandung branding khusus milik klien.
 * ============================================================
 */

const DEFAULT_PROFILE_CONFIG = {
  version: "1.0.0",

  feature: {
    id: "profile",
    enabled: true,
    editable: true,
  },

  cardPreview: {
    // Placeholder netral sampai data profil aktual disambungkan ke auth/API.
    name: "Nama User",
    work: "Tambahkan pekerjaan",
    bio: "Tambahkan bio singkat agar orang lain mengenalmu.",
    avatarUrl: "",
    followers: "00",
    posts: "00",
    actionLabel: "Lihat Profil",
    avatarAlt: "Foto profil pengguna",
  },

  display: {
    title: "Profil Saya",
    description: "Kelola informasi dan identitas akun Anda.",
    eyebrow: "ACCOUNT CENTER",
    showAvatar: true,
    showEmail: true,
    showRole: true,
    showAccountStatus: true,
    showEditButton: true,
  },

  fields: {
    name: {
      enabled: true,
      label: "Nama",
      editable: true,
      required: true,
      maxLength: 100,
    },

    email: {
      enabled: true,
      label: "Email",
      editable: false,
      required: true,
      maxLength: 254,
    },

    role: {
      enabled: true,
      label: "Role",
      editable: false,
    },

    avatarUrl: {
      enabled: true,
      label: "Foto profil",
      editable: true,
    },
  },

  actions: {
    editProfile: {
      enabled: true,
      label: "Edit profil",
    },

    changePassword: {
      enabled: false,
      label: "Ubah kata sandi",
    },

    signOut: {
      enabled: false,
      label: "Keluar",
    },
  },

  messages: {
    loading: "Memuat informasi profil...",
    unavailable:
      "Informasi akun akan ditampilkan setelah autentikasi tersedia.",
    noEmail: "Email belum tersedia",
    noRole: "Role belum tersedia",
    editUnavailable:
      "Fitur edit profil belum terhubung ke backend.",
    updateSuccess: "Profil berhasil diperbarui.",
    updateError: "Profil gagal diperbarui. Silakan coba kembali.",
  },

  security: {
    requireAuthentication: true,
    allowClientSidePersistence: false,
    allowUntrustedProfileUpdates: false,
  },
};

/**
 * Memastikan konfigurasi berupa objek biasa.
 */
function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

/**
 * Menggabungkan konfigurasi secara rekursif.
 * Array dan nilai primitif akan diganti, bukan digabung.
 */
function mergeConfig(base, overrides) {
  const result = { ...base };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      continue;
    }

    if (isPlainObject(value) && isPlainObject(base[key])) {
      result[key] = mergeConfig(base[key], value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Memvalidasi konfigurasi sebelum digunakan.
 */
function validateProfileConfig(config) {
  if (!isPlainObject(config)) {
    throw new TypeError(
      "[KANTOONG Profile] Konfigurasi harus berupa objek."
    );
  }

  if (config.feature?.id !== "profile") {
    throw new Error(
      '[KANTOONG Profile] feature.id harus bernilai "profile".'
    );
  }

  if (typeof config.feature.enabled !== "boolean") {
    throw new TypeError(
      "[KANTOONG Profile] feature.enabled harus boolean."
    );
  }

  if (typeof config.security?.requireAuthentication !== "boolean") {
    throw new TypeError(
      "[KANTOONG Profile] Pengaturan autentikasi tidak valid."
    );
  }

  for (const [fieldName, field] of Object.entries(config.fields ?? {})) {
    if (!isPlainObject(field)) {
      throw new TypeError(
        `[KANTOONG Profile] Konfigurasi field "${fieldName}" tidak valid.`
      );
    }

    if (typeof field.enabled !== "boolean") {
      throw new TypeError(
        `[KANTOONG Profile] fields.${fieldName}.enabled harus boolean.`
      );
    }

    if (
      field.editable !== undefined &&
      typeof field.editable !== "boolean"
    ) {
      throw new TypeError(
        `[KANTOONG Profile] fields.${fieldName}.editable harus boolean.`
      );
    }
  }

  return config;
}

/**
 * Membekukan konfigurasi secara rekursif.
 * Mencegah konfigurasi default berubah tanpa sengaja.
 */
function deepFreeze(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    Object.isFrozen(value)
  ) {
    return value;
  }

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

const frozenDefaults = deepFreeze(
  validateProfileConfig(
    mergeConfig(DEFAULT_PROFILE_CONFIG, {})
  )
);

/**
 * Menghasilkan konfigurasi Profile.
 *
 * overrides hanya untuk pengaturan frontend.
 * Jangan memasukkan token, kredensial, atau data rahasia.
 */
export function getProfileConfig(overrides = {}) {
  if (!isPlainObject(overrides)) {
    throw new TypeError(
      "[KANTOONG Profile] Overrides harus berupa objek."
    );
  }

  const config = mergeConfig(frozenDefaults, overrides);

  validateProfileConfig(config);

  return deepFreeze(config);
}

/**
 * Menyediakan konfigurasi default yang immutable.
 */
export const PROFILE_CONFIG = frozenDefaults;

export default PROFILE_CONFIG;
