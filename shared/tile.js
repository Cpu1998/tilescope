/**
 * TileScope 共享纯逻辑 —— 单一来源。
 *
 * app/page.tsx（React 版）与 github-pages/（静态版）都从这里取逻辑，
 * 避免两份实现分叉。github-pages/tile.js 由 scripts/build-static.mjs
 * 从本文件复制生成，请勿直接编辑那个生成文件。
 */

/** @typedef {{ lon: number, lat: number }} LonLat */

/**
 * 搜索解析结果（判别联合）。
 * @typedef {(
 *   | { type: "center", lon: number, lat: number }
 *   | { type: "tile", x: number, y: number, z: number, lon: number, lat: number }
 *   | { type: "error", message: string }
 * )} QueryResult
 */

export const TILE = 256;
export const MIN_Z = 2;
export const MAX_Z = 19;

/** @type {Record<string, [number, number]>} */
export const cities = {
  北京: [116.3974, 39.9093],
  上海: [121.4737, 31.2304],
  深圳: [114.0579, 22.5431],
  杭州: [120.1551, 30.2741],
  成都: [104.0665, 30.5723],
  广州: [113.2644, 23.1291],
};

/**
 * 经纬度 → 世界像素坐标（Web Mercator，原点在左上角）。
 * @param {number} lon
 * @param {number} lat
 * @param {number} z
 * @returns {{ x: number, y: number }}
 */
export function lonLatToWorld(lon, lat, z) {
  const s = TILE * 2 ** z;
  const n = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * s,
    y: (0.5 - Math.log((1 + n) / (1 - n)) / (4 * Math.PI)) * s,
  };
}

/**
 * 世界像素坐标 → 经纬度。
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {LonLat}
 */
export function worldToLonLat(x, y, z) {
  const s = TILE * 2 ** z;
  const n = Math.PI - (2 * Math.PI * y) / s;
  return {
    lon: (x / s) * 360 - 180,
    lat: (180 / Math.PI) * Math.atan(Math.sinh(n)),
  };
}

/**
 * 切片 QuadKey（Bing 编码）。
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {string}
 */
export function quadKey(x, y, z) {
  let q = "";
  for (let i = z; i > 0; i--) {
    let d = 0;
    const m = 1 << (i - 1);
    if (x & m) d += 1;
    if (y & m) d += 2;
    q += d;
  }
  return q;
}

/**
 * 切片中心点的经纬度。
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {LonLat}
 */
export function tileCenter(x, y, z) {
  const n = 2 ** z;
  const wx = ((x % n) + n) % n; // 跨经度 180° 平移后 x 可能越界，取模回到 [0, n)
  return worldToLonLat((wx + 0.5) * TILE, (y + 0.5) * TILE, z);
}

/**
 * 切片中心坐标文本（"lon, lat"，六位小数），供一键复制到剪贴板。
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {string}
 */
export function tileCenterText(x, y, z) {
  const c = tileCenter(x, y, z);
  return `${c.lon.toFixed(6)}, ${c.lat.toFixed(6)}`;
}

/**
 * 底图种类键：standard = OSM 矢量，imagery = Esri 世界影像。
 * @typedef {"standard" | "imagery"} BasemapKey
 */

/**
 * 底图切片 URL。注意两家服务的路径顺序不同：
 * OSM 是 /z/x/y.png，ArcGIS World Imagery 是 /z/y/x（无扩展名）。
 * @param {BasemapKey} basemap
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {string}
 */
export function tileUrl(basemap, x, y, z) {
  if (basemap === "imagery") {
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  }
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

/** 各底图的署名（对比模式仍基于 OSM 切片，用 standard 署名）。 */
export const ATTRIBUTIONS = {
  standard: "© OpenStreetMap contributors",
  imagery: "Esri, Maxar, Earthstar Geographics",
};

/**
 * 解析搜索输入：城市名 / 经纬度 / XYZ 切片坐标。
 *
 * - 命中城市名或两个数字（经纬度）→ `{ type: "center" }`，仅平移地图中心。
 * - 三个数字（Z/X/Y）且在合法范围内 → `{ type: "tile" }`，定位到该切片
 *   （中心点经纬度 + 选中切片 + 缩放级别）。
 * - 其它情况 → `{ type: "error", message }`，由调用方提示用户。
 *
 * @param {string} input
 * @returns {QueryResult}
 */
export function parseQuery(input) {
  const v = input.trim();
  const hit = cities[v];
  if (hit) return { type: "center", lon: hit[0], lat: hit[1] };

  const c = v.split(/[/,，\s]+/).map(Number);

  if (c.length === 3 && c.every(Number.isFinite)) {
    const z = c[0] | 0;
    const x = c[1] | 0;
    const y = c[2] | 0;
    const n = 2 ** z;
    if (z < MIN_Z || z > MAX_Z) {
      return { type: "error", message: `缩放级别需在 ${MIN_Z}-${MAX_Z} 之间` };
    }
    if (x < 0 || x >= n || y < 0 || y >= n) {
      return { type: "error", message: `Z${z} 切片范围 0-${n - 1}` };
    }
    return { type: "tile", x, y, z, ...tileCenter(x, y, z) };
  }

  if (c.length >= 2 && c.every(Number.isFinite)) {
    return { type: "center", lon: c[0], lat: c[1] };
  }

  return {
    type: "error",
    message: "试试“上海”、经纬度 121.47,31.23 或切片 12/3372/1551",
  };
}
