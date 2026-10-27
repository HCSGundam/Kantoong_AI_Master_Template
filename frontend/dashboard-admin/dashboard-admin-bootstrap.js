/**
 * KANTOONG CORE — DASHBOARD ADMIN BOOTSTRAP
 * File: frontend/dashboard-admin/dashboard-admin-bootstrap.js
 *
 * Titik masuk halaman admin:
 *   belum login  -> form login
 *   bukan owner  -> akses ditolak
 *   owner        -> dashboard produk
 */

import { ACCESS, checkOwnerAccess } from "../auth/access-control.js";
import { onAuthStateChange } from "../auth/auth-service.js";
import {
    $,
    friendlyError,
    refreshProducts,
    resetForm,
    setMessage,
    showView,
} from "./dashboard-admin.js";
import { bindAdminEvents } from "./dashboard-admin-events.js";

async function routeByAccess() {
    try {
        const access = await checkOwnerAccess();

        if (access.status === ACCESS.SIGNED_OUT) {
            showView("login");
            return;
        }

        if (access.status === ACCESS.NOT_OWNER) {
            showView("denied");
            return;
        }

        $("adminUserEmail").textContent = access.user.email ?? "";
        showView("app");
        resetForm();

        await refreshProducts();
    } catch (error) {
        console.error("[KANTOONG Admin]", error);
        showView("login");
        setMessage($("loginMessage"), friendlyError(error), "error");
    }
}

function init() {
    bindAdminEvents({ onAuthChanged: routeByAccess });

    // Dijalankan di luar callback agar tidak mengunci klien Supabase.
    onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
            window.setTimeout(routeByAccess, 0);
        }
    });

    routeByAccess();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
    init();
}
