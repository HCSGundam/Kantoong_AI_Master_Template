/**
 * KANTOONG — FITUR: Lokasi Toko
 * File: frontend/dashboard-user/features/store-map/feature.js
 * Ruang fitur (sub-fitur + laporan ke AI): home/rooms/time.js
 */

import { homeFeature } from "../../home/define.js";
import { mountRoom } from "../../home/room.js";
import { storeMap } from "../../home/rooms/time.js";

export default homeFeature({
    id: "store-map",
    name: "Lokasi Toko",
    order: 80,
    defaultActive: true,
    mount: (root, context) => mountRoom(root, storeMap, context),
});
