/**
 * KANTOONG — FITUR: Unggah Media
 * File: frontend/dashboard-user/features/media-upload/feature.js
 * Ruang fitur (sub-fitur + laporan ke AI): home/rooms/media.js
 */

import { homeFeature } from "../../home/define.js";
import { mountRoom } from "../../home/room.js";
import { mediaUpload } from "../../home/rooms/media.js";

export default homeFeature({
    id: "media-upload",
    name: "Unggah Media",
    order: 94,
    defaultActive: false,
    mount: (root, context) => mountRoom(root, mediaUpload, context),
});
