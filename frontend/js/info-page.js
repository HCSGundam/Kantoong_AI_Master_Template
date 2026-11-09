/**
 * KANTOONG — HALAMAN INFO TOKO (info.html)
 * File: frontend/js/info-page.js
 *
 * Kontak & lokasi, Tukar & retur, Pengiriman, Syarat & ketentuan, Privasi.
 * Isi dari pengaturan etalase (ERP › Etalase & Brand), berubah realtime.
 * Bila pemilik belum mengisi, tampil template yang wajar (bertanda).
 */

import CFG from "../client-config.js";
import { applyTheme } from "./theme.js";
import {
    POLICY_PAGES,
    getStorefront,
    onStorefrontChange,
    policyText,
    startStorefrontSync,
    whatsappLink,
} from "./storefront-settings.js";

applyTheme("store");

const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
}

function currentSlug() {
    const slug = new URLSearchParams(location.search).get("halaman") || "kontak";
    return POLICY_PAGES.some((p) => p.slug === slug) ? slug : "kontak";
}

/** Teks biasa -> paragraf & daftar (baris diawali • atau -). Aman: textContent saja. */
function renderText(text) {
    const frag = document.createDocumentFragment();
    String(text).split(/\n{2,}/).forEach((block) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        if (!lines.length) return;
        if (lines.every((l) => /^[•\-–*]\s?/.test(l))) {
            const ul = el("ul", "ip__list");
            lines.forEach((l) => ul.append(el("li", "", l.replace(/^[•\-–*]\s?/, ""))));
            frag.append(ul);
        } else {
            lines.forEach((l) => {
                if (/^[•\-–*]\s?/.test(l)) {
                    const ul = el("ul", "ip__list");
                    ul.append(el("li", "", l.replace(/^[•\-–*]\s?/, "")));
                    frag.append(ul);
                } else frag.append(el("p", "ip__p", l));
            });
        }
    });
    return frag;
}

function contactCard(settings) {
    const c = settings.brand.contact ?? {};
    const box = el("div", "ip__contact");
    const row = (label, value, href) => {
        if (!value) return;
        const item = el("div", "ip__row");
        item.append(el("span", "ip__label", label));
        if (href) {
            const a = el("a", "ip__value", value);
            a.href = href;
            if (/^https?:/.test(href)) {
                a.target = "_blank";
                a.rel = "noopener";
            }
            item.append(a);
        } else item.append(el("span", "ip__value", value));
        box.append(item);
    };
    row("WhatsApp", c.whatsapp, whatsappLink(settings));
    row("Telepon", c.phone, c.phone ? `tel:${c.phone}` : "");
    row("Email", c.email, c.email ? `mailto:${c.email}` : "");
    row("Alamat", [c.address, c.city].filter(Boolean).join(", "));
    row("Jam buka", c.hours);
    row("Instagram", c.instagram && `@${c.instagram}`, c.instagram ? `https://instagram.com/${c.instagram}` : "");
    if (c.maps) row("Peta", "Buka di Google Maps", c.maps);
    if (!box.children.length) box.append(el("p", "ip__muted", "Kontak toko belum diisi. Kamu tetap bisa bertanya lewat asisten di halaman toko."));
    return box;
}

function draw() {
    const settings = getStorefront();
    const slug = currentSlug();
    const page = POLICY_PAGES.find((p) => p.slug === slug);
    const name = settings.brand.name || CFG?.app_name || "Toko";

    document.title = `${page.label} · ${name}`;
    $("infoBrand").textContent = name;

    $("infoNav").replaceChildren(...POLICY_PAGES.map((p) => {
        const a = el("a", `ip__tab${p.slug === slug ? " is-on" : ""}`, p.label);
        a.href = `?halaman=${p.slug}`;
        if (p.slug === slug) a.setAttribute("aria-current", "page");
        return a;
    }));

    const main = $("infoMain");
    const title = el("h1", "ip__title", page.label);
    if (page.key === "contact") {
        main.replaceChildren(title, el("p", "ip__lead", `Kami siap membantu. Hubungi ${name} lewat salah satu cara berikut.`), contactCard(settings));
    } else {
        const own = settings.brand.policies?.[page.key];
        const nodes = [title];
        if (!own) nodes.push(el("p", "ip__template", "Template awal — pemilik toko akan menyesuaikannya."));
        nodes.push(renderText(policyText(settings, page.key)));
        main.replaceChildren(...nodes);
    }
    $("infoFoot").textContent = `© ${new Date().getFullYear()} ${name} · Data pribadi dilindungi UU No. 27/2022 (PDP)`;
}

onStorefrontChange(draw);
startStorefrontSync();
draw();
