import esbuild from "esbuild";
import { rmSync, mkdirSync, copyFileSync, cpSync, existsSync } from "fs";
import path from "path";

const distDir = "dist";

// 1️⃣ Clean previous build
if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true, force: true });
}
mkdirSync(distDir, { recursive: true });

// 2️⃣ Build JS bundles
await esbuild.build({
  entryPoints: [
    "src/background/background.js",
    "src/content/content.js"
  ],
  bundle: true,
  minify: true,
  outdir: distDir,
  format: "esm",
  target: ["chrome120"],
  logLevel: "info",
});

// 3️⃣ Copy static assets
const staticFiles = ["manifest.json", "src/db_store.js"];
for (const file of staticFiles) {
  const dest = path.join(distDir, path.basename(file));
  copyFileSync(file, dest);
}

// 4️⃣ Copy icons folder if exists
if (existsSync("icons")) {
  cpSync("icons", path.join(distDir, "icons"), { recursive: true });
}

console.log("✅ Build complete. Ready to load from 'dist/'!");
