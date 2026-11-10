/**
 * KANTOONG — FITUR: Pesanan Saya
 * File: frontend/dashboard-user/features/my-orders/feature.js
 * Ruang fitur (sub-fitur + laporan ke AI): home/rooms/orders.js
 */

import { homeFeature } from "../../home/define.js";
import { mountRoom } from "../../home/room.js";
import { myOrders } from "../../home/rooms/orders.js";

export default homeFeature({
    id: "my-orders",
    name: "Pesanan Saya",
    order: 10,
    defaultActive: true,
    mount: (root, context) => mountRoom(root, myOrders, context),
});
