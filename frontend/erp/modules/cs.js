/**
 * KANTOONG ERP — CUSTOMER SERVICE (Fase 3)
 * File: frontend/erp/modules/cs.js
 *
 * Tiket pertanyaan, keluhan, dan retur. Semua karyawan boleh membuat
 * tiket (mis. sales menerima keluhan); CS & atasan mengelola semuanya.
 * Retur diterima -> stok kembali + pengembalian dana tercatat di jurnal.
 */

import { hasRole } from "../core/org.js";
import { PRIORITIES, TICKET_KINDS, TICKET_STATUS, sortTickets, waitingLabel } from "../core/cs.js";
import { dateTime, el, emptyState, formDialog, friendlyError, pageHeader, rupiah, segmented, statCard, toast } from "../ui.js";

let filter = "open";

export async function render(ctx) {
    const { data, me } = ctx;
    const [tickets, members] = await Promise.all([data.listTickets(), data.listMembers()]);
    const nameOf = (id) => members.find((member) => member.id === id)?.full_name || "—";
    const isCs = hasRole(me, "cs") || me.level >= 3;

    const open = tickets.filter((ticket) => ["baru", "diproses"].includes(ticket.status));
    const high = open.filter((ticket) => ticket.priority === "tinggi").length;
    const done = tickets.filter((ticket) => ticket.resolved_at);
    const avgHours = done.length
        ? Math.round(done.reduce((sum, ticket) => sum + (new Date(ticket.resolved_at) - new Date(ticket.created_at)), 0) / done.length / 3600000)
        : 0;

    const page = el("div", { class: "erp-page__inner" });
    page.appendChild(pageHeader(
        "Customer Service",
        isCs ? "Keluhan, pertanyaan & retur pelanggan dari semua toko." : "Laporkan keluhan pelanggan ke tim CS.",
        el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: () => newTicket(ctx, members) }, "+ Tiket baru")
    ));

    page.appendChild(el("div", { class: "erp-stats" },
        statCard({ label: "Tiket terbuka", value: String(open.length), tone: open.length ? "alert" : "" }),
        statCard({ label: "Prioritas tinggi", value: String(high) }),
        statCard({ label: "Rata-rata selesai", value: done.length ? `${avgHours} jam` : "-", sub: `${done.length} tiket selesai` })
    ));

    page.appendChild(segmented(
        [{ value: "open", label: "Terbuka" }, { value: "done", label: "Selesai" }, { value: "all", label: "Semua" }],
        filter,
        (value) => {
            filter = value;
            ctx.rerender();
        }
    ));

    const list = sortTickets(tickets).filter((ticket) =>
        filter === "all" || (filter === "open" ? ["baru", "diproses"].includes(ticket.status) : ["selesai", "ditutup"].includes(ticket.status))
    );

    if (!list.length) {
        page.appendChild(emptyState(filter === "open" ? "Tidak ada tiket terbuka. 🎉" : "Belum ada tiket."));
        return page;
    }

    page.appendChild(el("div", { class: "erp-approvals" }, list.map((ticket) => {
        const status = TICKET_STATUS[ticket.status];
        return el("article", { class: "erp-card erp-approval" },
            el("div", { class: "erp-approval__top" },
                el("span", { class: "erp-tag", text: `${ticket.ticket_no} · ${TICKET_KINDS[ticket.kind]}` }),
                el("span", { class: `erp-pill ${status.tone ? `erp-pill--${status.tone}` : ""}`, text: status.label })
            ),
            el("h3", { text: ticket.subject }),
            el("p", { class: "erp-approval__meta", text: [ticket.customer_name, ticket.customer_contact, ticket.order_code].filter(Boolean).join(" · ") }),
            el("p", { class: "erp-approval__meta", text: `Prioritas ${PRIORITIES[ticket.priority]} · ditangani ${nameOf(ticket.assigned_to)} · ${["baru", "diproses"].includes(ticket.status) ? `menunggu ${waitingLabel(ticket.created_at)}` : `selesai ${dateTime(ticket.resolved_at)}`}` }),
            el("div", { class: "erp-approval__actions" },
                el("button", { class: "erp-btn erp-btn--sm erp-btn--primary", type: "button", onclick: () => openTicket(ctx, ticket, members, isCs) }, "Buka")
            )
        );
    })));

    return page;
}

