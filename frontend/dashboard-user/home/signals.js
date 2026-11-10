/**
 * KANTOONG — STRIP SINYAL "Mungkin kamu butuh ini" (beranda dashboard user)
 * File: frontend/dashboard-user/home/signals.js
 *
 * Tebakan DIAM dari keadaan nyata (keranjang beralasan, paket, harga turun,
 * acara, batas belanja, voucher, takeaway). Bukan pesan chat — sesuai aturan:
 * AI baru proaktif di chat setelah pengguna menyapa duluan.
 * Hanya tampil bila pengguna MENGIZINKAN (js/ai-consent.js) & di luar jam tenang.
 */

import { el, icon } from "./home-icons.js";
import { readMe } from "./me-store.js";
import { computeSignals, spentThisMonth } from "./room-logic.js";
import { cartItems, coupons, getCart, orders, wishlistWithPrices } from "./rooms/shared.js";
import { allEvents } from "./rooms/time.js";
import { askConsent, consentGranted, getConsent } from "../../js/ai-consent.js";
import { openTarget } from "./ai-bridge.js";

function inQuietHours(q, now = new Date()) {
    if (!q?.on) return false;
    const toMin = (s) => {
        const [h, m] = String(s).split(":").map(Number);
        return (h || 0) * 60 + (m || 0);
    };
    const t = now.getHours() * 60 + now.getMinutes();
    const from = toMin(q.from);
    const to = toMin(q.to);
    return from <= to ? t >= from && t < to : t >= from || t < to;
}

async function gather() {
    const { orders: list = [] } = await orders();
    return {
        cartItems: cartItems(),
        cartTotal: getCart().total,
        orders: list,
        wishlist: await wishlistWithPrices(),
        events: allEvents(),
        budget: { spent: spentThisMonth(list), limit: Number(readMe("budget-limit", 0)) || 0 },
        vouchers: coupons().filter((v) => v.claimed),
        takeaway: readMe("takeaway", null),
    };
}

let drawing = 0;

export async function renderSignals(host) {
    if (!host) return;
    const ticket = ++drawing;
    const box = host.querySelector(".bx-signals") ?? el("section", "bx-signals");
    box.setAttribute("aria-label", "Mungkin kamu butuh ini");
    if (!box.isConnected) host.append(box);

    if (!consentGranted()) {
        // Belum/tidak diizinkan: ajakan halus, tanpa membaca data apa pun.
        const ask = el("button", "bx-signals__invite", icon("sparkle"), getConsent() ? "Sinyal pribadi mati · nyalakan" : "Nyalakan Sinyal pribadi");
        ask.type = "button";
        ask.addEventListener("click", () => askConsent({ onDone: () => renderSignals(host) }));
        box.replaceChildren(ask);
        return;
    }
    if (inQuietHours(readMe("quiet-hours", null))) {
        box.replaceChildren();
        return;
    }

    const list = computeSignals(await gather());
    if (ticket !== drawing) return;
    if (!list.length) {
        box.replaceChildren(el("p", "bx-signals__calm", icon("check"), "Semua beres. Tidak ada yang perlu kamu kejar hari ini."));
        return;
    }
    box.replaceChildren(
        el("p", "bx-signals__label", "Mungkin kamu butuh ini"),
        el("div", "bx-signals__track", list.map((s, i) => {
            const card = el("button", `bx-signal bx-signal--${s.tone}`, el("strong", "", s.title), el("span", "", s.text), el("span", "bx-signal__go", "›"));
            card.type = "button";
            card.style.setProperty("--i", String(i));
            card.addEventListener("click", () => openTarget(s.action?.tool ? `${s.action.feature}/${s.action.tool}` : s.action?.feature));
            return card;
        })));
}
