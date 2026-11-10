/**
 * KANTOONG — FITUR: Analitik Belanja
 * File: frontend/dashboard-user/features/spending-analytics/feature.js
 * Ruang fitur (sub-fitur + laporan ke AI): home/rooms/money.js
 */

import { homeFeature } from "../../home/define.js";
import { mountRoom } from "../../home/room.js";
import { spendingAnalytics } from "../../home/rooms/money.js";

export default homeFeature({
    id: "spending-analytics",
    name: "Analitik Belanja",
    order: 72,
    defaultActive: false,
    mount: (root, context) => mountRoom(root, spendingAnalytics, context),
});
