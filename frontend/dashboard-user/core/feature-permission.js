
/**
 * KANTOONG CORE
 * File: frontend/dashboard-user/core/feature-permission.js
 *
 * Tanggung jawab:
 * 1. Memeriksa apakah pengguna boleh mengakses fitur.
 * 2. Memeriksa role pengguna terhadap konfigurasi fitur.
 * 3. Mendukung izin akses berbasis permission.
 * 4. Mendukung status fitur enabled/disabled.
 * 5. Menyediakan hasil pemeriksaan yang konsisten.
 * 6. Menyediakan hook pemeriksaan tambahan untuk integrasi berikutnya.
 *
 * CATATAN KEAMANAN:
 * Pemeriksaan di frontend hanya untuk UX.
 * Otorisasi data wajib tetap dilakukan oleh backend/Supabase RLS.
 */

const DEFAULT_ACCESS_POLICY = Object.freeze({
  requireAuthentication: true,
  allowedRoles: [],
  requiredPermissions: [],
  allowWhenRoleMissing: false,
});

const VALID_ROLES = new Set([
  "customer",
  "owner",
  "admin",
  "staff",
]);

const permissionChecks = new Map();

/**
 * Normalisasi teks agar format role dan permission konsisten.
 */
function normalizeValue(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

/**
 * Normalisasi daftar string.
 */
function normalizeList(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [
    ...new Set(
      values
        .map(normalizeValue)
        .filter(Boolean)
    ),
  ];
}

/**
 * Mengambil identitas akses dari context.
 *
 * Bentuk context yang direkomendasikan:
 * {
 *   user: {
 *     id: "uuid",
 *     authenticated: true,
 *     role: "customer",
 *     roles: ["customer"],
 *     permissions: ["profile.read"]
 *   },
 *   feature: { ... }
 * }
 */
function getAccessIdentity(context = {}) {
  const user = context.user ?? context.currentUser ?? null;

  if (!user || typeof user !== "object") {
    return {
      authenticated: false,
      userId: null,
      roles: [],
      permissions: [],
    };
  }

  const authenticated =
    user.authenticated === true ||
    user.isAuthenticated === true;

  const roles = normalizeList([
    ...(Array.isArray(user.roles) ? user.roles : []),
    ...(user.role ? [user.role] : []),
  ]);

  const permissions = normalizeList(
    user.permissions
  );

  return {
    authenticated,
    userId:
      typeof user.id === "string" && user.id.trim()
        ? user.id.trim()
        : null,
    roles,
    permissions,
  };
}

/**
 * Membaca policy akses dari definisi fitur.
 *
 * Format fitur yang didukung:
 *
 * permission: {
 *   roles: ["customer", "owner"],
 *   permissions: ["profile.read"],
 *   requireAuthentication: true
 * }
 *
 * atau:
 *
 * access: {
 *   allowedRoles: ["customer"],
 *   requiredPermissions: ["profile.read"]
 * }
 */
function getFeatureAccessPolicy(feature = {}) {
  const permission =
    feature.permission &&
    typeof feature.permission === "object"
      ? feature.permission
      : {};

  const access =
    feature.access &&
    typeof feature.access === "object"
      ? feature.access
      : {};

  const roles = normalizeList([
    ...(Array.isArray(permission.roles)
      ? permission.roles
      : []),
    ...(Array.isArray(access.allowedRoles)
      ? access.allowedRoles
      : []),
  ]);

  const requiredPermissions = normalizeList([
    ...(Array.isArray(permission.permissions)
      ? permission.permissions
      : []),
    ...(Array.isArray(permission.requiredPermissions)
      ? permission.requiredPermissions
      : []),
    ...(Array.isArray(access.requiredPermissions)
      ? access.requiredPermissions
      : []),
  ]);

  const configuredAuthentication =
    typeof permission.requireAuthentication === "boolean"
      ? permission.requireAuthentication
      : typeof access.requireAuthentication === "boolean"
        ? access.requireAuthentication
        : DEFAULT_ACCESS_POLICY.requireAuthentication;

  return {
    requireAuthentication: configuredAuthentication,
    allowedRoles: [...new Set(roles)],
    requiredPermissions: [
      ...new Set(requiredPermissions),
    ],
    allowWhenRoleMissing:
      permission.allowWhenRoleMissing === true ||
      access.allowWhenRoleMissing === true,
  };
}

/**
 * Membuat hasil pemeriksaan akses dengan format konsisten.
 */
function createResult(
  allowed,
  reason,
  details = {}
) {
  return Object.freeze({
    allowed,
    reason,
    ...details,
  });
}

/**
 * Mendaftarkan pemeriksaan tambahan untuk suatu fitur.
 *
 * Callback harus mengembalikan:
 * - true: pemeriksaan tambahan mengizinkan akses.
 * - false: pemeriksaan tambahan menolak akses.
 *
 * Callback juga boleh mengembalikan Promise<boolean>.
 */
export function registerFeaturePermissionCheck(
  featureId,
  callback
) {
  const id = normalizeValue(featureId);

  if (!id) {
    throw new TypeError(
      "featureId wajib berupa string yang valid."
    );
  }

  if (typeof callback !== "function") {
    throw new TypeError(
      "Permission check harus berupa function."
    );
  }

  const checks = permissionChecks.get(id) ?? [];

  checks.push(callback);
  permissionChecks.set(id, checks);

  // Kembalikan fungsi untuk melepas pemeriksaan ini.
  return function unregisterPermissionCheck() {
    const currentChecks = permissionChecks.get(id);

    if (!currentChecks) {
      return false;
    }

    const index = currentChecks.indexOf(callback);

    if (index === -1) {
      return false;
    }

    currentChecks.splice(index, 1);

    if (currentChecks.length === 0) {
      permissionChecks.delete(id);
    }

    return true;
  };
}

/**
 * Memeriksa akses dasar berdasarkan status fitur,
 * autentikasi, role, dan permission.
 *
 * Fungsi ini sinkron.
 */
export function checkFeaturePermission(
  feature,
  context = {}
) {
  if (!feature || typeof feature !== "object") {
    return createResult(
      false,
      "INVALID_FEATURE"
    );
  }

  const featureId = normalizeValue(feature.id);

  if (!featureId) {
    return createResult(
      false,
      "INVALID_FEATURE_ID"
    );
  }

  if (feature.enabled === false) {
    return createResult(
      false,
      "FEATURE_DISABLED",
      { featureId }
    );
  }

  if (feature.status === "disabled") {
    return createResult(
      false,
      "FEATURE_DISABLED",
      { featureId }
    );
  }

  const identity = getAccessIdentity(context);
  const policy = getFeatureAccessPolicy(feature);

  if (
    policy.requireAuthentication &&
    !identity.authenticated
  ) {
    return createResult(
      false,
      "AUTHENTICATION_REQUIRED",
      { featureId }
    );
  }

  if (policy.allowedRoles.length > 0) {
    if (identity.roles.length === 0) {
      if (!policy.allowWhenRoleMissing) {
        return createResult(
          false,
          "ROLE_REQUIRED",
          { featureId }
        );
      }
    } else {
      const hasAllowedRole = identity.roles.some(
        (role) => policy.allowedRoles.includes(role)
      );

      if (!hasAllowedRole) {
        return createResult(
          false,
          "ROLE_NOT_ALLOWED",
          { featureId }
        );
      }
    }
  }

  if (policy.requiredPermissions.length > 0) {
    const missingPermissions =
      policy.requiredPermissions.filter(
        (permission) =>
          !identity.permissions.includes(permission)
      );

    if (missingPermissions.length > 0) {
      return createResult(
        false,
        "PERMISSION_MISSING",
        {
          featureId,
          missingPermissions,
        }
      );
    }
  }

  return createResult(
    true,
    "ACCESS_ALLOWED",
    {
      featureId,
      userId: identity.userId,
      roles: identity.roles,
    }
  );
}

/**
 * Memeriksa akses termasuk seluruh callback tambahan.
 *
 * Karena callback tambahan dapat asynchronous,
 * fungsi ini selalu mengembalikan Promise.
 */
export async function canAccessFeature(
  feature,
  context = {}
) {
  const baseResult = checkFeaturePermission(
    feature,
    context
  );

  if (!baseResult.allowed) {
    return baseResult;
  }

  const featureId = normalizeValue(feature.id);
  const checks = permissionChecks.get(featureId) ?? [];

  for (const check of checks) {
    try {
      const allowed = await check({
        feature,
        context,
        result: baseResult,
      });

      if (allowed !== true) {
        return createResult(
          false,
          "CUSTOM_PERMISSION_DENIED",
          { featureId }
        );
      }
    } catch (error) {
      // Fail closed: jika pemeriksaan gagal,
      // jangan izinkan akses.
      return createResult(
        false,
        "CUSTOM_PERMISSION_ERROR",
        {
          featureId,
          error:
            error instanceof Error
              ? error.message
              : "Pemeriksaan izin gagal.",
        }
      );
    }
  }

  return baseResult;
}

/**
 * Memeriksa beberapa fitur sekaligus.
 */
export async function checkFeaturesPermission(
  features = [],
  context = {}
) {
  if (!Array.isArray(features)) {
    throw new TypeError(
      "features harus berupa array."
    );
  }

  const results = await Promise.all(
    features.map(async (feature) => ({
      featureId:
        typeof feature?.id === "string"
          ? feature.id
          : null,
      ...(await canAccessFeature(feature, context)),
    }))
  );

  return Object.freeze({
    total: results.length,
    allowed: results.filter(
      (result) => result.allowed
    ).length,
    denied: results.filter(
      (result) => !result.allowed
    ).length,
    results,
  });
}

/**
 * Membuat daftar fitur yang boleh ditampilkan
 * berdasarkan pemeriksaan akses.
 */
export async function filterAccessibleFeatures(
  features = [],
  context = {}
) {
  if (!Array.isArray(features)) {
    throw new TypeError(
      "features harus berupa array."
    );
  }

  const results = await Promise.all(
    features.map(async (feature) => ({
      feature,
      result: await canAccessFeature(
        feature,
        context
      ),
    }))
  );

  return results
    .filter(({ result }) => result.allowed)
    .map(({ feature }) => feature);
}

/**
 * Mengambil role yang dikenali sistem.
 *
 * Ini hanya daftar role frontend saat ini.
 * Role yang valid untuk otorisasi tetap harus
 * ditetapkan dan diverifikasi oleh backend.
 */
export function getKnownFeatureRoles() {
  return [...VALID_ROLES];
}

/**
 * Menghapus semua callback pemeriksaan tambahan.
 * Berguna untuk reset saat testing.
 */
export function clearFeaturePermissionChecks() {
  permissionChecks.clear();
}

/**
 * API publik modul.
 */
const FeaturePermission = Object.freeze({
  checkFeaturePermission,
  canAccessFeature,
  checkFeaturesPermission,
  filterAccessibleFeatures,
  registerFeaturePermissionCheck,
  getKnownFeatureRoles,
  clearFeaturePermissionChecks,
});

export default FeaturePermission;
