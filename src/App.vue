<script setup lang="ts">
import TopBar from "@/components/TopBar.vue";
import MapPanel from "@/components/MapPanel.vue";
import TileInspector from "@/components/TileInspector.vue";
import { provideTileScope } from "@/composables/useTileScope";

// 根组件创建共享作用域，TopBar / MapPanel / Inspector 通过 inject 取用。
const { toast } = provideTileScope();
</script>

<template>
  <main class="app-shell">
    <TopBar />
    <section class="workspace">
      <MapPanel />
      <TileInspector />
    </section>
    <div v-if="toast" class="toast">{{ toast }}</div>
  </main>
</template>
