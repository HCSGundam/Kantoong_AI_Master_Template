/**
 * KANTOONG — TES ISOLASI BRAND & KEBOCORAN DATA (HANYA MEMBACA)
 * Jalankan: node tools/isolation-check.mjs
 *
 * Bertindak sebagai PENGUNJUNG ANONIM (kunci publik yang memang ada di web),
 * lalu mencoba membaca tabel rahasia. Lulus = ditolak / 0 baris.
 * Tidak ada INSERT/UPDATE/DELETE sama sekali.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const src = readFileSync(new URL("../frontend/js/supabase-client.js", import.meta.url), "utf8");
const cfg = readFileSync(new URL("../frontend/client-config.js", import.meta.url), "utf8");
const url = src.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)?.[1];
const key = src.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)?.[1];
const BID = cfg.match(/business_id:\s*"([^"]+)"/)?.[1];
if (!url || !key) throw new Error("Kunci publik Supabase tidak ditemukan.");

const db = createClient(url, key, { auth: { persistSession: false } });

// Tabel yang TIDAK BOLEH terbaca pengunjung anonim.
const SECRET = [
    "members", "member_salary", "member_targets", "approvals", "audit_log", "org_units",
    "journal_entries", "journal_lines", "pos_sales", "pos_shifts", "pos_pins", "pos_members", "pos_points",
    "stock_moves", "suppliers", "purchase_orders", "cs_tickets", "crm_profiles",
    "finance_invoices", "finance_budgets", "finance_recurring", "approval_rules", "approval_delegations",
    "hr_leaves", "hr_contracts", "hr_reviews", "crm_deals", "stock_batches",
    "erp_documents", "erp_doc_settings", "ai_agent_settings", "ai_agent_tasks",
    "ai_events", "assistant_memory", "brand_addons", "orders", "attendance", "payroll_runs",
];

const results = [];
const note = (status, name, detail) => results.push({ status, name, detail });

for (const table of SECRET) {
    const { data, error } = await db.from(table).select("*").limit(3);
    if (error) {
        const missing = ["42P01", "PGRST205"].includes(error.code);
        note(missing ? "lewati" : "aman", table, missing ? "tabel belum dibuat (SQL belum dijalankan)" : `ditolak (${error.code || error.message})`);
    } else if (!data?.length) {
        note("aman", table, "0 baris terlihat");
    } else {
        note("BOCOR", table, `${data.length}+ baris terbaca oleh pengunjung anonim!`);
    }
}

// Harga modal tidak boleh terbaca publik.
{
    const { error } = await db.from("products").select("id, cost_price").limit(1);
    note(error ? "aman" : "BOCOR", "products.cost_price", error ? "kolom harga modal ditolak" : "harga modal terbaca publik!");
}

// Katalog publik brand lain (memang publik, dilaporkan saja).
{
    const { data, error } = await db.from("products").select("business_id").neq("business_id", BID).limit(50);
    if (error) note("info", "products brand lain", `tidak bisa dicek (${error.code})`);
    else note("info", "products brand lain", `${new Set((data || []).map((r) => r.business_id)).size} brand lain di database yang sama (katalog publik — wajar).`);
}

// Fungsi verifikasi dokumen tidak membocorkan isi.
{
    const { data, error } = await db.rpc("erp_verify_document", { p_id: "00000000-0000-0000-0000-000000000000", p_code: "000000000000" });
    if (error) note(["PGRST202", "42883"].includes(error.code) ? "lewati" : "info", "erp_verify_document", error.message);
    else note(data?.found === false && !("model" in (data || {})) ? "aman" : "BOCOR", "erp_verify_document", JSON.stringify(data));
}

// Fungsi internal yang harus tertutup untuk anonim.
for (const fn of ["erp_journal_write", "erp_pro_build_chain", "erp_pro_resolve_step"]) {
    const { error } = await db.rpc(fn, {});
    if (error?.code === "PGRST202") note("lewati", `rpc ${fn}`, "fungsi belum dibuat / tidak terlihat publik");
    else note(error ? "aman" : "BOCOR", `rpc ${fn}`, error ? `ditolak (${error.code})` : "bisa dipanggil anonim!");
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`\nTES ISOLASI — brand ${BID} — ${new Date().toISOString()}\n`);
results.forEach((r) => console.log(`${pad(r.status.toUpperCase(), 7)} ${pad(r.name, 24)} ${r.detail}`));
const leaks = results.filter((r) => r.status === "BOCOR");
console.log(`\n${leaks.length ? `❌ ${leaks.length} KEBOCORAN` : "✅ Tidak ada kebocoran"} · ${results.filter((r) => r.status === "aman").length} aman · ${results.filter((r) => r.status === "lewati").length} dilewati\n`);
process.exitCode = leaks.length ? 1 : 0;
