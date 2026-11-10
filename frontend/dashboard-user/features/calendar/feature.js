/**
 * KANTOONG — FITUR: Kalender
 * File: frontend/dashboard-user/features/calendar/feature.js
 * Ruang fitur (sub-fitur + laporan ke AI): home/rooms/time.js
 */

import { homeFeature } from "../../home/define.js";
import { mountRoom } from "../../home/room.js";
import { calendar } from "../../home/rooms/time.js";

export default homeFeature({
    id: "calendar",
    name: "Kalender",
    order: 50,
    defaultActive: false,
    mount: (root, context) => mountRoom(root, calendar, context),
});
