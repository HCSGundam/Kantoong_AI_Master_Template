/**
 * KANTOONG — FITUR: Katalog Produk
 * File: frontend/dashboard-user/features/product-catalog/feature.js
 * Ringkasan kartu: home/home-glance.js · Halaman detail: home/details.js
 */

import { homeFeature } from "../../home/define.js";
import { mountCatalog } from "../../home/details.js";

export default homeFeature({
    id: "product-catalog",
    name: "Katalog Produk",
    order: 30,
    mount: mountCatalog,
});
