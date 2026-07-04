#!/usr/bin/env node
/**
 * Post-build script: replaces EJS template tags in static/index.html
 * with real values so the app works on GitHub Pages (no server-side EJS).
 *
 * Also reads asset-manifest.json (if present) to resolve hashed asset URLs.
 *
 * Usage: node scripts/fix-pages-html.js [base-path]
 *   base-path defaults to "/openfront/"
 */
const fs = require("fs");
const path = require("path");

const staticDir = path.join(process.cwd(), "static");
const basePath = process.argv[2] || "/openfront/";

// --- Load asset manifest if it exists ---
let assetManifest = {};
const manifestPath = path.join(staticDir, "asset-manifest.json");
if (fs.existsSync(manifestPath)) {
  try {
    assetManifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  } catch (e) {
    console.warn("[fix-pages-html] Could not parse asset-manifest.json:", e.message);
  }
}
console.log("[fix-pages-html] Loaded asset manifest with", Object.keys(assetManifest).length, "entries");

// --- Helper: resolve an asset key to its hashed path ---
function resolveAsset(key, fallback) {
  if (assetManifest[key]) {
    return basePath + assetManifest[key].replace(/^\//, "");
  }
  return basePath + fallback;
}

// --- Build the replacement map ---
// These correspond to the EJS variables used in index.html and injectCdnBaseTemplate
const replacements = {
  // BOOTSTRAP_CONFIG values
  gitCommit: JSON.stringify("pages-" + Date.now()),
  assetManifest: JSON.stringify(assetManifest),
  cdnBase: JSON.stringify(""),
  gameEnv: JSON.stringify("prod"),
  numWorkers: JSON.stringify(2),
  turnstileSiteKey: JSON.stringify("1x00000000000000000000AA"),
  jwtAudience: JSON.stringify("openfront-web.onrender.com"),
  instanceId: JSON.stringify("pages-deploy"),

  // Asset URLs used in <link> and CSS
  manifestHref: resolveAsset("manifest.json", "manifest.json"),
  faviconHref: resolveAsset("images/Favicon.svg", "images/Favicon.svg"),
  gameplayScreenshotUrl: resolveAsset("images/GameplayScreenshot.png", "images/GameplayScreenshot.png"),
  backgroundImageUrl: resolveAsset("images/background.webp", "images/background.webp"),
  desktopLogoImageUrl: resolveAsset("images/OpenFront.png", "images/OpenFront.png"),
  mobileLogoImageUrl: resolveAsset("images/OF.png", "images/OF.png"),
};

console.log("[fix-pages-html] Replacements prepared:");
for (const [k, v] of Object.entries(replacements)) {
  console.log("  " + k + " = " + (typeof v === "string" && v.length > 80 ? v.substring(0, 80) + "..." : v));
}

// --- Read index.html ---
const indexPath = path.join(staticDir, "index.html");
if (!fs.existsSync(indexPath)) {
  console.error("[fix-pages-html] ERROR: static/index.html not found!");
  process.exit(1);
}

let html = fs.readFileSync(indexPath, "utf-8");
let replaceCount = 0;

// --- Replace all EJS tags: <%- varName %> ---
for (const [key, value] of Object.entries(replacements)) {
  const ejsPattern = new RegExp("<%-\\s*" + key + "\\s*%>", "g");
  const matches = html.match(ejsPattern);
  if (matches) {
    html = html.replace(ejsPattern, value);
    replaceCount += matches.length;
    console.log("[fix-pages-html] Replaced " + matches.length + "x: " + key);
  }
}

// --- Handle any remaining <%- ... %> tags by replacing with empty string ---
const remainingEjs = html.match(/<%-\s*\w+\s*%>/g);
if (remainingEjs) {
  console.warn("[fix-pages-html] WARNING: Unresolved EJS tags found:", remainingEjs);
  html = html.replace(/<%-\s*\w+\s*%>/g, '""');
}

// --- Fix asset paths: if Vite built with base "/openfront/", paths are already correct ---
// But rewriteAssetsForCdn may have wrapped them in EJS that we already replaced.
// Also fix any remaining absolute paths that start with / but not /openfront/
// (this handles cases where rewriteAssetsForCdn produced EJS like <%- cdnBase %>/assets/...)
// Since cdnBase is "", these become /assets/... which needs /openfront/assets/...
html = html.replace(/src="\/assets\//g, 'src="' + basePath + 'assets/');
html = html.replace(/href="\/assets\//g, 'href="' + basePath + 'assets/');

// --- Write the fixed index.html ---
fs.writeFileSync(indexPath, html, "utf-8");
console.log("[fix-pages-html] Wrote fixed index.html (" + replaceCount + " EJS tags replaced)");

// --- Create .nojekyll to prevent GitHub Pages from ignoring files starting with _ ---
const nojekyllPath = path.join(staticDir, ".nojekyll");
fs.writeFileSync(nojekyllPath, "");
console.log("[fix-pages-html] Created .nojekyll");

// --- Also ensure manifest.json exists at root (for PWA) ---
// If it's only in assets/, copy it to root
const rootManifest = path.join(staticDir, "manifest.json");
if (!fs.existsSync(rootManifest)) {
  // Try to find it in resources or assets
  const resourceManifest = path.join(process.cwd(), "resources", "manifest.json");
  if (fs.existsSync(resourceManifest)) {
    fs.copyFileSync(resourceManifest, rootManifest);
    console.log("[fix-pages-html] Copied manifest.json from resources to static root");
  }
}

console.log("[fix-pages-html] Done!");
