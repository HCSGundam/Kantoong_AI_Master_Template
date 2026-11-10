/**
 * KANTOONG — FITUR: Pengaturan
 * File: frontend/dashboard-user/features/settings/feature.js
 * Ruang fitur (sub-fitur + laporan ke AI): home/rooms/self.js
 */

import { homeFeature } from "../../home/define.js";
import { mountRoom } from "../../home/room.js";
import { settings } from "../../home/rooms/self.js";

export default homeFeature({
    id: "settings",
    name: "Pengaturan",
    order: 20,
    defaultActive: true,
    mount: (root, context) => mountRoom(root, settings, context),
});
