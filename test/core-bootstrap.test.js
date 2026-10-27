
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    ensureFeaturesLoaded: vi.fn(),
    getFeatureLoadReport: vi.fn(),
    getAllFeatures: vi.fn(),
    initializeFeatureController: vi.fn(),
    setControllerContext: vi.fn(),
    getControllerContext: vi.fn(),
    initializeFeatureRouter: vi.fn(),
    initializeCommandCenter: vi.fn(),
    handleError: vi.fn(),
}));

vi.mock("../frontend/dashboard-user/core/feature-loader.js", () => ({
    ensureFeaturesLoaded: mocks.ensureFeaturesLoaded,
    getFeatureLoadReport: mocks.getFeatureLoadReport,
}));

vi.mock("../frontend/dashboard-user/core/feature-registry.js", () => ({
    getAllFeatures: mocks.getAllFeatures,
}));

vi.mock("../frontend/dashboard-user/core/feature-controller.js", () => ({
    initializeFeatureController: mocks.initializeFeatureController,
    setControllerContext: mocks.setControllerContext,
    getControllerContext: mocks.getControllerContext,
}));

vi.mock("../frontend/dashboard-user/core/feature-router.js", () => ({
    initializeFeatureRouter: mocks.initializeFeatureRouter,
}));

vi.mock("../frontend/dashboard-user/core/command-center.js", () => ({
    initializeCommandCenter: mocks.initializeCommandCenter,
}));

vi.mock("../frontend/dashboard-user/core/error-handler.js", () => ({
    handleError: mocks.handleError,
}));

