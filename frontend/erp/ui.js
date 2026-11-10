/**
 * KANTOONG ERP — ALAT BANTU TAMPILAN
 * File: frontend/erp/ui.js
 *
 * Pembuat elemen kecil yang dipakai semua modul. Semua teks dari
 * database dipasang lewat textContent (anti-XSS), tidak pernah innerHTML.
 */

import { formatRupiah, formatShortRupiah } from "./core/metrics.js";
import "../js/dom-guard.js"; // tidak pernah menulis "null" di layar

export function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);

    for (const [key, value] of Object.entries(attrs || {})) {
        if (value === null || value === undefined || value === false) continue;
        if (key === "class") node.className = value;
        else if (key === "text") node.textContent = String(value);
        else if (key === "style") node.setAttribute("style", value);
        else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
        else if (key === "dataset") Object.assign(node.dataset, value);
        else if (value === true) node.setAttribute(key, "");
        else node.setAttribute(key, String(value));
    }

    for (const child of children.flat()) {
        if (child === null || child === undefined || child === false) continue;
        node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }

    return node;
}

export function icon(path, className = "erp-icon") {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", className);
    const node = document.createElementNS("http://www.w3.org/2000/svg", "path");
    node.setAttribute("d", path);
    svg.appendChild(node);
    return svg;
}

export const rupiah = formatRupiah;
export const shortRupiah = formatShortRupiah;

export function dateTime(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString("id-ID", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta",
    });
}

export function initials(name) {
    return String(name || "?")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("");
}

/* ---------- Notifikasi singkat ---------- */

export function toast(message, tone = "") {
    const host = document.getElementById("erpToast");
    if (!host) return;
    host.textContent = message;
    host.dataset.tone = tone;
    host.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
        host.hidden = true;
    }, 2800);
}

export function friendlyError(error) {
    const message = String(error?.message || error || "");
    if (error?.code === "42501" || /row-level security|permission denied|akses ditolak/i.test(message)) {
        return "Akses ditolak: jabatanmu tidak boleh melakukan ini.";
    }
    if (/duplicate key|unique/i.test(message)) return "Data itu sudah dipakai (email, kode barang, atau alamat toko kembar).";
    if (/failed to fetch|network/i.test(message)) return "Koneksi bermasalah. Coba lagi.";
    if (/relation .* does not exist|could not find the .* (table|column|function)/i.test(message)) {
        return "Database ERP belum siap. Jalankan db/erp-foundation.sql di Supabase.";
    }
    return message || "Terjadi kesalahan.";
}

/* ---------- Kartu angka (KPI) ---------- */

export function statCard({ label, value, sub = "", tone = "" }) {
    return el("article", { class: `erp-stat ${tone ? `erp-stat--${tone}` : ""}` },
        el("p", { class: "erp-stat__label", text: label }),
        el("p", { class: "erp-stat__value", text: value }),
        sub ? el("p", { class: "erp-stat__sub", text: sub }) : null
    );
}

/** Batang progres target (aksesibel, angka tertulis). */
export function progressBar(percent, label = "Capaian target") {
    const shown = percent === null ? 0 : Math.min(100, percent);
    return el("div", { class: "erp-progress" },
        el("div", {
            class: "erp-progress__track",
            role: "progressbar",
            "aria-label": label,
            "aria-valuemin": 0,
            "aria-valuemax": 100,
            "aria-valuenow": shown,
        }, el("span", { class: "erp-progress__fill", style: `width:${shown}%` })),
        el("span", { class: "erp-progress__text", text: percent === null ? "Target belum diatur" : `${percent}%` })
    );
}

/* ---------- Grafik batang omzet harian (satu seri, tinta netral) ---------- */

export function barChart(series, { label = "Omzet harian" } = {}) {
    const max = Math.max(1, ...series.map((point) => point.omzet));
    const wrap = el("figure", { class: "erp-chart" });
    const plot = el("div", { class: "erp-chart__plot", role: "group", "aria-label": label });
    const tip = el("div", { class: "erp-chart__tip", hidden: true });

    series.forEach((point, index) => {
        const height = point.omzet > 0 ? Math.max(2, (point.omzet / max) * 100) : 0;
        const day = new Date(`${point.date}T00:00:00+07:00`);
        const dayLabel = day.toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });

        const column = el("div", {
            class: "erp-chart__col",
            tabindex: 0,
            "aria-label": `${dayLabel}: ${formatRupiah(point.omzet)}`,
        }, el("span", { class: "erp-chart__bar", style: `height:${height}%` }));

        const show = () => {
            tip.textContent = `${dayLabel} · ${formatRupiah(point.omzet)}`;
            tip.hidden = false;
            tip.style.left = `${((index + 0.5) / series.length) * 100}%`;
        };
        column.addEventListener("mouseenter", show);
        column.addEventListener("focus", show);
        column.addEventListener("mouseleave", () => { tip.hidden = true; });
        column.addEventListener("blur", () => { tip.hidden = true; });
        plot.appendChild(column);
    });

    plot.appendChild(tip);

    const first = series[0];
    const last = series[series.length - 1];
    const fmt = (point) => new Date(`${point.date}T00:00:00+07:00`)
        .toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });

    wrap.append(
        el("div", { class: "erp-chart__axis" },
            el("span", { text: shortRupiah(max) }),
            el("span", { text: "0" })
        ),
        plot,
        first ? el("figcaption", { class: "erp-chart__foot" },
            el("span", { text: fmt(first) }),
            el("span", { text: fmt(last) })
        ) : null
    );

    return wrap;
}

