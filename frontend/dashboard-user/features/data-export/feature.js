/**
 * KANTOONG — FITUR: Ekspor Data
 * File: frontend/dashboard-user/features/data-export/feature.js
 * Ruang fitur (sub-fitur + laporan ke AI): home/rooms/self.js
 */

import { homeFeature } from "../../home/define.js";
import { mountRoom } from "../../home/room.js";
import { dataExport } from "../../home/rooms/self.js";

export default homeFeature({
    id: "data-export",
    name: "Ekspor Data",
    order: 90,
    defaultActive: false,
    mount: (root, context) => mountRoom(root, dataExport, context),
});
