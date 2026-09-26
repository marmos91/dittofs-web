import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { findBrokenDocLinks } from "./check-doc-links.mjs";

test("built docs checks cover pages, headings, relative URLs and versions", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dittofs-built-links-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const files = {
    "docs/start/index.html": '<a href="../target#hello%20world">ok</a><a href="../target#missing">bad heading</a><a href="../../docs/missing">bad page</a><a href="https://example.org/docs/missing">external</a><a href="/pro">marketing</a><a href="/v0.22/docs/target#release">release</a>',
    "docs/target/index.html": '<h2 id="hello world">Heading</h2>',
    "v0.22/docs/target/index.html": '<h2 id="release">Release heading</h2><a href="#absent">bad release heading</a>',
  };
  for (const [file, html] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), html);
  }
  const failures = await findBrokenDocLinks(root);
  assert.equal(failures.length, 3);
  assert.deepEqual(new Set(failures.map(({ href, reason }) => `${href}: ${reason}`)), new Set([
    "../target#missing: missing heading", "../../docs/missing: missing page", "#absent: missing heading",
  ]));
  await fs.writeFile(path.join(root, "docs/start/index.html"), '<a href="../target#hello%20world">ok</a>');
  await fs.writeFile(path.join(root, "v0.22/docs/target/index.html"), '<h2 id="release">Release heading</h2>');
  assert.deepEqual(await findBrokenDocLinks(root), []);
});