describe("Core Bootstrap", () => {
    let core;

    const sampleFeatures = [
        {
            id: "profile",
            name: "Profil",
            enabled: true,
            category: "account",
        },
        {
            id: "orders",
            name: "Pesanan",
            enabled: false,
            category: "commerce",
        },
    ];

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();

        mocks.ensureFeaturesLoaded.mockResolvedValue([]);
        mocks.getFeatureLoadReport.mockReturnValue({
            success: true,
            loaded: 2,
        });
        mocks.getAllFeatures.mockReturnValue(sampleFeatures);
        mocks.initializeFeatureController.mockResolvedValue(undefined);
        mocks.setControllerContext.mockImplementation(() => {});
        mocks.getControllerContext.mockReturnValue({});
        mocks.initializeFeatureRouter.mockResolvedValue(undefined);
        mocks.initializeCommandCenter.mockReturnValue({
            success: true,
        });
        mocks.handleError.mockImplementation((error) => ({
            userMessage: error?.message ?? "Terjadi kesalahan.",
        }));

        core = await import(
            "../frontend/dashboard-user/core/core-bootstrap.js"
        );
    });

    describe("API dan status awal", () => {
        it("menyediakan versi dan status yang benar", () => {
            expect(core.CORE_BOOTSTRAP_VERSION).toBe("1.0.0");
            expect(core.CORE_BOOTSTRAP_STATUS).toEqual({
                IDLE: "idle",
                INITIALIZING: "initializing",
                READY: "ready",
                DEGRADED: "degraded",
                ERROR: "error",
            });
        });

        it("dimulai dalam status idle", () => {
            expect(core.getCoreBootstrapStatus()).toMatchObject({
                version: "1.0.0",
                status: "idle",
                initialized: false,
                hasError: false,
                startedAt: null,
                completedAt: null,
            });
        });

        it("belum siap sebelum bootstrap berhasil", () => {
            expect(core.isCoreReady()).toBe(false);
        });

        it("hasil bootstrap awal bernilai null", () => {
            expect(core.getCoreBootstrapResult()).toBeNull();
        });

        it("menyediakan API melalui default export", () => {
            expect(core.default).toMatchObject({
                bootstrapCore: expect.any(Function),
                getCoreBootstrapStatus: expect.any(Function),
                getCoreBootstrapResult: expect.any(Function),
                getCoreFeatureSummary: expect.any(Function),
                isCoreReady: expect.any(Function),
                resetCoreBootstrapState: expect.any(Function),
            });
        });
    });

    describe("Bootstrap berhasil", () => {
        it("menjalankan seluruh tahap inisialisasi", async () => {
            const result = await core.bootstrapCore();

            expect(result.success).toBe(true);
            expect(result.status).toBe("ready");

            expect(mocks.ensureFeaturesLoaded).toHaveBeenCalledOnce();
            expect(mocks.initializeFeatureController).toHaveBeenCalledOnce();
            expect(mocks.initializeFeatureRouter).toHaveBeenCalledOnce();
            expect(mocks.initializeCommandCenter).toHaveBeenCalledOnce();
        });

        it("menjalankan tahap sesuai urutan", async () => {
            const order = [];

            mocks.ensureFeaturesLoaded.mockImplementation(async () => {
                order.push("loader");
                return [];
            });

            mocks.initializeFeatureController.mockImplementation(async () => {
                order.push("controller");
            });

            mocks.initializeFeatureRouter.mockImplementation(async () => {
                order.push("router");
            });

            mocks.initializeCommandCenter.mockImplementation(() => {
                order.push("command-center");
                return { success: true };
            });

            await core.bootstrapCore();

            expect(order).toEqual([
                "loader",
                "controller",
                "router",
                "command-center",
            ]);
        });

        it("menghasilkan laporan tahap bootstrap", async () => {
            const result = await core.bootstrapCore();

            expect(result.stages.map((stage) => stage.name)).toEqual([
                "prepare-context",
                "load-features",
                "initialize-feature-controller",
                "initialize-feature-router",
                "initialize-command-center",
            ]);

            expect(result.stages.every(
                (stage) => stage.status === "success",
            )).toBe(true);
        });

        it("mencatat fitur yang ditemukan", async () => {
            const result = await core.bootstrapCore();

            expect(result.featureCount).toBe(2);
            expect(result.features).toEqual([
                {
                    id: "profile",
                    name: "Profil",
                    enabled: true,
                    category: "account",
                },
                {
                    id: "orders",
                    name: "Pesanan",
                    enabled: false,
                    category: "commerce",
                },
            ]);
        });

        it("menyimpan laporan loader pada hasil bootstrap", async () => {
            const result = await core.bootstrapCore();

            expect(result.loadReport).toEqual({
                success: true,
                loaded: 2,
            });

            expect(mocks.getFeatureLoadReport).toHaveBeenCalledOnce();
        });

        it("mengubah status menjadi ready", async () => {
            await core.bootstrapCore();

            expect(core.isCoreReady()).toBe(true);
            expect(core.getCoreBootstrapStatus()).toMatchObject({
                status: "ready",
                initialized: true,
                hasError: false,
            });
        });

        it("mencatat waktu mulai dan selesai", async () => {
            const result = await core.bootstrapCore();

            expect(Date.parse(result.startedAt)).not.toBeNaN();
            expect(Date.parse(result.completedAt)).not.toBeNaN();
            expect(result.durationMs).toBeGreaterThanOrEqual(0);
        });

        it("menggunakan tenantId yang diberikan", async () => {
            await core.bootstrapCore({
                tenantId: "tenant-demo",
            });

            expect(mocks.setControllerContext).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: "tenant-demo",
                    source: "core-bootstrap",
                    bootstrapVersion: "1.0.0",
                }),
            );
        });

        it("membersihkan spasi pada tenantId", async () => {
            await core.bootstrapCore({
                tenantId: "  tenant-demo  ",
            });

            expect(mocks.setControllerContext).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: "tenant-demo",
                }),
            );
        });

        it("mempertahankan tenantId dari context sebelumnya", async () => {
            mocks.getControllerContext.mockReturnValue({
                tenantId: "tenant-existing",
                customValue: "preserved",
            });

            await core.bootstrapCore();

            expect(mocks.setControllerContext).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: "tenant-existing",
                    customValue: "preserved",
                }),
            );
        });

        it("mengutamakan context yang diberikan", async () => {
            await core.bootstrapCore({
                context: {
                    tenantId: "tenant-context",
                    customValue: "test",
                },
            });

            expect(mocks.setControllerContext).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: "tenant-context",
                    customValue: "test",
                }),
            );
        });

        it("meneruskan context ke feature controller", async () => {
            await core.bootstrapCore({
                tenantId: "tenant-demo",
            });

            expect(mocks.initializeFeatureController).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: "tenant-demo",
                    source: "core-bootstrap",
                }),
            );
        });

        it("mengirim tenantId ke Command Center", async () => {
            await core.bootstrapCore({
                tenantId: "tenant-demo",
            });

            expect(mocks.initializeCommandCenter).toHaveBeenCalledWith({
                source: "core-bootstrap",
                tenantId: "tenant-demo",
            });
        });

        it("membekukan objek hasil bootstrap", async () => {
            const result = await core.bootstrapCore();

            expect(Object.isFrozen(result)).toBe(true);
        });
    });

    describe("Pencegahan bootstrap berulang", () => {
        it("menggunakan hasil yang sama saat bootstrap dipanggil lagi", async () => {
            const first = await core.bootstrapCore();
            const second = await core.bootstrapCore();

            expect(second).toBe(first);
            expect(mocks.ensureFeaturesLoaded).toHaveBeenCalledOnce();
        });

        it("menjalankan ulang bootstrap jika force true", async () => {
            await core.bootstrapCore();
            const second = await core.bootstrapCore({ force: true });

            expect(second.success).toBe(true);
            expect(mocks.ensureFeaturesLoaded).toHaveBeenCalledTimes(2);
        });

        it("membagikan hasil pada pemanggilan bersamaan", async () => {
            let resolveLoader;

            mocks.ensureFeaturesLoaded.mockImplementation(
                () => new Promise((resolve) => {
                    resolveLoader = resolve;
                }),
            );

            const first = core.bootstrapCore();
            const second = core.bootstrapCore();

            resolveLoader([]);

            const [firstResult, secondResult] = await Promise.all([
                first,
                second,
            ]);

            expect(firstResult).toBe(secondResult);
            expect(mocks.ensureFeaturesLoaded).toHaveBeenCalledOnce();
        });
    });

    describe("Penanganan kegagalan", () => {
        it("melaporkan error saat feature loader gagal", async () => {
            mocks.ensureFeaturesLoaded.mockRejectedValue(
                new Error("Loader gagal"),
            );

            const result = await core.bootstrapCore();

            expect(result.success).toBe(false);
            expect(result.status).toBe("error");
            expect(result.error.message).toBe("Loader gagal");
            expect(core.isCoreReady()).toBe(false);
        });

        it("menggunakan kode error fallback jika tidak tersedia", async () => {
            mocks.ensureFeaturesLoaded.mockRejectedValue(
                new Error("Kegagalan umum"),
            );

            const result = await core.bootstrapCore();

            expect(result.error.code).toBe("CORE_BOOTSTRAP_FAILED");
        });

        it("mencatat tahap bootstrap yang gagal", async () => {
            mocks.initializeFeatureRouter.mockRejectedValue(
                new Error("Router gagal"),
            );

            const result = await core.bootstrapCore();

            expect(result.stages.at(-1)).toMatchObject({
                name: "bootstrap",
                status: "failed",
            });
        });

        it("memanggil error handler ketika bootstrap gagal", async () => {
            const error = new Error("Loader gagal");
            mocks.ensureFeaturesLoaded.mockRejectedValue(error);

            await core.bootstrapCore();

            expect(mocks.handleError).toHaveBeenCalledWith(error, {
                context: "core-bootstrap",
            });
        });

        it("menyimpan status error pada diagnostik", async () => {
            mocks.ensureFeaturesLoaded.mockRejectedValue(
                new Error("Loader gagal"),
            );

            await core.bootstrapCore();

            expect(core.getCoreBootstrapStatus()).toMatchObject({
                status: "error",
                initialized: false,
                hasError: true,
            });
        });

        it("tidak menganggap hasil gagal sebagai Core siap", async () => {
            mocks.ensureFeaturesLoaded.mockRejectedValue(
                new Error("Loader gagal"),
            );

            await core.bootstrapCore();

            expect(core.isCoreReady()).toBe(false);
        });
    });

    describe("Ringkasan fitur", () => {
        it("menghitung total, enabled, dan disabled", () => {
            expect(core.getCoreFeatureSummary()).toMatchObject({
                total: 2,
                enabled: 1,
                disabled: 1,
            });
        });

        it("mengembalikan detail fitur", () => {
            const summary = core.getCoreFeatureSummary();

            expect(summary.features).toEqual([
                {
                    id: "profile",
                    name: "Profil",
                    category: "account",
                    enabled: true,
                },
                {
                    id: "orders",
                    name: "Pesanan",
                    category: "commerce",
                    enabled: false,
                },
            ]);
        });

        it("membekukan objek ringkasan dan setiap detail", () => {
            const summary = core.getCoreFeatureSummary();

            expect(Object.isFrozen(summary)).toBe(true);
            expect(summary.features.every(
                (feature) => Object.isFrozen(feature),
            )).toBe(true);
        });
    });

    describe("Reset status", () => {
        it("mengembalikan status ke idle", async () => {
            await core.bootstrapCore();

            const status = core.resetCoreBootstrapState();

            expect(status.status).toBe("idle");
            expect(status.initialized).toBe(false);
            expect(status.hasError).toBe(false);
        });

        it("menghapus hasil bootstrap terakhir", async () => {
            await core.bootstrapCore();
            core.resetCoreBootstrapState();

            expect(core.getCoreBootstrapResult()).toBeNull();
        });

        it("mengizinkan bootstrap baru setelah reset", async () => {
            await core.bootstrapCore();
            core.resetCoreBootstrapState();

            const result = await core.bootstrapCore();

            expect(result.success).toBe(true);
            expect(mocks.ensureFeaturesLoaded).toHaveBeenCalledTimes(2);
        });

        it("menolak reset saat bootstrap masih berjalan", async () => {
            let resolveLoader;

            mocks.ensureFeaturesLoaded.mockImplementation(
                () => new Promise((resolve) => {
                    resolveLoader = resolve;
                }),
            );

            const pending = core.bootstrapCore();

            expect(() => core.resetCoreBootstrapState()).toThrow(
                expect.objectContaining({
                    code: "BOOTSTRAP_IN_PROGRESS",
                }),
            );

            resolveLoader([]);
            await pending;
        });
    });
});
