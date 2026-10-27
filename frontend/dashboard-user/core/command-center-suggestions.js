
/**
 * KANTOONG CORE
 * File: frontend/dashboard-user/core/command-center-suggestions.js
 *
 * Tanggung jawab:
 * - Menghasilkan saran fitur secara dinamis dari feature registry.
 * - Mendukung konteks halaman, kategori, dan riwayat penggunaan.
 * - Mengutamakan fitur yang relevan dan dapat diakses.
 * - Mendukung saran default ketika pengguna belum melakukan pencarian.
 * - Menyediakan API untuk integrasi AI Companion di masa depan.
 *
 * Batasan:
 * - Rekomendasi saat ini berbasis aturan lokal, bukan LLM.
 * - Riwayat penggunaan hanya digunakan jika diberikan oleh pemanggil.
 * - Modul ini tidak menyimpan riwayat pengguna secara otomatis.
 * - Saran tidak memberikan izin akses ke fitur atau data.
 */

import { getAllFeatures } from "./feature-registry.js";
import { searchFeatures } from "./command-center-search.js";
import { checkFeaturePermission } from "./feature-permission.js";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

/**
 * Memastikan nilai merupakan object biasa.
 */
function isPlainObject(value) {
    if (
        value === null ||
        typeof value !== "object" ||
        Array.isArray(value)
    ) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return (
        prototype === Object.prototype ||
        prototype === null
    );
}

/**
 * Normalisasi teks.
 */
function normalizeText(value) {
    if (typeof value !== "string") {
        return "";
    }

    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("id-ID")
        .trim();
}

/**
 * Normalisasi limit.
 */
function normalizeLimit(limit) {
    if (!Number.isFinite(limit)) {
        return DEFAULT_LIMIT;
    }

    return Math.max(
        1,
        Math.min(Math.floor(limit), MAX_LIMIT)
    );
}

/**
 * Memeriksa apakah fitur dapat direkomendasikan.
 */
function isEligibleFeature(feature, options = {}) {
    if (!feature || typeof feature !== "object") {
        return false;
    }

    if (typeof feature.id !== "string" || !feature.id.trim()) {
        return false;
    }

    if (typeof feature.name !== "string" || !feature.name.trim()) {
        return false;
    }

    if (feature.enabled === false) {
        return options.includeDisabled === true;
    }

    if (
        feature.status === "deprecated" &&
        options.includeDeprecated !== true
    ) {
        return false;
    }

    if (feature.recommendable === false) {
        return false;
    }

    return true;
}

/**
 * Membaca identitas fitur dari nilai string atau object.
 */
function getFeatureId(value) {
    if (typeof value === "string") {
        return value.trim();
    }

    if (value && typeof value.id === "string") {
        return value.id.trim();
    }

    if (value && value.feature && typeof value.feature.id === "string") {
        return value.feature.id.trim();
    }

    return "";
}

/**
 * Membuat peta ID fitur untuk pencarian cepat.
 */
function createFeatureMap(features) {
    return new Map(
        features
            .filter((feature) => feature && typeof feature.id === "string")
            .map((feature) => [feature.id, feature])
    );
}

/**
 * Memeriksa izin fitur.
 *
 * Pemeriksaan frontend membantu menyaring saran,
 * tetapi backend tetap harus melindungi data dan tindakan sensitif.
 */
function canRecommendFeature(feature, context) {
    try {
        return checkFeaturePermission(feature, context).allowed === true;
    } catch {
        // Gagal memeriksa izin berarti jangan rekomendasikan fitur.
        return false;
    }
}

/**
 * Mengambil skor urutan dari konfigurasi fitur.
 */
function getFeatureOrder(feature) {
    const order = feature.order;

    return Number.isFinite(order) ? order : 100;
}

/**
 * Menghasilkan skor dasar sebuah fitur.
 */
