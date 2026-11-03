/**
 * KANTOONG ERP — HR & ABSENSI (Fase 2)
 * File: frontend/erp/modules/hr.js
 *
 * Semua orang: absen masuk/pulang (jam server, tidak bisa diakali)
 * dan rekap kehadirannya sendiri.
 * Atasan: kehadiran timnya. HR: semua orang + koreksi + aturan jam kerja.
 */

import { hasRole, subtreeIds } from "../core/org.js";
import { ATTENDANCE_LABELS, DEFAULT_HR_SETTINGS, currentPeriod, monthlyRecap, periodLabel, previousPeriod, wibDate, wibTime, workDuration } from "../core/hr.js";
import { monthRange } from "../core/accounting.js";
import { el, emptyState, formDialog, friendlyError, initials, pageHeader, segmented, statCard, toast } from "../ui.js";

let period = null;

const STATUS_PILL = { hadir: "erp-pill--good", telat: "erp-pill--warn", alpa: "erp-pill--bad", izin: "", sakit: "", cuti: "" };

export async function render(ctx) {
    const { data, me } = ctx;
    period = period || currentPeriod();
    const range = monthRange(period);
    const today = wibDate();

    const [members, records, settings] = await Promise.all([
        data.listMembers(),
        data.listAttendance({ from: range.from < monthRange(currentPeriod()).from ? range.from : monthRange(currentPeriod()).from, to: today }),
        data.getHrSettings(),
    ]);

    const rules = { ...DEFAULT_HR_SETTINGS, ...(settings || {}) };
    const isHr = hasRole(me, "hr");
    const team = isHr
        ? members.filter((member) => member.is_active !== false && member.id !== me.id)
        : members.filter((member) => subtreeIds(members, me.id).has(member.id) && member.is_active !== false);

    const page = el("div", { class: "erp-page__inner" });
    page.appendChild(pageHeader(
        "HR & Absensi",
        `Jam masuk ${rules.work_start} WIB · toleransi ${rules.grace_minutes} menit · ${rules.working_days} hari kerja/bulan`,
        isHr ? el("button", { class: "erp-btn", type: "button", onclick: () => editSettings(ctx, rules) }, "Aturan jam kerja") : null
    ));

    // ---------- Absensiku ----------
    const mineToday = records.find((record) => record.member_id === me.id && record.work_date === today);
    const myRecap = monthlyRecap(records, me.id, currentPeriod());

    const clockButton = (action, label, disabled) => el("button", {
        class: `erp-btn ${action === "in" ? "erp-btn--primary" : ""}`,
        type: "button",
        disabled,
        onclick: async (event) => {
            event.currentTarget.disabled = true;
            try {
                const result = await data.clock(action);
                toast(action === "in"
                    ? (result?.status === "telat" ? "Absen masuk tercatat (telat)." : "Absen masuk tercatat. Semangat! 💪")
                    : "Absen pulang tercatat. Terima kasih!");
                ctx.rerender();
            } catch (error) {
                toast(friendlyError(error), "error");
                ctx.rerender();
            }
        },
    }, label);

    page.appendChild(el("section", { class: "erp-card erp-clock" },
        el("div", { class: "erp-card__head" },
            el("div", {},
                el("h2", { text: "Absensiku hari ini" }),
                el("p", { class: "erp-muted", text: new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Jakarta" }) })
            ),
            mineToday ? el("span", { class: `erp-pill ${STATUS_PILL[mineToday.status] || ""}`, text: ATTENDANCE_LABELS[mineToday.status] }) : null
        ),
        el("div", { class: "erp-clock__times" },
            el("div", {}, el("small", { text: "Masuk" }), el("strong", { text: wibTime(mineToday?.check_in) })),
            el("div", {}, el("small", { text: "Pulang" }), el("strong", { text: wibTime(mineToday?.check_out) })),
            el("div", {}, el("small", { text: "Durasi" }), el("strong", { text: workDuration(mineToday?.check_in, mineToday?.check_out) || "-" }))
        ),
        el("div", { class: "erp-clock__actions" },
            clockButton("in", "Absen masuk", Boolean(mineToday?.check_in)),
            clockButton("out", "Absen pulang", !mineToday?.check_in || Boolean(mineToday?.check_out))
        ),
        el("p", { class: "erp-muted erp-note", text: "Jam dicatat oleh server, bukan jam HP, agar adil untuk semua." })
    ));

    page.appendChild(el("div", { class: "erp-stats" },
        statCard({ label: `Masuk kerja (${periodLabel(currentPeriod())})`, value: `${myRecap.masuk} hari`, sub: `${myRecap.telat} kali telat` }),
        statCard({ label: "Izin / sakit / cuti", value: `${myRecap.izin + myRecap.sakit + myRecap.cuti} hari` }),
        statCard({ label: "Alpa", value: `${myRecap.alpa} hari`, sub: myRecap.alpa ? "memotong gaji pokok" : "tidak ada", tone: myRecap.alpa ? "alert" : "" })
    ));

    if (!team.length) return page;

    // ---------- Kehadiran tim hari ini ----------
    const todayRows = team.map((member) => ({ member, record: records.find((record) => record.member_id === member.id && record.work_date === today) }));
    const present = todayRows.filter((row) => row.record && ["hadir", "telat"].includes(row.record.status)).length;

    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" },
            el("h2", { text: isHr ? "Kehadiran hari ini — semua karyawan" : "Kehadiran timku hari ini" }),
            el("span", { class: "erp-muted", text: `${present}/${team.length} sudah masuk` })
        ),
        el("ul", { class: "erp-members" }, todayRows.map(({ member, record }) => el("li", { class: "erp-member" },
            el("span", { class: "erp-avatar erp-avatar--sm", text: initials(member.full_name) }),
            el("div", { class: "erp-member__main" },
                el("strong", { text: member.full_name }),
                el("small", { class: "erp-muted", text: record?.check_in ? `Masuk ${wibTime(record.check_in)}${record.check_out ? ` · Pulang ${wibTime(record.check_out)}` : ""}` : member.position_title })
            ),
            el("span", { class: `erp-pill ${record ? STATUS_PILL[record.status] || "" : ""}`, text: record ? ATTENDANCE_LABELS[record.status] : "Belum absen" }),
            isHr ? el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => correct(ctx, member, today, record) }, "Koreksi") : null
        )))
    ));

    // ---------- Rekap bulanan ----------
    const periods = [currentPeriod(), previousPeriod(currentPeriod())];
    page.appendChild(el("section", { class: "erp-card" },
        el("div", { class: "erp-card__head" },
            el("h2", { text: `Rekap ${periodLabel(period)}` }),
            segmented(periods.map((value) => ({ value, label: periodLabel(value) })), period, (value) => {
                period = value;
                ctx.rerender();
            })
        ),
        el("div", { class: "erp-table-wrap" }, el("table", { class: "erp-table" },
            el("thead", {}, el("tr", {}, ["Nama", "Masuk", "Telat", "Izin", "Sakit", "Cuti", "Alpa"].map((head) => el("th", { text: head })))),
            el("tbody", {}, team.map((member) => {
                const recap = monthlyRecap(records, member.id, period);
                return el("tr", {},
                    el("td", {}, el("strong", { text: member.full_name })),
                    el("td", { "data-label": "Masuk", text: String(recap.masuk) }),
                    el("td", { "data-label": "Telat", text: String(recap.telat) }),
                    el("td", { "data-label": "Izin", text: String(recap.izin) }),
                    el("td", { "data-label": "Sakit", text: String(recap.sakit) }),
                    el("td", { "data-label": "Cuti", text: String(recap.cuti) }),
                    el("td", { "data-label": "Alpa" }, el("span", { class: recap.alpa ? "erp-pill erp-pill--bad" : "", text: String(recap.alpa) }))
                );
            }))
        ))
    ));

    return page;
}

