/**
 * KANTOONG — FITUR: Customer Service
 * File: frontend/dashboard-user/features/customer-support/feature.js
 * Ruang fitur (sub-fitur + laporan ke AI): home/rooms/self.js
 */

import { homeFeature } from "../../home/define.js";
import { mountRoom } from "../../home/room.js";
import { customerSupport } from "../../home/rooms/self.js";

export default homeFeature({
    id: "customer-support",
    name: "Customer Service",
    order: 35,
    defaultActive: true,
    mount: (root, context) => mountRoom(root, customerSupport, context),
});
