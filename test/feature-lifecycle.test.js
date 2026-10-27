
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

let lifecycle;

beforeEach(async () => {
    // Reset Map internal agar setiap tes dimulai dengan kondisi bersih.
    vi.resetModules();

    lifecycle = await import(
        "../frontend/dashboard-user/core/feature-lifecycle.js"
    );
});

afterEach(() => {
    vi.restoreAllMocks();
});

function createFeature(id = "test-feature", options = {}) {
    return {
        id,
        ...options,
    };
}

function createElement() {
    // Objek sederhana untuk simulasi elemen mount.
    return {};
}

describe("Feature Lifecycle — API dan registrasi", () => {
    it("menyediakan API default dengan versi yang benar", () => {
        expect(lifecycle.default.version).toBe("1.0.0");
        expect(lifecycle.default.registerFeatureLifecycle).toBeTypeOf(
            "function",
        );
        expect(lifecycle.default.initializeFeature).toBeTypeOf(
            "function",
        );
        expect(lifecycle.default.mountFeature).toBeTypeOf("function");
        expect(lifecycle.default.activateFeature).toBeTypeOf(
            "function",
        );
        expect(lifecycle.default.deactivateFeature).toBeTypeOf(
            "function",
        );
        expect(lifecycle.default.unmountFeature).toBeTypeOf(
            "function",
        );
    });

    it("mendaftarkan fitur dengan ID yang dinormalisasi", () => {
        const result = lifecycle.registerFeatureLifecycle(
            createFeature("  Customer-Profile  "),
        );

        expect(result.success).toBe(true);
        expect(result.featureId).toBe("customer-profile");
        expect(result.state).toBe("registered");
    });

    it("menolak definisi fitur yang tidak valid", () => {
        const result = lifecycle.registerFeatureLifecycle(null);

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("LIFECYCLE_REGISTER_FAILED");
    });

    it("menolak ID fitur kosong", () => {
        const result = lifecycle.registerFeatureLifecycle(
            createFeature("   "),
        );

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("LIFECYCLE_REGISTER_FAILED");
    });

    it("mengembalikan null untuk fitur yang belum terdaftar", () => {
        expect(
            lifecycle.getFeatureLifecycleState("unknown-feature"),
        ).toBeNull();
    });

    it("mengembalikan null untuk ID status yang tidak valid", () => {
        expect(lifecycle.getFeatureLifecycleState("  ")).toBeNull();
    });

    it("mengembalikan riwayat kosong untuk fitur yang tidak ditemukan", () => {
        expect(
            lifecycle.getFeatureLifecycleHistory("unknown-feature"),
        ).toEqual([]);
    });

    it("mendaftarkan ulang ID yang sama tanpa membuat record baru", () => {
        lifecycle.registerFeatureLifecycle(createFeature("profile"));

        lifecycle.initializeFeature(
            createFeature("profile"),
        );

        const result = lifecycle.registerFeatureLifecycle(
            createFeature("PROFILE", { label: "Profile terbaru" }),
        );

        expect(result.success).toBe(true);
        expect(result.featureId).toBe("profile");
        expect(lifecycle.getFeatureLifecycleSummary().total).toBe(1);
    });
});

