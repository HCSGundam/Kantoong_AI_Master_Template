
/**
 * ============================================================
 * KANTOONG CORE — PROFILE ACTIONS
 * File: frontend/dashboard-user/features/profile/profile-actions.js
 *
 * Tanggung jawab:
 * - Menyediakan fungsi aksi untuk fitur Profile.
 * - Menyiapkan kontrak pengambilan data profil.
 * - Menyiapkan alur permintaan edit profil.
 * - Memvalidasi input sebelum diproses.
 * - Mengirim event agar UI atau sistem lain dapat merespons.
 *
 * Keamanan:
 * - Tidak menganggap data dari frontend sebagai identitas tepercaya.
 * - Tidak menyimpan perubahan profil secara lokal sebagai data resmi.
 * - Tidak mengakses API atau database sebelum backend siap.
 * ============================================================
 */

const PROFILE_EVENT_PREFIX = "profile:";

/**
 * Membuat error dengan kode yang konsisten.
 */
function createProfileError(code, message, details = {}) {
  const error = new Error(message);

  error.name = "ProfileActionError";
  error.code = code;
  error.details = details;

  return error;
}

/**
 * Memastikan context tersedia.
 */
function validateContext(context) {
  if (!context || typeof context !== "object") {
    throw createProfileError(
      "INVALID_CONTEXT",
      "Context Profile tidak valid."
    );
  }

  return context;
}

/**
 * Mengambil identitas pengguna dari context aplikasi.
 *
 * Fungsi ini hanya membaca context frontend.
 * Identitas resmi tetap harus diverifikasi oleh backend.
 */
export function getProfile(context = {}) {
  validateContext(context);

  const user = context.currentUser ?? context.user ?? null;

  if (!user || typeof user !== "object") {
    return {
      available: false,
      profile: null,
      source: "context",
    };
  }

  const authenticated =
    user.authenticated === true ||
    user.isAuthenticated === true;

  if (!authenticated) {
    return {
      available: false,
      profile: null,
      source: "context",
    };
  }

  return {
    available: true,
    profile: {
      id: typeof user.id === "string" ? user.id : null,
      name:
        typeof user.name === "string"
          ? user.name
          : typeof user.fullName === "string"
            ? user.fullName
            : "",
      email: typeof user.email === "string" ? user.email : "",
      role: typeof user.role === "string" ? user.role : "",
      avatarUrl:
        typeof user.avatarUrl === "string"
          ? user.avatarUrl
          : "",
    },
    source: "context",
  };
}

/**
 * Memvalidasi data yang diajukan untuk perubahan profil.
 *
 * Belum melakukan penyimpanan.
 */
export function validateProfileUpdate(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createProfileError(
      "INVALID_PROFILE_INPUT",
      "Data perubahan profil harus berupa objek."
    );
  }

  const allowedFields = new Set([
    "name",
    "email",
    "avatarUrl",
  ]);

  const unknownFields = Object.keys(input).filter(
    (key) => !allowedFields.has(key)
  );

  if (unknownFields.length > 0) {
    throw createProfileError(
      "UNKNOWN_PROFILE_FIELDS",
      "Terdapat kolom profil yang tidak diizinkan.",
      { fields: unknownFields }
    );
  }

  const result = {};

  if (Object.hasOwn(input, "name")) {
    if (
      typeof input.name !== "string" ||
      input.name.trim().length < 2 ||
      input.name.trim().length > 100
    ) {
      throw createProfileError(
        "INVALID_PROFILE_NAME",
        "Nama harus terdiri dari 2–100 karakter."
      );
    }

    result.name = input.name.trim();
  }

  if (Object.hasOwn(input, "email")) {
    if (
      typeof input.email !== "string" ||
      input.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())
    ) {
      throw createProfileError(
        "INVALID_PROFILE_EMAIL",
        "Format email tidak valid."
      );
    }

    result.email = input.email.trim().toLowerCase();
  }

  if (Object.hasOwn(input, "avatarUrl")) {
    if (
      typeof input.avatarUrl !== "string" ||
      input.avatarUrl.length > 2048
    ) {
      throw createProfileError(
        "INVALID_AVATAR_URL",
        "URL avatar tidak valid."
      );
    }

    let url;

    try {
      url = new URL(input.avatarUrl);
    } catch {
      throw createProfileError(
        "INVALID_AVATAR_URL",
        "URL avatar harus berupa URL yang valid."
      );
    }

    if (url.protocol !== "https:") {
      throw createProfileError(
        "UNSAFE_AVATAR_URL",
        "URL avatar harus menggunakan HTTPS."
      );
    }

    result.avatarUrl = url.href;
  }

  if (Object.keys(result).length === 0) {
    throw createProfileError(
      "EMPTY_PROFILE_UPDATE",
      "Tidak ada perubahan profil yang diajukan."
    );
  }

  return result;
}

/**
 * Meminta UI membuka alur edit profil.
 *
 * Fungsi ini hanya mengirim permintaan.
 * Form edit dan penyimpanan belum diimplementasikan.
 */
export function requestProfileEdit(context = {}) {
  validateContext(context);

  const profileResult = getProfile(context);

  if (!profileResult.available) {
    throw createProfileError(
      "AUTHENTICATION_REQUIRED",
      "Silakan masuk sebelum mengubah profil."
    );
  }

  const payload = {
    featureId: "profile",
    profile: profileResult.profile,
    requestedAt: new Date().toISOString(),
  };

  if (typeof context.emit === "function") {
    context.emit(
      `${PROFILE_EVENT_PREFIX}edit-requested`,
      payload
    );
  }

  return {
    accepted: true,
    action: "edit-profile",
    message:
      "Permintaan edit profil diterima. Form dan backend belum terhubung.",
  };
}

/**
 * Meminta pembaruan profil.
 *
 * Sengaja belum menyimpan data atau memanggil API.
 * Penyimpanan nantinya harus melalui backend yang:
 * - memverifikasi sesi pengguna;
 * - memeriksa hak akses dan tenant;
 * - memvalidasi data di sisi server;
 * - mencatat audit log bila diperlukan.
 */
export async function updateProfile(context = {}, input = {}) {
  validateContext(context);

  const profileResult = getProfile(context);

  if (!profileResult.available) {
    throw createProfileError(
      "AUTHENTICATION_REQUIRED",
      "Silakan masuk sebelum memperbarui profil."
    );
  }

  const changes = validateProfileUpdate(input);

  const payload = {
    featureId: "profile",
    changes,
    requestedAt: new Date().toISOString(),
  };

  if (typeof context.emit === "function") {
    context.emit(
      `${PROFILE_EVENT_PREFIX}update-requested`,
      payload
    );
  }

  return {
    accepted: true,
    persisted: false,
    changes,
    message:
      "Perubahan tervalidasi di frontend, tetapi belum disimpan ke backend.",
  };
}

/**
 * Namespace aksi Profile.
 */
const ProfileActions = Object.freeze({
  getProfile,
  validateProfileUpdate,
  requestProfileEdit,
  updateProfile,
});

export default ProfileActions;