async function newTicket(ctx, members) {
    const csMembers = members.filter((member) => member.job_role === "cs" && member.is_active !== false);
    const values = await formDialog({
        title: "Tiket baru",
        submitLabel: "Buat tiket",
        fields: [
            { name: "kind", label: "Jenis", type: "select", value: "keluhan", options: Object.entries(TICKET_KINDS).map(([value, label]) => ({ value, label })) },
            { name: "subject", label: "Ringkasan masalah", required: true, max: 140, placeholder: "contoh: Botol bocor saat diterima" },
            { name: "customer_name", label: "Nama pelanggan", max: 80 },
            { name: "customer_contact", label: "Kontak pelanggan (HP/IG/email)", max: 120 },
            { name: "order_code", label: "Kode pesanan (jika ada)", max: 40 },
            { name: "priority", label: "Prioritas", type: "select", value: "normal", options: Object.entries(PRIORITIES).map(([value, label]) => ({ value, label })) },
            { name: "assigned_to", label: "Ditangani oleh", type: "select", value: csMembers[0]?.id || "", options: [{ value: "", label: "— Tim CS —" }].concat(csMembers.map((member) => ({ value: member.id, label: member.full_name }))) },
        ],
    });
    if (!values) return;
    if (values.subject.trim().length < 3) {
        toast("Ringkasan masalah terlalu pendek.", "error");
        return;
    }

    try {
        await ctx.data.createTicket({
            kind: values.kind,
            subject: values.subject.trim(),
            customer_name: values.customer_name.trim() || null,
            customer_contact: values.customer_contact.trim() || null,
            order_code: values.order_code.trim().toUpperCase() || null,
            priority: values.priority,
            assigned_to: values.assigned_to || null,
        });
        toast("Tiket dibuat & masuk ke antrean CS.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

async function openTicket(ctx, ticket, members, isCs) {
    const { data } = ctx;
    const notes = await data.listTicketNotes(ticket.id);
    const nameOf = (id) => members.find((member) => member.id === id)?.full_name || "—";
    const csMembers = members.filter((member) => member.job_role === "cs" && member.is_active !== false);

    const status = el("select", { "aria-label": "Status" }, Object.entries(TICKET_STATUS).map(([value, entry]) => el("option", { value, selected: value === ticket.status }, entry.label)));
    const priority = el("select", { "aria-label": "Prioritas" }, Object.entries(PRIORITIES).map(([value, label]) => el("option", { value, selected: value === ticket.priority }, label)));
    const assignee = el("select", { "aria-label": "Ditangani" }, [el("option", { value: "" }, "— Tim CS —")].concat(csMembers.map((member) => el("option", { value: member.id, selected: member.id === ticket.assigned_to }, member.full_name))));
    const note = el("textarea", { rows: 3, maxlength: 1000, placeholder: "Tulis perkembangan / jawaban ke pelanggan…" });

    const dialog = el("dialog", { class: "erp-dialog erp-dialog--wide" });
    const form = el("form", { class: "erp-form" },
        el("h2", { class: "erp-dialog__title", text: `${ticket.ticket_no} — ${ticket.subject}` }),
        el("p", { class: "erp-muted", text: [TICKET_KINDS[ticket.kind], ticket.customer_name, ticket.customer_contact, ticket.order_code, `dibuat ${dateTime(ticket.created_at)}`].filter(Boolean).join(" · ") }),
        isCs ? el("div", { class: "erp-grid3" },
            el("label", { class: "erp-field" }, el("span", { text: "Status" }), status),
            el("label", { class: "erp-field" }, el("span", { text: "Prioritas" }), priority),
            el("label", { class: "erp-field" }, el("span", { text: "Ditangani" }), assignee)
        ) : null,
        el("div", { class: "erp-field" },
            el("span", { text: "Riwayat" }),
            notes.length
                ? el("ul", { class: "erp-notes" }, notes.map((entry) => el("li", {}, el("strong", { text: nameOf(entry.author_id) }), el("small", { class: "erp-muted", text: ` · ${dateTime(entry.created_at)}` }), el("p", { text: entry.body }))))
                : el("p", { class: "erp-muted", text: "Belum ada catatan." })
        ),
        el("label", { class: "erp-field" }, el("span", { text: "Catatan baru" }), note),
        el("div", { class: "erp-form__actions" },
            isCs && ticket.kind === "retur" && ["baru", "diproses"].includes(ticket.status)
                ? el("button", { class: "erp-btn", type: "button", onclick: () => { dialog.close(); processReturn(ctx, ticket); } }, "Proses retur")
                : null,
            el("span", { class: "erp-spacer" }),
            el("button", { class: "erp-btn", type: "button", onclick: () => dialog.close() }, "Tutup"),
            el("button", { class: "erp-btn erp-btn--primary", type: "submit" }, "Simpan")
        )
    );

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
            if (note.value.trim()) await data.addTicketNote(ticket.id, note.value.trim());
            if (isCs && (status.value !== ticket.status || priority.value !== ticket.priority || (assignee.value || null) !== (ticket.assigned_to || null))) {
                await data.updateTicket(ticket.id, { status: status.value, priority: priority.value, assigned_to: assignee.value || null });
            }
            dialog.close();
            toast("Tiket diperbarui.");
            ctx.rerender();
        } catch (error) {
            toast(friendlyError(error), "error");
        }
    });

    dialog.addEventListener("close", () => dialog.remove());
    dialog.appendChild(form);
    document.body.appendChild(dialog);
    dialog.showModal();
}

