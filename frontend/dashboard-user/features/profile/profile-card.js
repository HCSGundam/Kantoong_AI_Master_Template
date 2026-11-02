/**
 * KANTOONG CORE — PROFILE CARD
 * File: frontend/dashboard-user/features/profile/profile-card.js
 *
 * Kartu Profil di dashboard. Satu struktur DOM yang dirapikan oleh CSS
 * sesuai ukuran kartu (atribut data-card-mode pada kartu induk):
 *
 *   1x1         ikon: foto/inisial + tombol View Profile
 *   horizontal  2x1 : foto kiri, nama + bio + angka + tombol kanan
 *   vertical    1x2 : foto atas, nama + bio + angka + tombol bawah
 *   compact     2x2 : foto penuh + kotak kaca (glassmorphism)
 *   large       4x4 : seperti compact dengan tipografi lebih besar
 *
 * Seluruh teks dipasang lewat textContent (anti-XSS).
 */

import "./profile-card.css";

const SVG_NS = "http://www.w3.org/2000/svg";

function el(tag, className, text) {
    const node = document.createElement(tag);

    if (className) {
        node.className = className;
    }

    if (text !== undefined) {
        node.textContent = text;
    }

    return node;
}

function icon(pathData) {
    const svg = document.createElementNS(SVG_NS, "svg");

    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.classList.add("kc-pcard__icon");

    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", pathData);

    svg.append(path);

    return svg;
}

const ICON_PERSON =
    "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0";
const ICON_POSTS =
    "M8 8h11v11H8zM5 16V5h11";
const ICON_ARROW = "M7 17 17 7M8 7h9v9";

/** 0 -> "00", 1500 -> "1.5K", 90 -> "90". */
export function formatCount(value) {
    const number = Number(value) || 0;

    if (number <= 0) {
        return "00";
    }

    if (number >= 1_000_000) {
        return `${(number / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    }

    if (number >= 1000) {
        return `${(number / 1000).toFixed(1).replace(/\.0$/, "")}K`;
    }

    return String(number);
}

function createStat(pathData, value) {
    const stat = el("span", "kc-pcard__stat");

    stat.append(icon(pathData), el("span", "", formatCount(value)));

    return stat;
}

/**
 * @param {object}  options
 * @param {object|null} options.user  hasil getDashboardUser() atau null
 */
export function renderProfileCard({ user } = {}) {
    const loggedIn = Boolean(user?.authenticated);

    const name = loggedIn ? user.name : "Belum masuk";

    const bio = loggedIn
        ? user.bio || `${user.role} \u00B7 ${user.email}`
        : "Masuk untuk melihat profil dan fitur pribadimu.";

    const photo =
        loggedIn && /^https?:\/\//i.test(user.avatarUrl ?? "")
            ? user.avatarUrl
            : "";

    const root = el("span", "kc-pcard");

    root.dataset.photo = String(Boolean(photo));
    root.dataset.state = loggedIn ? "member" : "guest";

    // --- media: foto atau inisial
    const media = el("span", "kc-pcard__media");

    const showLetter = () => {
        root.dataset.photo = "false";

        media.replaceChildren(
            el(
                "span",
                "kc-pcard__letter",
                (name.trim().charAt(0) || "P").toUpperCase()
            )
        );
    };

    if (photo) {
        const image = document.createElement("img");

        image.src = photo;
        image.alt = "";
        image.decoding = "async";
        image.referrerPolicy = "no-referrer";
        image.draggable = false;
        image.addEventListener("error", showLetter);

        media.append(image);
    } else {
        showLetter();
    }

    // --- panel: nama, bio, angka, tombol
    const panel = el("span", "kc-pcard__panel");

    const nameNode = el("span", "kc-pcard__name", name);
    const bioNode = el("span", "kc-pcard__bio", bio);

    bioNode.dataset.fade = "";

    const footer = el("span", "kc-pcard__footer");

    const stats = el("span", "kc-pcard__stats");

    stats.append(
        createStat(ICON_PERSON, user?.followers),
        createStat(ICON_POSTS, user?.posts)
    );

    const cta = el("span", "kc-pcard__cta");

    cta.append(icon(ICON_ARROW), el("span", "", loggedIn ? "View Profile" : "Masuk"));

    footer.append(stats, cta);
    panel.append(nameNode, bioNode, footer);

    root.append(media, panel);

    return root;
}
