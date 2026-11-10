/**
 * KANTOONG ERP — ALAT PDF (tab "Alat PDF" di menu Dokumen)
 * File: frontend/erp/modules/doc-tools.js
 *
 * Semua diproses DI PERANGKAT (pdf-lib + pdf.js): file tidak pernah diunggah
 * ke server → aman untuk berkas pribadi/kantor & tanpa biaya server.
 * Alat yang butuh server/AI (Word→PDF, OCR, ringkas, terjemah, kunci password)
 * tampil sebagai "Segera" agar peta fiturnya utuh.
 */

import { chunkPages, diffLines, diffSummary, parseRanges } from "../core/pdf-plan.js";
import { el, friendlyError, toast } from "../ui.js";
import { saveFile } from "../docs/assets.js";
import { signaturePad } from "./documents.js";

let current = null; // alat yang sedang dibuka
let engineP = null;
const engine = () => (engineP ||= import("../docs/pdf-engine.js"));

const TOOLS = [
    { id: "merge", label: "Gabung PDF", desc: "Satukan beberapa PDF sesuai urutan yang kamu mau.", color: "#e5603b", icon: "M4 4h7v7H4zM13 13h7v7h-7zM11 7h4a2 2 0 0 1 2 2v4" },
    { id: "split", label: "Pisah PDF", desc: "Ambil halaman tertentu atau pecah tiap N halaman.", color: "#e5603b", icon: "M4 4h7v7H4zM13 13h7v7h-7zM8 13v3a2 2 0 0 0 2 2h3" },
    { id: "organize", label: "Atur halaman", desc: "Urutkan, putar, atau hapus halaman lewat pratinjau.", color: "#e5603b", icon: "M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z" },
    { id: "compress", label: "Kompres PDF", desc: "Perkecil ukuran file untuk dikirim lewat WhatsApp/email.", color: "#6aa84f", icon: "M8 3v5H3M16 3v5h5M8 21v-5H3M16 21v-5h5" },
    { id: "sign", label: "Tanda tangan PDF", desc: "Gambar tanda tanganmu, letakkan di halaman mana saja.", color: "#3d6fb6", icon: "M3 21h18M5 17l9-9 3 3-9 9H5zM14 8l2-2 3 3-2 2" },
    { id: "watermark", label: "Watermark", desc: "Cap teks transparan (RAHASIA, DRAF, nama brand).", color: "#a0508a", icon: "M12 3v12M8 11l4 4 4-4M5 21h14" },
    { id: "pagenum", label: "Nomor halaman", desc: "Tambah nomor halaman: posisi & format bebas.", color: "#a0508a", icon: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
    { id: "rotate", label: "Putar PDF", desc: "Putar semua halaman 90°, 180°, atau 270°.", color: "#a0508a", icon: "M20 12a8 8 0 1 1-3-6.2M20 4v5h-5" },
    { id: "pdf2jpg", label: "PDF ke JPG", desc: "Ubah tiap halaman jadi gambar (zip).", color: "#d4a72c", icon: "M4 4h16v16H4zM4 16l5-5 4 4 3-3 4 4" },
    { id: "jpg2pdf", label: "JPG ke PDF", desc: "Satukan foto/gambar jadi satu PDF rapi.", color: "#d4a72c", icon: "M4 4h16v16H4zM8 12h8M12 8v8" },
    { id: "scan", label: "Pindai ke PDF", desc: "Foto berkas pakai kamera HP → langsung PDF.", color: "#e5603b", icon: "M4 8V5h3M20 8V5h-3M4 16v3h3M20 16v3h-3M7 12h10" },
    { id: "crop", label: "Potong PDF", desc: "Buang margin halaman (dalam milimeter).", color: "#a0508a", icon: "M6 2v16h16M2 6h16v16" },
    { id: "redact", label: "Sensor PDF", desc: "Hitamkan data sensitif secara permanen (NIK, rekening).", color: "#3d6fb6", icon: "M4 6h16M4 12h10M4 18h16M16 10h4v4h-4z" },
    { id: "compare", label: "Bandingkan PDF", desc: "Lihat kalimat yang berubah di antara dua versi.", color: "#3d6fb6", icon: "M4 4h7v16H4zM13 4h7v16h-7zM7 9h1M16 13h1" },
    { id: "protect", label: "Kunci PDF", desc: "Pasang password pada PDF.", color: "#3d6fb6", soon: true, icon: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4" },
    { id: "unlock", label: "Buka kunci PDF", desc: "Lepas password PDF milikmu.", color: "#3d6fb6", soon: true, icon: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 7.5-2" },
    { id: "word2pdf", label: "Word / Excel / PPT ke PDF", desc: "Ubah dokumen Office jadi PDF.", color: "#2b5797", soon: true, icon: "M5 4h10l4 4v12H5zM8 12l1.5 5L11 13l1.5 4L14 12" },
    { id: "pdf2word", label: "PDF ke Word / Excel", desc: "Ubah PDF jadi dokumen yang bisa diedit.", color: "#2b5797", soon: true, icon: "M5 4h10l4 4v12H5zM9 12h6M9 16h6" },
    { id: "ocr", label: "OCR (teks dari scan)", desc: "Jadikan hasil scan bisa dicari & disalin.", color: "#6aa84f", soon: true, icon: "M4 8V5h3M20 8V5h-3M4 16v3h3M20 16v3h-3M8 10h8M8 14h5" },
    { id: "ai", label: "Ringkas & terjemah (AI)", desc: "Ringkasan poin penting & terjemahan dokumen.", color: "#6b4fd8", soon: true, icon: "M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" },
    { id: "forms", label: "Formulir PDF", desc: "Buat isian formulir yang bisa diisi.", color: "#a0508a", soon: true, icon: "M5 4h14v16H5zM8 8h8M8 12h8M8 16h4" },
];

export function renderTools(ctx) {
    const root = el("div", { class: "erp-stack erp-tools" });
    const draw = () => {
        const tool = TOOLS.find((t) => t.id === current);
        root.replaceChildren(tool ? toolView(tool, () => {
            current = null;
            draw();
        }) : grid((id) => {
            current = id;
            draw();
            root.scrollIntoView({ behavior: "smooth", block: "start" });
        }));
    };
    draw();
    return root;
}

const svg = (d) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    node.setAttribute("viewBox", "0 0 24 24");
    node.setAttribute("class", "erp-icon");
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d);
    node.append(p);
    return node;
};

function grid(open) {
    return el("div", { class: "erp-stack" },
        el("p", { class: "erp-tools__privacy", text: "🔒 Semua alat bekerja di perangkatmu. File tidak diunggah ke server mana pun." }),
        el("div", { class: "erp-toolgrid" }, TOOLS.map((t) => el("button", {
            class: `erp-toolcard${t.soon ? " is-soon" : ""}`,
            type: "button",
            style: `--tool:${t.color}`,
            onclick: () => (t.soon ? toast(`${t.label} segera hadir (butuh server/AI, menyusul di Babak 2).`) : open(t.id)),
        },
            el("span", { class: "erp-toolcard__icon" }, svg(t.icon)),
            el("strong", { text: t.label }),
            el("small", { text: t.desc }),
            t.soon ? el("span", { class: "erp-toolcard__soon", text: "Segera" }) : null))));
}

/* ---------- Kerangka satu alat ---------- */

function toolView(tool, back) {
    const body = el("div", { class: "erp-tool__body" });
    const view = el("section", { class: "erp-card erp-tool", style: `--tool:${tool.color}` },
        el("div", { class: "erp-tool__head" },
            el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: back }, "← Semua alat"),
            el("span", { class: "erp-tool__icon" }, svg(tool.icon)),
            el("div", {}, el("h2", { text: tool.label }), el("p", { class: "erp-muted", text: tool.desc }))),
        body);
    (BUILDERS[tool.id] || (() => body.append(el("p", { text: "Segera hadir." }))))(body);
    return view;
}

