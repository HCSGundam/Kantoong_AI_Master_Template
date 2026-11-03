import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { join } from "node:path";

const frontendRoot = fileURLToPath(
    new URL("./frontend/", import.meta.url)
);

/*
 * Toko per sales: /nama-sales  ->  index.html (storefront membaca slug).
 * Folder/berkas yang memang ada (erp, cart, css, ...) tidak dibelokkan.
 * Saat online nanti: atur rewrite yang sama di hosting, lalu pindah ke
 * subdomain nama-sales.kantoong.id.
 */
function salesStoreFallback() {
    const pattern = /^\/([a-z0-9][a-z0-9-]{1,30}[a-z0-9])\/?$/;

    const rewrite = (req, res, next) => {
        const [path, query = ""] = String(req.url || "").split("?");
        const match = path.match(pattern);

        if (match && !existsSync(join(frontendRoot, match[1]))) {
            // "/andi/" -> "/andi" agar alamat css/js relatif tetap benar.
            if (path.endsWith("/")) {
                res.writeHead(302, { Location: `/${match[1]}${query ? `?${query}` : ""}` });
                res.end();
                return;
            }

            req.url = "/index.html" + (query ? `?${query}` : "");
        }

        next();
    };

    return {
        name: "kantoong-sales-store-fallback",
        configureServer(server) {
            server.middlewares.use(rewrite);
        },
        configurePreviewServer(server) {
            server.middlewares.use(rewrite);
        },
    };
}

export default defineConfig({
    root: frontendRoot,

    appType: "mpa",

    plugins: [salesStoreFallback()],

    server: {
        host: "127.0.0.1",
        port: 5173,
        strictPort: true,
        open: "/index.html",
        
            // Izinkan hostname ngrok saat pengujian.
            // Ganti dengan hostname tunnel yang kamu gunakan.
            allowedHosts: [
                "localhost",
                "127.0.0.1",
                "italicize-playhouse-down.ngrok-free.dev",
            ],

        // Chat AI: "/api/..." diteruskan ke backend (port 5000) di laptop.
        // Jadi chat tetap jalan saat web dibuka dari HP.
        proxy: {
            "/api": "http://127.0.0.1:5000",
        },
    },

    preview: {
        host: "127.0.0.1",
        port: 4173,
        strictPort: true,
    },

    build: {
        outDir: "../dist",
        emptyOutDir: true,

        rollupOptions: {
            input: {
                homepage: fileURLToPath(
                    new URL(
                        "./frontend/index.html",
                        import.meta.url
                    )
                ),

                dashboardAdmin: fileURLToPath(
                    new URL(
                        "./frontend/dashboard-admin/dashboard-admin.html",
                        import.meta.url
                    )
                ),

                erp: fileURLToPath(
                    new URL(
                        "./frontend/erp/erp.html",
                        import.meta.url
                    )
                ),

                dashboardUser: fileURLToPath(
                    new URL(
                        "./frontend/dashboard-user/dashboard-user.html",
                        import.meta.url
                    )
                ),
            },
        },
    },
});