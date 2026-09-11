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
 *   | { type: "terrain", x: number, y: number, z: number, lon: number, lat: number }
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
 * ========== 地形切片（Quantized-Mesh）规则 ==========
 *
 * 与上方 Web Mercator XYZ 规则不同，Cesium 地形切片（ctb-tile 产物，
 * layer.json 声明 scheme "tms"）使用 WGS84 地理四叉树网格：
 *
 * - 第 z 层共 2^(z+1) 列 × 2^z 行（第 0 层全球 2×1，从经度对半切两次起步）
 * - x 自西向东（同 XYZ），y 自南向北（TMS，与 XYZ 相反）
 * - 每片跨度 360/2^(z+1)° × 180/2^z°（度数正方形，非墨卡托）
 * - 路径 {z}/{x}/{y}.terrain，内容为量化网格二进制（非图片）
 */

/** 地形切片第 z 层的列数（2^(z+1)）。 */
export function terrainCols(z) {
  return 2 ** (z + 1);
}

/** 地形切片第 z 层的行数（2^z）。 */
export function terrainRows(z) {
  return 2 ** z;
}

/**
 * 经纬度 → 地形切片编号。y 自南向北计数（TMS）。
 * @param {number} lon
 * @param {number} lat
 * @param {number} z
 * @returns {{ x: number, y: number }}
 */
export function lonLatToTerrainTile(lon, lat, z) {
  return {
    x: Math.min(terrainCols(z) - 1, Math.max(0, Math.floor(((lon + 180) / 360) * terrainCols(z)))),
    y: Math.min(terrainRows(z) - 1, Math.max(0, Math.floor(((lat + 90) / 180) * terrainRows(z)))),
  };
}

/**
 * 地形切片的地理边界（度，WGS84）。
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {{ west: number, south: number, east: number, north: number }}
 */
export function terrainTileBounds(x, y, z) {
  const lonSpan = 360 / terrainCols(z);
  const latSpan = 180 / terrainRows(z);
  return {
    west: -180 + x * lonSpan,
    east: -180 + (x + 1) * lonSpan,
    south: -90 + y * latSpan,
    north: -90 + (y + 1) * latSpan,
  };
}

/**
 * 地形切片相对路径（ctb-tile 产物命名，服务前缀由具体部署决定）。
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {string}
 */
export function terrainTilePath(x, y, z) {
  return `${z}/${x}/${y}.terrain`;
}

/** Web 墨卡托可表达的纬度上限（约 ±85.0511°），用于把地形网格投到像素平面。 */
const MERCATOR_MAX_LAT = 85.0511287798066;

/**
 * 单个地形切片在 Web 墨卡托世界像素平面上的矩形。
 * 列数是 XYZ 的两倍，因此宽度恒为 128px；纬度超出墨卡托范围的
 * 极地片按 ±85.0511° 裁剪。
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {{ left: number, top: number, width: number, height: number }}
 */
export function terrainTileRectPx(x, y, z) {
  const s = TILE * 2 ** z;
  const b = terrainTileBounds(x, y, z);
  const north = Math.min(b.north, MERCATOR_MAX_LAT);
  const south = Math.max(b.south, -MERCATOR_MAX_LAT);
  const top = lonLatToWorld(0, north, z).y;
  const bottom = lonLatToWorld(0, south, z).y;
  return {
    left: (x / terrainCols(z)) * s,
    top,
    width: s / terrainCols(z),
    height: bottom - top,
  };
}

/**
 * 枚举视口（世界像素区间）内可见的地形切片，返回相对视口左上角的像素矩形。
 * 地图仍按 Web 墨卡托渲染，因此高纬度片会被压扁；跨经度 180° 时
 * 编号回绕到 [0, 2^(z+1))，位置连续延伸。
 * @param {number} minX 视口左上角的世界像素 x
 * @param {number} minY 视口左上角的世界像素 y
 * @param {number} w 视口宽（px）
 * @param {number} h 视口高（px）
 * @param {number} z
 * @returns {{ x: number, y: number, left: number, top: number, width: number, height: number }[]}
 */
