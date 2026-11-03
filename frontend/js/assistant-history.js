/**
 * KANTOONG — RIWAYAT CHAT AI (gaya kartu catatan)
 * File: frontend/js/assistant-history.js
 *
 * Tombol riwayat di bar judul chat mengganti isi chat dengan kisi kartu:
 * satu kartu = satu sesi obrolan (pratinjau mini gelembung + kartu produk,
 * jam di pojok, judul dari pertanyaan pertama, tanggal).
 *
 * - Kartu redup & sedikit blur. Kartu "hidup" (menyala, membesar, isi
 *   chat bergulir atas-bawah) saat:
 *     desktop: kursor di atasnya;
 *     HP: kartu berada di tengah area saat digulir / baru tersentuh.
 * - Ketuk kartu = buka lagi sesi itu (ai-brain.js: openArchived).
 * - Sumber data: sesi aktif + arsip lokal dari tombol "Chat baru"
 *   (30 hari, teks saja). Kartu produk ikut tersimpan, jadi user tahu
 *   produk apa yang dulu ditanya/direkomendasikan.
 */

const hoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

const ICON_HISTORY =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<rect x="3" y="4" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="4" width="7.5" height="7.5" rx="2"/>' +
    '<rect x="3" y="14.5" width="7.5" height="5.5" rx="2"/><rect x="13.5" y="14.5" width="7.5" height="5.5" rx="2"/></svg>';

const dateFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" });
const timeFormat = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" });

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}

/* ---------- Data sesi ---------- */

function sessionTitle(messages) {
    const first = messages.find((message) => message.who === "user");
    if (!first) return "Chat baru";

    const text = String(first.text || "").replace(/\s+/g, " ").trim();
    if (text) return text;
    return first.attachments?.length ? "Kirim lampiran" : "Chat tanpa judul";
}

function readSessions() {
    const brain = window.KantoongAIBrain;
    const current = brain?.getHistory?.() || [];
    const archive = brain?.getArchive?.() || [];

    const sessions = archive
        .map((entry, index) => ({ index, messages: entry.messages }))
        .reverse();

    sessions.unshift({ index: -1, current: true, messages: current });

    return sessions.map((session) => ({
        ...session,
        title: sessionTitle(session.messages),
        startedAt: Number(session.messages[0]?.timestamp) || Date.now(),
    }));
}

/* ---------- Kartu ---------- */

function previewBubble(message) {
    const who = message.who === "user" ? "user" : "ai";
    const bubble = el("div", `kc-hcard__msg kc-hcard__msg--${who}`);

    const text = String(message.text || "").trim();
    if (text) bubble.appendChild(el("p", "", text.length > 90 ? `${text.slice(0, 90)}…` : text));

    const ids = Array.isArray(message.productIds) ? message.productIds.slice(0, 3) : [];
    if (ids.length) {
        const row = el("div", "kc-hcard__products");
        for (const id of ids) {
            const product = window.KantoongAIBrain?.describeProduct?.(id);
            const chip = el("span", "kc-hcard__product");
            if (product?.image) {
                const image = document.createElement("img");
                image.src = product.image;
                image.alt = "";
                image.loading = "lazy";
                chip.appendChild(image);
            } else {
                // Produk sudah tidak dijual: tetap ada jejaknya.
                chip.classList.add("is-gone");
                chip.title = "Produk sudah tidak tersedia";
            }
            row.appendChild(chip);
        }
        bubble.appendChild(row);
    }

    return bubble;
}

function createCard(session) {
    const card = el("button", "kc-hcard");
    card.type = "button";
    card.dataset.index = String(session.index);
    if (session.current) card.classList.add("is-current");

    const date = new Date(session.startedAt);
    card.setAttribute(
        "aria-label",
        `${session.current ? "Chat sekarang: " : "Buka chat: "}${session.title}, ${dateFormat.format(date)} ${timeFormat.format(date)}`
    );

    const preview = el("span", "kc-hcard__preview");
    const track = el("span", "kc-hcard__track");
    session.messages.slice(0, 14).forEach((message) => track.appendChild(previewBubble(message)));
    preview.append(track, el("span", "kc-hcard__time", timeFormat.format(date)));
    if (session.current) preview.appendChild(el("span", "kc-hcard__badge", "Sedang dibuka"));

    card.append(
        preview,
        el("span", "kc-hcard__title", session.title),
        el("span", "kc-hcard__date", dateFormat.format(date))
    );

    return card;
}

/* ---------- Kartu "hidup" ---------- */

function setLive(card, live) {
    if (!card || card.classList.contains("is-live") === live) return;
    card.classList.toggle("is-live", live);

    if (live) {
        // Jarak gulir pratinjau = isi yang tidak muat di kotak.
        const preview = card.querySelector(".kc-hcard__preview");
        const track = card.querySelector(".kc-hcard__track");
        const distance = Math.max(0, track.scrollHeight - preview.clientHeight + 16);
        card.style.setProperty("--kc-track-dist", `${-distance}px`);
    }
}

