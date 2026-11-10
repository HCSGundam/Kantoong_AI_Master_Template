import { describe, expect, it } from "vitest";
import { TEMPLATES, buildDocument, canonical, docNumber, fingerprint, itemsTotal, nextSeq, parseItems, terbilang, validateValues, verifyUrl } from "../frontend/erp/core/documents.js";
import { chunkPages, diffLines, diffSummary, pageLabel, parseRanges, placeText } from "../frontend/erp/core/pdf-plan.js";
import { modelToRows, rupiahToNumber, sheetXml } from "../frontend/erp/docs/render-office.js";
import { pdfSafe } from "../frontend/erp/docs/render-pdf.js";
import { advanceTask, agentQuota, assignAgent, isStopCommand, parseCommand, plannedSteps, stopTask, validateAgent } from "../frontend/erp/core/agents.js";

describe("mesin dokumen", () => {
    it("terbilang rupiah", () => {
        expect(terbilang(0)).toBe("nol rupiah");
        expect(terbilang(11)).toBe("Sebelas rupiah");
        expect(terbilang(1250000)).toBe("Satu juta dua ratus lima puluh ribu rupiah");
        expect(terbilang(4_812_500)).toBe("Empat juta delapan ratus dua belas ribu lima ratus rupiah");
        expect(terbilang(1_000)).toBe("Seribu rupiah");
    });

    it("nomor surat gaya Indonesia", () => {
        expect(docNumber("invoice", 14, "2026-11-10")).toBe("INV/014/XI/2026");
        expect(nextSeq([{ kind: "invoice", number: "INV/014/XI/2026", issued_on: "2026-11-01" }, { kind: "invoice", number: "INV/003/I/2025", issued_on: "2025-01-02" }], "invoice", "2026-11-10")).toBe(15);
        expect(nextSeq([], "po", "2026-11-10")).toBe(1);
    });

    it("baris barang & total", () => {
        const items = parseItems("Kopi 1kg | 10 | 185.000\nGelas | 2,5 | 1000\n\n");
        expect(items).toEqual([{ name: "Kopi 1kg", qty: 10, price: 185000 }, { name: "Gelas", qty: 2.5, price: 1000 }]);
        expect(itemsTotal(items, { discount: 2500, taxPct: 11 })).toEqual({ subtotal: 1852500, discount: 2500, tax: 203500, total: 2053500 });
    });

    it("semua templat bisa dibangun dari isian minimal", () => {
        const sample = { employee: "Andi", position: "Sales", period: "2026-11", base: 4800000, customer: "PT A", supplier: "CV B", to: "PT C", subject: "Kopi kantor",
            items: "Kopi | 2 | 100000", due: "2026-11-30", since: "2024-01-02", violation: "Terlambat 5x", level: "SP 1", omzet: 1000000, expense: 400000 };
        TEMPLATES.forEach((t) => {
            const doc = buildDocument(t.id, sample, { brand: { name: "Miloat" }, signer: { name: "Owner", title: "Direktur" }, city: "Bandung", date: "2026-11-10" });
            expect(doc.title.length).toBeGreaterThan(3);
            expect(doc.blocks.length).toBeGreaterThan(0);
            expect(doc.sign.signers[0].name).toBe("Owner");
        });
        const slip = buildDocument("slip", sample, {});
        expect(slip.summary.amount).toBe(4800000);
    });

    it("validasi isian wajib", () => {
        const inv = TEMPLATES.find((t) => t.id === "invoice");
        expect(validateValues(inv, { customer: "A", items: "", due: "2026-11-30" })).toMatch(/wajib|minimal/);
        expect(validateValues(inv, { customer: "A", items: "X | 1 | 10", due: "2026-11-30", tax: "abc" })).toMatch(/angka/);
    });

    it("sidik keaslian stabil & berubah bila isi diubah", async () => {
        expect(canonical({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}');
        const doc = buildDocument("keterangan", { employee: "Rina", position: "SPV", since: "2023-01-01" }, { date: "2026-11-10", number: "SKK/001/XI/2026" });
        const a = await fingerprint(doc);
        const b = await fingerprint({ ...doc });
        const c = await fingerprint({ ...doc, blocks: [...doc.blocks, { type: "para", text: "dipalsukan" }] });
        expect(a).toHaveLength(64);
        expect(a).toBe(b);
        expect(a).not.toBe(c);
        expect(verifyUrl("https://x.dev/", "abc", a)).toBe(`https://x.dev/verify.html?d=abc&k=${a.slice(0, 12)}`);
    });
});

describe("wadah agen AI", () => {
    it("kuota dari add-on", () => {
        expect(agentQuota({}).total).toBe(1);
        expect(agentQuota({ addons: ["ai-agents"], addonQuota: 4, level: 5 })).toMatchObject({ total: 5, canMore: true });
        expect(validateAgent({ name: "B", skills: ["dokumen"] }, agentQuota({}), [{ id: "agent-1" }])).toMatch(/Kuota/);
        expect(validateAgent({ name: "B", skills: ["terbang"] }, agentQuota({}), [])).toMatch(/tidak dikenal/);
    });

    it("perintah sehari-hari jadi tugas", () => {
        expect(parseCommand("Tolong buatkan slip gaji untuk Andi Saputra")).toMatchObject({ skill: "dokumen", template: "slip", target: "Andi Saputra" });
        expect(parseCommand("bikin invoice ke Kafe Senja")).toMatchObject({ template: "invoice", target: "Kafe Senja" });
        expect(parseCommand("ajukan PO restok yang hampir habis")).toMatchObject({ skill: "restok" });
        expect(parseCommand("susun laporan bulanan")).toMatchObject({ skill: "laporan" });
        expect(parseCommand("siapa yang belum bayar?")).toMatchObject({ skill: "tagih" });
        expect(parseCommand("cuaca hari ini")).toBeNull();
        expect(isStopCommand("STOP sekarang")).toBe(true);
    });

    it("antrean & langkah", () => {
        const agents = [{ id: "a1", skills: ["dokumen"], active: true }, { id: "a2", skills: ["dokumen", "tagih"], active: true }];
        let task = { id: "t1", skill: "dokumen", status: "antre", steps: plannedSteps({ skill: "dokumen" }) };
        expect(assignAgent(task, agents, [{ agent_id: "a1", status: "berjalan" }]).id).toBe("a2");
        for (let i = 0; i < 4; i += 1) task = advanceTask(task);
        expect(task.status).toBe("berjalan");
        task = advanceTask(task);
        expect(task.status).toBe("selesai");
        const failed = advanceTask({ ...task, status: "berjalan", steps: plannedSteps({ skill: "tagih" }) }, { ok: false, note: "Tidak boleh" });
        expect(failed).toMatchObject({ status: "gagal", error: "Tidak boleh" });
        expect(stopTask({ status: "berjalan" }).status).toBe("dihentikan");
    });
});

describe("alat PDF & ekspor", () => {
    it("rentang halaman", () => {
        expect(parseRanges("1-3, 5, 8-", 10)).toEqual([[1, 2, 3], [5], [8, 9, 10]]);
        expect(parseRanges("4-2", 10)).toEqual([[2, 3, 4]]);
        expect(() => parseRanges("abc", 5)).toThrow(/tidak dikenal/);
        expect(() => parseRanges("20-30", 5)).toThrow(/Tidak ada/);
        expect(chunkPages(7, 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    });

    it("nomor halaman & posisi", () => {
        expect(pageLabel("Halaman {n} dari {total}", 2, 9)).toBe("Halaman 2 dari 9");
        expect(placeText({ position: "atas-kanan", pageW: 600, pageH: 800, textW: 50, size: 10 })).toEqual({ x: 522, y: 762 });
    });

    it("bandingkan teks", () => {
        const d = diffLines(["a", "b", "c"], ["a", "x", "c", "d"]);
        expect(diffSummary(d)).toEqual({ added: 2, removed: 1, same: 2 });
    });

    it("Excel: rupiah jadi angka, PDF: karakter aman", () => {
        expect(rupiahToNumber("Rp1.250.000")).toBe(1250000);
        expect(rupiahToNumber("−Rp5.000")).toBe(-5000);
        expect(rupiahToNumber("Kopi")).toBeNull();
        const xml = sheetXml([["Total", "Rp2.000"], ["Nama", "A & B <x>"]]);
        expect(xml).toContain('<v>2000</v>');
        expect(xml).toContain("A &amp; B &lt;x&gt;");
        expect(pdfSafe("Potongan −Rp5.000 ≤ 7 hari ✓ 👋")).toBe("Potongan -Rp5.000 <= 7 hari v ");
        expect(modelToRows({ title: "X", number: "N", date: "2026-11-10", blocks: [] }, "Brand")[0][0].v).toBe("Brand");
    });
});
