
/**
 * KANTOONG CORE
 * File: frontend/dashboard-user/core/command-center-search.js
 *
 * Tanggung jawab:
 * - Mencari fitur berdasarkan nama, ID, deskripsi, kategori, dan tags.
 * - Mendukung pencarian toleran terhadap perbedaan penulisan.
 * - Memberikan skor relevansi untuk mengurutkan hasil.
 * - Membaca fitur secara dinamis dari feature registry.
 * - Menyediakan API pencarian untuk Command Center.
 *
 * Batasan:
 * - Pencarian ini berjalan secara lokal di frontend.
 * - Ini bukan semantic search berbasis LLM.
 * - Hasil pencarian tidak memberikan izin untuk membuka fitur.
 * - Pemeriksaan akses tetap dilakukan oleh feature-permission.js
 *   dan backend saat mengakses data terlindungi.
 */

import {
    getAllFeatures,
} from "./feature-registry.js";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MIN_QUERY_LENGTH = 1;

/**
 * Normalisasi teks untuk pencarian.
 */
export function normalizeSearchText(value) {
    if (typeof value !== "string") {
        return "";
    }

    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("id-ID")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}

/**
 * Mengubah nilai menjadi array string.
 */
function toStringArray(value) {
    if (typeof value === "string") {
        return [value];
    }

    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter(
        (item) => typeof item === "string"
    );
}

/**
 * Mengambil teks yang dapat dicari dari sebuah fitur.
 *
 * Tidak ada daftar fitur yang di-hardcode di sini.
 */
export function getFeatureSearchDocument(feature) {
    if (!feature || typeof feature !== "object") {
        return null;
    }

    const config =
        feature.config && typeof feature.config === "object"
            ? feature.config
            : {};

    const fields = {
        id: feature.id ?? "",
        name: feature.name ?? "",
        description: feature.description ?? "",
        category: feature.category ?? "",
        tags: [
            ...toStringArray(feature.tags),
            ...toStringArray(config.tags),
        ],
        keywords: [
            ...toStringArray(feature.keywords),
            ...toStringArray(config.keywords),
        ],
        aliases: [
            ...toStringArray(feature.aliases),
            ...toStringArray(config.aliases),
        ],
    };

    return {
        id: String(fields.id),
        name: String(fields.name),
        description: String(fields.description),
        category: String(fields.category),
        tags: fields.tags,
        keywords: fields.keywords,
        aliases: fields.aliases,

        normalized: {
            id: normalizeSearchText(String(fields.id)),
            name: normalizeSearchText(String(fields.name)),
            description: normalizeSearchText(
                String(fields.description)
            ),
            category: normalizeSearchText(
                String(fields.category)
            ),
            tags: fields.tags.map(normalizeSearchText),
            keywords: fields.keywords.map(normalizeSearchText),
            aliases: fields.aliases.map(normalizeSearchText),
        },
    };
}

/**
 * Menghitung jarak edit sederhana.
 *
 * Digunakan untuk membantu pencarian ketika ada salah ketik.
 * Panjang input dibatasi oleh pemanggil agar proses tetap ringan.
 */
function levenshteinDistance(a, b) {
    if (a === b) {
        return 0;
    }

    if (!a.length) {
        return b.length;
    }

    if (!b.length) {
        return a.length;
    }

    let previous = Array.from(
        { length: b.length + 1 },
        (_, index) => index
    );

    for (let i = 1; i <= a.length; i += 1) {
        const current = [i];

        for (let j = 1; j <= b.length; j += 1) {
            const substitutionCost =
                a[i - 1] === b[j - 1] ? 0 : 1;

            current[j] = Math.min(
                current[j - 1] + 1,
                previous[j] + 1,
                previous[j - 1] + substitutionCost
            );
        }

        previous = current;
    }

    return previous[b.length];
}

/**
 * Memeriksa kecocokan kata dengan toleransi salah ketik.
 */
function fuzzyTokenMatch(queryToken, targetToken) {
    if (!queryToken || !targetToken) {
        return false;
    }

    if (
        targetToken.includes(queryToken) ||
        queryToken.includes(targetToken)
    ) {
        return true;
    }

    // Hindari perhitungan fuzzy untuk kata yang terlalu pendek.
    if (queryToken.length < 4 || targetToken.length < 4) {
        return false;
    }

    // Batasi perbedaan panjang supaya perhitungan tetap ringan.
    if (Math.abs(queryToken.length - targetToken.length) > 2) {
        return false;
    }

    const distance = levenshteinDistance(
        queryToken.slice(0, 32),
        targetToken.slice(0, 32)
    );

    const threshold = queryToken.length >= 8 ? 2 : 1;

    return distance <= threshold;
}

/**
 * Menghitung skor kecocokan satu bidang.
 */
function scoreField(query, queryTokens, target, weight) {
    if (!target) {
        return 0;
    }

    if (target === query) {
        return weight * 10;
    }

    if (target.startsWith(query)) {
        return weight * 7;
    }

    if (target.includes(query)) {
        return weight * 5;
    }

    const targetTokens = target.split(" ");
    let score = 0;

    for (const queryToken of queryTokens) {
        let bestTokenScore = 0;

        for (const targetToken of targetTokens) {
            if (targetToken === queryToken) {
                bestTokenScore = Math.max(
                    bestTokenScore,
                    weight * 4
                );
            } else if (
                targetToken.startsWith(queryToken) ||
                queryToken.startsWith(targetToken)
            ) {
                bestTokenScore = Math.max(
                    bestTokenScore,
                    weight * 2
                );
            } else if (
                fuzzyTokenMatch(queryToken, targetToken)
            ) {
                bestTokenScore = Math.max(
                    bestTokenScore,
                    weight
                );
            }
        }

        score += bestTokenScore;
    }

    return score;
}

