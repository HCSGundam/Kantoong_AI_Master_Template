/**
 * KANTOONG — FITUR: Banner Promo
 * File: frontend/dashboard-user/features/banner-carousel/feature.js
 * Ruang fitur (sub-fitur + laporan ke AI): home/rooms/media.js
 */

import { homeFeature } from "../../home/define.js";
import { mountRoom } from "../../home/room.js";
import { bannerCarousel } from "../../home/rooms/media.js";

export default homeFeature({
    id: "banner-carousel",
    name: "Banner Promo",
    order: 46,
    defaultActive: false,
    mount: (root, context) => mountRoom(root, bannerCarousel, context),
});
