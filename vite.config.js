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