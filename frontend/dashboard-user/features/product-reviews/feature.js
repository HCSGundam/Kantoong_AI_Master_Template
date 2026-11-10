/**
 * KANTOONG — FITUR: Ulasan
 * File: frontend/dashboard-user/features/product-reviews/feature.js
 * Ruang fitur (sub-fitur + laporan ke AI): home/rooms/shopping.js
 */

import { homeFeature } from "../../home/define.js";
import { mountRoom } from "../../home/room.js";
import { productReviews } from "../../home/rooms/shopping.js";

export default homeFeature({
    id: "product-reviews",
    name: "Ulasan",
    order: 48,
    defaultActive: false,
    mount: (root, context) => mountRoom(root, productReviews, context),
});