/** Batang mendatar per kelompok (mis. omzet per tim) dengan label langsung. */
export function hbarList(rows) {
    const max = Math.max(1, ...rows.map((row) => row.value));
    return el("ul", { class: "erp-hbars" },
        rows.map((row) => el("li", { class: "erp-hbar" },
            el("span", { class: "erp-hbar__label", text: row.label }),
            el("span", { class: "erp-hbar__track" },
                el("span", { class: "erp-hbar__fill", style: `width:${(row.value / max) * 100}%` })
            ),
            el("span", { class: "erp-hbar__value", text: row.display ?? shortRupiah(row.value) })
        ))
    );
}

/* ---------- Dialog formulir sederhana ---------- */

/**
 * fields: [{ name, label, type, value, options, required, hint, min, max, step }]
 * Mengembalikan Promise<object|null> (null = batal).
 */
export function formDialog({ title, fields, submitLabel = "Simpan", danger = null }) {
    return new Promise((resolve) => {
        const dialog = el("dialog", { class: "erp-dialog" });
        const form = el("form", { method: "dialog", class: "erp-form" });

        form.appendChild(el("h2", { class: "erp-dialog__title", text: title }));

        for (const field of fields) {
            const id = `f-${field.name}`;
            let input;

            if (field.type === "select") {
                input = el("select", { id, name: field.name, required: field.required },
                    field.options.map((option) =>
                        el("option", { value: option.value, selected: String(option.value) === String(field.value ?? "") }, option.label)
                    )
                );
            } else if (field.type === "textarea") {
                input = el("textarea", { id, name: field.name, rows: 3, maxlength: field.max || 500 });
                input.value = field.value ?? "";
            } else if (field.type === "checkboxes") {
                input = el("div", { class: "erp-checks", id },
                    field.options.map((option) => el("label", { class: "erp-check" },
                        el("input", {
                            type: "checkbox",
                            name: field.name,
                            value: option.value,
                            checked: (field.value || []).includes(option.value),
                        }),
                        option.label
                    ))
                );
            } else {
                input = el("input", {
                    id,
                    name: field.name,
                    type: field.type || "text",
                    required: field.required,
                    min: field.min,
                    max: field.type === "number" ? field.max : null,
                    maxlength: field.type !== "number" ? field.max : null,
                    step: field.step,
                    placeholder: field.placeholder,
                    inputmode: field.type === "number" ? "decimal" : null,
                });
                input.value = field.value ?? "";
            }

            form.appendChild(el("label", { class: "erp-field", for: id },
                el("span", { text: field.label }),
                input,
                field.hint ? el("small", { text: field.hint }) : null
            ));
        }

        const message = el("p", { class: "erp-form__error", hidden: true });
        const actions = el("div", { class: "erp-form__actions" },
            danger ? el("button", { type: "button", class: "erp-btn erp-btn--danger", onclick: () => { dialog.close(); danger.onClick(); } }, danger.label) : null,
            el("span", { class: "erp-spacer" }),
            el("button", { type: "button", class: "erp-btn", onclick: () => dialog.close("cancel") }, "Batal"),
            el("button", { type: "submit", class: "erp-btn erp-btn--primary" }, submitLabel)
        );
        form.append(message, actions);

        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const data = {};
            for (const field of fields) {
                if (field.type === "checkboxes") {
                    data[field.name] = [...form.querySelectorAll(`input[name="${field.name}"]:checked`)].map((box) => box.value);
                } else {
                    data[field.name] = form.elements[field.name].value;
                }
            }
            dialog.returnValue = "ok";
            dialog.close();
            resolve(data);
        });

        dialog.addEventListener("close", () => {
            if (dialog.returnValue !== "ok") resolve(null);
            dialog.remove();
        });

        dialog.appendChild(form);
        document.body.appendChild(dialog);
        dialog.showModal();
        form.querySelector("input, select, textarea")?.focus();
    });
}

export function confirmDialog(message) {
    return Promise.resolve(window.confirm(message));
}

/** Kerangka halaman modul: judul + keterangan + slot aksi. */
export function pageHeader(title, subtitle, ...actions) {
    return el("header", { class: "erp-page__head" },
        el("div", {},
            el("h1", { class: "erp-page__title", text: title }),
            subtitle ? el("p", { class: "erp-page__sub", text: subtitle }) : null
        ),
        actions.length ? el("div", { class: "erp-page__actions" }, actions) : null
    );
}

export function emptyState(text) {
    return el("p", { class: "erp-empty", text });
}

export function segmented(options, value, onChange) {
    const group = el("div", { class: "erp-seg", role: "tablist" });
    options.forEach((option) => {
        group.appendChild(el("button", {
            type: "button",
            role: "tab",
            class: "erp-seg__btn",
            "aria-selected": String(option.value === value),
            onclick: () => onChange(option.value),
        }, option.label));
    });
    return group;
}