const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const baseName = (file) => String(file?.name || "dokumen").replace(/\.[^.]+$/, "");

function dropZone({ accept = "application/pdf", multiple = false, label = "Pilih PDF", onFiles }) {
    const input = el("input", { type: "file", accept, multiple, hidden: true });
    input.addEventListener("change", () => {
        if (input.files?.length) onFiles([...input.files]);
        input.value = "";
    });
    const zone = el("div", { class: "erp-drop", tabindex: "0", role: "button", "aria-label": label },
        el("strong", { text: label }),
        el("small", { text: `atau tarik & lepas file ke sini${multiple ? " (bisa banyak)" : ""}` }),
        input);
    zone.addEventListener("click", () => input.click());
    zone.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") input.click();
    });
    zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        zone.classList.add("is-over");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("is-over"));
    zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("is-over");
        const files = [...(e.dataTransfer?.files || [])].filter((f) => accept.split(",").some((a) => (a.endsWith("/*") ? f.type.startsWith(a.slice(0, -1)) : f.type === a.trim())));
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
        else toast("Jenis file tidak sesuai.", "error");
    });
    return zone;
}

function field(label, input, hint) {
    return el("label", { class: "erp-field" }, el("span", { text: label }), input, hint ? el("small", { text: hint }) : null);
}
const select = (options, value) => {
    const s = el("select", {}, options.map(([v, l]) => el("option", { value: v, selected: v === value }, l)));
    return s;
};

