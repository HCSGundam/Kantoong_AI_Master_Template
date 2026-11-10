/**
 * KANTOONG ERP — SUMBER DATA DEMO: DOKUMEN & AGEN AI
 * File: frontend/erp/data/demo-adapter-docs.js
 *
 * Aturan akses sama dengan db/erp-docs.sql:
 * - Kop & tanda tangan: semua anggota baca; owner/direktur ubah.
 * - Dokumen: pembuat, penerima, penyetuju di rantainya, keuangan (invoice/PO),
 *   HR (slip/SK/SP), owner/direktur. Tidak ada hapus: dokumen dicabut (jejak tetap).
 * - Pengaturan & tugas agen: milik masing-masing anggota.
 */

import { hasRole } from "../core/org.js";
import { DEFAULT_RULES, buildChain } from "../core/approval-chain.js";
import { DOC_KINDS } from "../core/documents.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const newId = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const FINANCE_KINDS = new Set(["invoice", "po", "laporan", "penawaran"]);
const HR_KINDS = new Set(["slip", "keterangan", "peringatan"]);

function denied(message = "Akses ditolak: jabatanmu tidak boleh melakukan ini.") {
    const error = new Error(message);
    error.code = "42501";
    return error;
}

export function ensureDocsSeed(db) {
    if (!db) return;
    if (db.pro?.rules && !db.pro.rules.some((r) => r.kind === "dokumen")) {
        db.pro.rules.push({ ...DEFAULT_RULES.find((r) => r.kind === "dokumen"), steps: ["atasan", "owner"] });
    }
    if (db.docs) return;
    db.docs = {
        settings: { signer_name: "Owner Demo", signer_title: "Direktur Utama", city: "Bandung", signature: "", address: "", phone: "", email: "" },
        documents: [],
        agents: {},
        tasks: [],
    };
}

