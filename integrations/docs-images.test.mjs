import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { parse } from "parse5";
import sharp from "sharp";
import { createDocImageOptimizer } from "./docs-images.mjs";

async function site(t) {
  const path = await mkdtemp(join(tmpdir(), "docs-images-test-"));
  t.after(() => rm(path, { recursive: true, force: true }));
  return pathToFileURL(`${path}/`);
}

async function png(directory, source, color = "#0065ff") {
  const input = await sharp({ create: { width: 64, height: 48, channels: 4, background: color } })
    .png({ compressionLevel: 0 }).toBuffer();
  const file = new URL(source.slice(1), directory);
  await mkdir(new URL("./", file), { recursive: true });
  await writeFile(file, input);
  return input;
}

function images(html) {
  const result = [];
  function visit(node) {
    if (node.tagName === "img") result.push(Object.fromEntries(node.attrs.map(({ name, value }) => [name, value])));
    for (const child of node.childNodes ?? []) visit(child);
  }
  visit(parse(html));
  return result;
}

test("optimizes rendered Markdown and raw table images without rewriting surrounding HTML", async (t) => {
  const directory = await site(t);
  const input = await png(directory, "/docs-assets/pro/dashboard.png");
  await png(directory, "/docs-assets/pro/shares.png", "#ff6500");
  const first = '<img src="/docs-assets/pro/dashboard.png" alt="A &amp; B">';
  const second = '<img src="/docs-assets/pro/shares.png" alt="Shares" />';
  const before = '<!doctype html>\n<script>const example = "<img src=\'/docs-assets/example.png\'>";</script>\n<main class="sl-markdown-content">\n<p>';
  const between = '</p>\n<!-- keep formatting -->\n<table><tr><td width="50%">';
  const after = '<br /><sub>caption</sub></td></tr></table>\n</main>';
  const html = before + first + between + second + after;
  const optimizer = createDocImageOptimizer(directory);
  const output = await optimizer.optimizeHtml(html);
  const [dashboard, shares] = images(output);
  assert.match(dashboard.src, /^\/_astro\/docs-images\/[a-f0-9]{16}\.webp$/);
  assert.equal(dashboard.alt, "A & B");
  assert.equal(dashboard.width, "64");
  assert.equal(dashboard.height, "48");
  assert.equal(dashboard.loading, "eager");
  assert.equal(shares.loading, "lazy");
  assert.equal(shares.decoding, "async");
  assert.ok(output.startsWith(before));
  assert.ok(output.includes(between));
  assert.ok(output.endsWith(after));
  const webp = await readFile(new URL(dashboard.src.slice(1), directory));
  assert.ok(webp.length < input.length);
  assert.deepEqual(await sharp(webp).ensureAlpha().raw().toBuffer(), await sharp(input).ensureAlpha().raw().toBuffer());
  assert.deepEqual(await readFile(new URL("docs-assets/pro/dashboard.png", directory)), input);
  assert.equal(optimizer.stats.images, 2);
});

test("keeps same-name snapshots distinct and produces deterministic shared derivatives", async (t) => {
  const directory = await site(t);
  const snapshot = await png(directory, "/docs-assets/pro/v0.22/dashboard.png", "#ff6500");
  await png(directory, "/docs-assets/pro/dashboard.png");
  const html = '<main class="sl-markdown-content"><img src="/docs-assets/pro/dashboard.png"><img src="/docs-assets/pro/v0.22/dashboard.png"><img src="/docs-assets/pro/dashboard.png"></main>';
  const optimizer = createDocImageOptimizer(directory);
  const output = await optimizer.optimizeHtml(html);
  const [latest, versioned, shared] = images(output);
  assert.notEqual(latest.src, versioned.src);
  assert.equal(latest.src, shared.src);
  assert.equal(optimizer.stats.images, 2);
  assert.equal((await readdir(new URL("_astro/docs-images/", directory))).length, 2);
  assert.equal(await optimizer.optimizeHtml(html), output);
  assert.equal(await createDocImageOptimizer(directory).optimizeHtml(html), output);
  await png(directory, "/docs-assets/pro/dashboard.png", "#33ee33");
  const changed = images(await createDocImageOptimizer(directory).optimizeHtml(html));
  assert.notEqual(changed[0].src, latest.src);
  assert.equal(changed[1].src, versioned.src);
  assert.deepEqual(await readFile(new URL("docs-assets/pro/v0.22/dashboard.png", directory)), snapshot);
});

