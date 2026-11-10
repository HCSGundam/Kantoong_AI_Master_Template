/**
 * KANTOONG — FITUR: Lacak Paket
 * File: frontend/dashboard-user/features/package-tracking/feature.js
 * Ruang fitur (sub-fitur + laporan ke AI): home/rooms/orders.js
 */

import { homeFeature } from "../../home/define.js";
import { mountRoom } from "../../home/room.js";
import { packageTracking } from "../../home/rooms/orders.js";

export default homeFeature({
    id: "package-tracking",
    name: "Lacak Paket",
    order: 15,
    defaultActive: true,
    mount: (root, context) => mountRoom(root, packageTracking, context),
});