describe("Feature Lifecycle — Inisialisasi", () => {
    it("menginisialisasi fitur dan memperbarui status", async () => {
        const feature = createFeature("profile");

        const result = await lifecycle.initializeFeature(feature, {
            source: "test",
        });

        expect(result.success).toBe(true);
        expect(result.state).toBe("initialized");

        expect(
            lifecycle.getFeatureLifecycleState("profile"),
        ).toMatchObject({
            id: "profile",
            state: "initialized",
            initialized: true,
            mounted: false,
            active: false,
            error: null,
        });
    });

    it("menjalankan onRegister dan onLoad secara berurutan", async () => {
        const calls = [];

        const feature = createFeature("ordered-hooks", {
            lifecycle: {
                onRegister: async () => {
                    calls.push("register");
                },
                onLoad: async () => {
                    calls.push("load");
                },
            },
        });

        await lifecycle.initializeFeature(feature);

        expect(calls).toEqual(["register", "load"]);
    });

    it("menjalankan inisialisasi hanya satu kali", async () => {
        const onLoad = vi.fn();

        const feature = createFeature("once-only", {
            lifecycle: { onLoad },
        });

        const first = await lifecycle.initializeFeature(feature);
        const second = await lifecycle.initializeFeature(feature);

        expect(first.success).toBe(true);
        expect(second.success).toBe(true);
        expect(second.skipped).toBe(true);
        expect(onLoad).toHaveBeenCalledTimes(1);
    });

    it("meneruskan context ke hook inisialisasi", async () => {
        const context = { tenantId: "tenant-test" };
        const onLoad = vi.fn();

        const feature = createFeature("context-test", {
            lifecycle: { onLoad },
        });

        await lifecycle.initializeFeature(feature, context);

        expect(onLoad).toHaveBeenCalledWith(context);
    });

    it("menerima fitur tanpa hook lifecycle", async () => {
        const result = await lifecycle.initializeFeature(
            createFeature("no-hooks"),
        );

        expect(result.success).toBe(true);
        expect(result.state).toBe("initialized");
    });

    it("menghasilkan error jika hook bukan function", async () => {
        const feature = createFeature("invalid-hook", {
            lifecycle: { onLoad: true },
        });

        const result = await lifecycle.initializeFeature(feature);

        expect(result.success).toBe(false);
        expect(result.state).toBe("error");
        expect(result.error.code).toBe(
            "FEATURE_INITIALIZATION_FAILED",
        );
    });

    it("menjalankan onError jika inisialisasi gagal", async () => {
        const onError = vi.fn();

        const feature = createFeature("init-error", {
            lifecycle: {
                onLoad: () => {
                    throw new Error("Load gagal");
                },
                onError,
            },
        });

        const result = await lifecycle.initializeFeature(feature);

        expect(result.success).toBe(false);
        expect(result.error.message).toBe("Load gagal");
        expect(onError).toHaveBeenCalledWith(
            expect.objectContaining({
                phase: "initialize",
                error: expect.objectContaining({
                    code: "FEATURE_INITIALIZATION_FAILED",
                }),
            }),
        );
    });
});