/** Tombol proses + status + hasil unduhan. */
function runner(body, { label, run }) {
    const status = el("p", { class: "erp-tool__status", role: "status" });
    const result = el("div", { class: "erp-tool__result" });
    const button = el("button", { class: "erp-btn erp-btn--primary erp-tool__go", type: "button", onclick: async () => {
        button.disabled = true;
        result.replaceChildren();
        status.textContent = "Memproses di perangkatmu…";
        try {
            const files = await run((text) => {
                status.textContent = text;
            });
            status.textContent = "";
            if (!files) return;
            const list = Array.isArray(files) ? files : [files];
            if (list.length > 3) {
                const { zipFiles } = await engine();
                const zip = zipFiles(list);
                result.append(downloadButton({ name: `${list[0].zipName || "hasil"}.zip`, bytes: zip, mime: "application/zip" }, `Unduh semua (${list.length} file, zip)`));
            } else {
                list.forEach((f) => result.append(downloadButton(f)));
            }
        } catch (error) {
            status.textContent = "";
            toast(friendlyError(error), "error");
        } finally {
            button.disabled = false;
        }
    } }, label);
    body.append(el("div", { class: "erp-tool__run" }, button, status), result);
    return button;
}

function downloadButton(file, label) {
    const mime = file.mime || (file.name.endsWith(".pdf") ? "application/pdf" : file.name.endsWith(".jpg") ? "image/jpeg" : "application/octet-stream");
    return el("button", { class: "erp-btn erp-tool__dl", type: "button", onclick: () => saveFile(file.bytes, file.name, mime) },
        `⬇ ${label || file.name}`, el("small", { text: kb(file.bytes.length || file.bytes.size || 0) }));
}

/** Satu PDF masuk → simpan bytes & tampilkan nama/ukuran. */
function singlePdf(body, onLoad) {
    const info = el("p", { class: "erp-tool__file" });
    const state = { bytes: null, file: null, pages: 0 };
    body.append(dropZone({ onFiles: async ([file]) => {
        try {
            const { readFile, pageCount } = await engine();
            state.bytes = await readFile(file);
            state.file = file;
            state.pages = await pageCount(state.bytes);
            info.textContent = `📄 ${file.name} · ${state.pages} halaman · ${kb(file.size)}`;
            onLoad?.(state);
        } catch (error) {
            toast(friendlyError(error), "error");
        }
    } }), info);
    return state;
}

function needPdf(state) {
    if (!state.bytes) throw new Error("Pilih file PDF dulu.");
}

/* ---------- Alat-alat ---------- */

