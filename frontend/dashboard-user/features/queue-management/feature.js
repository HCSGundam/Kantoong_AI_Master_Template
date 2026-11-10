/**
 * KANTOONG — FITUR: Antrean
 * File: frontend/dashboard-user/features/queue-management/feature.js
 * Ruang fitur (sub-fitur + laporan ke AI): home/rooms/time.js
 */

import { homeFeature } from "../../home/define.js";
import { mountRoom } from "../../home/room.js";
import { queue } from "../../home/rooms/time.js";

export default homeFeature({
    id: "queue-management",
    name: "Antrean",
    order: 84,
    defaultActive: false,
    mount: (root, context) => mountRoom(root, queue, context),
});
