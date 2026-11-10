/**
 * KANTOONG — FITUR: Interaksi Suara
 * File: frontend/dashboard-user/features/voice-interaction/feature.js
 * Ruang fitur (sub-fitur + laporan ke AI): home/rooms/media.js
 */

import { homeFeature } from "../../home/define.js";
import { mountRoom } from "../../home/room.js";
import { voiceInteraction } from "../../home/rooms/media.js";

export default homeFeature({
    id: "voice-interaction",
    name: "Interaksi Suara",
    order: 96,
    defaultActive: false,
    mount: (root, context) => mountRoom(root, voiceInteraction, context),
});
