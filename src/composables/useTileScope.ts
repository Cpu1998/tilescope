/**
 * TileScope 视图状态与交互逻辑（Vue 版）。
 *
 * 由原 React 版 app/page.tsx 的 useState / useMemo / useRef 迁移而来：
 * - useState  -> ref
 * - useMemo   -> computed
 * - useRef    -> ref（视口 DOM 元素由 MapPanel 通过 setViewport 注入）
 *
 * 所有切片计算仍来自单一来源 @/shared/tile，本文件只负责状态编排。
 */
import {
  computed,
  inject,
  provide,
  ref,
  type ComponentPublicInstance,
  type InjectionKey,
  type Ref,
} from "vue";
import {
  ATTRIBUTIONS,
  MAX_Z,
  MIN_Z,
  TILE,
  lonLatToTerrainTile,
  lonLatToWorld,
  parseQuery,
  terrainTileBounds,
  terrainTilePath,
  tileCenter,
  tileUrl,
  visibleTerrainTiles,
  worldToLonLat,
} from "@shared/tile";

/** 底图图层（对比模式是叠加在 OSM 切片上的 CSS 滤镜，实际底图仍是 standard）。 */
export const LAYERS = [
  { key: "standard", label: "标准" },
  { key: "imagery", label: "影像" },
  { key: "terrain", label: "地形" },
  { key: "contrast", label: "对比" },
] as const;

export type LayerKey = (typeof LAYERS)[number]["key"];
/** 网格方案：XYZ（Web 墨卡托）或 terrain（Quantized-Mesh WGS84 地理四叉树）。 */
export type GridMode = "xyz" | "terrain";

export interface LonLat {
  lon: number;
  lat: number;
}

/** 当前选中的切片：XYZ 坐标 + 点击处的经纬度。 */
export interface Selection extends LonLat {
  x: number;
  y: number;
  z: number;
}

/** 瓦片舞台的固定尺寸（与 CSS 中的绝对定位配合，视口外留出缓冲）。 */
const STAGE_W = 1400;
const STAGE_H = 900;

/** 默认中心：北京天安门。 */
const DEFAULT_CENTER: LonLat = { lon: 116.3974, lat: 39.9093 };

export interface TileCell {
  x: number;
  y: number;
  left: number;
  top: number;
}

