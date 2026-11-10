/**
 * KANTOONG — FITUR: Alamat Pengiriman
 * File: frontend/dashboard-user/features/shipping-address/feature.js
 * Ruang fitur (sub-fitur + laporan ke AI): home/rooms/orders.js
 */

import { homeFeature } from "../../home/define.js";
import { mountRoom } from "../../home/room.js";
import { shippingAddress } from "../../home/rooms/orders.js";

export default homeFeature({
    id: "shipping-address",
    name: "Alamat Pengiriman",
    order: 62,
    defaultActive: false,
    mount: (root, context) => mountRoom(root, shippingAddress, context),
});
