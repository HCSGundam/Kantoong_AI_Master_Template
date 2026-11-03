/**
 * KANTOONG ERP — NEURON SECOND BRAIN (kanvas, tanpa library)
 * File: frontend/erp/modules/brain-neuron.js
 *
 * Satu brand = satu neuron di otak Anachronos Digital Mall.
 * Bola biru bercahaya yang "bernapas", dengan dendrit yang bergoyang
 * halus. spark(kind) mengirim percikan cahaya dari ujung dendrit masuk
 * ke bola (hijau = masuk keranjang). Klik bola = onOpen().
 */

function prng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const BLUE = [125, 211, 252];
const GREEN = [74, 222, 128];
const rgba = ([r, g, b], alpha) => `rgba(${r}, ${g}, ${b}, ${alpha})`;

/** Bentuk dendrit tetap (seeded): tiap cabang = titik-titik dari bola keluar. */
function makeDendrites(count = 18) {
    const random = prng(7);
    const dendrites = [];
    for (let index = 0; index < count; index++) {
        const angle = (index / count) * Math.PI * 2 + random() * 0.3;
        const length = 1.5 + random() * 1.3; // dalam satuan jari-jari bola
        const bend = (random() - 0.5) * 0.9;
        const points = [];
        for (let step = 0; step <= 6; step++) {
            const t = step / 6;
            points.push({ r: 1 + t * (length - 1), a: angle + bend * t * t });
        }
        // Satu cabang kecil di tengah dendrit.
        const fork = random() < 0.7
            ? { from: 3, a: angle + bend * 0.25 + (random() < 0.5 ? -0.5 : 0.5), len: 0.4 + random() * 0.5 }
            : null;
        dendrites.push({ points, fork, phase: random() * Math.PI * 2 });
    }
    return dendrites;
}

