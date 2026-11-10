/**
 * KANTOONG — FITUR: Riwayat Chat AI
 * File: frontend/dashboard-user/features/ai-chat-history/feature.js
 * Ruang fitur (sub-fitur + laporan ke AI): home/rooms/self.js
 */

import { homeFeature } from "../../home/define.js";
import { mountRoom } from "../../home/room.js";
import { aiChatHistory } from "../../home/rooms/self.js";

export default homeFeature({
    id: "ai-chat-history",
    name: "Riwayat Chat AI",
    order: 30,
    defaultActive: true,
    mount: (root, context) => mountRoom(root, aiChatHistory, context),
});
