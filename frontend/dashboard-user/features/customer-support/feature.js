/**
 * KANTOONG — FITUR: Customer Service
 * File: frontend/dashboard-user/features/customer-support/feature.js
 * Ringkasan kartu: home/home-glance.js · Halaman detail: home/details.js
 */

import { homeFeature } from "../../home/define.js";
import { mountSupport } from "../../home/details.js";

export default homeFeature({
    id: "customer-support",
    name: "Customer Service",
    order: 110,
    mount: mountSupport,
});
