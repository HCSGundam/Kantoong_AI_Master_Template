/**
 * KANTOONG ERP — INFO TOKO & KEBIJAKAN, PAKET & INDUSTRI, HARGA EMAS
 * File: frontend/erp/modules/storefront-info.js
 * Dipakai modules/storefront.js (menu Etalase & Brand).
 */

import { el, toast, friendlyError } from "../ui.js";
import CFG from "../../client-config.js";
import { GOLD_KARATS, POLICY_PAGES, defaultPolicies, getStorefront, saveStorefront } from "../../js/storefront-settings.js";
import { PACKAGES, getPlan, setPlanPreview } from "../../js/plan.js";
import { INDUSTRIES } from "../../js/industry.js";

const clone = (v) => JSON.parse(JSON.stringify(v));

function field(label, input, hint) {
    return el("label", { class: "hs-field" }, el("span", {}, label), input, hint ? el("small", { class: "erp-muted" }, hint) : null);
}

function input(value, { type = "text", placeholder = "", max = 200, disabled = false, onInput } = {}) {
    const node = el("input", { class: "hs-input", type, placeholder, maxlength: String(max), disabled });
    node.value = value ?? "";
    node.addEventListener("input", () => onInput?.(node.value));
    return node;
}

/* ---------- Info toko & kebijakan (owner) ---------- */

export function infoCard({ draft, isOwner, demo, onChange, onSaved }) {
    draft.brand.contact = draft.brand.contact ?? {};
    draft.brand.policies = draft.brand.policies ?? {};
    const c = draft.brand.contact;
    const templates = defaultPolicies(draft.brand.name);
    const set = (key) => (v) => {
        c[key] = v;
        onChange();
    };

    const contactGrid = el("div", { class: "hs-row" },
        field("WhatsApp", input(c.whatsapp, { placeholder: "0812xxxxxxx", max: 20, disabled: !isOwner, onInput: set("whatsapp") }), "Dipakai tombol \"Pesan via WhatsApp\" & jadwal survei."),
        field("Telepon (opsional)", input(c.phone, { max: 20, disabled: !isOwner, onInput: set("phone") })),
        field("Email", input(c.email, { type: "email", max: 120, disabled: !isOwner, onInput: set("email") })),
        field("Instagram (tanpa @)", input(c.instagram, { max: 60, disabled: !isOwner, onInput: set("instagram") })));
    const placeGrid = el("div", { class: "hs-row" },
        field("Alamat toko", input(c.address, { max: 300, disabled: !isOwner, onInput: set("address") })),
        field("Kota", input(c.city, { max: 80, disabled: !isOwner, onInput: set("city") })),
        field("Jam buka", input(c.hours, { placeholder: "Senin–Sabtu 09.00–21.00", max: 120, disabled: !isOwner, onInput: set("hours") })),
        field("Link Google Maps (https)", input(c.maps, { placeholder: "https://maps.app.goo.gl/…", max: 500, disabled: !isOwner, onInput: set("maps") })));

    const policies = el("div", { class: "hs" }, POLICY_PAGES.filter((p) => p.key !== "contact").map((page) => {
        const area = el("textarea", { class: "hs-input", rows: 7, maxlength: "5000", disabled: !isOwner });
        area.value = draft.brand.policies[page.key] || templates[page.key];
        area.addEventListener("input", () => {
            draft.brand.policies[page.key] = area.value;
            onChange();
        });
        return field(page.label, area);
    }));

    const save = el("button", { class: "erp-btn erp-btn--primary", type: "button", disabled: !isOwner }, "Simpan info toko");
    save.addEventListener("click", async () => {
        // Template yang belum diubah ikut disimpan apa adanya agar halaman info tidak kosong.
        POLICY_PAGES.filter((p) => p.key !== "contact").forEach((p) => {
            if (!draft.brand.policies[p.key]) draft.brand.policies[p.key] = templates[p.key];
        });
        save.disabled = true;
        try {
            await saveStorefront("brand", draft.brand, { demo });
            onSaved?.();
            toast("Info toko tersimpan · footer & halaman info langsung berubah.");
        } catch (error) {
            toast(friendlyError(error), "bad");
        } finally {
            save.disabled = !isOwner;
        }
    });

    const preview = el("a", { class: "erp-btn erp-btn--ghost", href: "../info.html?halaman=kontak", target: "_blank", rel: "noopener" }, "Lihat halaman info ↗");

    return el("section", { class: "erp-card erp-sf__card" },
        el("div", { class: "erp-card__head" }, el("h2", {}, "Info toko & kebijakan")),
        el("p", { class: "erp-muted" }, isOwner
            ? "Wajib sebelum didaftarkan ke Google (Merchant Center / Business Profile): kontak, tukar & retur, pengiriman, syarat, privasi. Tampil di footer toko dan halaman info terpisah."
            : "🔒 Hanya owner yang bisa mengubah info toko & kebijakan."),
        el("p", { class: "hs-section" }, "Kontak"), contactGrid,
        el("p", { class: "hs-section" }, "Lokasi"), placeGrid,
        el("p", { class: "hs-section" }, "Kebijakan (template sudah diisi — sesuaikan dengan aturan tokomu)"), policies,
        el("div", { class: "erp-sf__actions" }, preview, save));
}

