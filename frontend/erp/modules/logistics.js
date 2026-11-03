/**
 * KANTOONG ERP — LOGISTIK & PENGIRIMAN (Fase 3)
 * File: frontend/erp/modules/logistics.js
 *
 * Alur pesanan online: Menunggu bayar -> Siap dikemas -> Dikemas ->
 * Dalam pengiriman (stok gudang berkurang, resi tersimpan) -> Selesai.
 * Pembayaran SELALU dilakukan pembeli; di sini hanya konfirmasi.
 */

import { ORDER_STEPS, actionsFor, hoursSince } from "../core/logistics.js";
import { dateTime, el, emptyState, formDialog, friendlyError, pageHeader, rupiah, toast } from "../ui.js";

let current = "dibayar";

export async function render(ctx) {
    const { data, me } = ctx;
    const [orders, warehouses] = await Promise.all([data.listOnlineOrders(), data.listWarehouses()]);

    const count = (status) => orders.filter((order) => order.status === status).length;
    const page = el("div", { class: "erp-page__inner" });

    page.appendChild(pageHeader(
        "Logistik & Pengiriman",
        "Pesanan online dari semua toko sales. Kirim = stok gudang berkurang otomatis."
    ));

    // Tab status dengan jumlah (seperti papan kanban sederhana).
    page.appendChild(el("div", { class: "erp-chips" }, ORDER_STEPS.map((step) => el("button", {
        type: "button",
        class: `erp-chip${current === step.status ? " is-active" : ""}`,
        onclick: () => {
            current = step.status;
            ctx.rerender();
        },
    }, `${step.label} (${count(step.status)})`))));

    const list = orders.filter((order) => order.status === current);
    const late = list.filter((order) => current === "dibayar" && hoursSince(order.created_at) >= 24).length;

    if (late) {
        page.appendChild(el("p", { class: "erp-privacy", text: `⚠️ ${late} pesanan sudah dibayar lebih dari 24 jam tapi belum dikemas.` }));
    }

    if (!list.length) {
        page.appendChild(emptyState("Tidak ada pesanan di tahap ini."));
        return page;
    }

    page.appendChild(el("div", { class: "erp-approvals" }, list.slice(0, 80).map((order) => {
        const actions = actionsFor(order.status, me);
        const items = order.items || [];

        return el("article", { class: "erp-card erp-approval" },
            el("div", { class: "erp-approval__top" },
                el("code", { text: order.order_code }),
                current === "dibayar" && hoursSince(order.created_at) >= 24
                    ? el("span", { class: "erp-pill erp-pill--bad", text: "Terlambat" })
                    : el("small", { class: "erp-muted", text: dateTime(order.created_at) })
            ),
            el("h3", { text: order.customer_name }),
            el("p", { class: "erp-approval__meta", text: [order.customer_phone, [order.address_line, order.city].filter(Boolean).join(", ")].filter(Boolean).join(" · ") }),
            el("ul", { class: "erp-lines" }, items.map((item) =>
                el("li", {}, el("span", { text: `${item.qty}× ${item.product_name}` }), el("span", { text: rupiah(item.qty * item.unit_price) }))
            )),
            el("p", { class: "erp-approval__amount", text: rupiah(order.total) }),
            order.voucher_code ? el("p", { class: "erp-approval__meta", text: `Voucher ${order.voucher_code} −${rupiah(order.voucher_discount)}` }) : null,
            order.tracking_number
                ? el("p", { class: "erp-approval__decision", text: `${order.courier_name || "Kurir"} · resi ${order.tracking_number}` })
                : (order.courier_name ? el("p", { class: "erp-approval__meta", text: `Kurir pilihan: ${order.courier_name}` }) : null),
            el("div", { class: "erp-approval__actions" },
                ["diproses", "dikirim"].includes(order.status)
                    ? el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => printLabel(order) }, "Cetak label")
                    : null,
                actions.map((entry) => el("button", {
                    class: `erp-btn erp-btn--sm ${entry.danger ? "erp-btn--danger" : "erp-btn--primary"}`,
                    type: "button",
                    onclick: () => advance(ctx, order, entry.action, warehouses),
                }, entry.label))
            )
        );
    })));

    return page;
}

async function advance(ctx, order, action, warehouses) {
    const payload = { order_id: order.id, action };

    if (action === "kirim") {
        const stores = warehouses.filter((entry) => entry.is_active !== false);
        const values = await formDialog({
            title: `Kirim ${order.order_code}`,
            submitLabel: "Kirim sekarang",
            fields: [
                { name: "warehouse_id", label: "Diambil dari gudang", type: "select", value: stores.find((entry) => entry.kind === "gudang")?.id || stores[0]?.id, options: stores.map((entry) => ({ value: entry.id, label: entry.name })) },
                { name: "courier_name", label: "Kurir", max: 40, value: order.courier_name || "" },
                { name: "tracking_number", label: "Nomor resi", required: true, max: 60, placeholder: "contoh: JX1234567890" },
            ],
        });
        if (!values) return;
        Object.assign(payload, values);
    } else {
        const ask = {
            bayar: `Pembayaran ${order.order_code} sebesar ${rupiah(order.total)} sudah masuk ke rekening toko?`,
            batal: `Batalkan pesanan ${order.order_code}?`,
        }[action];
        if (ask && !window.confirm(ask)) return;
    }

    try {
        await ctx.data.orderAdvance(payload);
        toast({
            bayar: "Pembayaran dikonfirmasi. Pesanan siap dikemas.",
            proses: "Pesanan sedang dikemas.",
            kirim: "Pesanan dikirim. Stok gudang berkurang.",
            selesai: "Pesanan selesai.",
            batal: "Pesanan dibatalkan.",
        }[action]);
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

function printLabel(order) {
    const dialog = el("dialog", { class: "erp-dialog erp-receipt" },
        el("div", { class: "erp-receipt__paper erp-label" },
            el("p", { class: "erp-receipt__brand", text: "LABEL PENGIRIMAN" }),
            el("p", {}, el("strong", { text: "Kepada: " }), order.customer_name),
            el("p", { text: order.customer_phone || "" }),
            el("p", { text: [order.address_line, order.district, order.city, order.province, order.postal_code].filter(Boolean).join(", ") }),
            el("p", {}, el("strong", { text: "Kurir: " }), `${order.courier_name || "-"} ${order.service_name || ""}`),
            order.tracking_number ? el("p", {}, el("strong", { text: "Resi: " }), order.tracking_number) : null,
            el("p", { class: "erp-muted", text: `${order.order_code} · ${(order.items || []).reduce((sum, item) => sum + item.qty, 0)} barang` })
        ),
        el("div", { class: "erp-form__actions" },
            el("span", { class: "erp-spacer" }),
            el("button", { class: "erp-btn", type: "button", onclick: () => window.print() }, "Cetak"),
            el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => dialog.close() }, "Tutup")
        )
    );
    dialog.addEventListener("close", () => dialog.remove());
    document.body.appendChild(dialog);
    dialog.showModal();
}
