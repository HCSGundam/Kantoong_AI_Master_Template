/**
 * KANTOONG ERP — CRM PELANGGAN
 * File: frontend/erp/core/crm.js
 *
 * Daftar pelanggan dibangun dari pesanan (sama dengan erp_customers di
 * erp-phase3.sql). Segmen sederhana untuk tindak lanjut:
 *   Loyal       : ≥ 3 pesanan dibayar
 *   Baru        : pesanan pertama ≤ 30 hari lalu
 *   Aktif       : pesanan terakhir ≤ 60 hari lalu
 *   Tidak aktif : pesanan terakhir > 60 hari lalu
 * UU PDP: marketing hanya melihat kontak lengkap pelanggan yang memberi izin.
 */

import { isPaid } from "./metrics.js";

export const SEGMENTS = Object.freeze({
    loyal: { label: "Loyal", tone: "good" },
    baru: { label: "Baru", tone: "" },
    aktif: { label: "Aktif", tone: "" },
    pasif: { label: "Tidak aktif", tone: "warn" },
});

const DAY = 86400000;

export function segmentOf(customer, now = new Date()) {
    if (customer.paid_count >= 3) return "loyal";
    if (now - new Date(customer.first_order) <= 30 * DAY) return "baru";
    if (now - new Date(customer.last_order) <= 60 * DAY) return "aktif";
    return "pasif";
}

export function maskPhone(phone) {
    const text = String(phone ?? "");
    return text.length > 7 ? `${text.slice(0, 4)}****${text.slice(-3)}` : "****";
}

/**
 * orders -> pelanggan. Opsi:
 *  - onlySalesId: sales hanya melihat pelanggan dari pesanan miliknya
 *  - maskWithoutConsent: samarkan kontak bila belum ada izin pemasaran
 */
export function aggregateCustomers(orders, profiles = [], { onlySalesId = null, maskWithoutConsent = false } = {}) {
    const byPhone = new Map();
    const profileOf = new Map(profiles.map((profile) => [profile.phone, profile]));

    const sorted = orders
        .filter((order) => order.status !== "dibatalkan" && order.customer_phone)
        .filter((order) => !onlySalesId || order.sales_member_id === onlySalesId)
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

    for (const order of sorted) {
        const entry = byPhone.get(order.customer_phone) || {
            phone: order.customer_phone,
            orders_count: 0,
            paid_count: 0,
            total_spent: 0,
            first_order: order.created_at,
        };
        entry.name = order.customer_name;
        entry.email = order.customer_email || null;
        entry.city = order.city;
        entry.last_order = order.created_at;
        entry.sales_member_id = order.sales_member_id || null;
        entry.orders_count += 1;
        if (isPaid(order)) {
            entry.paid_count += 1;
            entry.total_spent += Number(order.total) || 0;
        }
        byPhone.set(order.customer_phone, entry);
    }

    return [...byPhone.values()]
        .map((customer) => {
            const profile = profileOf.get(customer.phone) || {};
            const consent = profile.marketing_consent === true;
            const hidden = maskWithoutConsent && !consent;
            return {
                ...customer,
                // Kunci catatan ikut disamarkan: tanpa izin, nomor asli tidak keluar sama sekali.
                phone_key: hidden ? maskPhone(customer.phone) : customer.phone,
                phone: hidden ? maskPhone(customer.phone) : customer.phone,
                email: hidden ? null : customer.email,
                tags: profile.tags || [],
                note: profile.note || "",
                marketing_consent: consent,
            };
        })
        .sort((a, b) => String(b.last_order).localeCompare(String(a.last_order)));
}
