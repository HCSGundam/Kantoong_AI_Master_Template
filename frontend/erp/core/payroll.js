/**
 * KANTOONG ERP — HITUNGAN SLIP GAJI
 * File: frontend/erp/core/payroll.js
 *
 * Bersih = gaji pokok + komisi + tunjangan − potongan − potongan alpa.
 * Komisi = % komisi × omzet DIBAYAR bulan itu (otomatis dari pesanan).
 * Potongan alpa = gaji pokok ÷ hari kerja × jumlah hari alpa.
 */

import { commission } from "./metrics.js";

export function computePayslip({
    baseSalary = 0,
    commissionRate = 0,
    omzet = 0,
    alpaDays = 0,
    workingDays = 26,
    allowance = 0,
    deduction = 0,
}) {
    const base = Math.max(0, Math.round(Number(baseSalary) || 0));
    const comm = commission(omzet, commissionRate);
    const days = Math.max(1, Number(workingDays) || 26);
    const attendanceDeduction = Math.min(base, Math.round((base / days) * Math.max(0, Number(alpaDays) || 0)));
    const plus = Math.max(0, Math.round(Number(allowance) || 0));
    const minus = Math.max(0, Math.round(Number(deduction) || 0));

    return {
        base_salary: base,
        commission: comm,
        allowance: plus,
        deduction: minus,
        attendance_deduction: attendanceDeduction,
        net: base + comm + plus - minus - attendanceDeduction,
        details: {
            commission_rate: Number(commissionRate) || 0,
            omzet: Math.round(Number(omzet) || 0),
            alpa_days: Number(alpaDays) || 0,
            working_days: days,
        },
    };
}

/** Pembagian jurnal pembayaran gaji (sama dengan erp_payroll_pay). */
export function payrollJournal(payslips) {
    const paid = payslips.filter((slip) => slip.net > 0);
    const net = paid.reduce((sum, slip) => sum + slip.net, 0);
    const comm = paid.reduce((sum, slip) => sum + Math.min(slip.commission, Math.max(slip.net, 0)), 0);

    return [
        { account_code: "6-1000", debit: net - comm, credit: 0 },
        { account_code: "6-1100", debit: comm, credit: 0 },
        { account_code: "1-1100", debit: 0, credit: net },
    ].filter((line) => line.debit > 0 || line.credit > 0);
}
