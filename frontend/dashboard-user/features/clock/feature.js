/**
 * KANTOONG — FITUR: Jam
 * File: frontend/dashboard-user/features/clock/feature.js
 * Ringkasan kartu: home/home-glance.js · Halaman detail: home/details.js
 */

import { homeFeature } from "../../home/define.js";
import { mountClock } from "../../home/details.js";

export default homeFeature({
    id: "clock",
    name: "Jam",
    order: 90,
    mount: mountClock,
});
