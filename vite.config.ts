import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin";

export default defineConfig({
  plugins: [vue(), sites()],
  resolve: {
    // 与 tsconfig.json 的 paths 保持一致。
    alias: {
      // 前端源码
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // 与静态版共用的纯逻辑单一来源
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
});
