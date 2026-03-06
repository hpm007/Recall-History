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
    "src/content/content.js",
    "src/popup/popup.js",
    "src/options/options.js"
  ],
  bundle: true,
  minify: true,
  outdir: distDir,
  format: "esm",
  target: ["chrome120"],
  logLevel: "info",
});

// 3️⃣ Copy static files
const staticFiles = ["manifest.json", "src/db_store.js"];
for (const file of staticFiles) {
  const dest = path.join(distDir, path.basename(file));
  copyFileSync(file, dest);
}
// copy static folders
const staticFolders = ["src/popup", "src/options", "src/debug"];
for (const folder of staticFolders){
  cpSync(folder, path.join(distDir, folder.split("/")[1]), 
  {recursive: true, filter: (src) => !src.endsWith(".js")});
}
copyFileSync("src/debug/db.js", "dist/debug/db.js");
// 4️⃣ Copy icons folder if exists
if (existsSync("icons")) {
  cpSync("icons", path.join(distDir, "icons"), { recursive: true });
}

console.log("✅ Build complete. Ready to load from 'dist/'!");