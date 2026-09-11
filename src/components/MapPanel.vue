<script setup lang="ts">
import { computed, ref } from "vue";
import { lonLatToWorld, tileUrl, worldToLonLat } from "@shared/tile";
import { LAYERS, useTileScopeContext, type GridMode } from "@/composables/useTileScope";

const {
  center,
  zoom,
  selected,
  layer,
  gridMode,
  map,
  base,
  attribution,
  terrain,
  terrainCells,
  setViewport,
  chooseAt,
  changeZoom,
  selectGridMode,
  resetCenter,
} = useTileScopeContext();

/** 可选的网格方案（对应地形 / XYZ 两套切片规则）。 */
const GRID_MODES: GridMode[] = ["xyz", "terrain"];

const drag = ref<{ x: number; y: number; wx: number; wy: number } | null>(null);

/** 舞台上的修饰类：对比滤镜 / 底图类型 / 网格方案。 */
const stageClass = computed(() => ({
  contrast: layer.value === "contrast",
  imagery: layer.value === "imagery",
  terrain: layer.value === "terrain",
  "scheme-terrain": gridMode.value === "terrain",
}));

const stageStyle = computed(() => ({
  width: `${map.value.w}px`,
  height: `${map.value.h}px`,
  left: "50%",
  top: "50%",
  transform: "translate(-50%,-50%)",
}));

function onWheel(e: WheelEvent) {
  changeZoom(zoom.value + (e.deltaY < 0 ? 1 : -1), { x: e.clientX, y: e.clientY });
}

function onPointerDown(e: PointerEvent) {
  if ((e.target as HTMLElement).closest("button,input,a")) return;
  const w = lonLatToWorld(center.value.lon, center.value.lat, zoom.value);
  drag.value = { x: e.clientX, y: e.clientY, wx: w.x, wy: w.y };
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  const d = drag.value;
  if (!d) return;
  center.value = worldToLonLat(d.wx - (e.clientX - d.x), d.wy - (e.clientY - d.y), zoom.value);
}

function onPointerUp(e: PointerEvent) {
  const d = drag.value;
  if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) chooseAt(e.clientX, e.clientY);
  drag.value = null;
}
</script>

<template>
  <div
    class="map-panel"
    :ref="setViewport"
    @wheel.prevent="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
  >
    <div class="tile-stage" :class="stageClass" :style="stageStyle">
      <div
        v-for="t in map.tiles"
        :key="`${t.x}-${t.y}`"
        class="tile-cell"
        :class="{ selected: selected.x === t.x && selected.y === t.y && selected.z === zoom }"
        :style="{ left: `${t.left}px`, top: `${t.top}px` }"
      >
        <img :src="tileUrl(base, t.x, t.y, zoom)" alt="" draggable="false" />
        <div class="tile-grid">
          <span><b>{{ zoom }}</b><i>/</i>{{ t.x }}<i>/</i>{{ t.y }}</span>
        </div>
      </div>

      <div
        v-for="t in terrainCells"
        :key="`t-${t.x}-${t.y}`"
        class="tgrid-cell"
        :class="{ selected: terrain.tile.x === t.x && terrain.tile.y === t.y && selected.z === zoom }"
        :style="{ left: `${t.left}px`, top: `${t.top}px`, width: `${t.width}px`, height: `${t.height}px` }"
      >
        <span><b>{{ zoom }}</b><i>/</i>{{ t.x }}<i>/</i>{{ t.y }}</span>
      </div>
    </div>

    <div class="map-vignette" />

    <div class="map-controls">
      <button aria-label="放大" @click="changeZoom(zoom + 1)">+</button>
      <button aria-label="缩小" @click="changeZoom(zoom - 1)">−</button>
      <button aria-label="重置方向" @click="resetCenter()">◆</button>
    </div>

    <div class="layer-switch">
      <button
        v-for="l in LAYERS"
        :key="l.key"
        :class="{ active: layer === l.key }"
        @click="layer = l.key"
      >
        {{ l.label }}
      </button>
    </div>

    <div class="grid-switch">
      <button
        v-for="k in GRID_MODES"
        :key="k"
        :class="{ active: gridMode === k }"
        @click="selectGridMode(k)"
      >
        {{ k === "xyz" ? "XYZ 切片" : "地形切片" }}
      </button>
    </div>

    <div class="map-status">
      <span class="pulse" /> 网格已开启 <i /> Z {{ zoom }} <i /> {{ center.lon.toFixed(4) }}°,
      {{ center.lat.toFixed(4) }}°
    </div>

    <div class="attribution">{{ attribution }}</div>
  </div>
</template>