const BUILDERS = {
    merge(body) {
        const files = [];
        const list = el("ol", { class: "erp-filelist" });
        const draw = () => list.replaceChildren(...files.map((f, i) => el("li", {},
            el("span", { text: `${f.name} · ${kb(f.size)}` }),
            el("span", { class: "erp-filelist__actions" },
                el("button", { class: "erp-btn erp-btn--sm", type: "button", disabled: i === 0, "aria-label": "Naikkan", onclick: () => { [files[i - 1], files[i]] = [files[i], files[i - 1]]; draw(); } }, "↑"),
                el("button", { class: "erp-btn erp-btn--sm", type: "button", disabled: i === files.length - 1, "aria-label": "Turunkan", onclick: () => { [files[i + 1], files[i]] = [files[i], files[i + 1]]; draw(); } }, "↓"),
                el("button", { class: "erp-btn erp-btn--sm", type: "button", "aria-label": "Hapus", onclick: () => { files.splice(i, 1); draw(); } }, "✕")))));
        body.append(dropZone({ multiple: true, label: "Pilih beberapa PDF", onFiles: (f) => { files.push(...f); draw(); } }), list);
        runner(body, { label: "Gabungkan", run: async () => {
            if (files.length < 2) throw new Error("Pilih minimal 2 PDF.");
            const { merge, readFile } = await engine();
            const bytes = await merge(await Promise.all(files.map(readFile)));
            return { name: "gabungan.pdf", bytes };
        } });
    },

    split(body) {
        const state = singlePdf(body);
        const mode = select([["range", "Ambil rentang halaman"], ["every", "Pecah tiap N halaman"], ["all", "Setiap halaman jadi 1 file"]], "range");
        const ranges = el("input", { type: "text", placeholder: "contoh: 1-3, 5, 8-", value: "1-2" });
        const every = el("input", { type: "number", min: 1, value: 2 });
        const merged = select([["0", "Tiap rentang jadi file sendiri"], ["1", "Gabungkan semua rentang jadi 1 file"]], "0");
        body.append(el("div", { class: "erp-tool__opts" }, field("Cara", mode), field("Rentang", ranges, "Pisahkan dengan koma. \"8-\" = halaman 8 sampai akhir."), field("Tiap N halaman", every), field("Hasil", merged)));
        runner(body, { label: "Pisahkan", run: async () => {
            needPdf(state);
            const { split } = await engine();
            let groups = mode.value === "range" ? parseRanges(ranges.value, state.pages) : mode.value === "every" ? chunkPages(state.pages, every.value) : chunkPages(state.pages, 1);
            if (mode.value === "range" && merged.value === "1") groups = [groups.flat()];
            const files = await split(state.bytes, groups);
            return files.map((f) => ({ ...f, name: `${baseName(state.file)} ${f.name}`, zipName: baseName(state.file) }));
        } });
    },

    organize(body) {
        let pages = [];
        const gridEl = el("div", { class: "erp-pagegrid" });
        const state = singlePdf(body, async (s) => {
            gridEl.replaceChildren(el("p", { class: "erp-muted", text: "Membuat pratinjau…" }));
            const { thumbnails } = await engine();
            const thumbs = await thumbnails(s.bytes);
            pages = thumbs.map((t) => ({ index: t.page - 1, rotate: 0, src: t.src }));
            draw();
        });
        const draw = () => gridEl.replaceChildren(...pages.map((p, i) => el("figure", { class: "erp-pagecard" },
            el("img", { src: p.src, alt: `Halaman ${p.index + 1}`, style: `transform:rotate(${p.rotate}deg)` }),
            el("figcaption", { text: `Hal. ${p.index + 1}` }),
            el("div", { class: "erp-pagecard__actions" },
                el("button", { type: "button", "aria-label": "Geser kiri", disabled: i === 0, onclick: () => { [pages[i - 1], pages[i]] = [pages[i], pages[i - 1]]; draw(); } }, "←"),
                el("button", { type: "button", "aria-label": "Putar", onclick: () => { p.rotate = (p.rotate + 90) % 360; draw(); } }, "↻"),
                el("button", { type: "button", "aria-label": "Hapus halaman", onclick: () => { pages.splice(i, 1); draw(); } }, "✕"),
                el("button", { type: "button", "aria-label": "Geser kanan", disabled: i === pages.length - 1, onclick: () => { [pages[i + 1], pages[i]] = [pages[i], pages[i + 1]]; draw(); } }, "→")))));
        body.append(gridEl);
        runner(body, { label: "Simpan susunan baru", run: async () => {
            needPdf(state);
            if (!pages.length) throw new Error("Semua halaman terhapus.");
            const { organize } = await engine();
            return { name: `${baseName(state.file)} (diatur).pdf`, bytes: await organize(state.bytes, pages) };
        } });
    },

    rotate(body) {
        const state = singlePdf(body);
        const angle = select([["90", "90° searah jarum jam"], ["180", "180°"], ["270", "90° berlawanan"]], "90");
        body.append(el("div", { class: "erp-tool__opts" }, field("Putar", angle)));
        runner(body, { label: "Putar", run: async () => {
            needPdf(state);
            const { rotateAll } = await engine();
            return { name: `${baseName(state.file)} (diputar).pdf`, bytes: await rotateAll(state.bytes, Number(angle.value)) };
        } });
    },

    compress(body) {
        const state = singlePdf(body);
        const level = select([["ringan", "Ringan (kualitas tinggi)"], ["sedang", "Sedang (disarankan)"], ["kuat", "Kuat (paling kecil)"]], "sedang");
        body.append(el("div", { class: "erp-tool__opts" }, field("Tingkat kompres", level, "Halaman digambar ulang jadi gambar: teks tidak bisa disalin lagi. Cocok untuk kirim berkas.")));
        runner(body, { label: "Kompres", run: async (say) => {
            needPdf(state);
            const { compress } = await engine();
            const bytes = await compress(state.bytes, level.value, (n, t) => say(`Memproses halaman ${n} dari ${t}…`));
            toast(bytes.length < state.bytes.length ? `Turun ${Math.round((1 - bytes.length / state.bytes.length) * 100)}% (${kb(state.bytes.length)} → ${kb(bytes.length)}).` : "File ini sudah kecil; tidak bisa diperkecil lagi.");
            return { name: `${baseName(state.file)} (kecil).pdf`, bytes };
        } });
    },

    pdf2jpg(body) {
        const state = singlePdf(body);
        const quality = select([["1.5", "Standar"], ["2", "Tajam"], ["3", "Sangat tajam (file besar)"]], "2");
        body.append(el("div", { class: "erp-tool__opts" }, field("Kualitas", quality)));
        runner(body, { label: "Ubah ke JPG", run: async (say) => {
            needPdf(state);
            const { toImages } = await engine();
            const files = await toImages(state.bytes, { scale: Number(quality.value), onPage: (n, t) => say(`Halaman ${n} dari ${t}…`) });
            return files.map((f) => ({ ...f, name: `${baseName(state.file)} ${f.name}`, mime: "image/jpeg", zipName: baseName(state.file) }));
        } });
    },

    jpg2pdf(body) {
        imageCollector(body, { label: "Pilih foto/gambar", camera: false });
    },

    scan(body) {
        imageCollector(body, { label: "Pilih foto dari galeri", camera: true });
    },

    watermark(body) {
        const state = singlePdf(body);
        const text = el("input", { type: "text", value: "RAHASIA", maxlength: 40 });
        const opacity = select([["0.08", "Sangat samar"], ["0.15", "Samar"], ["0.3", "Jelas"]], "0.15");
        const size = select([["36", "Kecil"], ["54", "Sedang"], ["80", "Besar"]], "54");
        const color = select([["#b42318", "Merah"], ["#12110f", "Hitam"], ["#3d6fb6", "Biru"], ["#c9a227", "Emas"]], "#b42318");
        body.append(el("div", { class: "erp-tool__opts" }, field("Teks", text), field("Ketebalan", opacity), field("Ukuran", size), field("Warna", color)));
        runner(body, { label: "Pasang watermark", run: async () => {
            needPdf(state);
            if (!text.value.trim()) throw new Error("Tulis teks watermark.");
            const { watermark } = await engine();
            return { name: `${baseName(state.file)} (watermark).pdf`, bytes: await watermark(state.bytes, { text: text.value.trim(), opacity: Number(opacity.value), size: Number(size.value), color: color.value }) };
        } });
    },

    pagenum(body) {
        const state = singlePdf(body);
        const position = select([["bawah-tengah", "Bawah tengah"], ["bawah-kanan", "Bawah kanan"], ["bawah-kiri", "Bawah kiri"], ["atas-tengah", "Atas tengah"], ["atas-kanan", "Atas kanan"]], "bawah-tengah");
        const format = select([["{n}", "1"], ["{n} / {total}", "1 / 10"], ["Halaman {n} dari {total}", "Halaman 1 dari 10"], ["- {n} -", "- 1 -"]], "{n} / {total}");
        const start = el("input", { type: "number", min: 1, value: 1 });
        body.append(el("div", { class: "erp-tool__opts" }, field("Posisi", position), field("Format", format), field("Mulai dari", start)));
        runner(body, { label: "Tambah nomor", run: async () => {
            needPdf(state);
            const { pageNumbers } = await engine();
            return { name: `${baseName(state.file)} (bernomor).pdf`, bytes: await pageNumbers(state.bytes, { position: position.value, format: format.value, start: Number(start.value) || 1 }) };
        } });
    },

    sign(body) {
        let signature = null;
        let place = { page: 1, x: 0.6, y: 0.85 };
        const preview = el("div", { class: "erp-signplace" });
        const sigBox = el("div", { class: "erp-sigpreview" }, el("span", { class: "erp-muted", text: "Belum ada tanda tangan." }));
        const pageSel = el("select", {});
        const size = select([["0.2", "Kecil"], ["0.28", "Sedang"], ["0.38", "Besar"]], "0.28");
        const all = select([["0", "Hanya halaman ini"], ["1", "Semua halaman (paraf)"]], "0");
        let thumbs = [];
        const drawPage = () => {
            const t = thumbs[place.page - 1];
            if (!t) return;
            const marker = el("span", { class: "erp-signplace__mark", style: `left:${place.x * 100}%;top:${place.y * 100}%;width:${Number(size.value) * 100}%` }, signature ? el("img", { src: signature, alt: "" }) : "✍");
            const img = el("img", { src: t.src, alt: `Halaman ${t.page}` });
            const frame = el("div", { class: "erp-signplace__page" }, img, marker);
            frame.addEventListener("click", (e) => {
                const r = frame.getBoundingClientRect();
                place = { ...place, x: Math.min(0.95, Math.max(0, (e.clientX - r.left) / r.width - Number(size.value) / 2)), y: (e.clientY - r.top) / r.height };
                drawPage();
            });
            preview.replaceChildren(el("p", { class: "erp-muted", text: "Ketuk halaman untuk memindah posisi tanda tangan." }), frame);
        };
        size.addEventListener("change", drawPage);
        pageSel.addEventListener("change", () => {
            place.page = Number(pageSel.value);
            drawPage();
        });
        const state = singlePdf(body, async (s) => {
            const { thumbnails } = await engine();
            thumbs = await thumbnails(s.bytes);
            pageSel.replaceChildren(...thumbs.map((t) => el("option", { value: t.page }, `Halaman ${t.page}`)));
            place.page = thumbs.length;
            pageSel.value = String(thumbs.length);
            drawPage();
        });
        const upload = el("input", { type: "file", accept: "image/png", hidden: true });
        upload.addEventListener("change", () => {
            const f = upload.files?.[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = () => {
                signature = reader.result;
                sigBox.replaceChildren(el("img", { src: signature, alt: "Tanda tangan" }));
                drawPage();
            };
            reader.readAsDataURL(f);
        });
        body.append(
            el("div", { class: "erp-tool__opts" },
                el("div", { class: "erp-field" }, el("span", { text: "Tanda tangan" }), sigBox,
                    el("div", { class: "erp-row-actions erp-row-actions--start" },
                        el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: async () => {
                            const png = await signaturePad();
                            if (png) {
                                signature = png;
                                sigBox.replaceChildren(el("img", { src: png, alt: "Tanda tangan" }));
                                drawPage();
                            }
                        } }, "✍ Gambar"),
                        el("button", { class: "erp-btn erp-btn--sm", type: "button", onclick: () => upload.click() }, "Unggah PNG"), upload)),
                field("Halaman", pageSel), field("Ukuran", size), field("Terapkan ke", all)),
            preview);
        runner(body, { label: "Tanda tangani", run: async () => {
            needPdf(state);
            if (!signature) throw new Error("Buat tanda tangan dulu.");
            const { stamp } = await engine();
            const png = Uint8Array.from(atob(signature.split(",")[1]), (c) => c.charCodeAt(0));
            return { name: `${baseName(state.file)} (ditandatangani).pdf`, bytes: await stamp(state.bytes, { png, page: place.page, x: place.x, y: place.y, width: Number(size.value), allPages: all.value === "1" }) };
        } });
    },

    crop(body) {
        const state = singlePdf(body);
        const inputs = ["top", "right", "bottom", "left"].map((k) => [k, el("input", { type: "number", min: 0, max: 100, value: 10 })]);
        const labels = { top: "Atas (mm)", right: "Kanan (mm)", bottom: "Bawah (mm)", left: "Kiri (mm)" };
        body.append(el("div", { class: "erp-tool__opts" }, inputs.map(([k, input]) => field(labels[k], input))));
        runner(body, { label: "Potong", run: async () => {
            needPdf(state);
            const { crop } = await engine();
            return { name: `${baseName(state.file)} (dipotong).pdf`, bytes: await crop(state.bytes, Object.fromEntries(inputs.map(([k, i]) => [k, Number(i.value) || 0]))) };
        } });
    },

    redact(body) {
        const boxes = {};
        let thumbs = [];
        let pageNo = 1;
        const pageSel = el("select", {});
        const stage = el("div", { class: "erp-redact" });
        const drawStage = () => {
            const t = thumbs[pageNo - 1];
            if (!t) return;
            const frame = el("div", { class: "erp-redact__page" }, el("img", { src: t.src, alt: `Halaman ${t.page}`, draggable: "false" }));
            (boxes[pageNo] || []).forEach((b, i) => frame.append(el("button", { class: "erp-redact__box", type: "button", title: "Ketuk untuk hapus kotak", style: `left:${b.x * 100}%;top:${b.y * 100}%;width:${b.w * 100}%;height:${b.h * 100}%`, onclick: (e) => {
                e.stopPropagation();
                boxes[pageNo].splice(i, 1);
                drawStage();
            } })));
            let start = null;
            let ghost = null;
            frame.addEventListener("pointerdown", (e) => {
                if (e.target.closest(".erp-redact__box")) return;
                const r = frame.getBoundingClientRect();
                start = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, r };
                ghost = el("span", { class: "erp-redact__box is-ghost" });
                frame.append(ghost);
                frame.setPointerCapture(e.pointerId);
            });
            frame.addEventListener("pointermove", (e) => {
                if (!start) return;
                const x = (e.clientX - start.r.left) / start.r.width;
                const y = (e.clientY - start.r.top) / start.r.height;
                Object.assign(ghost.style, { left: `${Math.min(x, start.x) * 100}%`, top: `${Math.min(y, start.y) * 100}%`, width: `${Math.abs(x - start.x) * 100}%`, height: `${Math.abs(y - start.y) * 100}%` });
            });
            frame.addEventListener("pointerup", (e) => {
                if (!start) return;
                const x = (e.clientX - start.r.left) / start.r.width;
                const y = (e.clientY - start.r.top) / start.r.height;
                const box = { x: Math.max(0, Math.min(x, start.x)), y: Math.max(0, Math.min(y, start.y)), w: Math.abs(x - start.x), h: Math.abs(y - start.y) };
                start = null;
                if (box.w > 0.01 && box.h > 0.005) (boxes[pageNo] ||= []).push(box);
                drawStage();
            });
            stage.replaceChildren(el("p", { class: "erp-muted", text: "Tarik kotak di atas teks yang mau dihitamkan (ketuk kotak untuk menghapusnya). Halaman yang disensor diubah jadi gambar agar teks aslinya benar-benar hilang." }), frame);
        };
        pageSel.addEventListener("change", () => {
            pageNo = Number(pageSel.value);
            drawStage();
        });
        const state = singlePdf(body, async (s) => {
            const { renderPages } = await engine();
            const rendered = await renderPages(s.bytes, { scale: 1 });
            thumbs = rendered.map((r) => ({ page: r.page, src: r.canvas.toDataURL("image/jpeg", 0.85) }));
            pageSel.replaceChildren(...thumbs.map((t) => el("option", { value: t.page }, `Halaman ${t.page}`)));
            pageNo = 1;
            drawStage();
        });
        body.append(el("div", { class: "erp-tool__opts" }, field("Halaman", pageSel)), stage);
        runner(body, { label: "Sensor permanen", run: async () => {
            needPdf(state);
            const { redact } = await engine();
            return { name: `${baseName(state.file)} (disensor).pdf`, bytes: await redact(state.bytes, boxes) };
        } });
    },

    compare(body) {
        const slots = [null, null];
        const out = el("div", { class: "erp-diff" });
        const pick = (i) => dropZone({ label: i ? "PDF versi BARU" : "PDF versi LAMA", onFiles: async ([f]) => {
            const { readFile } = await engine();
            slots[i] = { name: f.name, bytes: await readFile(f) };
            names[i].textContent = `📄 ${f.name}`;
        } });
        const names = [el("p", { class: "erp-tool__file" }), el("p", { class: "erp-tool__file" })];
        body.append(el("div", { class: "erp-compare" }, el("div", {}, pick(0), names[0]), el("div", {}, pick(1), names[1])), out);
        runner(body, { label: "Bandingkan", run: async () => {
            if (!slots[0] || !slots[1]) throw new Error("Pilih dua PDF.");
            const { extractLines } = await engine();
            const [a, b] = await Promise.all([extractLines(slots[0].bytes), extractLines(slots[1].bytes)]);
            if (!a.length && !b.length) throw new Error("Tidak ada teks (PDF hasil scan). Gunakan OCR (segera hadir).");
            const diff = diffLines(a, b);
            const sum = diffSummary(diff);
            out.replaceChildren(
                el("p", { class: "erp-diff__sum", text: `${sum.added} baris baru · ${sum.removed} baris dihapus · ${sum.same} sama` }),
                el("ol", { class: "erp-diff__list" }, diff.filter((d, i, all) => d.type !== "sama" || all[i - 1]?.type !== "sama" || all[i + 1]?.type !== "sama")
                    .slice(0, 600).map((d) => el("li", { class: `is-${d.type}`, text: `${d.type === "tambah" ? "+ " : d.type === "hapus" ? "− " : "  "}${d.text}` }))));
            return null;
        } });
    },
};

