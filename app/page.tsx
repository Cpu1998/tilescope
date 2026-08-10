"use client";

import { useMemo, useRef, useState } from "react";

const TILE = 256;
const cities: Record<string, [number, number]> = {
  北京: [116.3974, 39.9093], 上海: [121.4737, 31.2304], 深圳: [114.0579, 22.5431],
  杭州: [120.1551, 30.2741], 成都: [104.0665, 30.5723], 广州: [113.2644, 23.1291],
};

function lonLatToWorld(lon: number, lat: number, z: number) {
  const scale = TILE * 2 ** z;
  const x = ((lon + 180) / 360) * scale;
  const s = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function worldToLonLat(x: number, y: number, z: number) {
  const scale = TILE * 2 ** z;
  const lon = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lon, lat };
}

function quadKey(x: number, y: number, z: number) {
  let q = "";
  for (let i = z; i > 0; i--) {
    let d = 0; const mask = 1 << (i - 1);
    if ((x & mask) !== 0) d += 1;
    if ((y & mask) !== 0) d += 2;
    q += d;
  }
  return q;
}

export default function Home() {
  const [center, setCenter] = useState({ lon: 116.3974, lat: 39.9093 });
  const [zoom, setZoom] = useState(12);
  const [selected, setSelected] = useState({ x: 3372, y: 1551, z: 12, lon: 116.3974, lat: 39.9093 });
  const [query, setQuery] = useState("");
  const [contrast, setContrast] = useState(false);
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

  function chooseAt(clientX: number, clientY: number) {
    const r = viewport.current?.getBoundingClientRect(); if (!r) return;
    const px = clientX - r.left + (map.w - r.width) / 2;
    const py = clientY - r.top + (map.h - r.height) / 2;
    const wx = map.minX + px, wy = map.minY + py;
    const ll = worldToLonLat(wx, wy, zoom);
    setSelected({ x: Math.floor(wx / TILE), y: Math.floor(wy / TILE), z: zoom, ...ll });
  }

  function changeZoom(next: number) {
    const z = Math.max(2, Math.min(19, next)); setZoom(z);
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
    const v = query.trim();
    const hit = cities[v];
    const c = v.split(/[/,，\s]+/).map(Number);
    if (hit) { setCenter({ lon: hit[0], lat: hit[1] }); return; }
    if (c.length === 3 && c.every(Number.isFinite)) {
      const z = c[0] | 0, x = c[1] | 0, y = c[2] | 0, n = 2 ** z;
      if (z < 2 || z > 19) return flash("缩放级别需在 2-19 之间");
      if (x < 0 || x >= n || y < 0 || y >= n) return flash("Z" + z + " 切片范围 0-" + (n - 1));
      const ll = worldToLonLat((x + 0.5) * TILE, (y + 0.5) * TILE, z);
      setZoom(z); setCenter(ll); setSelected({ x, y, z, ...ll });
      flash("已定位到切片 " + z + "/" + x + "/" + y); return;
    }
    if (c.length >= 2 && c.every(Number.isFinite)) { setCenter({ lon: c[0], lat: c[1] }); return; }
    flash("试试“上海”、经纬度 121.47,31.23 或切片 12/3372/1551");
  }

  function flash(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2200); }
  function copy(value: string) { navigator.clipboard.writeText(value); flash("已复制到剪贴板"); }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">N</span><div><strong>TileScope</strong><small>WEB MERCATOR EXPLORER</small></div></div>
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()} placeholder="搜索城市 / 经纬度 / 切片 Z/X/Y…" aria-label="搜索地点" />
          <kbd>↵</kbd>
        </div>
        <div className="header-actions"><button onClick={locate}>◎ <span>定位</span></button><button className="icon-button" aria-label="帮助">?</button></div>
      </header>

      <section className="workspace">
        <div className="map-panel" ref={viewport}
          onWheel={e=>{e.preventDefault(); changeZoom(zoom + (e.deltaY < 0 ? 1 : -1));}}
          onPointerDown={e=>{const w=lonLatToWorld(center.lon,center.lat,zoom); drag.current={x:e.clientX,y:e.clientY,wx:w.x,wy:w.y}; e.currentTarget.setPointerCapture(e.pointerId)}}
          onPointerMove={e=>{if(!drag.current)return; const w=drag.current.wx-(e.clientX-drag.current.x), y=drag.current.wy-(e.clientY-drag.current.y); setCenter(worldToLonLat(w,y,zoom));}}
          onPointerUp={e=>{if(drag.current && Math.hypot(e.clientX-drag.current.x,e.clientY-drag.current.y)<5) chooseAt(e.clientX,e.clientY); drag.current=null;}}
        >
          <div className={`tile-stage ${contrast ? "contrast" : ""}`} style={{width:map.w,height:map.h,left:"50%",top:"50%",transform:"translate(-50%,-50%)"}}>
            {map.tiles.map(t=><div className={`tile-cell ${selected.x===t.x&&selected.y===t.y&&selected.z===zoom?"selected":""}`} key={`${t.x}-${t.y}`} style={{left:t.left,top:t.top}}>
              <img src={`https://tile.openstreetmap.org/${zoom}/${t.x}/${t.y}.png`} alt="" draggable={false}/>
              <div className="tile-grid"><span><b>{zoom}</b><i>/</i>{t.x}<i>/</i>{t.y}</span></div>
            </div>)}
          </div>
          <div className="map-vignette" />
          <div className="map-controls"><button onClick={()=>changeZoom(zoom+1)} aria-label="放大">+</button><button onClick={()=>changeZoom(zoom-1)} aria-label="缩小">−</button><button onClick={()=>setCenter({lon:116.3974,lat:39.9093})} aria-label="重置方向">◆</button></div>
          <div className="layer-switch"><button className={!contrast?"active":""} onClick={()=>setContrast(false)}>标准</button><button className={contrast?"active":""} onClick={()=>setContrast(true)}>对比</button></div>
          <div className="map-status"><span className="pulse"/> 网格已开启 <i/> Z {zoom} <i/> {center.lon.toFixed(4)}°, {center.lat.toFixed(4)}°</div>
          <div className="attribution">© OpenStreetMap contributors</div>
        </div>

        <aside className="inspector">
          <div className="inspector-head"><div><span className="eyebrow">TILE INSPECTOR</span><h1>切片检查器</h1></div><span className="live"><i/> LIVE</span></div>
          <p className="hint">点击地图网格以检查该位置的切片信息。</p>

          <div className="xyz-card">
            <div className="xyz-label">当前 XYZ 坐标 <button onClick={()=>copy(`${selected.z}/${selected.x}/${selected.y}`)}>复制</button></div>
            <div className="xyz-values"><div><span>Z</span><strong>{selected.z}</strong></div><em>/</em><div><span>X</span><strong>{selected.x}</strong></div><em>/</em><div><span>Y</span><strong>{selected.y}</strong></div></div>
          </div>

          <section className="data-section"><h2>中心位置</h2><div className="coordinate-row"><div><span>经度 LONGITUDE</span><b>{selected.lon.toFixed(6)}°</b></div><div><span>纬度 LATITUDE</span><b>{selected.lat.toFixed(6)}°</b></div></div></section>
          <section className="data-section"><h2>切片属性</h2><dl>
            <div><dt>QuadKey</dt><dd>{quadKey(selected.x,selected.y,selected.z)} <button onClick={()=>copy(quadKey(selected.x,selected.y,selected.z))}>⧉</button></dd></div>
            <div><dt>切片尺寸</dt><dd>256 × 256 px</dd></div><div><dt>坐标系</dt><dd>EPSG:3857</dd></div><div><dt>切片方案</dt><dd>XYZ / Slippy Map</dd></div>
          </dl></section>
          <section className="data-section"><h2>地理边界</h2><div className="bounds"><div><span>西北 NW</span><code>{bounds.nw.lon.toFixed(5)}, {bounds.nw.lat.toFixed(5)}</code></div><div><span>东南 SE</span><code>{bounds.se.lon.toFixed(5)}, {bounds.se.lat.toFixed(5)}</code></div></div></section>
          <div className="zoom-scale"><div><span>缩放级别</span><b>Z {zoom}</b></div><input type="range" min="2" max="19" value={zoom} onChange={e=>changeZoom(Number(e.target.value))}/><div className="scale-label"><span>世界</span><span>街道</span><span>建筑</span></div></div>
          <button className="url-button" onClick={()=>copy(`https://tile.openstreetmap.org/${selected.z}/${selected.x}/${selected.y}.png`)}>复制切片 URL <span>→</span></button>
        </aside>
      </section>
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