describe("Feature Lifecycle — Mount dan unmount", () => {
    it("menolak mount tanpa elemen", async () => {
        const feature = createFeature("missing-element");

        const result = await lifecycle.mountFeature(feature, null);

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("INVALID_MOUNT_ELEMENT");
    });

    it("memasang fitur yang sudah diinisialisasi", async () => {
        const feature = createFeature("mount-test");
        const element = createElement();

        await lifecycle.initializeFeature(feature);

        const result = await lifecycle.mountFeature(feature, element);

        expect(result.success).toBe(true);
        expect(result.state).toBe("mounted");

        expect(
            lifecycle.getFeatureLifecycleState("mount-test"),
        ).toMatchObject({
            initialized: true,
            mounted: true,
            active: false,
            state: "mounted",
        });
    });

    it("menyertakan element dan feature dalam context onMount", async () => {
        const element = createElement();
        const onMount = vi.fn();

        const feature = createFeature("mount-context", {
            lifecycle: { onMount },
        });

        await lifecycle.initializeFeature(feature);

        const result = await lifecycle.mountFeature(feature, element, {
            source: "dashboard",
        });

        expect(result.success).toBe(true);
        expect(onMount).toHaveBeenCalledWith(
            expect.objectContaining({
                feature,
                element,
                source: "dashboard",
            }),
        );
    });

    it("menjalankan feature.mount sebelum lifecycle.onMount", async () => {
        const calls = [];

        const feature = createFeature("mount-order", {
            mount: async () => {
                calls.push("mount");
            },
            lifecycle: {
                onMount: async () => {
                    calls.push("onMount");
                },
            },
        });

        await lifecycle.initializeFeature(feature);

        const result = await lifecycle.mountFeature(
            feature,
            createElement(),
        );

        expect(result.success).toBe(true);
        expect(calls).toEqual(["mount", "onMount"]);
    });

    it("melewati mount jika elemen yang sama sudah terpasang", async () => {
        const feature = createFeature("mount-skip");
        const element = createElement();

        await lifecycle.initializeFeature(feature);
        await lifecycle.mountFeature(feature, element);

        const result = await lifecycle.mountFeature(feature, element);

        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
    });

    it("melaporkan error jika hook onMount gagal", async () => {
        const feature = createFeature("mount-error", {
            lifecycle: {
                onMount: () => {
                    throw new Error("Mount gagal");
                },
            },
        });

        await lifecycle.initializeFeature(feature);

        const result = await lifecycle.mountFeature(
            feature,
            createElement(),
        );

        expect(result.success).toBe(false);
        expect(result.state).toBe("error");
        expect(result.error.code).toBe("FEATURE_MOUNT_FAILED");
    });

    it("melaporkan error jika feature.mount gagal", async () => {
        const feature = createFeature("mount-method-error", {
            mount: () => {
                throw new Error("Render gagal");
            },
        });

        await lifecycle.initializeFeature(feature);

        const result = await lifecycle.mountFeature(
            feature,
            createElement(),
        );

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("FEATURE_MOUNT_FAILED");
    });

    it("melepas fitur yang telah terpasang", async () => {
        const feature = createFeature("unmount-test", {
            lifecycle: {
                onUnmount: vi.fn(),
            },
        });

        await lifecycle.initializeFeature(feature);
        await lifecycle.mountFeature(feature, createElement());

        const result = await lifecycle.unmountFeature(feature);

        expect(result.success).toBe(true);
        expect(result.state).toBe("unmounted");

        expect(
            lifecycle.getFeatureLifecycleState("unmount-test"),
        ).toMatchObject({
            initialized: true,
            mounted: false,
            active: false,
            state: "unmounted",
        });
    });

    it("melewati unmount jika fitur belum terpasang", async () => {
        const feature = createFeature("unmount-skip");

        const result = await lifecycle.unmountFeature(feature);

        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
    });

    it("memanggil onUnmount sebelum feature.unmount", async () => {
        const calls = [];

        const feature = createFeature("unmount-order", {
            unmount: async () => {
                calls.push("unmount");
            },
            lifecycle: {
                onUnmount: async () => {
                    calls.push("onUnmount");
                },
            },
        });

        await lifecycle.initializeFeature(feature);
        await lifecycle.mountFeature(feature, createElement());

        const result = await lifecycle.unmountFeature(feature);

        expect(result.success).toBe(true);
        expect(calls).toEqual(["onUnmount", "unmount"]);
    });

    it("menolak penghapusan record selama fitur masih mounted", async () => {
        const feature = createFeature("still-mounted");

        await lifecycle.initializeFeature(feature);
        await lifecycle.mountFeature(feature, createElement());

        const result = lifecycle.unregisterFeatureLifecycle(feature);

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("FEATURE_STILL_IN_USE");
    });
});