async function correct(ctx, member, date, record) {
    const values = await formDialog({
        title: `Koreksi absensi — ${member.full_name}`,
        fields: [
            { name: "work_date", label: "Tanggal", type: "date", value: date },
            { name: "status", label: "Status", type: "select", value: record?.status || "izin", options: Object.entries(ATTENDANCE_LABELS).map(([value, label]) => ({ value, label })) },
            { name: "note", label: "Alasan koreksi", max: 200, value: record?.note || "", hint: "Tercatat di jejak audit." },
        ],
    });
    if (!values) return;

    try {
        await ctx.data.saveAttendance({
            member_id: member.id,
            work_date: values.work_date,
            status: values.status,
            note: values.note.trim() || null,
        });
        toast("Absensi dikoreksi.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}

async function editSettings(ctx, rules) {
    const values = await formDialog({
        title: "Aturan jam kerja",
        fields: [
            { name: "work_start", label: "Jam masuk (WIB)", type: "time", value: rules.work_start },
            { name: "grace_minutes", label: "Toleransi telat (menit)", type: "number", min: 0, max: 120, value: rules.grace_minutes },
            { name: "working_days", label: "Hari kerja per bulan (untuk potongan alpa)", type: "number", min: 1, max: 31, value: rules.working_days },
        ],
    });
    if (!values) return;

    try {
        await ctx.data.saveHrSettings({
            work_start: values.work_start || "09:00",
            grace_minutes: Math.min(120, Math.max(0, Number(values.grace_minutes) || 0)),
            working_days: Math.min(31, Math.max(1, Number(values.working_days) || 26)),
        });
        toast("Aturan jam kerja disimpan.");
        ctx.rerender();
    } catch (error) {
        toast(friendlyError(error), "error");
    }
}
