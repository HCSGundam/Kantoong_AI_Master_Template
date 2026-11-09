/**
 * KANTOONG — FITUR: Lacak Paket
 * File: frontend/dashboard-user/features/package-tracking/feature.js
 * Ringkasan kartu: home/home-glance.js · Halaman detail: home/details.js
 */

import { homeFeature } from "../../home/define.js";
import { mountTracking } from "../../home/details.js";

export default homeFeature({
    id: "package-tracking",
    name: "Lacak Paket",
    order: 60,
    mount: mountTracking,
});
