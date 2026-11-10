/**
 * KANTOONG — FITUR: Total Belanja
 * File: frontend/dashboard-user/features/total-spending/feature.js
 * Ruang fitur (sub-fitur + laporan ke AI): home/rooms/money.js
 */

import { homeFeature } from "../../home/define.js";
import { mountRoom } from "../../home/room.js";
import { totalSpending } from "../../home/rooms/money.js";

export default homeFeature({
    id: "total-spending",
    name: "Total Belanja",
    order: 70,
    defaultActive: true,
    mount: (root, context) => mountRoom(root, totalSpending, context),
});