/** HP: kartu terdekat dengan tengah area gulir menjadi hidup. */
function liveNearestCenter(list) {
    const box = list.getBoundingClientRect();
    const middle = box.top + box.height / 2;
    let nearest = null;
    let best = Infinity;

    for (const card of list.querySelectorAll(".kc-hcard")) {
        const rect = card.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - middle);
        if (distance < best) {
            best = distance;
            nearest = card;
        }
    }

    list.querySelectorAll(".kc-hcard.is-live").forEach((card) => {
        if (card !== nearest) setLive(card, false);
    });
    setLive(nearest, true);
}

/* ---------- Tampilan riwayat ---------- */

export function initAssistantHistory() {
    const panel = document.getElementById("chatPanel");
    const bar = panel?.querySelector(".kc-chatbar");
    if (!panel || !bar || panel.querySelector(".kc-history")) return;

    const heading = bar.querySelector("h2");
    const chatTitle = heading?.textContent || "Konsultasi AI";

    const toggle = el("button", "kc-icon-btn kc-history-btn");
    toggle.type = "button";
    toggle.title = "Riwayat chat";
    toggle.setAttribute("aria-label", "Riwayat chat AI");
    toggle.setAttribute("aria-pressed", "false");
    toggle.innerHTML = ICON_HISTORY;
    (bar.querySelector(".kc-dock-tools") || bar.querySelector("#chatCloseBtn"))?.before(toggle);

    const view = el("section", "kc-history");
    view.setAttribute("aria-label", "Riwayat chat AI");

    const head = el("div", "kc-history__head");
    const note = el("p", "kc-history__note", "Obrolan 30 hari terakhir");
    const fresh = el("button", "kc-history__new", "+ Chat baru");
    fresh.type = "button";
    head.append(note, fresh);

    const list = el("div", "kc-history__grid");
    view.append(head, list);
    // Sejajar dengan isi chat (bukan di dalam area geser kotak), agar bisa digulir.
    (panel.querySelector("#chatBox") || panel.lastElementChild).before(view);

    let scrollFrame = 0;

    const render = () => {
        const sessions = readSessions();
        list.replaceChildren(...sessions.map(createCard));

        if (sessions.length === 1) {
            list.appendChild(el("p", "kc-history__empty",
                "Tekan \"+ Chat baru\" untuk menyimpan obrolan ini. Obrolan lama akan muncul di sini."));
        }

        if (!hoverQuery.matches) requestAnimationFrame(() => liveNearestCenter(view));
    };

    const show = (open) => {
        panel.dataset.view = open ? "history" : "chat";
        toggle.setAttribute("aria-pressed", String(open));
        if (heading) heading.textContent = open ? "Riwayat Chat AI" : chatTitle;
        if (open) {
            render();
            view.scrollTop = 0;
        }
    };

    toggle.addEventListener("click", () => show(panel.dataset.view !== "history"));

    fresh.addEventListener("click", () => {
        window.KantoongAIBrain?.newChat?.();
        show(false);
    });

    // Desktop: kursor = hidup.
    list.addEventListener("pointerover", (event) => {
        if (!hoverQuery.matches) return;
        const card = event.target.closest(".kc-hcard");
        list.querySelectorAll(".kc-hcard.is-live").forEach((item) => item !== card && setLive(item, false));
        setLive(card, true);
    });
    list.addEventListener("pointerleave", () => {
        if (hoverQuery.matches) list.querySelectorAll(".kc-hcard.is-live").forEach((card) => setLive(card, false));
    });

    // HP: digulir = kartu di tengah hidup; tersentuh = kartu itu hidup.
    view.addEventListener("scroll", () => {
        if (hoverQuery.matches || scrollFrame) return;
        scrollFrame = requestAnimationFrame(() => {
            scrollFrame = 0;
            liveNearestCenter(view);
        });
    }, { passive: true });

    list.addEventListener("touchstart", (event) => {
        const card = event.target.closest(".kc-hcard");
        if (!card) return;
        list.querySelectorAll(".kc-hcard.is-live").forEach((item) => item !== card && setLive(item, false));
        setLive(card, true);
    }, { passive: true });

    // Ketuk kartu = buka sesi itu.
    list.addEventListener("click", (event) => {
        const card = event.target.closest(".kc-hcard");
        if (!card) return;

        card.classList.add("is-opening");
        setTimeout(() => {
            const index = Number(card.dataset.index);
            if (index >= 0) window.KantoongAIBrain?.openArchived?.(index);
            show(false);
        }, 240);
    });

    // Chat diturunkan: kembali ke tampilan obrolan.
    new MutationObserver(() => {
        if (panel.dataset.open === "false" && panel.dataset.view === "history") show(false);
    }).observe(panel, { attributes: true, attributeFilter: ["data-open"] });

    panel.dataset.view = "chat";
}
