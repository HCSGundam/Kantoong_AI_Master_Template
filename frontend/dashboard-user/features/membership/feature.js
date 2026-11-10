/**
 * KANTOONG — FITUR: Poin Member
 * File: frontend/dashboard-user/features/membership/feature.js
 * Ruang fitur (sub-fitur + laporan ke AI): home/rooms/money.js
 */

import { homeFeature } from "../../home/define.js";
import { mountRoom } from "../../home/room.js";
import { membership } from "../../home/rooms/money.js";

export default homeFeature({
    id: "membership",
    name: "Poin Member",
    order: 47,
    defaultActive: false,
    mount: (root, context) => mountRoom(root, membership, context),
});