test("preserves authored dimensions, loading, responsive markup, and unrelated images", async (t) => {
  const directory = await site(t);
  await png(directory, "/docs-assets/pro/dashboard.png");
  const outside = '<img src="/docs-assets/pro/dashboard.png" alt="Outside docs">';
  const responsive = '<picture><source srcset="/custom.webp"><img src="/docs-assets/missing.png"></picture><img src="/docs-assets/missing.png" srcset="/custom.png 2x">';
  const html = outside + '<main class="sl-markdown-content"><img src="https://example.com/first.png">' +
    '<img src="/docs-assets/pro/dashboard.png" width="320" height="240" loading="eager" decoding="sync">' +
    '<img src="/docs-assets/pro/dashboard.png" width="80">' + responsive +
    '<img src="/docs-assets/../outside.png"><img src="/docs-assets/pro/dashboard.png?version=1"></main>';
  const output = await createDocImageOptimizer(directory).optimizeHtml(html);
  assert.ok(output.startsWith(outside));
  assert.ok(output.includes(responsive));
  const [, external, authored, widthOnly, , , traversal, query] = images(output);
  assert.equal(external.src, "https://example.com/first.png");
  assert.equal(authored.width, "320");
  assert.equal(authored.height, "240");
  assert.equal(authored.loading, "eager");
  assert.equal(authored.decoding, "sync");
  assert.equal(widthOnly.width, "80");
  assert.equal(widthOnly.height, undefined);
  assert.equal(widthOnly.loading, "lazy");
  assert.equal(traversal.src, "/docs-assets/../outside.png");
  assert.equal(query.src, "/docs-assets/pro/dashboard.png?version=1");
});

test("retains PNG when the encoder cannot save bytes", async (t) => {
  const directory = await site(t);
  const input = await png(directory, "/docs-assets/pro/dashboard.png");
  t.mock.method(sharp.prototype, "toBuffer", async () => Buffer.alloc(input.length + 1));
  const optimizer = createDocImageOptimizer(directory);
  const output = await optimizer.optimizeHtml('<main class="sl-markdown-content"><img src="/docs-assets/pro/dashboard.png"></main>');
  assert.equal(images(output)[0].src, "/docs-assets/pro/dashboard.png");
  assert.equal(optimizer.stats.images, 0);
  await assert.rejects(readdir(new URL("_astro/docs-images/", directory)), { code: "ENOENT" });
});

test("reports missing local screenshots instead of emitting nonexistent derivatives", async (t) => {
  const optimizer = createDocImageOptimizer(await site(t));
  await assert.rejects(optimizer.optimizeHtml('<main class="sl-markdown-content"><img src="/docs-assets/missing.png"></main>'), { code: "ENOENT" });
});

test("preserves higher-bit-depth PNGs instead of reducing them to 8-bit WebP", async (t) => {
  const directory = await site(t);
  const input = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#0065ff" } })
    .toColourspace("rgb16").png().toBuffer();
  assert.equal((await sharp(input).metadata()).depth, "ushort");
  await mkdir(new URL("docs-assets/", directory));
  await writeFile(new URL("docs-assets/high-depth.png", directory), input);
  const optimizer = createDocImageOptimizer(directory);
  const output = await optimizer.optimizeHtml('<main class="sl-markdown-content"><img src="/docs-assets/high-depth.png"></main>');
  assert.equal(images(output)[0].src, "/docs-assets/high-depth.png");
  assert.equal(optimizer.stats.images, 0);
});
