// shared/tile.js 切片规则回归测试（单一来源，React 版与静态版共用）。
import assert from "node:assert/strict";
import test from "node:test";
import { tileUrl, ATTRIBUTIONS } from "../shared/tile.js";

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
