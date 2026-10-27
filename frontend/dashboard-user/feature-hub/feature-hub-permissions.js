/**
 * KANTOONG CORE — FEATURE HUB: PERMISSIONS
 * File: frontend/dashboard-user/feature-hub/feature-hub-permissions.js
 *
 * Menentukan fitur mana yang BOLEH tampil di Feature Hub untuk klien ini.
 * Fungsi murni: tidak menyentuh DOM maupun storage.
 *
 * Catatan: ini mengatur tampilan. Akses data yang sensitif tetap harus
 * dijaga di backend/RLS.
 */

export function isFeatureInContract(feature, contract) {
    if (!feature || !contract) {
        return true;
    }

    if (contract.hiddenIds?.includes(feature.id)) {
        return false;
    }

    if (
        Array.isArray(contract.enabledIds) &&
        !contract.enabledIds.includes(feature.id)
    ) {
        return false;
    }

    // Add-on hanya tampil bila sudah dibeli (atau mode demo).
    if (
        feature.tier === "addon" &&
        contract.showAllForDemo !== true &&
        !contract.addonIds?.includes(feature.id)
    ) {
        return false;
    }

    return true;
}

export function filterByContract(features, contract) {
    return features.filter((feature) =>
        isFeatureInContract(feature, contract)
    );
}
