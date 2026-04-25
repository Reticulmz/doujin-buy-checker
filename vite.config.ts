import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import UnoCSS from "unocss/vite";
import { VitePWA } from "vite-plugin-pwa";
import license from "rollup-plugin-license";
import { resolve } from "path";
import { execSync } from "child_process";

function m3ScrapeProxy() {
  return {
    name: "m3-scrape-proxy",
    configureServer(server: any) {
      server.middlewares.use("/api/m3-scrape", async (req: any, res: any) => {
        const reqUrl = new URL(req.url, "http://localhost");
        const targetUrl = reqUrl.searchParams.get("url");
        if (!targetUrl) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "url parameter required" }));
          return;
        }
        try {
          const response = await fetch(targetUrl);
          if (!response.ok) {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: `Upstream ${response.status}` }));
            return;
          }
          const html = await response.text();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(html);
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    },
  };
}

const commitHash = (() => {
  try { return execSync("git rev-parse --short HEAD").toString().trim(); }
  catch { return "unknown"; }
})();

export default defineConfig({
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  plugins: [
    m3ScrapeProxy(),
    UnoCSS(),
    solid(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      devOptions: { enabled: true },
      manifest: {
        name: "同人即売会 購入チェッカー",
        short_name: "購入チェッカー",
        description: "同人即売会の購入リストを管理するPWA",
        theme_color: "#2563eb",
        background_color: "#0f172a",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // 初回はシェルに必要な最小限のみプリキャッシュ
        globPatterns: ["**/*.{css,html,svg,png,woff2}", "assets/index-*.js"],
        runtimeCaching: [
          {
            // lazy loadされるページチャンクはナビゲーション時にキャッシュ
            urlPattern: /\/assets\/.+\.js$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "page-chunks",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("lucide-solid")) return "icons";
        },
      },
      plugins: [
        license({
          thirdParty: {
            output: resolve(__dirname, "dist", "third-party-licenses.txt"),
            includePrivate: false,
          },
        }),
      ],
    },
  },
  server: {
    proxy: {
      "/api/share": {
        target: "https://doujin-buy-checker.pages.dev",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "~": resolve(__dirname, "src"),
    },
  },
});