describe("Feature Lifecycle — Aktivasi dan deaktivasi", () => {
    it("menolak aktivasi sebelum fitur dipasang", async () => {
        const result = await lifecycle.activateFeature(
            createFeature("not-mounted"),
        );

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("FEATURE_NOT_MOUNTED");
    });

    it("mengaktifkan fitur yang sudah mounted", async () => {
        const feature = createFeature("activate-test");

        await lifecycle.initializeFeature(feature);
        await lifecycle.mountFeature(feature, createElement());

        const result = await lifecycle.activateFeature(feature);

        expect(result.success).toBe(true);
        expect(result.state).toBe("active");

        expect(
            lifecycle.getFeatureLifecycleState("activate-test"),
        ).toMatchObject({
            mounted: true,
            active: true,
            state: "active",
        });
    });

    it("memanggil hook onActivate dengan element", async () => {
        const onActivate = vi.fn();
        const feature = createFeature("activate-context", {
            lifecycle: { onActivate },
        });
        const element = createElement();

        await lifecycle.initializeFeature(feature);
        await lifecycle.mountFeature(feature, element);

        await lifecycle.activateFeature(feature, {
            reason: "user-action",
        });

        expect(onActivate).toHaveBeenCalledWith(
            expect.objectContaining({
                feature,
                element,
                reason: "user-action",
            }),
        );
    });

    it("melewati aktivasi jika fitur sudah active", async () => {
        const onActivate = vi.fn();
        const feature = createFeature("activate-skip", {
            lifecycle: { onActivate },
        });

        await lifecycle.initializeFeature(feature);
        await lifecycle.mountFeature(feature, createElement());
        await lifecycle.activateFeature(feature);

        const result = await lifecycle.activateFeature(feature);

        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
        expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it("menonaktifkan fitur tanpa melepas elemen", async () => {
        const feature = createFeature("deactivate-test");

        await lifecycle.initializeFeature(feature);
        await lifecycle.mountFeature(feature, createElement());
        await lifecycle.activateFeature(feature);

        const result = await lifecycle.deactivateFeature(feature);

        expect(result.success).toBe(true);
        expect(result.state).toBe("inactive");

        expect(
            lifecycle.getFeatureLifecycleState("deactivate-test"),
        ).toMatchObject({
            mounted: true,
            active: false,
            state: "inactive",
        });
    });

    it("melewati deaktivasi jika fitur belum active", async () => {
        const result = await lifecycle.deactivateFeature(
            createFeature("inactive-feature"),
        );

        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
    });

    it("mengubah status menjadi error jika onActivate gagal", async () => {
        const feature = createFeature("activate-error", {
            lifecycle: {
                onActivate: () => {
                    throw new Error("Aktivasi gagal");
                },
            },
        });

        await lifecycle.initializeFeature(feature);
        await lifecycle.mountFeature(feature, createElement());

        const result = await lifecycle.activateFeature(feature);

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("FEATURE_ACTIVATION_FAILED");
        expect(
            lifecycle.getFeatureLifecycleState("activate-error").active,
        ).toBe(false);
    });

    it("tidak melepas fitur jika hook onDeactivate gagal", async () => {
        const feature = createFeature("deactivate-error", {
            lifecycle: {
                onDeactivate: () => {
                    throw new Error("Deaktivasi gagal");
                },
            },
        });

        await lifecycle.initializeFeature(feature);
        await lifecycle.mountFeature(feature, createElement());
        await lifecycle.activateFeature(feature);

        const result = await lifecycle.deactivateFeature(feature);

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("FEATURE_DEACTIVATION_FAILED");
    });

    it("menonaktifkan fitur sebelum unmount", async () => {
        const calls = [];

        const feature = createFeature("deactivate-before-unmount", {
            lifecycle: {
                onDeactivate: () => {
                    calls.push("deactivate");
                },
                onUnmount: () => {
                    calls.push("unmount");
                },
            },
        });

        await lifecycle.initializeFeature(feature);
        await lifecycle.mountFeature(feature, createElement());
        await lifecycle.activateFeature(feature);

        const result = await lifecycle.unmountFeature(feature);

        expect(result.success).toBe(true);
        expect(calls).toEqual(["deactivate", "unmount"]);
    });
});

describe("Feature Lifecycle — Status, history, dan ringkasan", () => {
    it("mencatat perubahan status lifecycle", async () => {
        const feature = createFeature("history-test");

        await lifecycle.initializeFeature(feature);

        const history =
            lifecycle.getFeatureLifecycleHistory("history-test");

        expect(history.map((entry) => entry.state)).toEqual([
            "initializing",
            "initialized",
        ]);
    });

    it("mengembalikan salinan entry history", async () => {
        const feature = createFeature("history-copy");

        await lifecycle.initializeFeature(feature);

        const history =
            lifecycle.getFeatureLifecycleHistory("history-copy");

        history[0].state = "tampered";

        expect(
            lifecycle.getFeatureLifecycleHistory("history-copy")[0].state,
        ).toBe("initializing");
    });

    it("membatasi riwayat hingga maksimal 50 entry", async () => {
        const feature = createFeature("history-limit");

        await lifecycle.initializeFeature(feature);
        await lifecycle.mountFeature(feature, createElement());

        for (let index = 0; index < 30; index += 1) {
            await lifecycle.activateFeature(feature);
            await lifecycle.deactivateFeature(feature);
        }

        expect(
            lifecycle.getFeatureLifecycleHistory("history-limit").length,
        ).toBeLessThanOrEqual(50);
    });

    it("menyediakan ringkasan seluruh fitur", async () => {
        await lifecycle.initializeFeature(createFeature("summary-a"));
        await lifecycle.initializeFeature(createFeature("summary-b"));

        const summary = lifecycle.getFeatureLifecycleSummary();

        expect(summary.version).toBe("1.0.0");
        expect(summary.total).toBe(2);
        expect(summary.initialized).toBe(2);
        expect(summary.features).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: "summary-a",
                    state: "initialized",
                }),
                expect.objectContaining({
                    id: "summary-b",
                    state: "initialized",
                }),
            ]),
        );
    });

    it("menghapus record yang sudah tidak digunakan", async () => {
        const feature = createFeature("remove-record");

        await lifecycle.initializeFeature(feature);

        const result =
            lifecycle.unregisterFeatureLifecycle("REMOVE-RECORD");

        expect(result.success).toBe(true);
        expect(result.featureId).toBe("remove-record");
        expect(
            lifecycle.getFeatureLifecycleState("remove-record"),
        ).toBeNull();
    });

    it("mengembalikan error saat menghapus record yang tidak ada", () => {
        const result =
            lifecycle.unregisterFeatureLifecycle("missing-record");

        expect(result.success).toBe(false);
        expect(result.error.code).toBe(
            "FEATURE_LIFECYCLE_NOT_FOUND",
        );
    });

    it("mengembalikan error untuk ID penghapusan yang tidak valid", () => {
        const result = lifecycle.unregisterFeatureLifecycle(" ");

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("INVALID_FEATURE_ID");
    });
});