export function useTileScope() {
  const center = ref<LonLat>({ ...DEFAULT_CENTER });
  const zoom = ref(12);
  const selected = ref<Selection>({ x: 3372, y: 1551, z: 12, lon: 116.3974, lat: 39.9093 });
  const query = ref("");
  const layer = ref<LayerKey>("standard");
  const gridMode = ref<GridMode>("xyz");
  const toast = ref("");

  /** 地图视口 DOM 元素，由 MapPanel 注入，用于把屏幕坐标换算回世界坐标。 */
  const viewport: Ref<HTMLElement | null> = ref(null);

  let toastTimer: number | undefined;

  /** 视口内需要渲染的 XYZ 切片及它们在舞台中的像素位置。 */
  const map = computed(() => {
    const w = STAGE_W;
    const h = STAGE_H;
    const c = lonLatToWorld(center.value.lon, center.value.lat, zoom.value);
    const minX = c.x - w / 2;
    const minY = c.y - h / 2;
    const tiles: TileCell[] = [];
    const n = 2 ** zoom.value;
    for (let y = Math.floor(minY / TILE); y <= Math.floor((minY + h) / TILE); y++) {
      for (let x = Math.floor(minX / TILE); x <= Math.floor((minX + w) / TILE); x++) {
        const tx = ((x % n) + n) % n;
        if (y >= 0 && y < n) tiles.push({ x: tx, y, left: x * TILE - minX, top: y * TILE - minY });
      }
    }
    return { tiles, minX, minY, w, h };
  });

  /** 选中切片的经纬度边界。 */
  const bounds = computed(() => {
    const s = selected.value;
    return {
      nw: worldToLonLat(s.x * TILE, s.y * TILE, s.z),
      se: worldToLonLat((s.x + 1) * TILE, (s.y + 1) * TILE, s.z),
    };
  });

  /** 选中切片的中心点经纬度。 */
  const tileCenterLL = computed(() => tileCenter(selected.value.x, selected.value.y, selected.value.z));

  /** 选中位置对应的 Quantized-Mesh 地形切片（WGS84 地理四叉树，TMS y 自南向北）。 */
  const terrain = computed(() => {
    const s = selected.value;
    const t = lonLatToTerrainTile(s.lon, s.lat, s.z);
    return { tile: t, bounds: terrainTileBounds(t.x, t.y, s.z) };
  });

  /** 地形网格模式：枚举视口内的地形切片（宽恒 128px，高随纬度压扁）。 */
  const terrainCells = computed(() =>
    gridMode.value === "terrain"
      ? visibleTerrainTiles(map.value.minX, map.value.minY, map.value.w, map.value.h, zoom.value)
      : [],
  );

  /** 实际使用的底图键（对比模式是 CSS 滤镜，底图回落到 standard）。 */
  const base = computed<Exclude<LayerKey, "contrast">>(() =>
    layer.value === "contrast" ? "standard" : layer.value,
  );

  /** 当前底图的版权署名。 */
  const attribution = computed(() => ATTRIBUTIONS[base.value]);

  function flash(message: string) {
    toast.value = message;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.value = "";
    }, 2200);
  }

  function copy(value: string) {
    void navigator.clipboard?.writeText(value);
    flash("已复制到剪贴板");
  }

  /** 把舞台元素注册进来，供坐标换算使用。 */
  function setViewport(el: Element | ComponentPublicInstance | null) {
    viewport.value = el instanceof HTMLElement ? el : null;
  }

  /** 点击地图：把屏幕坐标换算成世界坐标，选中落点所在切片。 */
  function chooseAt(clientX: number, clientY: number) {
    const r = viewport.value?.getBoundingClientRect();
    if (!r) return;
    const m = map.value;
    const px = clientX - r.left + (m.w - r.width) / 2;
    const py = clientY - r.top + (m.h - r.height) / 2;
    const wx = m.minX + px;
    const wy = m.minY + py;
    const ll = worldToLonLat(wx, wy, zoom.value);
    selected.value = { x: Math.floor(wx / TILE), y: Math.floor(wy / TILE), z: zoom.value, ...ll };
  }

  /** 缩放：传入 anchorClient 时以鼠标位置为锚点，保持光标下的地理点不动。 */
  function changeZoom(next: number, anchorClient?: { x: number; y: number }) {
    const z = Math.max(MIN_Z, Math.min(MAX_Z, next));
    const m = map.value;
    if (anchorClient) {
      const r = viewport.value?.getBoundingClientRect();
      if (r) {
        const px = anchorClient.x - r.left + (m.w - r.width) / 2;
        const py = anchorClient.y - r.top + (m.h - r.height) / 2;
        const ll = worldToLonLat(m.minX + px, m.minY + py, zoom.value);
        const w2 = lonLatToWorld(ll.lon, ll.lat, z);
        center.value = worldToLonLat(w2.x - px + m.w / 2, w2.y - py + m.h / 2, z);
      }
    }
    zoom.value = z;
    const p = lonLatToWorld(selected.value.lon, selected.value.lat, z);
    selected.value = {
      ...selected.value,
      x: Math.floor(p.x / TILE),
      y: Math.floor(p.y / TILE),
      z,
    };
  }

  function locate() {
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        const lon = p.coords.longitude;
        const lat = p.coords.latitude;
        center.value = { lon, lat };
        const w = lonLatToWorld(lon, lat, zoom.value);
        selected.value = {
          x: Math.floor(w.x / TILE),
          y: Math.floor(w.y / TILE),
          z: zoom.value,
          lon,
          lat,
        };
      },
      () => flash("无法获取位置，请检查浏览器权限"),
    );
  }

  function search() {
    const r = parseQuery(query.value);
    if (r.type === "center") {
      center.value = { lon: r.lon, lat: r.lat };
      return;
    }
    if (r.type === "tile") {
      zoom.value = r.z;
      center.value = { lon: r.lon, lat: r.lat };
      selected.value = { x: r.x, y: r.y, z: r.z, lon: r.lon, lat: r.lat };
      flash("已定位到切片 " + r.z + "/" + r.x + "/" + r.y);
      return;
    }
    if (r.type === "terrain") {
      zoom.value = r.z;
      center.value = { lon: r.lon, lat: r.lat };
      const w = lonLatToWorld(r.lon, r.lat, r.z);
      selected.value = {
        x: Math.floor(w.x / TILE),
        y: Math.floor(w.y / TILE),
        z: r.z,
        lon: r.lon,
        lat: r.lat,
      };
      flash("已定位到地形切片 " + terrainTilePath(r.x, r.y, r.z) + "（TMS 地理网格）");
      return;
    }
    flash(r.message);
  }

  /** 切换到指定网格方案，并提示当前方案语义。 */
  function selectGridMode(mode: GridMode) {
    gridMode.value = mode;
    flash(
      mode === "terrain"
        ? "地形网格：Quantized-Mesh 地理四叉树（TMS，y 自南向北）"
        : "XYZ 网格：Web 墨卡托",
    );
  }

  function resetCenter() {
    center.value = { ...DEFAULT_CENTER };
  }

  /** 选中切片的 URL（供检查器一键复制）。 */
  const selectedTileUrl = computed(() =>
    tileUrl(base.value, selected.value.x, selected.value.y, selected.value.z),
  );

  return {
    // 状态
    center,
    zoom,
    selected,
    query,
    layer,
    gridMode,
    toast,
    // 派生
    map,
    bounds,
    tileCenterLL,
    terrain,
    terrainCells,
    base,
    attribution,
    selectedTileUrl,
    // 方法
    flash,
    copy,
    setViewport,
    chooseAt,
    changeZoom,
    locate,
    search,
    selectGridMode,
    resetCenter,
  };
}

export type TileScope = ReturnType<typeof useTileScope>;

export const TILE_SCOPE_KEY: InjectionKey<TileScope> = Symbol("tilescope");

/** 在 App 根组件调用，创建并向下提供共享作用域。 */
export function provideTileScope(): TileScope {
  const scope = useTileScope();
  provide(TILE_SCOPE_KEY, scope);
  return scope;
}

/** 在后代组件中取用共享作用域。 */
export function useTileScopeContext(): TileScope {
  const scope = inject(TILE_SCOPE_KEY);
  if (!scope) {
    throw new Error("useTileScopeContext() 必须在 provideTileScope() 的后代组件中使用。");
  }
  return scope;
}
