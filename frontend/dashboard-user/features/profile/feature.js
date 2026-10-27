
/**
 * ============================================================
 * KANTOONG CORE — PROFILE FEATURE
 * File: frontend/dashboard-user/features/profile/feature.js
 *
 * Tanggung jawab:
 * - Mendefinisikan identitas fitur Profile.
 * - Menyediakan metadata untuk feature discovery.
 * - Menghubungkan Profile dengan sistem lifecycle.
 * - Menyediakan mount dan unmount untuk tampilan Profile.
 * - Menjaga fitur tetap reusable lintas tenant.
 *
 * Arsitektur:
 * feature-discovery
 *   → feature-loader
 *   → feature-registry
 *   → feature-controller
 *   → feature-lifecycle
 * ============================================================
 */

import { defineFeature } from "../../core/feature-contract.js";

import {
  renderProfileView,
  destroyProfileView,
} from "./profile-view.js";

import "./profile.css";

/**
 * Identitas fitur.
 *
 * ID wajib sama dengan nama folder:
 * features/profile/feature.js
 */
const profileFeature = defineFeature({
  id: "profile",
  name: "Profile",
  description:
    "Kelola informasi profil, identitas akun, dan preferensi pribadi.",
  category: "account",
  icon: "user-round",

  enabled: true,
  status: "active",
  order: 10,

  /**
   * Dibaca oleh dashboard-user.js:
   * - defaultActive: kartu langsung muncul pada dashboard baru.
   * - defaultSize: ukuran awal kartu (kolom x baris).
   * - title: nama yang tampil pada kartu.
   */
  title: "Profil",
  defaultActive: true,
  available: true,
  defaultSize: { width: 2, height: 2 },

  /**
   * Ringkasan di kartu dashboard: nama dan peran jika sudah masuk,
   * atau ajakan masuk jika belum.
   */
  async summary() {
    try {
      const bridge = await import("../../integrations/auth-bridge.js");
      const user = await bridge.getDashboardUser();

      if (user) {
        return {
          title: user.name,
          text: `${user.role} \u00B7 ${user.email}`,
        };
      }
    } catch {
      // Layanan login tidak tersedia: tampilkan ajakan masuk.
    }

    return {
      title: "Belum masuk",
      text: "Ketuk untuk masuk atau melihat akunmu.",
    };
  },

  tags: [
    "profile",
    "account",
    "akun",
    "identitas",
    "pengguna",
  ],

  permissions: {
    requireAuthentication: true,
    roles: ["customer", "owner", "admin", "staff"],
    permissions: [],
    allowWhenRoleMissing: false,
  },

  /**
   * Dipanggil ketika fitur diinisialisasi oleh lifecycle.
   */
  lifecycle: {
    async onRegister(context) {
      context?.logger?.debug?.(
        "[KANTOONG] Profile feature registered."
      );
    },

    async onLoad(context) {
      context?.logger?.debug?.(
        "[KANTOONG] Profile feature loaded."
      );
    },

    async onMount(context) {
      context?.logger?.debug?.(
        "[KANTOONG] Profile feature mounted.",
        {
          tenantId: context?.tenantId ?? null,
        }
      );
    },

    async onActivate(context) {
      context?.logger?.debug?.(
        "[KANTOONG] Profile feature activated."
      );
    },

    async onDeactivate(context) {
      context?.logger?.debug?.(
        "[KANTOONG] Profile feature deactivated."
      );
    },

    async onUnmount(context) {
      context?.logger?.debug?.(
        "[KANTOONG] Profile feature unmounted."
      );
    },

    async onError(error, context) {
      context?.logger?.error?.(
        "[KANTOONG] Profile feature error.",
        {
          message: error?.message ?? String(error),
          tenantId: context?.tenantId ?? null,
        }
      );
    },
  },

  /**
   * Membuat tampilan Profile di elemen target.
   *
   * context.element berasal dari feature-controller.js.
   * Data pengguna nantinya dapat dihubungkan melalui
   * sistem autentikasi dan backend KANTOONG.
   */
  async mount(context) {
    const rootElement = context?.element ?? context?.rootElement;

    if (!rootElement) {
      throw new Error(
        "[KANTOONG Profile] Root element wajib tersedia."
      );
    }

    return renderProfileView({
      rootElement,
      context,
    });
  },

  /**
   * Membersihkan tampilan ketika fitur dilepas.
   */
  async unmount(context) {
    const rootElement = context?.element ?? context?.rootElement;

    if (rootElement) {
      await destroyProfileView({
        rootElement,
        context,
      });
    }
  },
});

export default profileFeature;
