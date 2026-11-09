/**
 * KANTOONG — FITUR: Pesanan Saya
 * File: frontend/dashboard-user/features/my-orders/feature.js
 * Ringkasan kartu: home/home-glance.js · Halaman detail: home/details.js
 */

import { homeFeature } from "../../home/define.js";
import { mountOrders } from "../../home/details.js";

export default homeFeature({
    id: "my-orders",
    name: "Pesanan Saya",
    order: 50,
    mount: mountOrders,
});
