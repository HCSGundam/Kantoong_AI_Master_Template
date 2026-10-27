
import { describe, it, expect, beforeEach } from "vitest";

import {
    registerFeature,
    registerFeatures,
    getFeature,
    hasFeature,
    getAllFeatures,
    getEnabledFeatures,
    getFeaturesByCategory,
    unregisterFeature,
    clearFeatureRegistry,
    getFeatureRegistrySnapshot,
    getFeatureRegistrySummary,
} from "../frontend/dashboard-user/core/feature-registry.js";

describe("KANTOONG CORE — Feature Registry", () => {
    beforeEach(() => {
        clearFeatureRegistry();
    });

    describe("registerFeature()", () => {
        it("mendaftarkan fitur yang valid", () => {
            const result = registerFeature({
                id: "profile",
                name: "Profil",
                description: "Pengaturan profil pengguna",
            });

            expect(result.success).toBe(true);
            expect(result.feature.id).toBe("profile");
            expect(getFeature("profile").name).toBe("Profil");
        });

        it("menormalisasi ID menjadi huruf kecil", () => {
            const result = registerFeature({
                id: "  PROFILE  ",
                name: "Profil",
            });

            expect(result.success).toBe(true);
            expect(result.feature.id).toBe("profile");
            expect(hasFeature("PROFILE")).toBe(true);
        });

        it("menolak fitur tanpa ID yang valid", () => {
            const result = registerFeature({
                name: "Profil",
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe("INVALID_FEATURE");
            expect(result.details).toContain("INVALID_FEATURE_ID");
        });

        it("menolak fitur tanpa nama yang valid", () => {
            const result = registerFeature({
                id: "profile",
                name: " ",
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe("INVALID_FEATURE");
            expect(result.details).toContain("INVALID_FEATURE_NAME");
        });

        it("menolak input yang bukan objek fitur", () => {
            const result = registerFeature(null);

            expect(result.success).toBe(false);
            expect(result.error).toBe("INVALID_FEATURE");
            expect(result.details).toContain("FEATURE_MUST_BE_OBJECT");
        });

        it("menolak tipe properti opsional yang tidak valid", () => {
            const result = registerFeature({
                id: "profile",
                name: "Profil",
                description: 123,
                category: [],
                enabled: "yes",
            });

            expect(result.success).toBe(false);
            expect(result.details).toContain(
                "INVALID_FEATURE_DESCRIPTION"
            );
            expect(result.details).toContain(
                "INVALID_FEATURE_CATEGORY"
            );
            expect(result.details).toContain(
                "INVALID_FEATURE_ENABLED"
            );
        });

        it("menolak ID duplikat secara default", () => {
            registerFeature({
                id: "profile",
                name: "Profil Pertama",
            });

            const result = registerFeature({
                id: "PROFILE",
                name: "Profil Kedua",
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe("DUPLICATE_FEATURE_ID");
            expect(getFeature("profile").name).toBe("Profil Pertama");
        });

        it("mengizinkan penggantian fitur dengan replace: true", () => {
            registerFeature({
                id: "profile",
                name: "Profil Pertama",
            });

            const result = registerFeature(
                {
                    id: "profile",
                    name: "Profil Baru",
                },
                { replace: true }
            );

            expect(result.success).toBe(true);
            expect(getFeature("profile").name).toBe("Profil Baru");
            expect(getAllFeatures()).toHaveLength(1);
        });

        it("membekukan objek fitur terdaftar pada level teratas", () => {
            const result = registerFeature({
                id: "profile",
                name: "Profil",
            });

            expect(Object.isFrozen(result.feature)).toBe(true);
        });
    });

    describe("registerFeatures()", () => {
        it("mendaftarkan beberapa fitur sekaligus", () => {
            const result = registerFeatures([
                { id: "profile", name: "Profil" },
                { id: "orders", name: "Pesanan" },
            ]);

            expect(result.success).toBe(true);
            expect(result.totalRegistered).toBe(2);
            expect(result.totalRejected).toBe(0);
            expect(getAllFeatures()).toHaveLength(2);
        });

        it("tetap memproses fitur valid ketika fitur lain gagal", () => {
            const result = registerFeatures([
                { id: "profile", name: "Profil" },
                { id: "orders", name: "" },
                { id: "wishlist", name: "Wishlist" },
            ]);

            expect(result.success).toBe(false);
            expect(result.totalRegistered).toBe(2);
            expect(result.totalRejected).toBe(1);
            expect(hasFeature("profile")).toBe(true);
            expect(hasFeature("wishlist")).toBe(true);
        });

        it("menolak input massal yang bukan array", () => {
            const result = registerFeatures({ id: "profile" });

            expect(result.success).toBe(false);
            expect(result.error).toBe("FEATURES_MUST_BE_ARRAY");
            expect(result.registered).toEqual([]);
            expect(result.rejected).toEqual([]);
        });
    });

    describe("pencarian dan filter fitur", () => {
        beforeEach(() => {
            registerFeatures([
                {
                    id: "profile",
                    name: "Profil",
                    category: "account",
                },
                {
                    id: "orders",
                    name: "Pesanan",
                    category: "shopping",
                },
                {
                    id: "wishlist",
                    name: "Wishlist",
                    category: "shopping",
                    enabled: false,
                },
                {
                    id: "support",
                    name: "Bantuan",
                    enabled: true,
                },
            ]);
        });

        it("mengambil fitur berdasarkan ID tanpa membedakan kapitalisasi", () => {
            expect(getFeature("PROFILE").name).toBe("Profil");
            expect(getFeature("unknown")).toBeNull();
            expect(getFeature("   ")).toBeNull();
            expect(getFeature(null)).toBeNull();
        });

        it("memeriksa keberadaan fitur", () => {
            expect(hasFeature("profile")).toBe(true);
            expect(hasFeature("PROFILE")).toBe(true);
            expect(hasFeature("unknown")).toBe(false);
            expect(hasFeature(" ")).toBe(false);
        });

        it("mengambil semua fitur terdaftar", () => {
            expect(getAllFeatures()).toHaveLength(4);
        });

        it("menganggap fitur tanpa enabled sebagai aktif", () => {
            const enabled = getEnabledFeatures();
            const ids = enabled.map((feature) => feature.id);

            expect(ids).toContain("profile");
            expect(ids).toContain("support");
            expect(ids).not.toContain("wishlist");
            expect(enabled).toHaveLength(3);
        });

        it("memfilter fitur berdasarkan kategori tanpa membedakan kapitalisasi", () => {
            const result = getFeaturesByCategory(" SHOPPING ");

            expect(result).toHaveLength(2);
            expect(result.map((feature) => feature.id)).toEqual([
                "orders",
                "wishlist",
            ]);
        });

        it("mengembalikan array kosong untuk kategori tidak valid atau tidak ditemukan", () => {
            expect(getFeaturesByCategory(" ")).toEqual([]);
            expect(getFeaturesByCategory(null)).toEqual([]);
            expect(getFeaturesByCategory("unknown")).toEqual([]);
        });
    });

    describe("unregisterFeature()", () => {
        it("menghapus fitur yang terdaftar", () => {
            registerFeature({
                id: "profile",
                name: "Profil",
            });

            const result = unregisterFeature("PROFILE");

            expect(result.success).toBe(true);
            expect(result.featureId).toBe("profile");
            expect(hasFeature("profile")).toBe(false);
        });

        it("memberi error jika fitur tidak ditemukan", () => {
            const result = unregisterFeature("unknown");

            expect(result.success).toBe(false);
            expect(result.error).toBe("FEATURE_NOT_FOUND");
        });

        it("menolak ID yang tidak valid", () => {
            const result = unregisterFeature(" ");

            expect(result.success).toBe(false);
            expect(result.error).toBe("INVALID_FEATURE_ID");
        });
    });

    describe("snapshot, summary, dan reset", () => {
        it("membuat snapshot tanpa mengubah registry internal", () => {
            registerFeature({
                id: "profile",
                name: "Profil",
            });

            const snapshot = getFeatureRegistrySnapshot();
            snapshot[0].name = "Nama yang Diubah";

            expect(getFeature("profile").name).toBe("Profil");
        });

        it("menghasilkan ringkasan registry yang benar", () => {
            registerFeatures([
                { id: "profile", name: "Profil" },
                { id: "orders", name: "Pesanan", enabled: false },
                { id: "support", name: "Bantuan" },
            ]);

            expect(getFeatureRegistrySummary()).toEqual({
                version: "1.0.0",
                total: 3,
                enabled: 2,
                disabled: 1,
                ids: ["profile", "orders", "support"],
            });
        });

        it("membersihkan seluruh registry dan melaporkan jumlah yang dihapus", () => {
            registerFeatures([
                { id: "profile", name: "Profil" },
                { id: "orders", name: "Pesanan" },
            ]);

            const result = clearFeatureRegistry();

            expect(result.success).toBe(true);
            expect(result.removedCount).toBe(2);
            expect(getAllFeatures()).toEqual([]);
        });
    });
});
