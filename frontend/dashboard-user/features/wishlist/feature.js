/**
 * KANTOONG — FITUR: Wishlist
 * File: frontend/dashboard-user/features/wishlist/feature.js
 * Ringkasan kartu: home/home-glance.js · Halaman detail: home/details.js
 */

import { homeFeature } from "../../home/define.js";
import { mountWishlist } from "../../home/details.js";

export default homeFeature({
    id: "wishlist",
    name: "Wishlist",
    order: 40,
    mount: mountWishlist,
});
