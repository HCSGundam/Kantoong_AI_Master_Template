
/**
 * KANTOONG CORE
 * Module: Feature Discovery
 * File: frontend/dashboard-user/core/feature-discovery.js
 *
 * Tanggung jawab:
 * 1. Menemukan semua entry fitur secara otomatis menggunakan Vite.
 * 2. Mengimpor modul fitur yang ditemukan.
 * 3. Memvalidasi struktur dasar modul fitur.
 * 4. Menghasilkan daftar fitur yang siap diproses registry.
 * 5. Mengisolasi error agar satu fitur bermasalah tidak
 *    menghentikan proses discovery fitur lainnya.
 *
 * KONVENSI:
 * Setiap fitur harus memiliki file:
 * features/<nama-fitur>/feature.js
 *
 * Contoh:
 * features/profile/feature.js
 * features/orders/feature.js
 * features/tracking/feature.js
 *
 * CATATAN:
 * File entry fitur menggunakan default export berupa object.
 */

const FEATURE_MODULES = import.meta.glob(
    "../features/**/feature.js",
    {
        eager: true,
    }
);

const FEATURE_DISCOVERY_VERSION = "1.0.0";

/**
 * Memastikan nilai adalah object konfigurasi fitur yang valid.
 */
function isValidFeatureModule(module, filePath) {
    if (!module || typeof module !== "object") {
        console.warn(
            `[KANTOONG CORE] Modul fitur tidak valid: ${filePath}`
        );

        return false;
    }

    const feature = module.default;

    if (!feature || typeof feature !== "object" || Array.isArray(feature)) {
        console.warn(
            `[KANTOONG CORE] Fitur harus memiliki default export object: ${filePath}`
        );

        return false;
    }

    if (
        typeof feature.id !== "string" ||
        feature.id.trim() === ""
    ) {
        console.warn(
            `[KANTOONG CORE] Fitur tidak memiliki id yang valid: ${filePath}`
        );

        return false;
    }

    if (
        typeof feature.name !== "string" ||
        feature.name.trim() === ""
    ) {
        console.warn(
            `[KANTOONG CORE] Fitur "${feature.id}" tidak memiliki name yang valid.`
        );

        return false;
    }

    return true;
}

/**
 * Mengubah path file menjadi ID yang dapat digunakan sistem.
 *
 * Contoh:
 * ../features/profile/feature.js
 * menjadi:
 * profile
 */
function getFeatureIdFromPath(filePath) {
    const normalizedPath = filePath.replaceAll("\\", "/");
    const match = normalizedPath.match(
        /\/features\/([^/]+)\/feature\.js$/
    );

    return match ? match[1] : null;
}

/**
 * Menemukan seluruh fitur yang tersedia.
 *
 * Return:
 * {
 *   features: [...],
 *   errors: [...],
 *   totalDiscovered: number,
 *   totalErrors: number
 * }
 */
export function discoverFeatures() {
    const features = [];
    const errors = [];
    const registeredIds = new Set();

    for (const [filePath, module] of Object.entries(FEATURE_MODULES)) {
        try {
            if (!isValidFeatureModule(module, filePath)) {
                errors.push({
                    filePath,
                    reason: "INVALID_FEATURE_MODULE",
                });

                continue;
            }

            const feature = module.default;
            const folderId = getFeatureIdFromPath(filePath);

            if (!folderId) {
                errors.push({
                    filePath,
                    reason: "INVALID_FEATURE_PATH",
                });

                continue;
            }

            if (feature.id !== folderId) {
                errors.push({
                    filePath,
                    reason: "FEATURE_ID_PATH_MISMATCH",
                    expectedId: folderId,
                    actualId: feature.id,
                });

                console.warn(
                    `[KANTOONG CORE] ID fitur "${feature.id}" harus sesuai ` +
                    `dengan nama folder "${folderId}".`
                );

                continue;
            }

            if (registeredIds.has(feature.id)) {
                errors.push({
                    filePath,
                    reason: "DUPLICATE_FEATURE_ID",
                    featureId: feature.id,
                });

                console.warn(
                    `[KANTOONG CORE] ID fitur duplikat: ${feature.id}`
                );

                continue;
            }

            registeredIds.add(feature.id);

            features.push({
                ...feature,
                id: feature.id,
                sourcePath: filePath,
            });
        } catch (error) {
            errors.push({
                filePath,
                reason: "FEATURE_DISCOVERY_ERROR",
                message:
                    error instanceof Error
                        ? error.message
                        : String(error),
            });

            console.error(
                `[KANTOONG CORE] Gagal memproses fitur: ${filePath}`,
                error
            );
        }
    }

    const result = {
        version: FEATURE_DISCOVERY_VERSION,
        features,
        errors,
        totalDiscovered: features.length,
        totalErrors: errors.length,
    };

    console.info(
        `[KANTOONG CORE] Feature discovery selesai. ` +
        `${result.totalDiscovered} fitur ditemukan, ` +
        `${result.totalErrors} masalah ditemukan.`
    );

    return result;
}

/**
 * Mengambil daftar fitur saja.
 * Berguna untuk modul lain yang hanya memerlukan array fitur.
 */
export function getDiscoveredFeatures() {
    return discoverFeatures().features;
}

/**
 * Mengambil ringkasan proses discovery.
 */
export function getFeatureDiscoverySummary() {
    const result = discoverFeatures();

    return {
        version: result.version,
        totalDiscovered: result.totalDiscovered,
        totalErrors: result.totalErrors,
        featureIds: result.features.map((feature) => feature.id),
        errors: result.errors,
    };
}

export default discoverFeatures;