describe("Feature Lifecycle — Antrean operasi", () => {
    it("menjalankan operasi fitur yang sama secara berurutan", async () => {
        const calls = [];

        const feature = createFeature("queue-order", {
            lifecycle: {
                onLoad: async () => {
                    calls.push("start");
                    await new Promise((resolve) => setTimeout(resolve, 10));
                    calls.push("end");
                },
            },
        });

        const first = lifecycle.initializeFeature(feature);
        const second = lifecycle.initializeFeature(feature);

        const results = await Promise.all([first, second]);

        expect(results.every((result) => result.success)).toBe(true);
        expect(calls).toEqual(["start", "end"]);
        expect(results.some((result) => result.skipped)).toBe(true);
    });

    it("menguji apakah mount bisa menyelesaikan inisialisasi internal", async () => {
        const feature = createFeature("mount-deadlock-check");
        const element = createElement();

        // Jangan menunggu tanpa batas jika antrean saling menunggu.
        let timeoutId;

        const outcome = await Promise.race([
            lifecycle.mountFeature(feature, element).then((result) => ({
                type: "result",
                result,
            })),
            new Promise((resolve) => {
                timeoutId = setTimeout(
                    () => resolve({ type: "timeout" }),
                    100,
                );
            }),
        ]);

        clearTimeout(timeoutId);

        // Tes ini menguji perilaku yang seharusnya benar.
        // Jika hasilnya timeout, kemungkinan ada deadlock di antrean.
        expect(outcome.type).toBe("result");
        expect(outcome.result.success).toBe(true);
        expect(outcome.result.state).toBe("mounted");
    });
});