function scoreFeature(feature, context, options = {}) {
    let score = 0;

    const currentFeatureId = getFeatureId(context.currentFeature);
    const currentCategory = normalizeText(context.currentCategory);
    const featureCategory = normalizeText(feature.category);

    const recentIds = new Set(
        (Array.isArray(context.recentFeatures)
            ? context.recentFeatures
            : []
        )
            .map(getFeatureId)
            .filter(Boolean)
    );

    const pinnedIds = new Set(
        (Array.isArray(context.pinnedFeatures)
            ? context.pinnedFeatures
            : []
        )
            .map(getFeatureId)
            .filter(Boolean)
    );

    const excludedIds = new Set(
        (Array.isArray(options.excludeFeatureIds)
            ? options.excludeFeatureIds
            : []
        )
            .map(getFeatureId)
            .filter(Boolean)
    );

    if (excludedIds.has(feature.id)) {
        return Number.NEGATIVE_INFINITY;
    }

    // Jangan menyarankan fitur yang sedang dibuka.
    if (feature.id === currentFeatureId) {
        return Number.NEGATIVE_INFINITY;
    }

    // Fitur yang disematkan pengguna mendapat prioritas.
    if (pinnedIds.has(feature.id)) {
        score += 50;
    }

    // Fitur yang baru digunakan memperoleh sedikit prioritas.
    if (recentIds.has(feature.id)) {
        score += 15;
    }

    // Kategori yang relevan dengan halaman saat ini.
    if (
        currentCategory &&
        featureCategory === currentCategory
    ) {
        score += 20;
    }

    // Urutan eksplisit pada metadata fitur.
    score += Math.max(
        -10,
        Math.min(10, (100 - getFeatureOrder(feature)) / 10)
    );

    // Opsional: bobot dari konteks yang diberikan pemanggil.
    if (isPlainObject(context.featureWeights)) {
        const weight = context.featureWeights[feature.id];

        if (Number.isFinite(weight)) {
            score += Math.max(-50, Math.min(50, weight));
        }
    }

    return score;
}

/**
 * Membuat bentuk data saran yang konsisten untuk UI.
 */
function createSuggestion(feature, score, reason) {
    return Object.freeze({
        id: feature.id,
        name: feature.name,
        description: feature.description ?? "",
        category: feature.category ?? "general",
        icon: feature.icon ?? null,
        score,
        reason,
        feature,
    });
}

/**
 * Menghasilkan saran fitur.
 *
 * Opsi:
 * - limit
 * - features
 * - context
 * - excludeFeatureIds
 * - includeDisabled
 * - includeDeprecated
 *
 * Context opsional:
 * - currentFeature
 * - currentCategory
 * - recentFeatures
 * - pinnedFeatures
 * - featureWeights
 * - user / role / permissions sesuai kontrak permission
 */
export function getFeatureSuggestions(options = {}) {
    const limit = normalizeLimit(options.limit);

    const context = isPlainObject(options.context)
        ? options.context
        : {};

    const features = Array.isArray(options.features)
        ? options.features
        : getAllFeatures();

    const suggestions = [];

    for (const feature of features) {
        if (!isEligibleFeature(feature, options)) {
            continue;
        }

        if (!canRecommendFeature(feature, context)) {
            continue;
        }

        const score = scoreFeature(feature, context, options);

        if (!Number.isFinite(score)) {
            continue;
        }

        let reason = "recommended";

        if (
            (context.pinnedFeatures ?? [])
                .some((item) => getFeatureId(item) === feature.id)
        ) {
            reason = "pinned";
        } else if (
            (context.recentFeatures ?? [])
                .some((item) => getFeatureId(item) === feature.id)
        ) {
            reason = "recent";
        } else if (
            context.currentCategory &&
            normalizeText(feature.category) ===
                normalizeText(context.currentCategory)
        ) {
            reason = "related-category";
        }

        suggestions.push(createSuggestion(feature, score, reason));
    }

    suggestions.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }

        return String(a.name).localeCompare(
            String(b.name),
            "id-ID"
        );
    });

    return suggestions.slice(0, limit);
}

/**
 * Menghasilkan saran berdasarkan pencarian pengguna.
 *
 * Mesin pencarian menentukan relevansi teks;
 * permission tetap diperiksa sebelum hasil disarankan.
 */
