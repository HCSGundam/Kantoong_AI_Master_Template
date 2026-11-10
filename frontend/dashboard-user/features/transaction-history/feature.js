/**
 * KANTOONG — FITUR: Riwayat Transaksi
 * File: frontend/dashboard-user/features/transaction-history/feature.js
 * Ruang fitur (sub-fitur + laporan ke AI): home/rooms/orders.js
 */

import { homeFeature } from "../../home/define.js";
import { mountRoom } from "../../home/room.js";
import { transactionHistory } from "../../home/rooms/orders.js";

export default homeFeature({
    id: "transaction-history",
    name: "Riwayat Transaksi",
    order: 60,
    defaultActive: false,
    mount: (root, context) => mountRoom(root, transactionHistory, context),
});
