import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const protocol = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  return {
    title: "TileScope — XYZ 地图切片检查器",
    description: "探索 Web Mercator 地图网格，实时查看 XYZ 切片坐标、QuadKey 与地理边界。",
    openGraph: { title: "TileScope", description: "XYZ 地图切片检查器", images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: "TileScope", description: "XYZ 地图切片检查器", images: [image] },
  };
}

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
