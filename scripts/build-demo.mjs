// Builds demo/dist/index.html: the whole Crumb interface in one file, using demo data.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const result = await build({
  entryPoints: [resolve(root, "demo/entry.tsx")],
  bundle: true,
  minify: true,
  write: false,
  format: "iife",
  jsx: "automatic",
  target: "es2020",
  alias: { "@": root },
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "error",
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = readFileSync(resolve(root, "app/globals.css"), "utf8");
const icon = readFileSync(resolve(root, "public/icon.svg"), "utf8");
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#fff8ee" />
<title>Crumb</title>
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(icon)}" />
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>`;
mkdirSync(resolve(root, "demo/dist"), { recursive: true });
writeFileSync(resolve(root, "demo/dist/index.html"), html);
console.log("Built demo/dist/index.html", Math.round(html.length / 1024) + " KB");
