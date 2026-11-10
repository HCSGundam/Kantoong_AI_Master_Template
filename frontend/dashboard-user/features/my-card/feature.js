/**
 * KANTOONG — FITUR: Kartu Diriku
 * File: frontend/dashboard-user/features/my-card/feature.js
 * Ruang fitur (sub-fitur + laporan ke AI): home/rooms/self.js
 */

import { homeFeature } from "../../home/define.js";
import { mountRoom } from "../../home/room.js";
import { myCard } from "../../home/rooms/self.js";

export default homeFeature({
    id: "my-card",
    name: "Kartu Diriku",
    order: 5,
    defaultActive: true,
    mount: (root, context) => mountRoom(root, myCard, context),
});
