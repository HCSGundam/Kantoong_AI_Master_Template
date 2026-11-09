/**
 * KANTOONG — FITUR: Lokasi Toko
 * File: frontend/dashboard-user/features/store-map/feature.js
 * Ringkasan kartu: home/home-glance.js · Halaman detail: home/details.js
 */

import { homeFeature } from "../../home/define.js";
import { mountStore } from "../../home/details.js";

export default homeFeature({
    id: "store-map",
    name: "Lokasi Toko",
    order: 100,
    mount: mountStore,
});
