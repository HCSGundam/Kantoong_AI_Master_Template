/**
 * KANTOONG — FITUR: Voucher & Promo
 * File: frontend/dashboard-user/features/vouchers-promos/feature.js
 * Ruang fitur (sub-fitur + laporan ke AI): home/rooms/money.js
 */

import { homeFeature } from "../../home/define.js";
import { mountRoom } from "../../home/room.js";
import { vouchersPromos } from "../../home/rooms/money.js";

export default homeFeature({
    id: "vouchers-promos",
    name: "Voucher & Promo",
    order: 45,
    defaultActive: false,
    mount: (root, context) => mountRoom(root, vouchersPromos, context),
});