/**
 * Menghitung skor pencarian fitur.
 */
export function scoreFeatureSearch(query, feature) {
    const normalizedQuery = normalizeSearchText(query);

    if (
        !normalizedQuery ||
        normalizedQuery.length < MIN_QUERY_LENGTH
    ) {
        return 0;
    }

    const document = getFeatureSearchDocument(feature);

    if (!document) {
        return 0;
    }

    const queryTokens = normalizedQuery
        .split(" ")
        .filter(Boolean);

    let score = 0;

    // Nama dan ID lebih penting daripada deskripsi.
    score += scoreField(
        normalizedQuery,
        queryTokens,
        document.normalized.name,
        10
    );

    score += scoreField(
        normalizedQuery,
        queryTokens,
        document.normalized.id,
        8
    );

    score += scoreField(
        normalizedQuery,
        queryTokens,
        document.normalized.aliases.join(" "),
        7
    );

    score += scoreField(
        normalizedQuery,
        queryTokens,
        document.normalized.keywords.join(" "),
        6
    );

    score += scoreField(
        normalizedQuery,
        queryTokens,
        document.normalized.tags.join(" "),
        5
    );

    score += scoreField(
        normalizedQuery,
        queryTokens,
        document.normalized.category,
        3
    );

    score += scoreField(
        normalizedQuery,
        queryTokens,
        document.normalized.description,
        2
    );

    return score;
}

/**
 * Memeriksa apakah fitur dapat ditampilkan dalam pencarian.
 *
 * Fitur nonaktif atau deprecated tidak ditampilkan secara default.
 */
function isSearchableFeature(feature, options) {
    if (!feature || typeof feature !== "object") {
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

    if (
        feature.searchable === false &&
        options.includeNonSearchable !== true
    ) {
        return false;
    }

    return true;
}

/**
 * Membatasi jumlah hasil agar tetap ringan untuk UI.
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
 * Mencari fitur berdasarkan query.
 *
 * Return:
 * [
 *   {
 *     id,
 *     name,
 *     description,
 *     category,
 *     score,
 *     feature
 *   }
 * ]
 */
export function searchFeatures(query, options = {}) {
    const normalizedQuery = normalizeSearchText(query);

    if (!normalizedQuery) {
        return [];
    }

    const limit = normalizeLimit(options.limit);

    const registryFeatures = Array.isArray(options.features)
        ? options.features
        : getAllFeatures();

    const results = [];

    for (const feature of registryFeatures) {
        if (!isSearchableFeature(feature, options)) {
            continue;
        }

        const score = scoreFeatureSearch(
            normalizedQuery,
            feature
        );

        if (score <= 0) {
            continue;
        }

        results.push({
            id: feature.id,
            name: feature.name,
            description: feature.description ?? "",
            category: feature.category ?? "general",
            icon: feature.icon ?? null,
            score,
            feature,
        });
    }

    results.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }

        return String(a.name).localeCompare(
            String(b.name),
            "id-ID"
        );
    });

    return results.slice(0, limit);
}

/**
 * Mengambil satu hasil terbaik.
 */
export function findBestFeatureMatch(query, options = {}) {
    const results = searchFeatures(query, {
        ...options,
        limit: 1,
    });

    return results[0] ?? null;
}

/**
 * Mencari berdasarkan kategori.
 */
export function searchFeaturesByCategory(
    category,
    options = {}
) {
    const normalizedCategory = normalizeSearchText(category);

    if (!normalizedCategory) {
        return [];
    }

    const registryFeatures = Array.isArray(options.features)
        ? options.features
        : getAllFeatures();

    return registryFeatures
        .filter((feature) => {
            if (!isSearchableFeature(feature, options)) {
                return false;
            }

            return (
                normalizeSearchText(feature.category ?? "") ===
                normalizedCategory
            );
        })
        .slice(0, normalizeLimit(options.limit))
        .map((feature) => ({
            id: feature.id,
            name: feature.name,
            description: feature.description ?? "",
            category: feature.category ?? "general",
            icon: feature.icon ?? null,
            feature,
        }));
}

/**
 * Menghasilkan saran query sederhana berdasarkan fitur terdaftar.
 *
 * Ini bukan rekomendasi AI. Hanya membantu pengguna menemukan
 * nama fitur yang mungkin dimaksud.
 */
export function suggestFeatureQueries(query, options = {}) {
    const normalizedQuery = normalizeSearchText(query);

    if (!normalizedQuery) {
        return [];
    }

    return searchFeatures(normalizedQuery, {
        ...options,
        limit: normalizeLimit(options.limit ?? 5),
    }).map((result) => ({
        id: result.id,
        label: result.name,
        description: result.description,
        category: result.category,
        score: result.score,
    }));
}

/**
 * API utama.
 */
const CommandCenterSearch = Object.freeze({
    normalizeSearchText,
    getFeatureSearchDocument,
    scoreFeatureSearch,
    searchFeatures,
    findBestFeatureMatch,
    searchFeaturesByCategory,
    suggestFeatureQueries,
});

export default CommandCenterSearch;
