/**
 * KANTOONG — FITUR: Takeaway
 * File: frontend/dashboard-user/features/takeaway-ordering/feature.js
 * Ruang fitur (sub-fitur + laporan ke AI): home/rooms/time.js
 */

import { homeFeature } from "../../home/define.js";
import { mountRoom } from "../../home/room.js";
import { takeaway } from "../../home/rooms/time.js";

export default homeFeature({
    id: "takeaway-ordering",
    name: "Takeaway",
    order: 82,
    defaultActive: false,
    mount: (root, context) => mountRoom(root, takeaway, context),
});
