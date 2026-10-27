
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

import {
    checkFeaturePermission,
    canAccessFeature,
    checkFeaturesPermission,
    filterAccessibleFeatures,
    registerFeaturePermissionCheck,
    getKnownFeatureRoles,
    clearFeaturePermissionChecks,
} from "../frontend/dashboard-user/core/feature-permission.js";

const authenticatedUser = {
    user: {
        id: "test-user-001",
        authenticated: true,
        role: "customer",
        permissions: ["profile.read", "orders.read"],
    },
};

const profileFeature = {
    id: "profile",
    name: "Profil",
};

describe("KANTOONG CORE — Feature Permission", () => {
    beforeEach(() => {
        clearFeaturePermissionChecks();
    });

    afterEach(() => {
        clearFeaturePermissionChecks();
        vi.restoreAllMocks();
    });

    describe("checkFeaturePermission()", () => {
        it("mengizinkan fitur untuk pengguna terautentikasi", () => {
            const result = checkFeaturePermission(
                profileFeature,
                authenticatedUser
            );

            expect(result.allowed).toBe(true);
            expect(result.reason).toBe("ACCESS_ALLOWED");
            expect(result.featureId).toBe("profile");
            expect(result.userId).toBe("test-user-001");
        });

        it("menolak fitur yang tidak valid", () => {
            expect(
                checkFeaturePermission(null, authenticatedUser)
            ).toMatchObject({
                allowed: false,
                reason: "INVALID_FEATURE",
            });
        });

        it("menolak fitur tanpa ID valid", () => {
            expect(
                checkFeaturePermission(
                    { name: "Profil" },
                    authenticatedUser
                )
            ).toMatchObject({
                allowed: false,
                reason: "INVALID_FEATURE_ID",
            });
        });

        it("menolak fitur yang dinonaktifkan", () => {
            const result = checkFeaturePermission(
                { ...profileFeature, enabled: false },
                authenticatedUser
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe("FEATURE_DISABLED");
        });

        it("menolak fitur dengan status disabled", () => {
            const result = checkFeaturePermission(
                { ...profileFeature, status: "disabled" },
                authenticatedUser
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe("FEATURE_DISABLED");
        });

        it("menolak pengguna yang belum terautentikasi secara default", () => {
            const result = checkFeaturePermission(profileFeature, {});

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe("AUTHENTICATION_REQUIRED");
        });

        it("mendukung currentUser sebagai sumber identitas", () => {
            const result = checkFeaturePermission(profileFeature, {
                currentUser: {
                    id: "current-user",
                    isAuthenticated: true,
                    role: "customer",
                },
            });

            expect(result.allowed).toBe(true);
            expect(result.userId).toBe("current-user");
        });

        it("mendukung autentikasi tanpa mewajibkan role tertentu", () => {
            const result = checkFeaturePermission(profileFeature, {
                user: {
                    authenticated: true,
                },
            });

            expect(result.allowed).toBe(true);
            expect(result.roles).toEqual([]);
        });

        it("mengizinkan fitur publik jika autentikasi tidak diwajibkan", () => {
            const result = checkFeaturePermission(
                {
                    ...profileFeature,
                    access: {
                        requireAuthentication: false,
                    },
                },
                {}
            );

            expect(result.allowed).toBe(true);
            expect(result.reason).toBe("ACCESS_ALLOWED");
        });

        it("menolak pengguna tanpa role saat fitur mensyaratkan role", () => {
            const result = checkFeaturePermission(
                {
                    ...profileFeature,
                    access: {
                        allowedRoles: ["customer"],
                    },
                },
                {
                    user: {
                        authenticated: true,
                    },
                }
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe("ROLE_REQUIRED");
        });

        it("mengizinkan role yang cocok tanpa membedakan kapitalisasi", () => {
            const result = checkFeaturePermission(
                {
                    ...profileFeature,
                    permission: {
                        roles: ["CUSTOMER"],
                    },
                },
                {
                    user: {
                        authenticated: true,
                        role: " Customer ",
                    },
                }
            );

            expect(result.allowed).toBe(true);
        });

        it("menolak role yang tidak diizinkan", () => {
            const result = checkFeaturePermission(
                {
                    ...profileFeature,
                    access: {
                        allowedRoles: ["admin"],
                    },
                },
                authenticatedUser
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe("ROLE_NOT_ALLOWED");
        });

        it("memungkinkan role hilang jika allowWhenRoleMissing diaktifkan", () => {
            const result = checkFeaturePermission(
                {
                    ...profileFeature,
                    permission: {
                        roles: ["customer"],
                        allowWhenRoleMissing: true,
                    },
                },
                {
                    user: {
                        authenticated: true,
                    },
                }
            );

            expect(result.allowed).toBe(true);
        });

        it("menolak akses jika permission yang diperlukan tidak tersedia", () => {
            const result = checkFeaturePermission(
                {
                    ...profileFeature,
                    permission: {
                        permissions: [
                            "profile.read",
                            "profile.update",
                        ],
                    },
                },
                authenticatedUser
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe("PERMISSION_MISSING");
            expect(result.missingPermissions).toEqual([
                "profile.update",
            ]);
        });

        it("mengizinkan akses jika seluruh permission tersedia", () => {
            const result = checkFeaturePermission(
                {
                    ...profileFeature,
                    access: {
                        requiredPermissions: ["profile.read"],
                    },
                },
                authenticatedUser
            );

            expect(result.allowed).toBe(true);
        });

        it("menggabungkan role dari user.role dan user.roles", () => {
            const result = checkFeaturePermission(
                {
                    ...profileFeature,
                    access: {
                        allowedRoles: ["admin"],
                    },
                },
                {
                    user: {
                        authenticated: true,
                        role: "customer",
                        roles: ["admin"],
                    },
                }
            );

            expect(result.allowed).toBe(true);
            expect(result.roles).toContain("customer");
            expect(result.roles).toContain("admin");
        });

        it("mengembalikan hasil pemeriksaan yang tidak dapat diubah", () => {
            const result = checkFeaturePermission(
                profileFeature,
                authenticatedUser
            );

            expect(Object.isFrozen(result)).toBe(true);
        });
    });

    describe("registerFeaturePermissionCheck() dan canAccessFeature()", () => {
        it("mengizinkan akses jika callback tambahan mengembalikan true", async () => {
            const callback = vi.fn().mockResolvedValue(true);

            registerFeaturePermissionCheck("profile", callback);

            const result = await canAccessFeature(
                profileFeature,
                authenticatedUser
            );

            expect(result.allowed).toBe(true);
            expect(callback).toHaveBeenCalledOnce();
        });

        it("menolak akses jika callback tambahan mengembalikan false", async () => {
            registerFeaturePermissionCheck(
                "profile",
                () => false
            );

            const result = await canAccessFeature(
                profileFeature,
                authenticatedUser
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe("CUSTOM_PERMISSION_DENIED");
        });

        it("menolak akses jika callback tidak mengembalikan true", async () => {
            registerFeaturePermissionCheck(
                "profile",
                () => undefined
            );

            const result = await canAccessFeature(
                profileFeature,
                authenticatedUser
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe("CUSTOM_PERMISSION_DENIED");
        });

        it("menolak akses jika callback melempar error", async () => {
            registerFeaturePermissionCheck("profile", () => {
                throw new Error("Simulated permission failure");
            });

            const result = await canAccessFeature(
                profileFeature,
                authenticatedUser
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe("CUSTOM_PERMISSION_ERROR");
            expect(result.error).toBe(
                "Simulated permission failure"
            );
        });

        it("tidak menjalankan callback tambahan jika akses dasar ditolak", async () => {
            const callback = vi.fn().mockResolvedValue(true);

            registerFeaturePermissionCheck("profile", callback);

            const result = await canAccessFeature(profileFeature, {});

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe("AUTHENTICATION_REQUIRED");
            expect(callback).not.toHaveBeenCalled();
        });

        it("menolak registrasi callback dengan ID tidak valid", () => {
            expect(() =>
                registerFeaturePermissionCheck(" ", () => true)
            ).toThrow(TypeError);
        });

        it("menolak registrasi jika callback bukan function", () => {
            expect(() =>
                registerFeaturePermissionCheck("profile", true)
            ).toThrow(TypeError);
        });

        it("mengizinkan callback tambahan dilepas", async () => {
            const unregister = registerFeaturePermissionCheck(
                "profile",
                () => false
            );

            const denied = await canAccessFeature(
                profileFeature,
                authenticatedUser
            );

            expect(denied.allowed).toBe(false);

            expect(unregister()).toBe(true);
            expect(unregister()).toBe(false);

            const allowed = await canAccessFeature(
                profileFeature,
                authenticatedUser
            );

            expect(allowed.allowed).toBe(true);
        });

        it("menghentikan pemeriksaan ketika callback pertama menolak akses", async () => {
            const secondCallback = vi.fn().mockResolvedValue(true);

            registerFeaturePermissionCheck(
                "profile",
                () => false
            );

            registerFeaturePermissionCheck(
                "profile",
                secondCallback
            );

            const result = await canAccessFeature(
                profileFeature,
                authenticatedUser
            );

            expect(result.allowed).toBe(false);
            expect(secondCallback).not.toHaveBeenCalled();
        });
    });

    describe("pemeriksaan banyak fitur", () => {
        it("menghasilkan ringkasan akses untuk beberapa fitur", async () => {
            const result = await checkFeaturesPermission(
                [
                    profileFeature,
                    {
                        id: "admin-panel",
                        name: "Admin",
                        access: {
                            allowedRoles: ["admin"],
                        },
                    },
                    {
                        id: "public-help",
                        name: "Bantuan",
                        access: {
                            requireAuthentication: false,
                        },
                    },
                ],
                authenticatedUser
            );

            expect(result.total).toBe(3);
            expect(result.allowed).toBe(2);
            expect(result.denied).toBe(1);
            expect(result.results).toHaveLength(3);
        });

        it("menolak input bukan array pada checkFeaturesPermission", async () => {
            await expect(
                checkFeaturesPermission(null, authenticatedUser)
            ).rejects.toThrow(TypeError);
        });

        it("memfilter dan hanya mengembalikan fitur yang boleh diakses", async () => {
            const features = [
                profileFeature,
                {
                    id: "admin-panel",
                    name: "Admin",
                    access: {
                        allowedRoles: ["admin"],
                    },
                },
                {
                    id: "public-help",
                    name: "Bantuan",
                    access: {
                        requireAuthentication: false,
                    },
                },
            ];

            const result = await filterAccessibleFeatures(
                features,
                authenticatedUser
            );

            expect(result.map((feature) => feature.id)).toEqual([
                "profile",
                "public-help",
            ]);
        });

        it("menolak input bukan array pada filterAccessibleFeatures", async () => {
            await expect(
                filterAccessibleFeatures(null, authenticatedUser)
            ).rejects.toThrow(TypeError);
        });
    });

    describe("getKnownFeatureRoles()", () => {
        it("mengembalikan role frontend yang dikenali", () => {
            expect(getKnownFeatureRoles()).toEqual([
                "customer",
                "owner",
                "admin",
                "staff",
            ]);
        });

        it("mengembalikan salinan daftar role", () => {
            const roles = getKnownFeatureRoles();

            roles.push("superuser");

            expect(getKnownFeatureRoles()).not.toContain("superuser");
        });
    });

    describe("clearFeaturePermissionChecks()", () => {
        it("membersihkan seluruh callback tambahan", async () => {
            registerFeaturePermissionCheck(
                "profile",
                () => false
            );

            clearFeaturePermissionChecks();

            const result = await canAccessFeature(
                profileFeature,
                authenticatedUser
            );

            expect(result.allowed).toBe(true);
        });
    });
});
