import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { posProMethods } from "../frontend/erp/data/demo-adapter-pos.js";
import { demoPinHash } from "../frontend/erp/data/demo-seed-cash.js";

const root = new URL("../frontend/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function setup() {
    const db = {
        products: [{ id: "p1", name: "Kopi", price: 20000 }],
        warehouses: [{ id: "w", kind: "outlet", is_active: true }],
        members: [{ id: "m-spv", level: 3, job_role: "umum", is_active: true }],
        stock_levels: [{ warehouse_id: "w", product_id: "p1", qty: 50, min_qty: 0 }],
        pos_sales: [], pos_serial: 1, accounts: [], pos_settings: { w: { tax_enabled: false, service_enabled: false, rounding: 0 } },
        pos_modifiers: [], pos_bills: [], pos_tickets: [], pos_lost: [], pos_queue: {}, pos_shifts: [], pos_cash_moves: [],
        pos_pins: [{ member_id: "m-spv", pin_hash: demoPinHash("m-spv", "4826") }],
        pos_members: [], pos_points: [], pos_promos: [], pos_ingredients: [], pos_ingredient_stock: {}, pos_recipes: {},
        pos_option_recipes: {}, pos_ingredient_moves: [], pos_restock: [], pos_ratings: [],
        ai_events: [],
    };
    const kasir = posProMethods({ db: () => db, save: () => {}, me: () => ({ id: "k", level: 1, job_role: "kasir" }), audit: () => {}, journalWrite: () => {}, recordMoves: () => {} });
    const barista = posProMethods({ db: () => db, save: () => {}, me: () => ({ id: "b", level: 1, job_role: "dapur" }), audit: () => {}, journalWrite: () => {}, recordMoves: () => {} });
    return { db, kasir, barista };
}

describe("kunci PIN atasan (anti tebak PIN)", () => {
    it("5x salah = dikunci; PIN benar pun ditolak selama terkunci", async () => {
        const { kasir } = setup();
        await kasir.openShift({ outlet_id: "w", opening_cash: 0 });
        const sale = await kasir.posCheckoutPro({ outlet_id: "w", channel: "take_away", lines: [{ product_id: "p1", qty: 1 }], payments: [{ method: "qris", amount: 20000 }] });
        for (let left = 4; left >= 0; left -= 1) {
            await expect(kasir.voidSale({ sale_id: sale.id, reason: "salah_input", pin: "0000" })).rejects.toThrow(`Sisa percobaan: ${left}`);
        }
        await expect(kasir.voidSale({ sale_id: sale.id, reason: "salah_input", pin: "4826" })).rejects.toThrow(/dikunci 15 menit/);
        await expect(kasir.posCheckoutPro({
            outlet_id: "w", channel: "take_away", discount: 15000, approval_pin: "4826",
            lines: [{ product_id: "p1", qty: 1 }], payments: [{ method: "qris", amount: 5000 }],
        })).rejects.toThrow(/dikunci 15 menit/);
    });
});

describe("Dapur Prediktif tidak bisa diracuni bot", () => {
    it("minat dihitung per sesi unik, bukan jumlah event", async () => {
        const { db, barista } = setup();
        const at = new Date().toISOString();
        for (let index = 0; index < 50; index += 1) db.ai_events.push({ at, session_key: "s-bot", product_name: "Kopi", kind: "view" });
        db.ai_events.push({ at, session_key: "s-asli", product_name: "Kopi", kind: "view" });
        expect(await barista.kitchenInterest()).toEqual([{ product_name: "Kopi", count: 2 }]);
    });
});

describe("pemeriksa kode: aturan keamanan tidak boleh mundur", () => {
    const files = [];
    const walk = (dir) => {
        for (const name of readdirSync(dir)) {
            if (["node_modules", "dist"].includes(name)) continue;
            const path = join(dir, name);
            if (statSync(path).isDirectory()) walk(path);
            else if (/\.(js|html)$/.test(name)) files.push(path);
        }
    };
    walk(root);

    it("tidak ada 'select *' pada tabel products (harga modal tidak boleh bocor)", () => {
        expect(files.length).toBeGreaterThan(50); // pemeriksa benar-benar membaca kode
        const offenders = files.filter((path) => /from\(["']products["']\)\s*\.select\(\s*(["']\*["'])?\s*\)/.test(readFileSync(path, "utf8")));
        expect(offenders).toEqual([]);
    });

    it("tidak ada kunci rahasia di frontend", () => {
        const secret = /(sb_secret_[A-Za-z0-9_-]{10,}|service_role|AIza[0-9A-Za-z_-]{30,}|GEMINI_API_KEY\s*=\s*["'][^"']+)/;
        const offenders = files.filter((path) => secret.test(readFileSync(path, "utf8")));
        expect(offenders).toEqual([]);
    });

    it("library Supabase dimuat dengan versi terkunci", () => {
        expect(readFileSync(join(root, "js/supabase-client.js"), "utf8")).toMatch(/supabase-js@\d+\.\d+\.\d+\/\+esm/);
    });

    it("SQL pengamanan menutup fungsi internal & harga modal", () => {
        const sql = readFileSync(join(root, "db/security-hardening.sql"), "utf8");
        expect(sql).toContain("'erp_journal_write'");
        expect(sql).toContain("column_name <> 'cost_price'");
        expect(sql).toMatch(/revoke all on function %s from public, anon, authenticated/);
        const pos = readFileSync(join(root, "db/erp-pos-pro.sql"), "utf8");
        expect(pos).toMatch(/revoke all on function public\.erp_pos_approver\(text, uuid\) from anon, authenticated/);
        expect(pos).toContain("insert into public.pos_pin_failures");
    });
});
