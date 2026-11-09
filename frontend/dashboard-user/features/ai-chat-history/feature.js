/**
 * KANTOONG — FITUR: Riwayat Chat AI
 * File: frontend/dashboard-user/features/ai-chat-history/feature.js
 * Ringkasan kartu: home/home-glance.js · Halaman detail: home/details.js
 */

import { homeFeature } from "../../home/define.js";
import { mountChats } from "../../home/details.js";

export default homeFeature({
    id: "ai-chat-history",
    name: "Riwayat Chat AI",
    order: 80,
    mount: mountChats,
});
