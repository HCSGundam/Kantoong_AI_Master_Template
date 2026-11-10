/**
 * KANTOONG — FITUR: Wishlist
 * File: frontend/dashboard-user/features/wishlist/feature.js
 * Ruang fitur (sub-fitur + laporan ke AI): home/rooms/shopping.js
 */

import { homeFeature } from "../../home/define.js";
import { mountRoom } from "../../home/room.js";
import { wishlist } from "../../home/rooms/shopping.js";

export default homeFeature({
    id: "wishlist",
    name: "Wishlist",
    order: 40,
    defaultActive: true,
    mount: (root, context) => mountRoom(root, wishlist, context),
});
