/**
 * KANTOONG — FITUR: Dokumen Kerja Sama
 * File: frontend/dashboard-user/features/cooperation-documents/feature.js
 * Ruang fitur (sub-fitur + laporan ke AI): home/rooms/media.js
 */

import { homeFeature } from "../../home/define.js";
import { mountRoom } from "../../home/room.js";
import { cooperationDocs } from "../../home/rooms/media.js";

export default homeFeature({
    id: "cooperation-documents",
    name: "Dokumen Kerja Sama",
    order: 98,
    defaultActive: false,
    mount: (root, context) => mountRoom(root, cooperationDocs, context),
});
