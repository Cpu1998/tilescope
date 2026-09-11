// shared/tile.js 切片规则回归测试（单一来源，React 版与静态版共用）。
import assert from "node:assert/strict";
import test from "node:test";
import {
  tileUrl,
  ATTRIBUTIONS,
  lonLatToTerrainTile,
  terrainTileBounds,
  terrainTilePath,
  terrainCols,
  terrainRows,
  visibleTerrainTiles,
  terrainTileRectPx,
  parseQuery,
} from "../shared/tile.js";

test("terrain 底图走 ArcGIS /z/y/x 切片规则", () => {
  assert.equal(
    tileUrl("terrain", 3372, 1551, 12),
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/12/1551/3372",
  );
  assert.ok(ATTRIBUTIONS.terrain.includes("Esri"));
});

test("standard / imagery 既有切片规则不回归", () => {
  assert.equal(
    tileUrl("standard", 3372, 1551, 12),
    "https://tile.openstreetmap.org/12/3372/1551.png",
  );
  assert.equal(
    tileUrl("imagery", 3372, 1551, 12),
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/1551/3372",
  );
});

test("地形切片使用 WGS84 地理四叉树（2^(z+1)×2^z，TMS y 自南向北）", () => {
  assert.equal(terrainCols(15), 65536);
  assert.equal(terrainRows(15), 32768);
  // 15/53255/21893.terrain → 湖北石首长江段
  const b = terrainTileBounds(53255, 21893, 15);
  assert.equal(b.west.toFixed(6), "112.538452");
  assert.equal(b.south.toFixed(6), "30.261841");
  assert.equal(b.east.toFixed(6), "112.543945");
  assert.equal(b.north.toFixed(6), "30.267334");
  // 切片中心点应反解回同一片
  const lon = (b.west + b.east) / 2;
  const lat = (b.north + b.south) / 2;
  assert.deepEqual(lonLatToTerrainTile(lon, lat, 15), { x: 53255, y: 21893 });
  assert.equal(terrainTilePath(53255, 21893, 15), "15/53255/21893.terrain");
});

test("地形网格视口枚举：像素矩形宽恒 128，跨 180° 回绕", () => {
  const cells = visibleTerrainTiles(0, 0, 256, 256, 15);
  assert.ok(cells.length > 0);
  // 256px 视口 ≈ 两个 128px 地形片；边界 floor 可能多带一个空条（与墨卡托循环同款行为）
  assert.ok(cells.every(c => c.x >= 0 && c.x <= 2 && Math.abs(c.width - 128) < 1e-9));
  assert.ok(cells.some(c => c.x === 0));
  assert.ok(cells.every(c => c.y >= 0 && c.y < 2 ** 15 && c.left >= -1e-9 && c.top >= -1e-6));

  // 世界右端跨 180°：编号回绕到 0 列，位置连续向右
  const wrapped = visibleTerrainTiles(256 * 2 ** 2 - 64, 1024, 256, 256, 2);
  assert.ok(wrapped.some(c => c.x === 0 && c.left >= 64 - 1e-6));

  // 单片矩形：z15 宽恰为 128px，顶点与墨卡托投影一致
  const r = terrainTileRectPx(53255, 21893, 15);
  assert.ok(Math.abs(r.width - 128) < 1e-9);
  assert.ok(r.height > 0);
});

test("parseQuery 识别 .terrain 后缀 / 完整 URL / 超界自动识别", () => {
  const r1 = parseQuery("15/53255/21893.terrain");
  assert.equal(r1.type, "terrain");
  assert.equal(r1.x, 53255);
  assert.equal(r1.y, 21893);
  assert.equal(r1.z, 15);

  const r2 = parseQuery("https://host/maptiles/terrain/demo/15/53255/21893.terrain");
  assert.equal(r2.type, "terrain");
  assert.equal(r2.x, 53255);

  // x 超出 XYZ 范围但落在地形网格内 → 自动按地形规则解析
  const r3 = parseQuery("15/53255/21893");
  assert.equal(r3.type, "terrain");

  // 正常 XYZ 不受影响
  const r4 = parseQuery("12/3372/1551");
  assert.equal(r4.type, "tile");

  // 超出两套网格范围 → 报错
  assert.equal(parseQuery("15/70000/21893").type, "error");
});
