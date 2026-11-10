/**
 * KANTOONG ERP — WADAH AGEN AI (murni, dites)
 * File: frontend/erp/core/agents.js
 *
 * Infrastruktur dulu, otak menyusul (Babak 2):
 * - Setiap anggota punya 1 asisten AI. Add-on "ai-agents" membuka agen tambahan
 *   (kuota dari pusat), masing-masing punya nama, peran & keahlian.
 * - Mode per orang: "tampil" (AI bekerja di depan layar, langkahnya terlihat)
 *   atau "belakang" (AI bekerja diam-diam, hasilnya masuk Kotak Masuk/notifikasi).
 * - Tugas = antrean dengan langkah-langkah yang tercatat (siapa, kapan, hasil).
 * - Keahlian (skill) saat ini DETERMINISTIK (tanpa biaya LLM): membuat dokumen,
 *   menyiapkan penagihan, mengajukan PO restok, menyusun laporan bulanan.
 * - Agen TIDAK PERNAH membayar, menghapus data, atau mengirim pesan ke luar:
 *   hanya menyiapkan; manusia yang menekan kirim/setuju.
 */

export const AGENT_ADDON = "ai-agents"; // nama add-on di brand_addons (huruf kecil + tanda hubung)

export const SKILLS = Object.freeze({
    "dokumen": { label: "Membuat dokumen", desc: "Slip gaji, invoice, PO, surat, laporan dari templat.", module: "documents" },
    "tagih": { label: "Menyiapkan penagihan", desc: "Daftar piutang telat + pesan pengingat siap kirim.", module: "finance" },
    "restok": { label: "Mengajukan PO restok", desc: "Dari saran belanja gudang → pengajuan berjenjang.", module: "inventory" },
    "laporan": { label: "Menyusun laporan bulanan", desc: "Rekap omzet, transaksi & beban jadi dokumen.", module: "documents" },
});

export const AGENT_MODES = Object.freeze({
    tampil: { label: "Tampil di layar", desc: "Kamu menonton AI bekerja langkah demi langkah (bisa dihentikan kapan saja)." },
    belakang: { label: "Bekerja di belakang", desc: "AI bekerja diam-diam, kamu mengerjakan hal lain. Hasil masuk ke notifikasi." },
});

export const TASK_STATUS = Object.freeze({
    antre: "Antre",
    berjalan: "Berjalan",
    selesai: "Selesai",
    gagal: "Gagal",
    dihentikan: "Dihentikan",
});

/** Berapa agen yang boleh dimiliki: 1 asisten pribadi + kuota add-on. */
export function agentQuota({ addons = [], addonQuota = 0, level = 1 } = {}) {
    const extra = addons.includes(AGENT_ADDON) ? Math.max(0, Math.min(20, Number(addonQuota) || 3)) : 0;
    return { base: 1, extra, total: 1 + extra, canMore: level >= 3 && extra > 0 };
}

export function defaultAgents(member) {
    const first = String(member?.full_name || "").split(" ")[0] || "Kamu";
    return [{ id: "agent-1", name: `Asisten ${first}`, role: "Asisten pribadi", skills: Object.keys(SKILLS), active: true }];
}

export function validateAgent(agent, quota, existing = []) {
    if (!String(agent.name || "").trim()) return "Beri nama agennya.";
    if (!Array.isArray(agent.skills) || !agent.skills.length) return "Pilih minimal satu keahlian.";
    if (!agent.skills.every((s) => SKILLS[s])) return "Ada keahlian yang tidak dikenal.";
    const others = existing.filter((a) => a.id !== agent.id);
    if (!agent.id && others.length >= quota.total) return `Kuota agen penuh (${quota.total}). Aktifkan add-on Agen AI untuk menambah.`;
    return null;
}

/* ---------- Perintah bahasa sehari-hari → tugas ---------- */