export function getSearchSuggestions(query, options = {}) {
    if (typeof query !== "string" || !query.trim()) {
        return [];
    }

    const context = isPlainObject(options.context)
        ? options.context
        : {};

    const features = Array.isArray(options.features)
        ? options.features
        : getAllFeatures();

    const limit = normalizeLimit(options.limit);

    const searchResults = searchFeatures(query, {
        limit: MAX_LIMIT,
        features,
        includeDisabled: options.includeDisabled === true,
        includeDeprecated: options.includeDeprecated === true,
    });

    const suggestions = [];

    for (const result of searchResults) {
        if (!canRecommendFeature(result.feature, context)) {
            continue;
        }

        if (
            Array.isArray(options.excludeFeatureIds) &&
            options.excludeFeatureIds
                .map(getFeatureId)
                .includes(result.id)
        ) {
            continue;
        }

        suggestions.push(
            createSuggestion(
                result.feature,
                result.score,
                "search-match"
            )
        );
    }

    return suggestions.slice(0, limit);
}

/**
 * Menghasilkan saran fitur berdasarkan kategori.
 */
export function getSuggestionsByCategory(category, options = {}) {
    const normalizedCategory = normalizeText(category);

    if (!normalizedCategory) {
        return [];
    }

    const context = isPlainObject(options.context)
        ? options.context
        : {};

    const features = Array.isArray(options.features)
        ? options.features
        : getAllFeatures();

    const limit = normalizeLimit(options.limit);

    return features
        .filter((feature) => {
            return (
                isEligibleFeature(feature, options) &&
                normalizeText(feature.category) === normalizedCategory &&
                canRecommendFeature(feature, context)
            );
        })
        .map((feature) => {
            const score = scoreFeature(feature, context, options);

            return createSuggestion(
                feature,
                score,
                "category"
            );
        })
        .filter((suggestion) => Number.isFinite(suggestion.score))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

/**
 * Mengambil fitur yang belum pernah digunakan,
 * berdasarkan riwayat yang diberikan pemanggil.
 */
export function getDiscoverSuggestions(options = {}) {
    const context = isPlainObject(options.context)
        ? options.context
        : {};

    const recentIds = new Set(
        (Array.isArray(context.recentFeatures)
            ? context.recentFeatures
            : []
        )
            .map(getFeatureId)
            .filter(Boolean)
    );

    const pinnedIds = new Set(
        (Array.isArray(context.pinnedFeatures)
            ? context.pinnedFeatures
            : []
        )
            .map(getFeatureId)
            .filter(Boolean)
    );

    const features = Array.isArray(options.features)
        ? options.features
        : getAllFeatures();

    const candidates = features.filter((feature) => {
        return (
            isEligibleFeature(feature, options) &&
            !recentIds.has(feature.id) &&
            !pinnedIds.has(feature.id) &&
            canRecommendFeature(feature, context)
        );
    });

    return getFeatureSuggestions({
        ...options,
        features: candidates,
        context: {
            ...context,
            recentFeatures: [],
            pinnedFeatures: [],
        },
    });
}

/**
 * Membuat konteks rekomendasi yang aman dan terstruktur.
 *
 * Fungsi ini hanya menormalisasi konteks untuk frontend.
 * Jangan menganggapnya sebagai validasi identitas dari server.
 */
export function createSuggestionContext(input = {}) {
    const source = isPlainObject(input) ? input : {};

    return {
        currentFeature: source.currentFeature ?? null,
        currentCategory:
            typeof source.currentCategory === "string"
                ? source.currentCategory
                : "",
        recentFeatures: Array.isArray(source.recentFeatures)
            ? source.recentFeatures.slice(0, 50)
            : [],
        pinnedFeatures: Array.isArray(source.pinnedFeatures)
            ? source.pinnedFeatures.slice(0, 50)
            : [],
        featureWeights: isPlainObject(source.featureWeights)
            ? { ...source.featureWeights }
            : {},
        user: source.user ?? null,
        role: source.role ?? null,
        permissions: Array.isArray(source.permissions)
            ? [...source.permissions]
            : [],
    };
}

/**
 * API publik.
 */
const CommandCenterSuggestions = Object.freeze({
    getFeatureSuggestions,
    getSearchSuggestions,
    getSuggestionsByCategory,
    getDiscoverSuggestions,
    createSuggestionContext,
});

export default CommandCenterSuggestions;
