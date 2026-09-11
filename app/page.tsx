"use client";

import { useMemo, useRef, useState } from "react";
import { TILE, lonLatToWorld, worldToLonLat, quadKey, parseQuery, tileCenter, tileCenterText, tileUrl, ATTRIBUTIONS, MIN_Z, MAX_Z, lonLatToTerrainTile, terrainTileBounds, terrainTilePath } from "@/shared/tile";

const LAYERS = [
  { key: "standard", label: "标准" },
  { key: "imagery", label: "影像" },
  { key: "terrain", label: "地形" },
  { key: "contrast", label: "对比" },
] as const;
type LayerKey = (typeof LAYERS)[number]["key"];

export default function Home() {
  const [center, setCenter] = useState({ lon: 116.3974, lat: 39.9093 });
  const [zoom, setZoom] = useState(12);
  const [selected, setSelected] = useState({ x: 3372, y: 1551, z: 12, lon: 116.3974, lat: 39.9093 });
  const [query, setQuery] = useState("");
  const [layer, setLayer] = useState<LayerKey>("standard");
  const [toast, setToast] = useState("");
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; wx: number; wy: number } | null>(null);

  const map = useMemo(() => {
    const w = 1400, h = 900;
    const c = lonLatToWorld(center.lon, center.lat, zoom);
    const minX = c.x - w / 2, minY = c.y - h / 2;
    const tiles = [];
    for (let y = Math.floor(minY / TILE); y <= Math.floor((minY + h) / TILE); y++) {
      for (let x = Math.floor(minX / TILE); x <= Math.floor((minX + w) / TILE); x++) {
        const n = 2 ** zoom, tx = ((x % n) + n) % n;
        if (y >= 0 && y < n) tiles.push({ x: tx, y, left: x * TILE - minX, top: y * TILE - minY });
      }
    }
    return { tiles, minX, minY, w, h };
  }, [center, zoom]);

  const bounds = useMemo(() => {
    const nw = worldToLonLat(selected.x * TILE, selected.y * TILE, selected.z);
    const se = worldToLonLat((selected.x + 1) * TILE, (selected.y + 1) * TILE, selected.z);
    return { nw, se };
  }, [selected]);

  const tileCenterLL = useMemo(() => tileCenter(selected.x, selected.y, selected.z), [selected]);

  // 选中位置对应的 Quantized-Mesh 地形切片（WGS84 地理四叉树，TMS y 自南向北）
  const terrain = useMemo(() => {
    const t = lonLatToTerrainTile(selected.lon, selected.lat, selected.z);
    return { tile: t, bounds: terrainTileBounds(t.x, t.y, selected.z) };
  }, [selected]);

  // 对比模式是叠加在 OSM 切片上的 CSS 滤镜，实际底图仍是 standard。
  const base = layer === "contrast" ? "standard" : layer;

  function chooseAt(clientX: number, clientY: number) {
    const r = viewport.current?.getBoundingClientRect(); if (!r) return;
    const px = clientX - r.left + (map.w - r.width) / 2;
    const py = clientY - r.top + (map.h - r.height) / 2;
    const wx = map.minX + px, wy = map.minY + py;
    const ll = worldToLonLat(wx, wy, zoom);
    setSelected({ x: Math.floor(wx / TILE), y: Math.floor(wy / TILE), z: zoom, ...ll });
  }

  function changeZoom(next: number, anchorClient?: { x: number; y: number }) {
    const z = Math.max(MIN_Z, Math.min(MAX_Z, next));
    if (anchorClient) {
      // 以鼠标为锚点缩放：保持光标下的地理点在屏幕上不动
      const r = viewport.current?.getBoundingClientRect();
      if (r) {
        const px = anchorClient.x - r.left + (map.w - r.width) / 2;
        const py = anchorClient.y - r.top + (map.h - r.height) / 2;
        const ll = worldToLonLat(map.minX + px, map.minY + py, zoom);
        const w2 = lonLatToWorld(ll.lon, ll.lat, z);
        setCenter(worldToLonLat(w2.x - px + map.w / 2, w2.y - py + map.h / 2, z));
      }
    }
    setZoom(z);
    const p = lonLatToWorld(selected.lon, selected.lat, z);
    setSelected(s => ({ ...s, x: Math.floor(p.x / TILE), y: Math.floor(p.y / TILE), z }));
  }

  function locate() {
    navigator.geolocation?.getCurrentPosition(p => {
      const lon = p.coords.longitude, lat = p.coords.latitude; setCenter({ lon, lat });
      const w = lonLatToWorld(lon, lat, zoom); setSelected({ x: Math.floor(w.x/TILE), y: Math.floor(w.y/TILE), z: zoom, lon, lat });
    }, () => flash("无法获取位置，请检查浏览器权限"));
  }

  function search() {
    const r = parseQuery(query);
    if (r.type === "center") { setCenter({ lon: r.lon, lat: r.lat }); return; }
    if (r.type === "tile") {
      setZoom(r.z); setCenter({ lon: r.lon, lat: r.lat });
      setSelected({ x: r.x, y: r.y, z: r.z, lon: r.lon, lat: r.lat });
      flash("已定位到切片 " + r.z + "/" + r.x + "/" + r.y); return;
    }
    if (r.type === "terrain") {
      setZoom(r.z); setCenter({ lon: r.lon, lat: r.lat });
      const w = lonLatToWorld(r.lon, r.lat, r.z);
      setSelected({ x: Math.floor(w.x / TILE), y: Math.floor(w.y / TILE), z: r.z, lon: r.lon, lat: r.lat });
      flash("已定位到地形切片 " + terrainTilePath(r.x, r.y, r.z) + "（TMS 地理网格）"); return;
    }
    flash(r.message);
  }

  function flash(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2200); }
  function copy(value: string) { navigator.clipboard.writeText(value); flash("已复制到剪贴板"); }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">N</span><div><strong>TileScope</strong><small>WEB MERCATOR EXPLORER</small></div></div>
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()} placeholder="搜索城市 / 经纬度 / 切片 Z/X/Y / 地形 .terrain…" aria-label="搜索地点" />
          <kbd>↵</kbd>
        </div>
        <div className="header-actions"><button onClick={locate}>◎ <span>定位</span></button><button className="icon-button" aria-label="帮助">?</button></div>
      </header>

      <section className="workspace">
        <div className="map-panel" ref={viewport}
          onWheel={e=>{e.preventDefault(); changeZoom(zoom + (e.deltaY < 0 ? 1 : -1), { x: e.clientX, y: e.clientY });}}
          onPointerDown={e=>{if((e.target as HTMLElement).closest("button,input,a"))return; const w=lonLatToWorld(center.lon,center.lat,zoom); drag.current={x:e.clientX,y:e.clientY,wx:w.x,wy:w.y}; e.currentTarget.setPointerCapture(e.pointerId)}}
          onPointerMove={e=>{if(!drag.current)return; const w=drag.current.wx-(e.clientX-drag.current.x), y=drag.current.wy-(e.clientY-drag.current.y); setCenter(worldToLonLat(w,y,zoom));}}
          onPointerUp={e=>{if(drag.current && Math.hypot(e.clientX-drag.current.x,e.clientY-drag.current.y)<5) chooseAt(e.clientX,e.clientY); drag.current=null;}}
        >
          <div className={`tile-stage ${layer === "contrast" ? "contrast" : ""} ${layer === "imagery" || layer === "terrain" ? layer : ""}`} style={{width:map.w,height:map.h,left:"50%",top:"50%",transform:"translate(-50%,-50%)"}}>
            {map.tiles.map(t=><div className={`tile-cell ${selected.x===t.x&&selected.y===t.y&&selected.z===zoom?"selected":""}`} key={`${t.x}-${t.y}`} style={{left:t.left,top:t.top}}>
              <img src={tileUrl(base, t.x, t.y, zoom)} alt="" draggable={false}/>
              <div className="tile-grid"><span><b>{zoom}</b><i>/</i>{t.x}<i>/</i>{t.y}</span></div>
            </div>)}
          </div>
          <div className="map-vignette" />
          <div className="map-controls"><button onClick={()=>changeZoom(zoom+1)} aria-label="放大">+</button><button onClick={()=>changeZoom(zoom-1)} aria-label="缩小">−</button><button onClick={()=>setCenter({lon:116.3974,lat:39.9093})} aria-label="重置方向">◆</button></div>
          <div className="layer-switch">{LAYERS.map(l=><button key={l.key} className={layer===l.key?"active":""} onClick={()=>setLayer(l.key)}>{l.label}</button>)}</div>
          <div className="map-status"><span className="pulse"/> 网格已开启 <i/> Z {zoom} <i/> {center.lon.toFixed(4)}°, {center.lat.toFixed(4)}°</div>
          <div className="attribution">{ATTRIBUTIONS[base]}</div>
        </div>

        <aside className="inspector">
          <div className="inspector-head"><div><span className="eyebrow">TILE INSPECTOR</span><h1>切片检查器</h1></div><span className="live"><i/> LIVE</span></div>
          <p className="hint">点击地图网格以检查该位置的切片信息。</p>

          <div className="xyz-card">
            <div className="xyz-label">当前 XYZ 坐标 <button onClick={()=>copy(`${selected.z}/${selected.x}/${selected.y}`)}>复制</button></div>
            <div className="xyz-values"><div><span>Z</span><strong>{selected.z}</strong></div><em>/</em><div><span>X</span><strong>{selected.x}</strong></div><em>/</em><div><span>Y</span><strong>{selected.y}</strong></div></div>
          </div>

          <section className="data-section"><h2>选中位置（点击点）</h2><div className="coordinate-row"><div><span>经度 LONGITUDE</span><b>{selected.lon.toFixed(6)}°</b></div><div><span>纬度 LATITUDE</span><b>{selected.lat.toFixed(6)}°</b></div></div></section>
          <section className="data-section"><h2>切片中心 <button className="section-copy" onClick={()=>copy(tileCenterText(selected.x,selected.y,selected.z))}>复制坐标</button></h2><div className="coordinate-row"><div><span>经度 LONGITUDE</span><b>{tileCenterLL.lon.toFixed(6)}°</b></div><div><span>纬度 LATITUDE</span><b>{tileCenterLL.lat.toFixed(6)}°</b></div></div></section>
          <section className="data-section"><h2>切片属性</h2><dl>
            <div><dt>QuadKey</dt><dd>{quadKey(selected.x,selected.y,selected.z)} <button onClick={()=>copy(quadKey(selected.x,selected.y,selected.z))}>⧉</button></dd></div>
            <div><dt>切片尺寸</dt><dd>256 × 256 px</dd></div><div><dt>坐标系</dt><dd>EPSG:3857</dd></div><div><dt>切片方案</dt><dd>XYZ / Slippy Map</dd></div>
          </dl></section>
          <section className="data-section"><h2>地理边界</h2><div className="bounds"><div><span>西北 NW</span><code>{bounds.nw.lon.toFixed(5)}, {bounds.nw.lat.toFixed(5)}</code></div><div><span>东南 SE</span><code>{bounds.se.lon.toFixed(5)}, {bounds.se.lat.toFixed(5)}</code></div></div></section>
          <section className="data-section"><h2>地形切片 · Quantized-Mesh <button className="section-copy" onClick={()=>copy(terrainTilePath(terrain.tile.x, terrain.tile.y, selected.z))}>复制路径</button></h2><dl>
            <div><dt>Z / X / Y</dt><dd>{selected.z} / {terrain.tile.x} / {terrain.tile.y}</dd></div>
            <div><dt>网格</dt><dd>EPSG:4326 四叉树 · 2^{selected.z + 1}×2^{selected.z}</dd></div>
            <div><dt>Y 方向</dt><dd>自南向北（TMS）</dd></div>
            <div><dt>路径</dt><dd>{terrainTilePath(terrain.tile.x, terrain.tile.y, selected.z)}</dd></div>
          </dl><div className="bounds"><div><span>西南 SW</span><code>{terrain.bounds.south.toFixed(5)}, {terrain.bounds.west.toFixed(5)}</code></div><div><span>东北 NE</span><code>{terrain.bounds.north.toFixed(5)}, {terrain.bounds.east.toFixed(5)}</code></div></div></section>
          <div className="zoom-scale"><div><span>缩放级别</span><b>Z {zoom}</b></div><input type="range" min={MIN_Z} max={MAX_Z} value={zoom} onChange={e=>changeZoom(Number(e.target.value))}/><div className="scale-label"><span>世界</span><span>街道</span><span>建筑</span></div></div>
          <button className="url-button" onClick={()=>copy(tileUrl(base, selected.x, selected.y, selected.z))}>复制切片 URL <span>→</span></button>
        </aside>
      </section>
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
