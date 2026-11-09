/**
 * KANTOONG — PEMBUAT FITUR RINGKAS
 * File: frontend/dashboard-user/home/define.js
 *
 * Judul, deskripsi & kata kunci diambil dari katalog 31 fitur
 * (feature-hub-catalog.js); modul cukup menyediakan halaman detail.
 */

import { defineFeature } from "../core/feature-contract.js";

export function homeFeature({ id, name, order, mount, defaultActive = true, requireAuthentication = false }) {
    return defineFeature({
        id,
        name,
        title: name,
        enabled: true,
        status: "active",
        order,
        defaultActive,
        available: true,
        tags: [id],
        permissions: {
            requireAuthentication,
            roles: [],
            permissions: [],
            allowWhenRoleMissing: true,
        },
        async mount(context) {
            const root = context?.element ?? context?.rootElement;
            if (!root) throw new Error(`[KANTOONG ${name}] Root element wajib tersedia.`);
            root.classList.add("bx-stage-body");
            await mount(root, context);
        },
        async unmount(context) {
            (context?.element ?? context?.rootElement)?.replaceChildren();
        },
    });
}