const RULES = [
    { skill: "dokumen", template: "slip", re: /slip\s*gaji(?:\s+(?:untuk|buat|atas nama))?\s*(.*)$/i },
    { skill: "dokumen", template: "invoice", re: /(?:invoice|faktur|tagihan)\s*(?:ke|untuk|buat)?\s*(.*)$/i },
    { skill: "dokumen", template: "keterangan", re: /(?:surat\s+)?keterangan\s+kerja(?:\s+(?:untuk|buat))?\s*(.*)$/i },
    { skill: "dokumen", template: "peringatan", re: /(?:surat\s+peringatan|\bsp\s*[123]?)(?:\s+(?:untuk|buat|ke))?\s*(.*)$/i },
    { skill: "dokumen", template: "penawaran", re: /(?:surat\s+)?penawaran(?:\s+harga)?(?:\s+(?:ke|untuk|buat))?\s*(.*)$/i },
    { skill: "dokumen", template: "po", re: /\b(?:purchase order|po)\b(?:\s+(?:ke|untuk|buat))?\s*(.*)$/i, unless: /restok|stok habis|saran belanja/i },
    { skill: "laporan", re: /laporan\s+bulan(?:an|\s+ini)?/i },
    { skill: "restok", re: /(restok|stok\s+habis|saran\s+belanja|pesan\s+barang)/i },
    { skill: "tagih", re: /(tagih|piutang|belum\s+bayar)/i },
];

/** "buatkan slip gaji untuk Andi" → { skill: "dokumen", template: "slip", target: "Andi" } */
export function parseCommand(text) {
    const clean = String(text || "").replace(/\s+/g, " ").trim().replace(/^(tolong|please|ai|asisten)[, ]+/i, "")
        .replace(/^(buatkan|buatin|bikinin|bikin|buat|siapkan|susun|ajukan|kirim)\s+/i, "");
    for (const rule of RULES) {
        if (rule.unless && rule.unless.test(clean)) continue;
        const match = clean.match(rule.re);
        if (match) {
            const target = String(match[1] || "").replace(/[.?!]+$/, "").trim().slice(0, 80);
            return { skill: rule.skill, template: rule.template ?? null, target: target || null, text: clean };
        }
    }
    return null;
}

/** Langkah standar tiap keahlian (ditampilkan di mode "tampil"). */
export function plannedSteps(task) {
    const base = {
        dokumen: ["Membuka menu Dokumen", "Memilih templat", "Mengisi data dari ERP", "Membuat nomor & QR keaslian", "Menyimpan ke Kotak Masuk"],
        laporan: ["Membaca penjualan & jurnal bulan ini", "Menghitung omzet, transaksi & beban", "Menyusun laporan", "Menyimpan ke Kotak Masuk"],
        restok: ["Membaca stok & pemakaian 14 hari", "Menghitung saran belanja", "Membuat pengajuan PO berjenjang"],
        tagih: ["Membaca piutang", "Memilih yang telat", "Menyiapkan pesan pengingat (tidak dikirim otomatis)"],
    }[task.skill] || ["Menjalankan tugas"];
    return base.map((label) => ({ label, status: "menunggu", at: null }));
}

/** Pilih agen yang menganggur & punya keahliannya. */
export function assignAgent(task, agents, tasks) {
    const busy = new Set((tasks || []).filter((t) => t.status === "berjalan").map((t) => t.agent_id));
    return (agents || []).find((a) => a.active !== false && a.skills.includes(task.skill) && !busy.has(a.id)) || null;
}

/** Majukan satu langkah. Mengembalikan tugas baru. */
export function advanceTask(task, { ok = true, note = "", now = new Date() } = {}) {
    if (!["antre", "berjalan"].includes(task.status)) return task;
    const steps = task.steps.map((s) => ({ ...s }));
    const index = steps.findIndex((s) => s.status !== "selesai");
    const at = new Date(now).toISOString();
    if (index < 0) return { ...task, status: "selesai", finished_at: at };
    steps[index] = { ...steps[index], status: ok ? "selesai" : "gagal", at, note: note || null };
    const failed = !ok;
    const done = !failed && steps.every((s) => s.status === "selesai");
    return {
        ...task,
        steps,
        status: failed ? "gagal" : done ? "selesai" : "berjalan",
        started_at: task.started_at || at,
        finished_at: failed || done ? at : null,
        error: failed ? note : null,
    };
}

export function stopTask(task, now = new Date()) {
    if (!["antre", "berjalan"].includes(task.status)) return task;
    return { ...task, status: "dihentikan", finished_at: new Date(now).toISOString() };
}

/** Kata "stop" / "berhenti" / "batal" di chat atau tombol menghentikan semua tugas yang berjalan. */
export function isStopCommand(text) {
    return /^\s*(stop|berhenti|hentikan|batal|cancel)\b/i.test(String(text || ""));
}
