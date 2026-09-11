import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/essential"],
  {
    // 让 <script setup lang="ts"> 里的 TS 语法交给 typescript-eslint 解析。
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
      },
    },
  },
  {
    // TS 已负责未定义标识符检查，no-undef 会在 .vue / .mjs 里误报浏览器与 Node 全局。
    rules: { "no-undef": "off" },
  },
  globalIgnores(["dist/**", "build/**", ".wrangler/**", "github-pages/tile.js"]),
]);
