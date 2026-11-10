/**
 * KANTOONG — FITUR: Hitung Mundur
 * File: frontend/dashboard-user/features/clock/feature.js
 * Ruang fitur (sub-fitur + laporan ke AI): home/rooms/time.js
 */

import { homeFeature } from "../../home/define.js";
import { mountRoom } from "../../home/room.js";
import { clock } from "../../home/rooms/time.js";

export default homeFeature({
    id: "clock",
    name: "Hitung Mundur",
    order: 52,
    defaultActive: true,
    mount: (root, context) => mountRoom(root, clock, context),
});
