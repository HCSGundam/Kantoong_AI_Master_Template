
/**
 * KANTOONG CORE
 * Core Module: Feature Contract
 * File: frontend/dashboard-user/core/feature-contract.js
 *
 * Tanggung jawab:
 * 1. Menentukan kontrak standar seluruh fitur Dashboard User.
 * 2. Memvalidasi metadata dan struktur fitur.
 * 3. Menyediakan factory untuk membuat definisi fitur.
 * 4. Memeriksa konfigurasi lifecycle dan permission.
 * 5. Menyediakan hasil validasi terstruktur.
 *
 * Catatan:
 * Kontrak ini memvalidasi struktur frontend.
 * Kontrak ini BUKAN sistem keamanan backend.
 */

export const FEATURE_CONTRACT_VERSION = "1.0.0";

/**
 * Nilai status fitur yang diizinkan.
 */
export const FEATURE_STATUS = Object.freeze({
    ACTIVE: "active",
    DISABLED: "disabled",
    DEPRECATED: "deprecated",
});

/**
 * Kategori fitur bawaan.
 * Fitur boleh memakai kategori lain yang sesuai kebutuhan.
 */
export const FEATURE_CATEGORIES = Object.freeze({
    ACCOUNT: "account",
    SHOPPING: "shopping",
    ACTIVITY: "activity",
    SUPPORT: "support",
    SETTINGS: "settings",
    BUSINESS: "business",
});

/**
 * Daftar properti metadata yang wajib tersedia.
 */
const REQUIRED_FIELDS = Object.freeze([
    "id",
    "name",
]);

/**
 * Validasi ID fitur.
 *
 * Contoh valid:
 * profile
 * shipping-address
 * order-history
 */
export function isValidFeatureId(id) {
    return (
        typeof id === "string" &&
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id.trim())
    );
}

/**
 * Validasi nama yang ditampilkan kepada pengguna.
 */
export function isValidFeatureName(name) {
    return (
        typeof name === "string" &&
        name.trim().length > 0 &&
        name.trim().length <= 100
    );
}

/**
 * Validasi metadata permission.
 *
 * Permission di sini merupakan deklarasi kebutuhan fitur,
 * bukan bukti bahwa pengguna benar-benar memiliki akses.
 */
function validatePermission(permission, errors) {
    if (permission === undefined) {
        return;
    }

    if (
        !permission ||
        typeof permission !== "object" ||
        Array.isArray(permission)
    ) {
        errors.push({
            field: "permission",
            code: "INVALID_PERMISSION_CONFIG",
            message: "Permission harus berupa object.",
        });

        return;
    }

    if (
        permission.roles !== undefined &&
        (
            !Array.isArray(permission.roles) ||
            permission.roles.some(
                (role) =>
                    typeof role !== "string" ||
                    role.trim() === ""
            )
        )
    ) {
        errors.push({
            field: "permission.roles",
            code: "INVALID_PERMISSION_ROLES",
            message: "permission.roles harus berupa array string.",
        });
    }

    if (
        permission.permissions !== undefined &&
        (
            !Array.isArray(permission.permissions) ||
            permission.permissions.some(
                (item) =>
                    typeof item !== "string" ||
                    item.trim() === ""
            )
        )
    ) {
        errors.push({
            field: "permission.permissions",
            code: "INVALID_PERMISSION_LIST",
            message: "permission.permissions harus berupa array string.",
        });
    }
}

/**
 * Validasi metadata lifecycle.
 */
function validateLifecycle(lifecycle, errors) {
    if (lifecycle === undefined) {
        return;
    }

    if (
        !lifecycle ||
        typeof lifecycle !== "object" ||
        Array.isArray(lifecycle)
    ) {
        errors.push({
            field: "lifecycle",
            code: "INVALID_LIFECYCLE_CONFIG",
            message: "Lifecycle harus berupa object.",
        });

        return;
    }

    const allowedHooks = [
        "onRegister",
        "onLoad",
        "onMount",
        "onActivate",
        "onDeactivate",
        "onUnmount",
        "onError",
    ];

    for (const hookName of allowedHooks) {
        if (
            lifecycle[hookName] !== undefined &&
            typeof lifecycle[hookName] !== "function"
        ) {
            errors.push({
                field: `lifecycle.${hookName}`,
                code: "INVALID_LIFECYCLE_HOOK",
                message: `${hookName} harus berupa function.`,
            });
        }
    }
}

/**
 * Memeriksa seluruh definisi fitur.
 *
 * Return:
 * {
 *   valid: boolean,
 *   errors: [...],
 *   warnings: [...]
 * }
 */
