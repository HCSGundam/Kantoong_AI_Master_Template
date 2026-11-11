/**
 * KANTOONG — IKON GARIS UNTUK 31 FITUR (SVG, bukan emoji)
 * File: frontend/dashboard-user/home/home-icons.js
 */

const P = {
    link: ["M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1", "M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"],
    profile: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"],
    "shipping-address": ["M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z", "M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"],
    "package-tracking": ["M2 7h12v9H2z", "M14 10h4l3 3v3h-7", "M6 19a1.8 1.8 0 1 0 0-3.6A1.8 1.8 0 0 0 6 19zM17 19a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z"],
    "my-orders": ["M4 7l8-4 8 4-8 4z", "M4 7v10l8 4 8-4V7", "M12 11v10"],
    "transaction-history": ["M6 3h12v18l-3-2-3 2-3-2-3 2z", "M9 8h6M9 12h6"],
    "product-catalog": ["M5 8h14l-1 12H6z", "M9 8V6a3 3 0 0 1 6 0v2"],
    "total-spending": ["M3 7h18v12H3z", "M3 10h18", "M16 15h2"],
    "spending-analytics": ["M4 20V10", "M10 20V4", "M16 20v-7", "M22 20H2"],
    calendar: ["M4 6h16v15H4z", "M4 10h16", "M8 3v5M16 3v5"],
    wishlist: ["M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"],
    "product-reviews": ["M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.6 6.7 19.4l1.2-6L3.4 9.3l6-.7z"],
    "vouchers-promos": ["M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 1 0-4V4H3z", "M9 4v16"],
    "ai-chat-history": ["M4 5h16v11H9l-5 4z", "M8 10h8M8 13h5"],
    "customer-support": ["M4 13a8 8 0 0 1 16 0", "M4 13v3a2 2 0 0 0 2 2h1v-6H6a2 2 0 0 0-2 1z", "M20 13v3a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 1z", "M17 18c0 2-2 3-5 3"],
    settings: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z"],
    "data-export": ["M12 4v11", "M7 10l5 5 5-5", "M4 20h16"],
    "store-map": ["M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2z", "M9 4v14M15 6v14"],
    membership: ["M3 8l4 4 5-7 5 7 4-4-2 11H5z"],
    "video-feed": ["M3 5h18v14H3z", "M10 9l5 3-5 3z"],
    "cooperation-documents": ["M7 3h8l4 4v14H7z", "M15 3v4h4", "M10 12h6M10 16h6"],
    "media-upload": ["M4 5h16v14H4z", "M4 16l5-5 4 4 3-3 4 4", "M15.5 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"],
    "voice-interaction": ["M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z", "M5 11a7 7 0 0 0 14 0", "M12 18v3"],
    "banner-carousel": ["M5 6h14v12H5z", "M2 8v8M22 8v8"],
    "venue-booking": ["M4 20V9l8-5 8 5v11", "M9 20v-6h6v6"],
    "takeaway-ordering": ["M6 8h12l-1.5 12h-9z", "M9 8l1-4h4l1 4"],
    "queue-management": ["M5 4h14v6H5z", "M5 14h14v6H5z", "M9 7h6M9 17h6"],
    clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7v5l3 2"],
    "music-player": ["M9 18V6l10-2v12", "M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"],
    localization: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M3 12h18", "M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"],
    "point-of-sale": ["M4 9h16v11H4z", "M7 9V4h10v5", "M8 13h2M12 13h2M16 13h0M8 16h2M12 16h2"],
    "in-app-payment": ["M3 6h18v12H3z", "M3 10h18", "M7 15h4"],
    plus: ["M12 5v14M5 12h14"],
    minus: ["M6 12h12"],
    check: ["M5 12l5 5 9-10"],
    close: ["M6 6l12 12M18 6L6 18"],
    search: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z", "M20 20l-4-4"],
    arrow: ["M7 17L17 7", "M9 7h8v8"],
    grid: ["M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"],
    lock: ["M6 11h12v9H6z", "M8 11V8a4 4 0 0 1 8 0v3"],
    sparkle: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"],
    filter: ["M4 6h16", "M7 12h10", "M10 18h4"],
    back: ["M15 5l-7 7 7 7"],
    chevron: ["M9 5l7 7-7 7"],
};

export function icon(name, className = "bx-icon") {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", className);
    (P[name] ?? P.sparkle).forEach((d) => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        svg.appendChild(path);
    });
    return svg;
}

/** Elemen kecil: el("div", "kelas", anak...) — teks lewat textContent (aman). */
export function el(tag, className, ...children) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    children.flat().forEach((child) => {
        if (child == null || child === false) return;
        node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return node;
}
