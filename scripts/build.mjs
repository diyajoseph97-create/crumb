// Builds the whole app into docs/index.html, which GitHub Pages serves.
// Run: npm run build
import { build, transform } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const result = await build({
  entryPoints: [resolve(root, "src/main.tsx")],
  bundle: true,
  minify: true,
  write: false,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  target: "es2020",
  // Preact is a drop-in, much smaller stand-in for React (about 15 KB instead of 170 KB).
  alias: { "@": root, react: "preact/compat", "react-dom/client": "preact/compat/client", "react-dom": "preact/compat", "react/jsx-runtime": "preact/jsx-runtime" },
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "error",
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = (await transform(readFileSync(resolve(root, "styles/globals.css"), "utf8"), { loader: "css", minify: true, target: ["chrome100", "safari15"] })).code;
const icon = readFileSync(resolve(root, "public/icons/icon.svg"), "utf8");
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#fdf6ec" />
<link rel="manifest" href="manifest.webmanifest" />
<link rel="apple-touch-icon" href="icons/icon-192.png" />
<meta name="robots" content="noindex, nofollow" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="Crumb" />
<title>Crumb's Cookbook</title>
<link rel="preload" href="fonts/fraunces-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin />
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(icon)}" />
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>`;
// Start clean so old files never linger (empties docs/ but keeps the folder itself).
mkdirSync(resolve(root, "docs"), { recursive: true });
for (const f of readdirSync(resolve(root, "docs"))) rmSync(resolve(root, "docs", f), { recursive: true, force: true });
writeFileSync(resolve(root, "docs/index.html"), html);
writeFileSync(resolve(root, "docs/.nojekyll"), "");
cpSync(resolve(root, "fonts"), resolve(root, "docs/fonts"), { recursive: true });
cpSync(resolve(root, "public"), resolve(root, "docs"), { recursive: true });
// Stamp the service worker with this build, so each deploy refreshes the offline copy.
const stamp = createHash("sha1").update(html).digest("hex").slice(0, 10);
writeFileSync(resolve(root, "docs/sw.js"), readFileSync(resolve(root, "public/sw.js"), "utf8").replace("__BUILD__", stamp));
writeFileSync(resolve(root, "docs/robots.txt"), "User-agent: *\nDisallow: /\n");
console.log("Built docs/index.html", Math.round(html.length / 1024) + " KB");
