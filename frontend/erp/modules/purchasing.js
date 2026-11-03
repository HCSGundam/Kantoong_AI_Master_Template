/**
 * KANTOONG ERP — PEMBELIAN (Fase 3)
 * File: frontend/erp/modules/purchasing.js
 *
 * Supplier & Purchase Order (PO).
 * Draf -> Dipesan -> Diterima (stok gudang +, harga modal & jurnal
 * Persediaan/Utang tercatat) -> Lunas (jurnal pelunasan, oleh keuangan).
 */

import { hasRole } from "../core/org.js";
import { PO_STATUS, nextSteps, poTotal, validatePoLines } from "../core/purchasing.js";
import { periodStart } from "../core/metrics.js";
import { dateTime, el, emptyState, formDialog, friendlyError, pageHeader, rupiah, segmented, statCard, toast } from "../ui.js";

let tab = "po";

const STEP_LABEL = {
    dipesan: "Pesan ke supplier",
    diterima: "Barang sudah diterima",
    dibayar: "Tandai lunas",
    dibatalkan: "Batalkan",
};

export async function render(ctx) {
    const { data, me } = ctx;
    const canEdit = hasRole(me, "gudang", "keuangan");

    const [orders, suppliers, warehouses, products] = await Promise.all([
        data.listPurchaseOrders(),
        data.listSuppliers(),
        data.listWarehouses(),
        data.listProducts(),
    ]);

    const supplierName = (id) => suppliers.find((entry) => entry.id === id)?.name || "—";
    const warehouseName = (id) => warehouses.find((entry) => entry.id === id)?.name || "—";
    const productName = (id) => products.find((entry) => String(entry.id) === String(id))?.name || id;

    const page = el("div", { class: "erp-page__inner" });

    page.appendChild(pageHeader(
        "Pembelian",
        "Belanja ke supplier. Barang diterima otomatis menambah stok & tercatat di keuangan.",
        canEdit ? el("button", { class: "erp-btn", type: "button", onclick: () => editSupplier(ctx, {}) }, "+ Supplier") : null,
        canEdit ? el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => editPo(ctx, { suppliers, warehouses, products }) }, "+ PO baru") : null
    ));

    const payable = orders.filter((order) => order.status === "diterima").reduce((sum, order) => sum + order.total, 0);
    const active = orders.filter((order) => ["draft", "dipesan"].includes(order.status)).length;
    const month = orders
        .filter((order) => order.received_at && new Date(order.received_at) >= periodStart("month"))
        .reduce((sum, order) => sum + order.total, 0);

    page.appendChild(el("div", { class: "erp-stats" },
        statCard({ label: "Utang ke supplier", value: rupiah(payable), sub: "barang diterima, belum dibayar", tone: payable ? "alert" : "" }),
        statCard({ label: "PO berjalan", value: String(active), sub: "draf & sudah dipesan" }),
        statCard({ label: "Pembelian bulan ini", value: rupiah(month), sub: "barang yang sudah diterima" }),
        statCard({ label: "Supplier aktif", value: String(suppliers.filter((entry) => entry.is_active !== false).length) })
    ));

    page.appendChild(segmented(
        [{ value: "po", label: "Purchase Order" }, { value: "supplier", label: "Supplier" }],
        tab,
        (value) => {
            tab = value;
            ctx.rerender();
        }
    ));

    if (tab === "supplier") {
        page.appendChild(el("section", { class: "erp-card" },
            suppliers.length
                ? el("ul", { class: "erp-members" }, suppliers.map((supplier) => el("li", { class: `erp-member${supplier.is_active === false ? " is-off" : ""}` },
                    el("div", { class: "erp-member__main" },
                        el("strong", { text: supplier.name }),
                        el("small", { text: [supplier.contact_name, supplier.phone, supplier.email].filter(Boolean).join(" · ") || "Belum ada kontak" }),
                        supplier.note ? el("small", { class: "erp-muted", text: supplier.note }) : null
                    ),
                    canEdit ? el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => editSupplier(ctx, supplier) }, "Ubah") : null
                )))
                : emptyState("Belum ada supplier.")
        ));
        return page;
    }

    if (!orders.length) {
        page.appendChild(emptyState("Belum ada PO. Buat PO pertama untuk belanja stok."));
        return page;
    }

    page.appendChild(el("div", { class: "erp-approvals" }, orders.map((order) => {
        const status = PO_STATUS[order.status];
        const steps = nextSteps(order.status).filter((step) => step !== "dibayar" || hasRole(me, "keuangan"));

        return el("article", { class: "erp-card erp-approval" },
            el("div", { class: "erp-approval__top" },
                el("code", { text: order.po_number }),
                el("span", { class: `erp-pill ${status.tone ? `erp-pill--${status.tone}` : ""}`, text: status.label })
            ),
            el("h3", { text: supplierName(order.supplier_id) }),
            el("p", { class: "erp-approval__amount", text: rupiah(order.total) }),
            el("ul", { class: "erp-lines" }, (order.lines || []).map((line) =>
                el("li", {}, el("span", { text: `${line.qty}× ${productName(line.product_id)}` }), el("span", { text: rupiah(line.qty * line.unit_cost) }))
            )),
            el("p", { class: "erp-approval__meta", text: `Ke ${warehouseName(order.warehouse_id)} · dibuat ${dateTime(order.created_at)}${order.received_at ? ` · diterima ${dateTime(order.received_at)}` : ""}` }),
            canEdit && (steps.length || order.status === "draft")
                ? el("div", { class: "erp-approval__actions" },
                    order.status === "draft" ? el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => editPo(ctx, { suppliers, warehouses, products }, order) }, "Ubah") : null,
                    steps.map((step) => el("button", {
                        class: `erp-btn erp-btn--sm ${step === "dibatalkan" ? "erp-btn--danger" : "erp-btn--primary"}`,
                        type: "button",
                        onclick: () => changeStatus(ctx, order, step),
                    }, STEP_LABEL[step]))
                )
                : null
        );
    })));

    return page;
}

