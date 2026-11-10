/**
 * KANTOONG — FITUR: Bahasa & Wilayah
 * File: frontend/dashboard-user/features/localization/feature.js
 * Ruang fitur (sub-fitur + laporan ke AI): home/rooms/self.js
 */

import { homeFeature } from "../../home/define.js";
import { mountRoom } from "../../home/room.js";
import { localization } from "../../home/rooms/self.js";

export default homeFeature({
    id: "localization",
    name: "Bahasa & Wilayah",
    order: 92,
    defaultActive: false,
    mount: (root, context) => mountRoom(root, localization, context),
});
