<script setup lang="ts">
import { MAX_Z, MIN_Z, quadKey, terrainTilePath, tileCenterText } from "@shared/tile";
import { useTileScopeContext } from "@/composables/useTileScope";

const { selected, zoom, bounds, tileCenterLL, terrain, selectedTileUrl, copy, changeZoom } =
  useTileScopeContext();

function onZoomInput(e: Event) {
  changeZoom(Number((e.target as HTMLInputElement).value));
}
</script>

<template>
  <aside class="inspector">
    <div class="inspector-head">
      <div><span class="eyebrow">TILE INSPECTOR</span><h1>切片检查器</h1></div>
      <span class="live"><i /> LIVE</span>
    </div>
    <p class="hint">点击地图网格以检查该位置的切片信息。</p>

    <div class="xyz-card">
      <div class="xyz-label">
        当前 XYZ 坐标
        <button @click="copy(`${selected.z}/${selected.x}/${selected.y}`)">复制</button>
      </div>
      <div class="xyz-values">
        <div><span>Z</span><strong>{{ selected.z }}</strong></div>
        <em>/</em>
        <div><span>X</span><strong>{{ selected.x }}</strong></div>
        <em>/</em>
        <div><span>Y</span><strong>{{ selected.y }}</strong></div>
      </div>
    </div>

    <section class="data-section">
      <h2>选中位置（点击点）</h2>
      <div class="coordinate-row">
        <div><span>经度 LONGITUDE</span><b>{{ selected.lon.toFixed(6) }}°</b></div>
        <div><span>纬度 LATITUDE</span><b>{{ selected.lat.toFixed(6) }}°</b></div>
      </div>
    </section>

    <section class="data-section">
      <h2>
        切片中心
        <button class="section-copy" @click="copy(tileCenterText(selected.x, selected.y, selected.z))">
          复制坐标
        </button>
      </h2>
      <div class="coordinate-row">
        <div><span>经度 LONGITUDE</span><b>{{ tileCenterLL.lon.toFixed(6) }}°</b></div>
        <div><span>纬度 LATITUDE</span><b>{{ tileCenterLL.lat.toFixed(6) }}°</b></div>
      </div>
    </section>

    <section class="data-section">
      <h2>切片属性</h2>
      <dl>
        <div>
          <dt>QuadKey</dt>
          <dd>
            {{ quadKey(selected.x, selected.y, selected.z) }}
            <button @click="copy(quadKey(selected.x, selected.y, selected.z))">⧉</button>
          </dd>
        </div>
        <div><dt>切片尺寸</dt><dd>256 × 256 px</dd></div>
        <div><dt>坐标系</dt><dd>EPSG:3857</dd></div>
        <div><dt>切片方案</dt><dd>XYZ / Slippy Map</dd></div>
      </dl>
    </section>

    <section class="data-section">
      <h2>地理边界</h2>
      <div class="bounds">
        <div>
          <span>西北 NW</span>
          <code>{{ bounds.nw.lon.toFixed(5) }}, {{ bounds.nw.lat.toFixed(5) }}</code>
        </div>
        <div>
          <span>东南 SE</span>
          <code>{{ bounds.se.lon.toFixed(5) }}, {{ bounds.se.lat.toFixed(5) }}</code>
        </div>
      </div>
    </section>

    <section class="data-section">
      <h2>
        地形切片 · Quantized-Mesh
        <button
          class="section-copy"
          @click="copy(terrainTilePath(terrain.tile.x, terrain.tile.y, selected.z))"
        >
          复制路径
        </button>
      </h2>
      <dl>
        <div><dt>Z / X / Y</dt><dd>{{ selected.z }} / {{ terrain.tile.x }} / {{ terrain.tile.y }}</dd></div>
        <div><dt>网格</dt><dd>EPSG:4326 四叉树 · 2^{{ selected.z + 1 }}×2^{{ selected.z }}</dd></div>
        <div><dt>Y 方向</dt><dd>自南向北（TMS）</dd></div>
        <div><dt>路径</dt><dd>{{ terrainTilePath(terrain.tile.x, terrain.tile.y, selected.z) }}</dd></div>
      </dl>
      <div class="bounds">
        <div>
          <span>西南 SW</span>
          <code>{{ terrain.bounds.south.toFixed(5) }}, {{ terrain.bounds.west.toFixed(5) }}</code>
        </div>
        <div>
          <span>东北 NE</span>
          <code>{{ terrain.bounds.north.toFixed(5) }}, {{ terrain.bounds.east.toFixed(5) }}</code>
        </div>
      </div>
    </section>

    <div class="zoom-scale">
      <div><span>缩放级别</span><b>Z {{ zoom }}</b></div>
      <input type="range" :min="MIN_Z" :max="MAX_Z" :value="zoom" @input="onZoomInput" />
      <div class="scale-label"><span>世界</span><span>街道</span><span>建筑</span></div>
    </div>

    <button class="url-button" @click="copy(selectedTileUrl)">复制切片 URL <span>→</span></button>
  </aside>
</template>
