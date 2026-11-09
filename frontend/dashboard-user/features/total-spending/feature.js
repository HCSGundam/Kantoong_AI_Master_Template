/**
 * KANTOONG — FITUR: Total Belanja
 * File: frontend/dashboard-user/features/total-spending/feature.js
 * Ringkasan kartu: home/home-glance.js · Halaman detail: home/details.js
 */

import { homeFeature } from "../../home/define.js";
import { mountSpending } from "../../home/details.js";

export default homeFeature({
    id: "total-spending",
    name: "Total Belanja",
    order: 70,
    mount: mountSpending,
});
