// 从唯一来源 shared/tile.js 生成 github-pages/tile.js。
// github-pages/ 目录会被 GitHub Pages 原样上传，因此共享模块必须落到该目录下。
// 本脚本只依赖 Node 内置模块，无需安装任何依赖，适合在 CI 中运行。
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "shared", "tile.js");
const dest = resolve(root, "github-pages", "tile.js");

await mkdir(dirname(dest), { recursive: true });
await copyFile(src, dest);
console.log(`[build-static] ${src} → ${dest}`);