export function visibleTerrainTiles(minX, minY, w, h, z) {
  const s = TILE * 2 ** z;
  const cols = terrainCols(z);
  const rows = terrainRows(z);
  const lonSpan = 360 / cols;
  const latSpan = 180 / rows;
  const cw = s / cols;
  const lonWest = (minX / s) * 360 - 180;
  const lonEast = ((minX + w) / s) * 360 - 180;
  const clampLat = (v) => Math.min(MERCATOR_MAX_LAT, Math.max(-MERCATOR_MAX_LAT, v));
  const latTop = clampLat(worldToLonLat(0, minY, z).lat);
  const latBottom = clampLat(worldToLonLat(0, minY + h, z).lat);
  const x0 = Math.floor((lonWest + 180) / lonSpan);
  const x1 = Math.floor((lonEast + 180) / lonSpan);
  const y0 = Math.max(0, Math.floor((latBottom + 90) / latSpan));
  const y1 = Math.min(rows - 1, Math.floor((latTop + 90) / latSpan));
  const cells = [];
  for (let ry = y0; ry <= y1; ry++) {
    for (let rx = x0; rx <= x1; rx++) {
      const tx = ((rx % cols) + cols) % cols;
      const r = terrainTileRectPx(tx, ry, z);
      cells.push({ x: tx, y: ry, left: rx * cw - minX, top: r.top - minY, width: r.width, height: r.height });
    }
  }
  return cells;
}

/**
 * 地形切片编号 → 定位结果（含切片中心经纬度）。
 * @param {number} z
 * @param {number} x
 * @param {number} y
 * @returns {QueryResult}
 */
function terrainQuery(z, x, y) {
  if (z < MIN_Z || z > MAX_Z) {
    return { type: "error", message: `缩放级别需在 ${MIN_Z}-${MAX_Z} 之间` };
  }
  if (x < 0 || x >= terrainCols(z) || y < 0 || y >= terrainRows(z)) {
    return {
      type: "error",
      message: `Z${z} 地形切片范围 x 0-${terrainCols(z) - 1} / y 0-${terrainRows(z) - 1}`,
    };
  }
  const b = terrainTileBounds(x, y, z);
  return {
    type: "terrain",
    x,
    y,
    z,
    lon: (b.west + b.east) / 2,
    lat: (b.north + b.south) / 2,
  };
}

/**
 * 底图种类键：standard = OSM 矢量，imagery = Esri 世界影像，terrain = Esri 世界地形图。
 * @typedef {"standard" | "imagery" | "terrain"} BasemapKey
 */

/**
 * 底图切片 URL。注意两类服务的路径顺序不同：
 * OSM 是 /z/x/y.png，ArcGIS（影像/地形）是 /z/y/x（无扩展名）。
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
  if (basemap === "terrain") {
    // 世界地形图（等高线 + 地貌渲染），与影像同源，全球覆盖到 Z19
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${y}/${x}`;
  }
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

/** 各底图的署名（对比模式仍基于 OSM 切片，用 standard 署名）。 */
export const ATTRIBUTIONS = {
  standard: "© OpenStreetMap contributors",
  imagery: "Esri, Maxar, Earthstar Geographics",
  terrain: "Esri, HERE, Garmin, FAO, NOAA, USGS",
};

/**
 * 解析搜索输入：城市名 / 经纬度 / XYZ 切片坐标 / 地形切片坐标。
 *
 * - 命中城市名或两个数字（经纬度）→ `{ type: "center" }`，仅平移地图中心。
 * - 三个数字（Z/X/Y）且在 XYZ 合法范围内 → `{ type: "tile" }`。
 * - 以 `.terrain` 结尾（支持裸编号或完整 URL 取末段），
 *   或 x 超出 XYZ 范围但落在地形网格内 → `{ type: "terrain" }`，
 *   按 WGS84 地理四叉树（TMS，y 自南向北）解析。
 * - 其它情况 → `{ type: "error", message }`，由调用方提示用户。
 *
 * @param {string} input
 * @returns {QueryResult}
 */
export function parseQuery(input) {
  const v = input.trim();
  const hit = cities[v];
  if (hit) return { type: "center", lon: hit[0], lat: hit[1] };

  // 地形切片：显式 .terrain 后缀，支持裸编号或完整 URL（取末段 z/x/y）
  const t = v.match(/(\d+)[^\d]+(\d+)[^\d]+(\d+)\s*\.terrain\s*$/i);
  if (t) return terrainQuery(t[1] | 0, t[2] | 0, t[3] | 0);

  const c = v.split(/[/,，\s]+/).map(Number);

  if (c.length === 3 && c.every(Number.isFinite)) {
    const z = c[0] | 0;
    const x = c[1] | 0;
    const y = c[2] | 0;
    const n = 2 ** z;
    if (z < MIN_Z || z > MAX_Z) {
      return { type: "error", message: `缩放级别需在 ${MIN_Z}-${MAX_Z} 之间` };
    }
    // x 超出 XYZ 范围但落在地形网格内 → 按地形切片（地理四叉树 TMS）解析
    if (x >= n && x < n * 2 && y >= 0 && y < n) {
      return terrainQuery(z, x, y);
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
    message: "试试“上海”、经纬度 121.47,31.23、切片 12/3372/1551 或地形 15/53255/21893.terrain",
  };
}