export function docsMethods({ db: getDb, save, me, audit }) {
    const docs = () => getDb().docs;
    const canSee = (doc, viewer) => {
        if (viewer.level >= 4) return true;
        if (doc.created_by === viewer.id || doc.recipient_id === viewer.id) return true;
        if (FINANCE_KINDS.has(doc.kind) && hasRole(viewer, "keuangan")) return true;
        if (HR_KINDS.has(doc.kind) && hasRole(viewer, "hr")) return true;
        const approval = getDb().approvals.find((a) => a.id === doc.approval_id);
        return Boolean(approval?.chain?.some((s) => s.approver_id === viewer.id));
    };

    return {
        async getDocSettings() {
            return clone(docs().settings);
        },

        async saveDocSettings(values) {
            if (me().level < 4) throw denied("Hanya owner/direktur yang boleh mengubah kop & tanda tangan.");
            const sig = String(values.signature ?? docs().settings.signature ?? "");
            if (sig && (!sig.startsWith("data:image/png;base64,") || sig.length > 300000)) throw new Error("Tanda tangan harus gambar PNG ≤ 200 KB.");
            Object.assign(docs().settings, {
                signer_name: String(values.signer_name || "").slice(0, 80),
                signer_title: String(values.signer_title || "").slice(0, 80),
                city: String(values.city || "").slice(0, 40),
                address: String(values.address || "").slice(0, 200),
                phone: String(values.phone || "").slice(0, 40),
                email: String(values.email || "").slice(0, 80),
                signature: sig,
            });
            audit("erp_doc_settings", "1", "UPDATE", { penanda_tangan: values.signer_name });
            save();
        },

        async listDocuments() {
            const viewer = me();
            return clone(docs().documents.filter((d) => canSee(d, viewer)).sort((a, b) => b.created_at.localeCompare(a.created_at)));
        },

        /**
         * input: { model, hash, recipient_id?, sign: boolean }
         * sign=true → dokumen "menunggu tanda tangan" lewat rantai persetujuan (jenis "dokumen").
         * sign=false → langsung terbit (tanpa tanda tangan basah; QR tetap).
         */
        async createDocument({ model, hash, recipient_id = null, sign = false }) {
            const viewer = me();
            if (!DOC_KINDS[model.kind]) throw new Error("Jenis dokumen tidak dikenal.");
            if (HR_KINDS.has(model.kind) && !hasRole(viewer, "hr") && viewer.level < 3) throw denied("Dokumen SDM dibuat oleh HR atau atasan.");
            if (FINANCE_KINDS.has(model.kind) && model.kind !== "penawaran" && !hasRole(viewer, "keuangan", "gudang") && viewer.level < 3) throw denied("Dokumen keuangan dibuat oleh bagian keuangan atau atasan.");
            const db = getDb();
            const now = new Date().toISOString();
            const doc = {
                id: newId("doc"),
                kind: model.kind,
                number: model.number,
                title: model.title,
                party: model.summary?.party || model.to?.name || "",
                amount: model.summary?.amount ?? null,
                issued_on: model.date,
                hash,
                model,
                status: sign ? "menunggu" : "terbit",
                created_by: viewer.id,
                recipient_id,
                approval_id: null,
                created_at: now,
                // Diterbitkan langsung oleh pimpinan (level 4+) = sudah ditandatangani.
                signed_at: !sign && viewer.level >= 4 ? now : null,
            };
            if (sign) {
                const built = buildChain({ kind: "dokumen", amount: 0, requester_id: viewer.id }, { rules: db.pro?.rules, members: db.members, delegations: db.pro?.delegations });
                const approval = {
                    id: newId("a"), kind: "dokumen", title: `Tanda tangani ${model.title.toLowerCase()} ${model.number}`, amount: model.summary?.amount ?? null,
                    note: doc.party ? `Untuk ${doc.party}` : null, requester_id: viewer.id, decision_note: null, created_at: now,
                    ...built, status: built.chain.length ? "menunggu" : "disetujui", decided_at: built.chain.length ? null : now,
                    approver_id: built.chain[0]?.approver_id ?? null, document_id: doc.id,
                };
                if (!built.chain.length) {
                    doc.status = "terbit";
                    doc.signed_at = now;
                }
                doc.approval_id = approval.id;
                db.approvals.push(approval);
            }
            docs().documents.push(doc);
            audit("erp_documents", doc.id, "INSERT", { nomor: doc.number });
            save();
            return clone(doc);
        },

        async revokeDocument(id, reason = "") {
            const viewer = me();
            const doc = docs().documents.find((d) => d.id === id);
            if (!doc) throw new Error("Dokumen tidak ditemukan.");
            if (doc.created_by !== viewer.id && viewer.level < 4) throw denied();
            doc.status = "dicabut";
            doc.revoked_reason = String(reason).slice(0, 200);
            audit("erp_documents", id, "UPDATE", { status: "dicabut" });
            save();
        },

        /** Halaman verifikasi publik (demo: hanya di perangkat yang sama). */
        async verifyDocument(id, code) {
            const doc = docs().documents.find((d) => d.id === id);
            if (!doc) return { found: false };
            const issuer = getDb().members.find((m) => m.id === doc.created_by);
            return {
                found: true,
                match: String(doc.hash || "").startsWith(String(code || "").toLowerCase()),
                status: doc.status,
                kind: doc.kind,
                title: doc.title,
                number: doc.number,
                issued_on: doc.issued_on,
                issuer: issuer?.full_name || "",
            };
        },

        /* ---------- Agen AI ---------- */

        async getAgentSettings() {
            const viewer = me();
            return clone(docs().agents[viewer.id] || null);
        },

        async saveAgentSettings({ mode, agents }) {
            const viewer = me();
            if (!["tampil", "belakang"].includes(mode)) throw new Error("Mode tidak dikenal.");
            docs().agents[viewer.id] = { mode, agents: (agents || []).slice(0, 21) };
            save();
        },

        async listAgentTasks() {
            const viewer = me();
            return clone(docs().tasks.filter((t) => t.member_id === viewer.id || viewer.level >= 5).slice(-200).reverse());
        },

        async saveAgentTask(task) {
            const viewer = me();
            const list = docs().tasks;
            const index = list.findIndex((t) => t.id === task.id);
            if (index >= 0 && list[index].member_id !== viewer.id) throw denied();
            const row = { ...task, member_id: viewer.id };
            if (index >= 0) list[index] = row;
            else list.push(row);
            docs().tasks = list.slice(-300);
            save();
            return clone(row);
        },
    };
}