/* ---------- Paket & industri ---------- */

export function planCard() {
    const plan = getPlan();
    const canPreview = CFG?.erp_demo === true;
    const box = el("section", { class: "erp-card erp-sf__card" },
        el("div", { class: "erp-card__head" }, el("h2", {}, "Paket & industri")),
        el("div", { class: "erp-sf__plan" },
            el("div", {}, el("small", {}, "Paket"), el("strong", {}, PACKAGES[plan.package].label)),
            el("div", {}, el("small", {}, "Industri"), el("strong", {}, INDUSTRIES[plan.industry].label)),
            el("div", {}, el("small", {}, "Keranjang & checkout"), el("strong", {}, plan.commerce ? "Aktif" : "Pesan via WhatsApp")),
            el("div", {}, el("small", {}, "Kasir POS"), el("strong", {}, plan.pos ? "Aktif" : "Tidak termasuk"))),
        el("p", { class: "erp-muted" }, "Paket & industri ditentukan oleh kontrak (diatur tim Kantoong di client-config.js), bukan oleh admin toko."));

    if (canPreview) {
        const pick = (label, options, value, onPick) => el("div", { class: "hs-field" }, el("span", {}, label),
            el("div", { class: "hs-chips" }, options.map(([id, text]) => {
                const b = el("button", { class: `hs-chip${id === value ? " is-on" : ""}`, type: "button" }, text);
                b.addEventListener("click", () => onPick(id));
                return b;
            })));
        const apply = (patch) => {
            setPlanPreview({ package: plan.package, industry: plan.industry, ...patch });
            toast("Pratinjau paket diterapkan di browser ini. Memuat ulang…");
            setTimeout(() => location.reload(), 500);
        };
        box.append(
            el("p", { class: "hs-section" }, "Pratinjau (khusus web template Kantoong)"),
            pick("Coba paket", Object.entries(PACKAGES).map(([id, p]) => [id, p.label]), plan.package, (id) => apply({ package: id })),
            pick("Coba industri", Object.entries(INDUSTRIES).map(([id, i]) => [id, i.label]), plan.industry, (id) => apply({ industry: id })),
            plan.preview ? el("button", { class: "erp-btn erp-btn--ghost", type: "button", onclick: () => {
                setPlanPreview(null);
                location.reload();
            } }, "Kembali ke paket asli") : null);
    }
    return box;
}

/* ---------- Harga emas hari ini (industri emas) ---------- */

export function goldCard({ draft, demo, onChange }) {
    draft.catalog.gold = draft.catalog.gold ?? { prices: {}, updatedAt: "" };
    const gold = draft.catalog.gold;
    const rows = el("div", { class: "hs-row" }, GOLD_KARATS.map((k) => field(`${k} (Rp / gram)`, input(gold.prices[k] ?? "", {
        type: "number",
        placeholder: "0",
        max: 12,
        onInput: (v) => {
            gold.prices[k] = Number(v) || 0;
            onChange();
        },
    }))));
    const save = el("button", { class: "erp-btn erp-btn--primary", type: "button" }, "Simpan harga hari ini");
    save.addEventListener("click", async () => {
        gold.updatedAt = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
        save.disabled = true;
        try {
            const current = clone(getStorefront().catalog);
            await saveStorefront("catalog", { ...current, gold }, { demo });
            toast("Harga emas tersimpan · harga semua perhiasan di toko langsung dihitung ulang.");
        } catch (error) {
            toast(friendlyError(error), "bad");
        } finally {
            save.disabled = false;
        }
    });
    return el("section", { class: "erp-card erp-sf__card" },
        el("div", { class: "erp-card__head" }, el("h2", {}, "Harga emas hari ini")),
        el("p", { class: "erp-muted" }, `Harga di toko = berat × harga per gram kadarnya + ongkos bikin. ${gold.updatedAt ? `Terakhir diperbarui ${gold.updatedAt}.` : "Belum pernah diisi."}`),
        rows,
        el("div", { class: "erp-sf__actions" }, save));
}