export function createNeuron({ name = "Brand", onOpen } = {}) {
    const stage = document.createElement("div");
    stage.className = "erp-neuron__stage";

    const canvas = document.createElement("canvas");
    canvas.className = "erp-neuron__canvas";
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "button");
    canvas.setAttribute("aria-label", `Neuron ${name}. Tekan untuk membuka isinya.`);
    stage.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dendrites = makeDendrites();

    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = 0;
    let hover = false;
    let flash = 0;
    let sparks = [];
    let lastIdleSpark = 0;

    const geometry = () => {
        const radius = Math.min(width, height) * 0.13;
        return { cx: width / 2, cy: height * 0.46, radius };
    };

    const pointAt = (dendrite, index, time, geo) => {
        const point = dendrite.points[index];
        const sway = reduceMotion ? 0 : Math.sin(time / 1400 + dendrite.phase) * 0.05 * (index / 6);
        return {
            x: geo.cx + Math.cos(point.a + sway) * point.r * geo.radius,
            y: geo.cy + Math.sin(point.a + sway) * point.r * geo.radius,
        };
    };

    function resize() {
        dpr = Math.min(2, window.devicePixelRatio || 1);
        width = stage.clientWidth;
        height = stage.clientHeight;
        canvas.width = Math.max(1, Math.round(width * dpr));
        canvas.height = Math.max(1, Math.round(height * dpr));
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
    }

    function addSpark(kind = "interest", strength = 1) {
        sparks.push({
            dendrite: Math.floor(Math.random() * dendrites.length),
            t: 0,
            speed: 0.008 + Math.random() * 0.006,
            color: kind === "cart" ? GREEN : BLUE,
            strength,
        });
    }

    function draw(time) {
        frame = requestAnimationFrame(draw);
        if (!width || !height) return;

        const geo = geometry();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const bg = ctx.createRadialGradient(geo.cx, geo.cy, 0, geo.cx, geo.cy, Math.max(width, height) * 0.75);
        bg.addColorStop(0, "#0c2147");
        bg.addColorStop(0.55, "#06122a");
        bg.addColorStop(1, "#020610");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        // Neuron tetangga yang samar di kejauhan: "1 dari ribuan".
        const far = prng(3);
        for (let index = 0; index < 26; index++) {
            const x = far() * width;
            const y = far() * height;
            const r = 1 + far() * 2.2;
            const twinkle = reduceMotion ? 0.35 : 0.2 + (Math.sin(time / 1700 + index) + 1) * 0.15;
            ctx.fillStyle = `rgba(96, 165, 250, ${twinkle})`;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        // Dendrit.
        ctx.lineCap = "round";
        for (const dendrite of dendrites) {
            ctx.strokeStyle = "rgba(96, 165, 250, 0.28)";
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            dendrite.points.forEach((_, index) => {
                const point = pointAt(dendrite, index, time, geo);
                if (index) ctx.lineTo(point.x, point.y);
                else ctx.moveTo(point.x, point.y);
            });
            ctx.stroke();

            if (dendrite.fork) {
                const start = pointAt(dendrite, dendrite.fork.from, time, geo);
                ctx.lineWidth = 1;
                ctx.strokeStyle = "rgba(96, 165, 250, 0.2)";
                ctx.beginPath();
                ctx.moveTo(start.x, start.y);
                ctx.lineTo(
                    start.x + Math.cos(dendrite.fork.a) * dendrite.fork.len * geo.radius,
                    start.y + Math.sin(dendrite.fork.a) * dendrite.fork.len * geo.radius
                );
                ctx.stroke();
            }

            // Ujung dendrit berkilau kecil.
            const tip = pointAt(dendrite, 6, time, geo);
            ctx.fillStyle = "rgba(147, 197, 253, 0.55)";
            ctx.beginPath();
            ctx.arc(tip.x, tip.y, 1.8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Percikan: dari ujung dendrit masuk ke bola.
        if (!reduceMotion && time - lastIdleSpark > 1600) {
            lastIdleSpark = time;
            addSpark("interest", 0.55);
        }
        sparks = sparks.filter((spark) => {
            spark.t += spark.speed;
            if (spark.t >= 1) {
                flash = Math.max(flash, spark.strength);
                return false;
            }
            const dendrite = dendrites[spark.dendrite];
            const position = 6 * (1 - spark.t);
            const index = Math.min(5, Math.floor(position));
            const a = pointAt(dendrite, index, time, geo);
            const b = pointAt(dendrite, index + 1, time, geo);
            const local = position - index;
            const x = a.x + (b.x - a.x) * local;
            const y = a.y + (b.y - a.y) * local;
            const size = 8 * spark.strength;
            const glow = ctx.createRadialGradient(x, y, 0, x, y, size);
            glow.addColorStop(0, rgba(spark.color, 0.95));
            glow.addColorStop(1, rgba(spark.color, 0));
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
            return true;
        });

        // Bola neuron yang bernapas.
        const breathe = reduceMotion ? 1 : 1 + Math.sin(time / 1100) * 0.035;
        const radius = geo.radius * breathe * (hover ? 1.04 : 1);
        flash *= 0.94;

        for (const [scale, alpha] of [[3.2, 0.08], [2.1, 0.14], [1.45, 0.22 + flash * 0.25]]) {
            const halo = ctx.createRadialGradient(geo.cx, geo.cy, radius * 0.6, geo.cx, geo.cy, radius * scale);
            halo.addColorStop(0, `rgba(59, 130, 246, ${alpha})`);
            halo.addColorStop(1, "rgba(59, 130, 246, 0)");
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(geo.cx, geo.cy, radius * scale, 0, Math.PI * 2);
            ctx.fill();
        }

        const body = ctx.createRadialGradient(
            geo.cx - radius * 0.35, geo.cy - radius * 0.4, radius * 0.1,
            geo.cx, geo.cy, radius
        );
        body.addColorStop(0, `rgba(240, 249, 255, ${0.95})`);
        body.addColorStop(0.35, `rgba(147, 197, 253, ${0.92 + flash * 0.08})`);
        body.addColorStop(0.8, "rgba(37, 99, 235, 0.9)");
        body.addColorStop(1, "rgba(30, 64, 175, 0.75)");
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(geo.cx, geo.cy, radius, 0, Math.PI * 2);
        ctx.fill();

        // Cincin berdenyut keluar (seperti detak).
        if (!reduceMotion) {
            const beat = (time % 2600) / 2600;
            ctx.strokeStyle = `rgba(147, 197, 253, ${0.35 * (1 - beat)})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(geo.cx, geo.cy, radius * (1.05 + beat * 0.9), 0, Math.PI * 2);
            ctx.stroke();
        }

        // Nama brand di bawah bola.
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.font = "700 18px Inter, system-ui, sans-serif";
        ctx.fillText(name, geo.cx, geo.cy + radius * 2.15 + 8);
        ctx.fillStyle = "rgba(191, 219, 254, 0.75)";
        ctx.font = "500 12px Inter, system-ui, sans-serif";
        ctx.fillText("1 neuron · Anachronos Digital Mall", geo.cx, geo.cy + radius * 2.15 + 28);
    }

    const insideBall = (event) => {
        const rect = canvas.getBoundingClientRect();
        const geo = geometry();
        return Math.hypot(event.clientX - rect.left - geo.cx, event.clientY - rect.top - geo.cy) <= geo.radius * 1.25;
    };

    canvas.addEventListener("pointermove", (event) => {
        hover = insideBall(event);
        canvas.style.cursor = hover ? "pointer" : "default";
    });
    canvas.addEventListener("pointerleave", () => { hover = false; });
    canvas.addEventListener("click", (event) => {
        if (insideBall(event)) onOpen?.();
    });
    canvas.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen?.();
        }
    });

    const observer = new ResizeObserver(resize);
    observer.observe(stage);

    const onVisibility = () => {
        cancelAnimationFrame(frame);
        if (!document.hidden) frame = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", onVisibility);
    frame = requestAnimationFrame(draw);

    return {
        element: stage,

        /** Aktivitas baru: percikan masuk ke neuron. kind "cart" = hijau. */
        spark(kind = "interest") {
            addSpark(kind, 1);
        },

        destroy() {
            cancelAnimationFrame(frame);
            observer.disconnect();
            document.removeEventListener("visibilitychange", onVisibility);
        },
    };
}
