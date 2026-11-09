/**
 * KANTOONG — KAMERA DI DALAM WEB
 * File: frontend/js/web-camera.js
 *
 * Kamera terbuka DI DALAM halaman (bukan dialihkan ke aplikasi kamera HP):
 * pratinjau langsung, tombol jepret, ganti kamera depan/belakang, ulangi / pakai.
 * Foto hanya diproses di perangkat; tidak ada yang dikirim sebelum pengguna
 * menekan "Pakai foto" lalu mengirim pesannya sendiri.
 */

function el(tag, className, ...children) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    children.forEach((c) => c != null && node.append(c instanceof Node ? c : document.createTextNode(String(c))));
    return node;
}

function btn(className, label, aria) {
    const b = el("button", className, label);
    b.type = "button";
    if (aria) b.setAttribute("aria-label", aria);
    return b;
}

export const cameraSupported = () => Boolean(navigator.mediaDevices?.getUserMedia);

/**
 * Buka kamera. Hasil: Promise<File | null>.
 */
export function openWebCamera({ facing = "environment" } = {}) {
    return new Promise((resolve) => {
        let stream = null;
        let mode = facing;
        let shot = null;

        const video = el("video", "kc-cam__video");
        video.playsInline = true;
        video.muted = true;
        video.autoplay = true;
        const still = el("img", "kc-cam__still");
        still.alt = "Hasil foto";
        still.hidden = true;
        const status = el("p", "kc-cam__status", "Menyalakan kamera…");

        const close = btn("kc-cam__close", "×", "Tutup kamera");
        const flip = btn("kc-cam__flip", "⟲", "Ganti kamera depan/belakang");
        const shutter = btn("kc-cam__shutter", "", "Ambil foto");
        const retake = btn("kc-cam__ghost", "Ulangi");
        const use = btn("kc-cam__use", "Pakai foto");
        retake.hidden = true;
        use.hidden = true;

        const root = el("div", "kc-cam",
            el("div", "kc-cam__stage", video, still, status),
            el("div", "kc-cam__top", el("span", "kc-cam__live", "● Kamera"), close),
            el("div", "kc-cam__bar", flip, shutter, retake, use));
        root.setAttribute("role", "dialog");
        root.setAttribute("aria-modal", "true");
        root.setAttribute("aria-label", "Kamera");

        const stop = () => stream?.getTracks().forEach((t) => t.stop());

        async function start() {
            stop();
            status.hidden = false;
            status.textContent = "Menyalakan kamera…";
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
                video.srcObject = stream;
                video.classList.toggle("is-mirror", mode === "user");
                await video.play().catch(() => {});
                status.hidden = true;
            } catch (error) {
                status.textContent = error?.name === "NotAllowedError"
                    ? "Izin kamera ditolak. Izinkan kamera di pengaturan browser, lalu coba lagi."
                    : "Kamera tidak tersedia di perangkat ini.";
            }
        }

        function finish(result) {
            stop();
            document.removeEventListener("keydown", onKey);
            root.classList.remove("is-open");
            setTimeout(() => root.remove(), 220);
            resolve(result);
        }

        const onKey = (event) => {
            if (event.key === "Escape") finish(null);
        };

        close.addEventListener("click", () => finish(null));
        flip.addEventListener("click", () => {
            mode = mode === "user" ? "environment" : "user";
            start();
        });
        shutter.addEventListener("click", () => {
            if (!video.videoWidth) return;
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            if (mode === "user") {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
            }
            ctx.drawImage(video, 0, 0);
            root.classList.add("is-flash");
            setTimeout(() => root.classList.remove("is-flash"), 180);
            canvas.toBlob((blob) => {
                if (!blob) return;
                shot = new File([blob], `kamera-${Date.now()}.jpg`, { type: "image/jpeg" });
                still.src = URL.createObjectURL(blob);
                still.hidden = false;
                video.hidden = true;
                shutter.hidden = true;
                flip.hidden = true;
                retake.hidden = false;
                use.hidden = false;
            }, "image/jpeg", 0.9);
        });
        retake.addEventListener("click", () => {
            shot = null;
            still.hidden = true;
            video.hidden = false;
            shutter.hidden = false;
            flip.hidden = false;
            retake.hidden = true;
            use.hidden = true;
        });
        use.addEventListener("click", () => finish(shot));

        document.addEventListener("keydown", onKey);
        document.body.append(root);
        requestAnimationFrame(() => root.classList.add("is-open"));
        start();
    });
}
