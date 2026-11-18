// Builds the whole app into docs/index.html, which GitHub Pages serves.
// Run: npm run build
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { resolve, dirname } from "node:path";
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
  alias: { "@": root },
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "error",
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = readFileSync(resolve(root, "styles/globals.css"), "utf8");
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#c9331f"/><circle cx="22" cy="40" r="8" fill="#ffd45c"/><circle cx="40" cy="26" r="10" fill="#fff8ee"/><circle cx="44" cy="46" r="5" fill="#f58a1f"/></svg>`;
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#fff8ee" />
<meta name="robots" content="noindex, nofollow" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="Crumb" />
<title>Crumb</title>
<link rel="preload" href="fonts/vt323-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin />
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(icon)}" />
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>`;
mkdirSync(resolve(root, "docs"), { recursive: true });
writeFileSync(resolve(root, "docs/index.html"), html);
writeFileSync(resolve(root, "docs/.nojekyll"), "");
cpSync(resolve(root, "fonts"), resolve(root, "docs/fonts"), { recursive: true });
writeFileSync(resolve(root, "docs/robots.txt"), "User-agent: *\nDisallow: /\n");
console.log("Built docs/index.html", Math.round(html.length / 1024) + " KB");
