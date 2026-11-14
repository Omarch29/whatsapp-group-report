import path from "node:path";
import type { NextConfig } from "next";
import { buildSettings, resolveDataDir } from "./src/lib/dataDir";

// The language and mode are chosen once per build, from the data's global.json (same data dir as src/lib/data.ts),
// and inlined into server and client code as NEXT_PUBLIC_WGR_*.
const { lang, mode } = buildSettings(resolveDataDir(path.join(process.cwd(), "data")));

// Static export: the site is plain HTML/CSS/JS built from web/data/*.json.
const nextConfig: NextConfig = {
  output: "export",
  // Emit /p/ana/index.html (not /p/ana.html) so any static host serves /p/ana/ without rewrites.
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_WGR_LANG: lang, NEXT_PUBLIC_WGR_MODE: mode },
};

export default nextConfig;
