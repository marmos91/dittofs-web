import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parse, serializeOuter } from "parse5";
import sharp from "sharp";

const attribute = (node, name) => node.attrs?.find((attr) => attr.name === name);
const setAttribute = (node, name, value) => {
  const existing = attribute(node, name);
  if (existing) existing.value = String(value);
  else node.attrs.push({ name, value: String(value) });
};

export function createDocImageOptimizer(directory) {
  const images = new Map();
  const stats = { images: 0, originalBytes: 0, optimizedBytes: 0 };

  async function convert(source, file) {
    const input = await readFile(file);
    const metadata = await sharp(input).metadata();
    const image = { source, width: metadata.width, height: metadata.height };
    // WebP is 8-bit; leave higher-depth or animated PNGs intact.
    if (metadata.depth !== "uchar" || metadata.pages > 1) return image;

    const output = await sharp(input).webp({ lossless: true }).toBuffer();
    if (output.length >= input.length) return image;

    const hash = createHash("sha256").update(output).digest("hex").slice(0, 16);
    image.source = `/_astro/docs-images/${hash}.webp`;
    const target = new URL(image.source.slice(1), directory);
    await mkdir(new URL("./", target), { recursive: true });
    await writeFile(target, output);
    stats.images++;
    stats.originalBytes += input.length;
    stats.optimizedBytes += output.length;
    return image;
  }

  async function optimizeHtml(html) {
    if (!html.includes("/docs-assets/")) return html;
    const candidates = [];
    let imageIndex = 0;
    function visit(node, inContent = false, inPicture = false) {
      inContent ||= attribute(node, "class")?.value.split(/\s+/).includes("sl-markdown-content");
      inPicture ||= node.tagName === "picture";
      if (inContent && node.tagName === "img") {
        const first = imageIndex++ === 0;
        if (!inPicture && !attribute(node, "srcset")) candidates.push({ node, first });
      }
      for (const child of node.childNodes ?? []) visit(child, inContent, inPicture);
    }
    visit(parse(html, { sourceCodeLocationInfo: true }));

    const edits = [];
    for (const { node, first } of candidates) {
      const source = attribute(node, "src")?.value;
      if (!source?.startsWith("/docs-assets/")) continue;
      const file = new URL(source.slice(1), directory);
      if (file.search || file.hash || !/\.png$/i.test(file.pathname) ||
          !file.href.startsWith(new URL("docs-assets/", directory).href)) continue;
      if (!images.has(source)) images.set(source, convert(source, file));
      const image = await images.get(source);
      setAttribute(node, "src", image.source);
      if (!attribute(node, "width") && !attribute(node, "height")) {
        setAttribute(node, "width", image.width);
        setAttribute(node, "height", image.height);
      }
      if (!attribute(node, "loading")) setAttribute(node, "loading", first ? "eager" : "lazy");
      if (!attribute(node, "decoding")) setAttribute(node, "decoding", "async");
      const { startOffset, endOffset } = node.sourceCodeLocation;
      edits.push({ startOffset, endOffset, replacement: serializeOuter(node) });
    }
    // Replace only image tags, retaining every other byte of Astro's output.
    for (const { startOffset, endOffset, replacement } of edits.sort((a, b) => b.startOffset - a.startOffset)) {
      html = html.slice(0, startOffset) + replacement + html.slice(endOffset);
    }
    return html;
  }

  return { optimizeHtml, stats };
}

export default function docsImages() {
  return {
    name: "docs-images",
    hooks: {
      "astro:build:done": async ({ dir, assets, logger }) => {
        const { optimizeHtml, stats } = createDocImageOptimizer(dir);
        for (const files of assets.values()) {
          for (const file of files) {
            if (!file.pathname.endsWith(".html")) continue;
            const html = await readFile(file, "utf8");
            const optimized = await optimizeHtml(html);
            if (optimized !== html) await writeFile(file, optimized);
          }
        }
        logger.info(`Optimized ${stats.images} documentation PNGs: ${stats.originalBytes} → ${stats.optimizedBytes} bytes.`);
      },
    },
  };
}
