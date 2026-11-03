/**
 * KANTOONG ERP — BAGIAN BERSAMA ANTAR-MODUL
 * File: frontend/erp/modules/shared.js
 */

import { el, initials, rupiah, segmented, emptyState } from "../ui.js";

/**
 * Papan peringkat sales real-time (per hari / per bulan).
 * Urutan & nama terlihat semua; angka omzet orang lain disamarkan
 * kecuali milik sendiri atau bawahan (diatur database).
 */
export function leaderboardPanel(ctx, { title = "Papan Peringkat Sales", period = "day" } = {}) {
    let current = period;
    const body = el("div", { class: "erp-board__body" });
    const stamp = el("small", { class: "erp-muted" });

    const load = async () => {
        const rows = await ctx.data.leaderboard(current);
        stamp.textContent = `Diperbarui ${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;

        if (!rows.length) {
            body.replaceChildren(emptyState("Belum ada sales aktif."));
            return;
        }

        body.replaceChildren(
            el("ol", { class: "erp-board__list" },
                rows.map((row) =>
                    el("li", { class: `erp-board__row${row.is_me ? " is-me" : ""}${row.rank <= 3 ? ` is-top is-top-${row.rank}` : ""}` },
                        el("span", { class: "erp-board__rank", text: `#${row.rank}` }),
                        el("span", { class: "erp-avatar erp-avatar--sm", text: initials(row.full_name) }),
                        el("span", { class: "erp-board__name" },
                            el("strong", { text: row.is_me ? `${row.full_name} (kamu)` : row.full_name }),
                            el("small", { text: row.unit_name || "" })
                        ),
                        el("span", {
                            class: "erp-board__value",
                            text: row.omzet === null || row.omzet === undefined ? "•••" : rupiah(row.omzet),
                            title: row.omzet === null || row.omzet === undefined ? "Angka rekan kerja dirahasiakan" : null,
                        })
                    )
                )
            )
        );
    };

    const tabs = segmented(
        [{ value: "day", label: "Hari ini" }, { value: "month", label: "Bulan ini" }],
        current,
        (value) => {
            current = value;
            tabs.querySelectorAll(".erp-seg__btn").forEach((button, index) =>
                button.setAttribute("aria-selected", String(["day", "month"][index] === value))
            );
            load();
        }
    );

    const panel = el("section", { class: "erp-card erp-board" },
        el("div", { class: "erp-card__head" },
            el("div", {},
                el("h2", { text: title }),
                el("p", { class: "erp-muted", text: "Otomatis dari pesanan yang sudah dibayar. Tidak ada input manual." })
            ),
            tabs
        ),
        body,
        el("div", { class: "erp-board__foot" }, el("span", { class: "erp-live", text: "Langsung" }), stamp)
    );

    load();

    return { element: panel, refresh: load };
}

/** Pasang pembaruan otomatis: real-time + cadangan tiap 30 detik. */
export function autoRefresh(ctx, refresh) {
    const unsubscribe = ctx.data.subscribeOrders?.(() => refresh());
    const timer = setInterval(refresh, 30000);
    ctx.onCleanup(() => {
        unsubscribe?.();
        clearInterval(timer);
    });
}

export const STATUS_LABELS = Object.freeze({
    menunggu_pembayaran: "Menunggu bayar",
    dibayar: "Dibayar",
    diproses: "Diproses",
    dikirim: "Dikirim",
    selesai: "Selesai",
    dibatalkan: "Dibatalkan",
});
