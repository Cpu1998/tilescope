<script setup lang="ts">
import { useTileScopeContext } from "@/composables/useTileScope";

const { query, search, locate } = useTileScopeContext();
</script>

<template>
  <header class="topbar">
    <div class="brand">
      <span class="brand-mark">N</span>
      <div><strong>TileScope</strong><small>WEB MERCATOR EXPLORER</small></div>
    </div>

    <div class="search-wrap">
      <span class="search-icon">⌕</span>
      <input
        v-model="query"
        placeholder="搜索城市 / 经纬度 / 切片 Z/X/Y / 地形 .terrain…"
        aria-label="搜索地点"
        @keydown.enter="search()"
      />
      <kbd>↵</kbd>
    </div>

    <div class="header-actions">
      <button @click="locate()">◎ <span>定位</span></button>
      <button class="icon-button" aria-label="帮助">?</button>
    </div>
  </header>
</template>