export function validateFeatureContract(feature) {
    const errors = [];
    const warnings = [];

    if (
        !feature ||
        typeof feature !== "object" ||
        Array.isArray(feature)
    ) {
        return {
            valid: false,
            version: FEATURE_CONTRACT_VERSION,
            errors: [
                {
                    field: null,
                    code: "FEATURE_MUST_BE_OBJECT",
                    message: "Definisi fitur harus berupa object.",
                },
            ],
            warnings,
        };
    }

    for (const field of REQUIRED_FIELDS) {
        if (
            feature[field] === undefined ||
            feature[field] === null
        ) {
            errors.push({
                field,
                code: "REQUIRED_FIELD_MISSING",
                message: `Field "${field}" wajib diisi.`,
            });
        }
    }

    if (
        feature.id !== undefined &&
        !isValidFeatureId(feature.id)
    ) {
        errors.push({
            field: "id",
            code: "INVALID_FEATURE_ID",
            message:
                "ID harus memakai huruf kecil, angka, dan tanda hubung.",
        });
    }

    if (
        feature.name !== undefined &&
        !isValidFeatureName(feature.name)
    ) {
        errors.push({
            field: "name",
            code: "INVALID_FEATURE_NAME",
            message:
                "Nama fitur wajib diisi dan maksimal 100 karakter.",
        });
    }

    if (
        feature.description !== undefined &&
        typeof feature.description !== "string"
    ) {
        errors.push({
            field: "description",
            code: "INVALID_DESCRIPTION",
            message: "Description harus berupa string.",
        });
    }

    if (
        feature.category !== undefined &&
        (
            typeof feature.category !== "string" ||
            feature.category.trim() === ""
        )
    ) {
        errors.push({
            field: "category",
            code: "INVALID_CATEGORY",
            message: "Category harus berupa string yang tidak kosong.",
        });
    }

    if (
        feature.icon !== undefined &&
        typeof feature.icon !== "string"
    ) {
        errors.push({
            field: "icon",
            code: "INVALID_ICON",
            message: "Icon harus berupa string.",
        });
    }

    if (
        feature.enabled !== undefined &&
        typeof feature.enabled !== "boolean"
    ) {
        errors.push({
            field: "enabled",
            code: "INVALID_ENABLED_VALUE",
            message: "Enabled harus berupa boolean.",
        });
    }

    if (
        feature.status !== undefined &&
        !Object.values(FEATURE_STATUS).includes(feature.status)
    ) {
        errors.push({
            field: "status",
            code: "INVALID_FEATURE_STATUS",
            message: "Status fitur tidak dikenali.",
        });
    }

    if (
        feature.order !== undefined &&
        (
            typeof feature.order !== "number" ||
            !Number.isFinite(feature.order)
        )
    ) {
        errors.push({
            field: "order",
            code: "INVALID_ORDER",
            message: "Order harus berupa angka yang valid.",
        });
    }

    if (
        feature.tags !== undefined &&
        (
            !Array.isArray(feature.tags) ||
            feature.tags.some(
                (tag) => typeof tag !== "string"
            )
        )
    ) {
        errors.push({
            field: "tags",
            code: "INVALID_TAGS",
            message: "Tags harus berupa array string.",
        });
    }

    if (
        feature.actions !== undefined &&
        (
            !Array.isArray(feature.actions) ||
            feature.actions.some(
                (action) =>
                    !action ||
                    typeof action !== "object" ||
                    Array.isArray(action)
            )
        )
    ) {
        errors.push({
            field: "actions",
            code: "INVALID_ACTIONS",
            message: "Actions harus berupa array object.",
        });
    }

    validatePermission(feature.permission, errors);
    validateLifecycle(feature.lifecycle, errors);

    if (feature.view !== undefined && typeof feature.view !== "function") {
        errors.push({
            field: "view",
            code: "INVALID_VIEW",
            message: "View, jika disediakan, harus berupa function.",
        });
    }

    if (feature.mount !== undefined && typeof feature.mount !== "function") {
        errors.push({
            field: "mount",
            code: "INVALID_MOUNT",
            message: "Mount, jika disediakan, harus berupa function.",
        });
    }

    if (feature.unmount !== undefined && typeof feature.unmount !== "function") {
        errors.push({
            field: "unmount",
            code: "INVALID_UNMOUNT",
            message: "Unmount, jika disediakan, harus berupa function.",
        });
    }

    if (
        feature.status === FEATURE_STATUS.DEPRECATED
    ) {
        warnings.push({
            field: "status",
            code: "FEATURE_DEPRECATED",
            message: "Fitur ditandai deprecated.",
        });
    }

    return {
        valid: errors.length === 0,
        version: FEATURE_CONTRACT_VERSION,
        errors,
        warnings,
    };
}

/**
 * Membuat definisi fitur dengan default yang konsisten.
 *
 * Factory ini tidak otomatis mendaftarkan fitur.
 */
export function defineFeature(definition) {
    const feature = {
        enabled: true,
        status: FEATURE_STATUS.ACTIVE,
        order: 100,
        tags: [],
        ...definition,
    };

    const validation = validateFeatureContract(feature);

    if (!validation.valid) {
        const details = validation.errors
            .map((error) => `${error.field}: ${error.message}`)
            .join("\n");

        throw new Error(
            `[KANTOONG CORE] Definisi fitur tidak valid:\n${details}`
        );
    }

    return Object.freeze({
        ...feature,
        tags: Object.freeze([...feature.tags]),
    });
}

/**
 * Memeriksa apakah fitur boleh ditampilkan berdasarkan
 * status metadata frontend.
 *
 * Ini bukan pemeriksaan hak akses ke data.
 */
export function isFeatureEnabled(feature) {
    if (!feature || typeof feature !== "object") {
        return false;
    }

    return (
        feature.enabled !== false &&
        feature.status !== FEATURE_STATUS.DISABLED &&
        feature.status !== FEATURE_STATUS.DEPRECATED
    );
}

/**
 * API default untuk penggunaan default import.
 */
const FeatureContract = Object.freeze({
    version: FEATURE_CONTRACT_VERSION,
    FEATURE_STATUS,
    FEATURE_CATEGORIES,
    isValidFeatureId,
    isValidFeatureName,
    validateFeatureContract,
    defineFeature,
    isFeatureEnabled,
});

export default FeatureContract;
