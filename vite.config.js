import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const frontendRoot = fileURLToPath(
    new URL("./frontend/", import.meta.url)
);

export default defineConfig({
    root: frontendRoot,

    appType: "mpa",

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