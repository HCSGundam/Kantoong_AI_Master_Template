/**
 * KANTOONG — DAFTAR RUANG FITUR DASHBOARD USER (26 fitur aktif)
 * File: frontend/dashboard-user/home/rooms/index.js
 *
 * Pending (konsep Koko): Profil (lama tetap), Video Feed (wadah kosong).
 * Ditahan: Booking Tempat, Musik, Belanja di Toko, Pembayaran.
 * Katalog Produk memakai tampilan katalog sendiri (catalog-view.js).
 */

import { myOrders, packageTracking, shippingAddress, transactionHistory } from "./orders.js";
import { membership, spendingAnalytics, totalSpending, vouchersPromos } from "./money.js";
import { productReviews, wishlist } from "./shopping.js";
import { calendar, clock, queue, storeMap, takeaway } from "./time.js";
import { aiChatHistory, customerSupport, dataExport, localization, myCard, settings } from "./self.js";
import { bannerCarousel, cooperationDocs, mediaUpload, voiceInteraction } from "./media.js";

export const ROOMS = [
    myCard, myOrders, packageTracking, transactionHistory, shippingAddress,
    totalSpending, spendingAnalytics, vouchersPromos, membership,
    wishlist, productReviews,
    calendar, clock, storeMap, takeaway, queue,
    aiChatHistory, customerSupport, settings, dataExport, localization,
    mediaUpload, voiceInteraction, bannerCarousel, cooperationDocs,
];

export const roomById = (id) => ROOMS.find((r) => r.id === id);
