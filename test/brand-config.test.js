
import { beforeEach, describe, expect, it, vi } from "vitest";

import BrandConfig, {
    BRAND_CONFIG_VERSION,
    DEFAULT_BRAND_CONFIG,
    getDefaultBrandConfig,
    validateBrandConfig,
    getBrandConfig,
    setBrandConfig,
    updateBrandConfig,
    resetBrandConfig,
    hasCustomBrandConfig,
    onBrandConfigChange,
    getConfiguredTenantIds,
    clearBrandConfigCache,
} from "../frontend/dashboard-user/core/brand-config.js";

describe("Brand Config", () => {
    beforeEach(() => {
        clearBrandConfigCache();
        vi.restoreAllMocks();
    });

    describe("API dan konfigurasi default", () => {
        it("menyediakan versi konfigurasi yang benar", () => {
            expect(BRAND_CONFIG_VERSION).toBe(1);
            expect(BrandConfig.BRAND_CONFIG_VERSION).toBe(1);
        });

        it("menggunakan konfigurasi default KANTOONG yang netral", () => {
            expect(DEFAULT_BRAND_CONFIG.brand.name).toBe("KANTOONG");
            expect(DEFAULT_BRAND_CONFIG.appearance.theme).toBe("system");
            expect(DEFAULT_BRAND_CONFIG.dashboard.layout).toBe("bento");
            expect(DEFAULT_BRAND_CONFIG.localization.currency).toBe("IDR");
        });

        it("menyediakan API melalui default export", () => {
            expect(BrandConfig).toMatchObject({
                getDefaultBrandConfig: expect.any(Function),
                validateBrandConfig: expect.any(Function),
                getBrandConfig: expect.any(Function),
                setBrandConfig: expect.any(Function),
                updateBrandConfig: expect.any(Function),
                resetBrandConfig: expect.any(Function),
                hasCustomBrandConfig: expect.any(Function),
                onBrandConfigChange: expect.any(Function),
                getConfiguredTenantIds: expect.any(Function),
                clearBrandConfigCache: expect.any(Function),
            });
        });

        it("mengembalikan salinan konfigurasi default", () => {
            const config = getDefaultBrandConfig();

            config.brand.name = "Brand Uji";
            config.appearance.colors.primary = "#123456";

            expect(getDefaultBrandConfig().brand.name).toBe("KANTOONG");
            expect(
                getDefaultBrandConfig().appearance.colors.primary,
            ).toBe("#111111");
        });

        it("membekukan konfigurasi default", () => {
            expect(Object.isFrozen(DEFAULT_BRAND_CONFIG)).toBe(true);
            expect(Object.isFrozen(DEFAULT_BRAND_CONFIG.brand)).toBe(true);
            expect(
                Object.isFrozen(DEFAULT_BRAND_CONFIG.appearance.colors),
            ).toBe(true);
            expect(
                Object.isFrozen(DEFAULT_BRAND_CONFIG.localization),
            ).toBe(true);
        });
    });

    describe("Validasi konfigurasi", () => {
        it("menerima konfigurasi default", () => {
            expect(validateBrandConfig(getDefaultBrandConfig())).toEqual({
                valid: true,
                errors: [],
            });
        });

        it("menolak null, array, dan nilai primitif", () => {
            for (const value of [null, [], "config", 123]) {
                expect(validateBrandConfig(value).valid).toBe(false);
            }
        });

        it("menolak bagian brand yang bukan object", () => {
            const config = getDefaultBrandConfig();
            config.brand = "bukan object";

            expect(validateBrandConfig(config).errors).toContain(
                "Bagian brand harus berupa object.",
            );
        });

        it("menolak nama brand kosong", () => {
            const config = getDefaultBrandConfig();
            config.brand.name = "   ";

            expect(validateBrandConfig(config).errors).toContain(
                "Nama brand tidak boleh kosong.",
            );
        });

        it("menolak teks brand yang melebihi batas karakter", () => {
            const config = getDefaultBrandConfig();
            config.brand.name = "A".repeat(101);

            expect(validateBrandConfig(config).errors).toContain(
                "brand.name harus berupa teks maksimal 100 karakter.",
            );
        });

        it("menolak versi konfigurasi yang tidak didukung", () => {
            const config = getDefaultBrandConfig();
            config.version = 99;

            expect(validateBrandConfig(config).errors).toContain(
                "Versi konfigurasi tidak didukung.",
            );
        });

        it.each(["light", "dark", "system"])(
            "menerima tema %s",
            (theme) => {
                const config = getDefaultBrandConfig();
                config.appearance.theme = theme;

                expect(validateBrandConfig(config).valid).toBe(true);
            },
        );

        it("menolak tema yang tidak dikenal", () => {
            const config = getDefaultBrandConfig();
            config.appearance.theme = "neon";

            expect(validateBrandConfig(config).errors).toContain(
                "Tema harus light, dark, atau system.",
            );
        });

        it("menolak format warna yang tidak valid", () => {
            const config = getDefaultBrandConfig();
            config.appearance.colors.primary = "red";

            expect(validateBrandConfig(config).errors).toContain(
                'Warna "primary" harus memakai format hex #RRGGBB.',
            );
        });

        it("menolak URL dengan protokol berbahaya", () => {
            const config = getDefaultBrandConfig();
            config.brand.logoUrl = "javascript:alert(1)";

            expect(validateBrandConfig(config).errors).toContain(
                "brand.logoUrl harus berupa URL HTTP atau HTTPS yang valid.",
            );
        });

        it("menerima URL HTTP dan HTTPS yang valid", () => {
            const config = getDefaultBrandConfig();
            config.brand.logoUrl = "https://example.com/logo.png";
            config.brand.websiteUrl = "http://example.com";

            expect(validateBrandConfig(config).valid).toBe(true);
        });

        it("menolak format email dukungan yang tidak valid", () => {
            const config = getDefaultBrandConfig();
            config.brand.supportEmail = "email-tidak-valid";

            expect(validateBrandConfig(config).errors).toContain(
                "Format email dukungan tidak valid.",
            );
        });

        it("menolak layout dashboard yang tidak dikenal", () => {
            const config = getDefaultBrandConfig();
            config.dashboard.layout = "circle";

            expect(validateBrandConfig(config).errors).toContain(
                "Layout harus bento, grid, atau list.",
            );
        });

        it("menolak jumlah kolom di luar rentang 1–12", () => {
            const config = getDefaultBrandConfig();
            config.dashboard.cardColumns.desktop = 13;

            expect(validateBrandConfig(config).errors).toContain(
                "Jumlah kolom desktop harus bilangan bulat 1–12.",
            );
        });

        it("menolak nilai boolean yang salah tipe", () => {
            const config = getDefaultBrandConfig();
            config.dashboard.showSearch = "yes";

            expect(validateBrandConfig(config).errors).toContain(
                "dashboard.showSearch harus berupa boolean.",
            );
        });

        it("menolak localization dengan nilai kosong", () => {
            const config = getDefaultBrandConfig();
            config.localization.language = " ";

            expect(validateBrandConfig(config).errors).toContain(
                "localization.language harus berupa teks yang valid.",
            );
        });

        it("menolak bagian features yang bukan object", () => {
            const config = getDefaultBrandConfig();
            config.features = [];

            expect(validateBrandConfig(config).errors).toContain(
                "Bagian features harus berupa object.",
            );
        });
    });

    describe("Konfigurasi tenant", () => {
        it("mengembalikan default untuk tenant tanpa konfigurasi khusus", () => {
            expect(getBrandConfig("tenant-a").brand.name).toBe("KANTOONG");
            expect(hasCustomBrandConfig("tenant-a")).toBe(false);
        });

        it("menyimpan konfigurasi tenant yang valid", () => {
            const result = setBrandConfig("tenant-a", {
                brand: {
                    name: "Toko Contoh",
                },
            });

            expect(result.brand.name).toBe("Toko Contoh");
            expect(getBrandConfig("tenant-a").brand.name).toBe("Toko Contoh");
            expect(hasCustomBrandConfig("tenant-a")).toBe(true);
        });

        it("mempertahankan nilai default yang tidak diubah", () => {
            setBrandConfig("tenant-a", {
                brand: {
                    name: "Toko Contoh",
                },
            });

            const config = getBrandConfig("tenant-a");

            expect(config.brand.legalName).toBe("");
            expect(config.appearance.theme).toBe("system");
            expect(config.dashboard.layout).toBe("bento");
        });

        it("mengisolasi konfigurasi antar-tenant", () => {
            setBrandConfig("tenant-a", {
                brand: { name: "Toko A" },
            });

            setBrandConfig("tenant-b", {
                brand: { name: "Toko B" },
            });

            expect(getBrandConfig("tenant-a").brand.name).toBe("Toko A");
            expect(getBrandConfig("tenant-b").brand.name).toBe("Toko B");
        });

        it("mengembalikan salinan agar mutasi hasil tidak mengubah cache", () => {
            setBrandConfig("tenant-a", {
                brand: { name: "Toko A" },
            });

            const result = getBrandConfig("tenant-a");
            result.brand.name = "Nama yang dimutasi";

            expect(getBrandConfig("tenant-a").brand.name).toBe("Toko A");
        });

        it("menolak konfigurasi tenant yang tidak valid", () => {
            expect(() => setBrandConfig("tenant-a", {
                brand: { name: "" },
            })).toThrow("Konfigurasi brand tidak valid.");

            expect(hasCustomBrandConfig("tenant-a")).toBe(false);
        });

        it("menolak config yang bukan object", () => {
            expect(() => setBrandConfig("tenant-a", null)).toThrow(
                "Config harus berupa object.",
            );
        });

        it("menolak tenantId yang bukan string", () => {
            expect(() => getBrandConfig(123)).toThrow(
                "tenantId harus berupa string.",
            );
        });

        it("menolak tenantId kosong", () => {
            expect(() => getBrandConfig("   ")).toThrow(
                "tenantId tidak valid.",
            );
        });

        it("menolak tenantId yang terlalu panjang", () => {
            expect(() => getBrandConfig("a".repeat(129))).toThrow(
                "tenantId tidak valid.",
            );
        });

        it("menormalisasi spasi pada tenantId", () => {
            setBrandConfig(" tenant-a ", {
                brand: { name: "Toko A" },
            });

            expect(getBrandConfig("tenant-a").brand.name).toBe("Toko A");
        });

        it("menggabungkan perubahan parsial dengan konfigurasi sebelumnya", () => {
            setBrandConfig("tenant-a", {
                brand: { name: "Toko A" },
            });

            updateBrandConfig("tenant-a", {
                appearance: { theme: "dark" },
            });

            const config = getBrandConfig("tenant-a");

            expect(config.brand.name).toBe("Toko A");
            expect(config.appearance.theme).toBe("dark");
        });

        it("menolak perubahan parsial yang bukan object", () => {
            expect(() => updateBrandConfig("tenant-a", null)).toThrow(
                "Perubahan config harus berupa object.",
            );
        });

        it("menghapus konfigurasi khusus tenant", () => {
            setBrandConfig("tenant-a", {
                brand: { name: "Toko A" },
            });

            expect(resetBrandConfig("tenant-a")).toBe(true);
            expect(hasCustomBrandConfig("tenant-a")).toBe(false);
            expect(getBrandConfig("tenant-a").brand.name).toBe("KANTOONG");
        });

        it("mengembalikan false saat reset tenant yang tidak ada", () => {
            expect(resetBrandConfig("tenant-tidak-ada")).toBe(false);
        });

        it("mencatat daftar tenant yang dikonfigurasi", () => {
            setBrandConfig("tenant-a", {
                brand: { name: "Toko A" },
            });
            setBrandConfig("tenant-b", {
                brand: { name: "Toko B" },
            });

            expect(getConfiguredTenantIds()).toEqual([
                "tenant-a",
                "tenant-b",
            ]);
        });

        it("membersihkan seluruh cache tenant", () => {
            setBrandConfig("tenant-a", {
                brand: { name: "Toko A" },
            });
            setBrandConfig("tenant-b", {
                brand: { name: "Toko B" },
            });

            expect(clearBrandConfigCache()).toBe(2);
            expect(getConfiguredTenantIds()).toEqual([]);
            expect(hasCustomBrandConfig("tenant-a")).toBe(false);
        });
    });

    describe("Notifikasi perubahan konfigurasi", () => {
        it("memberi tahu listener ketika konfigurasi berubah", () => {
            const listener = vi.fn();
            const unsubscribe = onBrandConfigChange(listener);

            setBrandConfig("tenant-a", {
                brand: { name: "Toko A" },
            });

            expect(listener).toHaveBeenCalledOnce();
            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: "tenant-a",
                    config: expect.objectContaining({
                        brand: expect.objectContaining({
                            name: "Toko A",
                        }),
                    }),
                    timestamp: expect.any(String),
                }),
            );

            unsubscribe();
        });

        it("mengembalikan fungsi unsubscribe", () => {
            const listener = vi.fn();
            const unsubscribe = onBrandConfigChange(listener);

            expect(typeof unsubscribe).toBe("function");

            unsubscribe();

            setBrandConfig("tenant-a", {
                brand: { name: "Toko A" },
            });

            expect(listener).not.toHaveBeenCalled();
        });

        it("menolak listener yang bukan function", () => {
            expect(() => onBrandConfigChange("bukan function")).toThrow(
                "Listener harus berupa function.",
            );
        });

        it("tetap menjalankan listener lain jika satu listener gagal", () => {
            const errorSpy = vi.spyOn(console, "error").mockImplementation(
                () => {},
            );

            const failingListener = vi.fn(() => {
                throw new Error("Listener gagal");
            });

            const workingListener = vi.fn();

            const unsubscribeFailing = onBrandConfigChange(failingListener);
            const unsubscribeWorking = onBrandConfigChange(workingListener);

            setBrandConfig("tenant-a", {
                brand: { name: "Toko A" },
            });

            expect(failingListener).toHaveBeenCalledOnce();
            expect(workingListener).toHaveBeenCalledOnce();
            expect(errorSpy).toHaveBeenCalledOnce();

            unsubscribeFailing();
            unsubscribeWorking();
        });
    });
});
