// Regenerates docs/screenshots/{es,en}/*.png from the fictional synthetic chat, so the README's captures never go
// stale. For each language: builds the full report (demo_deploy.py --no-deploy), serves web/out/ locally, takes the
// three full-mode shots, then builds the single-page mode and takes its shot. Run: `pnpm screenshots`.
// First time only: `pnpm exec playwright install chromium`.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(WEB, "..");
const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };

/**
 * Public slug of the hours and census chapters per language. This script is plain JS and cannot import the
 * TypeScript copy (web/i18n), so it carries its own map; src/test/screenshots.test.ts ties it to copyFor(lang).chapters.
 */
const SLUGS = {
  es: { horas: "horas", censo: "censo" },
  en: { horas: "hours", censo: "census" },
};

/** The four shots of one language, in the order they are taken (single-mobile needs the other build, so it is last). */
export function shotsFor(lang) {
  const slugs = SLUGS[lang];
  return [
    { name: "hero", mode: "full", path: "/", selector: null, viewport: DESKTOP },
    { name: "heatmap", mode: "full", path: `/${slugs.horas}/`, selector: "#heatmap", viewport: DESKTOP },
    { name: "chapter", mode: "full", path: `/${slugs.censo}/`, selector: null, viewport: DESKTOP },
    { name: "single-mobile", mode: "single", path: "/", selector: null, viewport: MOBILE },
  ];
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

/** Serves `dir` over HTTP on a free port (a directory maps to its index.html). Resolves `{ server, url }`. */
function serve(dir) {
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = path.join(dir, pathname);
    if (!file.startsWith(dir)) file = dir;
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!existsSync(file)) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

/** Builds the synthetic chat's static export into web/out/ (never deploys). Throws if the build fails. */
function build(lang, mode) {
  console.log(`building ${lang}/${mode}...`);
  const r = spawnSync(
    "uv",
    ["run", "python", "-I", "scripts/demo_deploy.py", "--lang", lang, "--mode", mode, "--no-deploy"],
    { cwd: ROOT, stdio: "inherit" },
  );
  if (r.status !== 0) throw new Error(`the ${lang}/${mode} build failed (exit ${r.status}): no screenshots taken for it`);
}

async function shoot(browser, base, shot, file) {
  const context = await browser.newContext({ viewport: shot.viewport, reducedMotion: "reduce", deviceScaleFactor: 1 });
  try {
    const page = await context.newPage();
    await page.goto(base + shot.path, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    if (shot.mode === "single") {
      await page.locator('button[aria-haspopup="dialog"]').click();
      await page.locator("dialog[open]").waitFor();
    }
    if (shot.selector) {
      const el = page.locator(shot.selector);
      await el.scrollIntoViewIfNeeded();
      await page.waitForLoadState("networkidle");
      await el.screenshot({ path: file });
    } else {
      await page.screenshot({ path: file });
    }
    console.log(`  ${path.relative(ROOT, file)}`);
  } finally {
    await context.close();
  }
}

async function run(lang, browser) {
  const dir = path.join(ROOT, "docs", "screenshots", lang);
  mkdirSync(dir, { recursive: true });
  for (const mode of ["full", "single"]) {
    build(lang, mode);
    const { server, url } = await serve(path.join(WEB, "out"));
    try {
      for (const shot of shotsFor(lang).filter((s) => s.mode === mode)) {
        await shoot(browser, url, shot, path.join(dir, `${shot.name}.png`));
      }
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  }
}

async function main() {
  const { chromium } = await import("playwright");
  let browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    console.error(`could not launch Chromium (${e.message.split("\n")[0]}).\nFirst-time setup: pnpm exec playwright install chromium`);
    process.exit(1);
  }
  try {
    for (const lang of ["es", "en"]) await run(lang, browser);
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
