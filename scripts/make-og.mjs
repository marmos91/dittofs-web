#!/usr/bin/env node
/*
 * Generates the social share image at public/og/default.png (1200x630).
 * Composes the DittoFS wordmark, a tagline, and the domain on the brand
 * gradient, rasterized with sharp. Run once and commit the result:
 *   npm run og
 */
import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const W = 1200;
const H = 630;

const logoRaw = await fs.readFile(
  path.join(ROOT, "src/assets/logo-light.svg"),
  "utf8",
);
// Inner markup of the wordmark (drop the outer <svg> wrapper).
const logoInner = logoRaw
  .replace(/^[\s\S]*?<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "");

let grid = "";
for (let x = 0; x <= W; x += 60) grid += `<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`;
for (let y = 0; y <= H; y += 60) grid += `<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`;

const logoW = 480;
const logoH = (logoW * 108) / 459;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a1730"/>
      <stop offset="100%" stop-color="#050a14"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="36%" r="55%">
      <stop offset="0%" stop-color="#0065ff" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="#0065ff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <g stroke="#1b2942" stroke-width="1" opacity="0.45">${grid}</g>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <svg x="${(W - logoW) / 2}" y="186" width="${logoW}" height="${logoH}" viewBox="0 0 459 108">${logoInner}</svg>
  <text x="${W / 2}" y="380" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="600" font-size="34" fill="#cdd8ef">NFS and SMB in userspace, with pluggable storage</text>
  <text x="${W / 2}" y="438" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="24" fill="#97a6c7">One filesystem. Every protocol. Any backend.</text>
  <text x="${W / 2}" y="556" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="22" letter-spacing="3" fill="#3d8bff">dittofs.io</text>
</svg>`;

await fs.mkdir(path.join(ROOT, "public/og"), { recursive: true });
await sharp(Buffer.from(svg)).png().toFile(path.join(ROOT, "public/og/default.png"));
console.log("Wrote public/og/default.png");