async function processReturn(ctx, ticket) {
    const [products, warehouses] = await Promise.all([ctx.data.listProducts(), ctx.data.listWarehouses()]);
    const values = await formDialog({
        title: `Proses retur ${ticket.ticket_no}`,
        submitLabel: "Retur diterima",
        fields: [
            { name: "product_id", label: "Produk yang dikembalikan", type: "select", value: String(products[0]?.id || ""), options: products.map((product) => ({ value: String(product.id), label: product.name })) },
            { name: "qty", label: "Jumlah kembali ke stok (0 bila barang rusak dibuang)", type: "number", min: 0, step: 1, value: 1 },
            { name: "warehouse_id", label: "Masuk ke gudang", type: "select", value: warehouses[0]?.id, options: warehouses.map((entry) => ({ value: entry.id, label: entry.name })) },
            { name: "refund_amount", label: "Uang dikembalikan ke pelanggan (Rp, 0 bila tukar barang)", type: "number", min: 0, step: 1000, value: 0 },
            { name: "refund_method", label: "Dikembalikan lewat", type: "select", value: "transfer", options: [{ value: "transfer", label: "Transfer" }, { value: "tunai", label: "Tunai" }] },
        ],
    });
    if (!values) return;

    try {
        await ctx.data.csReturn({
            ticket_id: ticket.id,
            product_id: values.product_id,
            qty: Math.max(0, Math.floor(Number(values.qty) || 0)),
            warehouse_id: values.warehouse_id,
            refund_amount: Math.max(0, Math.round(Number(values.refund_amount) || 0)),
            refund_method: values.refund_method,
        });
        toast(`Retur selesai${Number(values.refund_amount) > 0 ? `, pengembalian ${rupiah(values.refund_amount)} tercatat di jurnal` : ""}.`);
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}