async function changeStatus(ctx, order, status) {
    let method = "transfer";

    if (status === "dibayar") {
        const values = await formDialog({
            title: `Lunasi ${order.po_number}`,
            submitLabel: "Tandai lunas",
            fields: [{ name: "method", label: `Dibayar ${rupiah(order.total)} lewat`, type: "select", value: "transfer", options: [{ value: "transfer", label: "Transfer bank" }, { value: "tunai", label: "Tunai / kas" }] }],
        });
        if (!values) return;
        method = values.method;
    } else {
        const ask = {
            dipesan: `Kirim ${order.po_number} ke supplier? Setelah ini PO tidak bisa diubah.`,
            diterima: `Barang ${order.po_number} sudah diterima lengkap? Stok gudang akan bertambah dan utang ke supplier tercatat.`,
            dibatalkan: `Batalkan ${order.po_number}?`,
        }[status];
        if (!window.confirm(ask)) return;
    }

    try {
        await ctx.data.setPoStatus(order.id, status, method);
        toast({ dipesan: "PO dikirim ke supplier.", diterima: "Barang diterima: stok bertambah & jurnal tercatat.", dibayar: "PO lunas: jurnal pelunasan tercatat.", dibatalkan: "PO dibatalkan." }[status]);
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

async function editSupplier(ctx, supplier) {
    const values = await formDialog({
        title: supplier.id ? `Ubah supplier — ${supplier.name}` : "Tambah supplier",
        fields: [
            { name: "name", label: "Nama supplier", required: true, max: 80, value: supplier.name || "" },
            { name: "contact_name", label: "Nama kontak", max: 80, value: supplier.contact_name || "" },
            { name: "phone", label: "Telepon / WhatsApp", max: 20, value: supplier.phone || "" },
            { name: "email", label: "Email", type: "email", max: 120, value: supplier.email || "" },
            { name: "address", label: "Alamat", max: 200, value: supplier.address || "" },
            { name: "note", label: "Catatan", type: "textarea", max: 300, value: supplier.note || "" },
            { name: "is_active", label: "Status", type: "select", value: supplier.is_active === false ? "0" : "1", options: [{ value: "1", label: "Aktif" }, { value: "0", label: "Tidak aktif" }] },
        ],
    });
    if (!values) return;

    try {
        await ctx.data.saveSupplier({
            ...(supplier.id ? { id: supplier.id } : {}),
            name: values.name.trim(),
            contact_name: values.contact_name.trim() || null,
            phone: values.phone.trim() || null,
            email: values.email.trim() || null,
            address: values.address.trim() || null,
            note: values.note.trim() || null,
            is_active: values.is_active === "1",
        });
        toast("Supplier disimpan.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

/** Dialog PO dengan baris barang yang bisa ditambah/dihapus. */
function editPo(ctx, { suppliers, warehouses, products }, order = null) {
    const activeSuppliers = suppliers.filter((entry) => entry.is_active !== false);
    const activeWarehouses = warehouses.filter((entry) => entry.is_active !== false);

    if (!activeSuppliers.length || !activeWarehouses.length) {
        toast(!activeSuppliers.length ? "Tambah supplier dulu." : "Buat gudang dulu di menu Gudang & Stok.", "error");
        return;
    }

    const select = (options, value) => {
        const node = el("select", {}, options.map((option) => el("option", { value: option.value, selected: String(option.value) === String(value) }, option.label)));
        return node;
    };

    const supplier = select(activeSuppliers.map((entry) => ({ value: entry.id, label: entry.name })), order?.supplier_id);
    const warehouse = select(activeWarehouses.map((entry) => ({ value: entry.id, label: entry.name })), order?.warehouse_id);
    const note = el("input", { type: "text", maxlength: 300, placeholder: "contoh: kirim sebelum Jumat" });
    note.value = order?.note || "";

    const linesBox = el("div", { class: "erp-po-lines" });
    const totalText = el("strong", { text: rupiah(0) });
    const message = el("p", { class: "erp-form__error", hidden: true });
    const productOptions = products.map((product) => ({ value: String(product.id), label: product.name }));

    const readLines = () => [...linesBox.querySelectorAll(".erp-po-line")].map((row) => ({
        product_id: row.querySelector("select").value,
        qty: Number(row.querySelector("[name=qty]").value),
        unit_cost: Number(row.querySelector("[name=cost]").value),
    }));

    const refreshTotal = () => { totalText.textContent = rupiah(poTotal(readLines())); };

    const addLine = (line = {}) => {
        const productId = line.product_id || productOptions[0]?.value;
        const product = select(productOptions, productId);
        const qty = el("input", { type: "number", name: "qty", min: 1, step: 1, "aria-label": "Jumlah" });
        qty.value = line.qty ?? 1;
        const cost = el("input", { type: "number", name: "cost", min: 0, step: 100, "aria-label": "Harga beli per unit" });
        const costOf = (id) => products.find((entry) => String(entry.id) === String(id))?.cost_price ?? "";
        cost.value = line.unit_cost ?? costOf(productId);
        product.addEventListener("change", () => { if (!cost.value) cost.value = costOf(product.value); refreshTotal(); });
        [qty, cost].forEach((input) => input.addEventListener("input", refreshTotal));

        const row = el("div", { class: "erp-po-line" },
            product, qty, cost,
            el("button", { class: "erp-icon-btn erp-icon-btn--sm", type: "button", "aria-label": "Hapus baris", onclick: () => { row.remove(); refreshTotal(); } }, "×")
        );
        linesBox.appendChild(row);
        refreshTotal();
    };

    (order?.lines?.length ? order.lines : [{}]).forEach(addLine);

    const dialog = el("dialog", { class: "erp-dialog erp-dialog--wide" });
    const form = el("form", { class: "erp-form" },
        el("h2", { class: "erp-dialog__title", text: order ? `Ubah ${order.po_number}` : "Purchase Order baru" }),
        el("div", { class: "erp-grid2" },
            el("label", { class: "erp-field" }, el("span", { text: "Supplier" }), supplier),
            el("label", { class: "erp-field" }, el("span", { text: "Dikirim ke" }), warehouse)
        ),
        el("div", { class: "erp-field" },
            el("span", { text: "Barang (produk · jumlah · harga beli/unit)" }),
            linesBox,
            el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => addLine() }, "+ Tambah barang")
        ),
        el("label", { class: "erp-field" }, el("span", { text: "Catatan" }), note),
        el("p", { class: "erp-po-total" }, "Total PO: ", totalText),
        message,
        el("div", { class: "erp-form__actions" },
            el("span", { class: "erp-spacer" }),
            el("button", { class: "erp-btn", type: "button", onclick: () => dialog.close() }, "Batal"),
            el("button", { class: "erp-btn erp-btn--primary", type: "submit" }, "Simpan sebagai draf")
        )
    );

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const lines = readLines();
        const problem = validatePoLines(lines);
        if (problem) {
            message.textContent = problem;
            message.hidden = false;
            return;
        }

        try {
            await ctx.data.savePurchaseOrder({
                ...(order ? { id: order.id } : {}),
                supplier_id: supplier.value,
                warehouse_id: warehouse.value,
                note: note.value.trim() || null,
                lines,
            });
            dialog.close();
            toast("PO disimpan sebagai draf.");
            ctx.rerender();
        } catch (error) {
            message.textContent = friendlyError(error);
            message.hidden = false;
        }
    });

    dialog.addEventListener("close", () => dialog.remove());
    dialog.appendChild(form);
    document.body.appendChild(dialog);
    dialog.showModal();
}