function imageCollector(body, { label, camera }) {
    const files = [];
    const list = el("div", { class: "erp-imglist" });
    const draw = () => list.replaceChildren(...files.map((f, i) => {
        const url = URL.createObjectURL(f);
        return el("figure", { class: "erp-pagecard" },
            el("img", { src: url, alt: f.name, onload: () => URL.revokeObjectURL(url) }),
            el("figcaption", { text: `${i + 1}` }),
            el("div", { class: "erp-pagecard__actions" },
                el("button", { type: "button", disabled: i === 0, "aria-label": "Geser kiri", onclick: () => { [files[i - 1], files[i]] = [files[i], files[i - 1]]; draw(); } }, "←"),
                el("button", { type: "button", "aria-label": "Hapus", onclick: () => { files.splice(i, 1); draw(); } }, "✕"),
                el("button", { type: "button", disabled: i === files.length - 1, "aria-label": "Geser kanan", onclick: () => { [files[i + 1], files[i]] = [files[i], files[i + 1]]; draw(); } }, "→")));
    }));
    const fit = select([["a4", "Kertas A4 (rapi untuk dicetak)"], ["asli", "Ukuran asli gambar"]], "a4");
    const parts = [];
    if (camera) {
        parts.push(el("button", { class: "erp-btn erp-btn--primary", type: "button", onclick: async () => {
            const { openWebCamera, cameraSupported } = await import("../../js/web-camera.js");
            if (!cameraSupported()) return toast("Kamera tidak tersedia di perangkat ini.", "error");
            const shot = await openWebCamera({ facing: "environment" });
            if (shot) {
                files.push(shot);
                draw();
            }
        } }, "📷 Foto berkas"));
    }
    parts.push(dropZone({ accept: "image/jpeg,image/png,image/webp,image/*", multiple: true, label, onFiles: (f) => { files.push(...f); draw(); } }));
    body.append(...parts, list, el("div", { class: "erp-tool__opts" }, field("Ukuran halaman", fit)));
    runner(body, { label: "Jadikan PDF", run: async () => {
        if (!files.length) throw new Error("Tambahkan minimal 1 gambar.");
        const { imagesToPdf } = await engine();
        return { name: camera ? "hasil-pindai.pdf" : "gambar.pdf", bytes: await imagesToPdf(files, { fit: fit.value }) };
    } });
}
