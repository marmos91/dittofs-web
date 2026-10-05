import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { docsGitRef, docsEditRef, GITHUB_REPO, rewriteLinksAndAssets } from "./doc-links.mjs";

const routes = new Map([["docs/guide/configuration.md", "/docs/getting-started/configuration"]]);
const rewrite = (md, options = {}) => rewriteLinksAndAssets(md, "internals/testing.md", { routes, ...options });

test("repository files and directories resolve from the source document", () => {
  const input = [
    "[suites](../../test/conformance/suites.json)",
    '[runner](../../test/conformance/run.sh#usage "Run tests")',
    "[operator](../../k8s/dittofs-operator/)",
    "[other docs](.)",
    "[contribute](./contributing.md)",
    "[config](../guide/configuration.md?view=full#users)",
    "[different config](../../examples/configuration.md)",
  ].join("\n");
  assert.equal(rewrite(input), [
    `[suites](${GITHUB_REPO}/blob/develop/test/conformance/suites.json)`,
    `[runner](${GITHUB_REPO}/blob/develop/test/conformance/run.sh#usage "Run tests")`,
    `[operator](${GITHUB_REPO}/tree/develop/k8s/dittofs-operator/)`,
    `[other docs](${GITHUB_REPO}/tree/develop/docs/internals)`,
    `[contribute](${GITHUB_REPO}/blob/develop/docs/internals/contributing.md)`,
    "[config](/docs/getting-started/configuration?view=full#users)",
    `[different config](${GITHUB_REPO}/blob/develop/examples/configuration.md)`,
  ].join("\n"));
});

test("GitHub fallback links use the release ref, including non-Markdown targets", () => {
  assert.equal(rewrite("[readme](../../README.md#install) [run](../../test/run.sh)", { ref: "v0.22.0" }),
    `[readme](${GITHUB_REPO}/blob/v0.22.0/README.md#install) [run](${GITHUB_REPO}/blob/v0.22.0/test/run.sh)`);
});

test("site URLs, fragments and external URLs remain unchanged", () => {
  const targets = ["/docs/guide/configuration.md", "/docs-assets/pro/a.png", "#here", "?view=all", "//example.com/a.md",
    "https://example.com/a.md", "mailto:hello@example.com", "data:image/png;base64,abc", "ftp://example.com/a.md"];
  const input = targets.map((target) => `[link](${target}) ![image](${target})`).join("\n");
  assert.equal(rewrite(input), input);
});

test("Markdown and HTML assets retain query/fragment and register only file paths", () => {
  const assets = [];
  const options = { registerAsset: (asset) => { assets.push(asset); return `/docs-assets/${asset}`; } };
  const input = '![dash](../assets/pro/dashboard.png?v=1#top "Dashboard")\n\n<table><tr><td><img src="../assets/pro/shares.png" /></td><td><img src=\'../assets/pro/users.png\' /></td></tr></table>';
  assert.equal(rewrite(input, options), '![dash](/docs-assets/pro/dashboard.png?v=1#top "Dashboard")\n\n<table><tr><td><img src="/docs-assets/pro/shares.png" /></td><td><img src=\'/docs-assets/pro/users.png\' /></td></tr></table>');
  assert.deepEqual(assets, ["pro/dashboard.png", "pro/shares.png", "pro/users.png"]);
});

test("fenced, indented and inline code examples are never rewritten", () => {
  const input = [
    "`[example](../../run.sh)` and ``<img src=\"../assets/x.png\">``",
    "", "````md", "[example](../../run.sh)", "```", '<img src="../assets/x.png">', "````",
    "", "~~~md", "[example](../../run.sh)", "~~~",
    "", "    [example](../../run.sh)", '    <img src="../assets/x.png">',
  ].join("\n");
  assert.equal(rewrite(input), input);
});

test("reference destinations, rich labels and escaped destinations keep valid Markdown", () => {
  const input = '[`a]` **label**](../../run.sh "Title")\n\n[ref]: <../../a file.json> "Reference title"\n\n[file][ref]\n\n[paren](../../a\\)b.sh)\n\n[![dash](../assets/dash.png)](../../README.md)';
  assert.equal(rewrite(input), '[`a]` **label**](' + `${GITHUB_REPO}/blob/develop/run.sh "Title")\n\n[ref]: <${GITHUB_REPO}/blob/develop/a%20file.json> "Reference title"\n\n[file][ref]\n\n[paren](${GITHUB_REPO}/blob/develop/a%29b.sh)\n\n[![dash](/docs-assets/dash.png)](${GITHUB_REPO}/blob/develop/README.md)`);
  assert.equal(rewrite('![a `](` b](../assets/x.png)'), '![a `](` b](/docs-assets/x.png)');
  assert.equal(rewrite('![a ` b](../assets/x.png "tick `")'), '![a ` b](../assets/x.png "tick `")');
  assert.equal(rewrite('[a`]: ../../foo.md "`title`"\n\n[a`]'),
    '[a`]: ' + `${GITHUB_REPO}/blob/develop/foo.md "` + '`title`"\n\n[a`]');
  assert.equal(rewrite('![figure][image]\n\n[image]: diagram.png'), '![figure][image]\n\n[image]: /docs-assets/diagram.png');
});

test("source refs stay pinned while latest edits target develop", () => {
  assert.equal(docsGitRef({}), "develop");
  assert.equal(docsEditRef({}), "develop");
  assert.equal(docsEditRef({ DITTOFS_DOCS_REF: "v0.34.0" }), "develop");
  assert.equal(docsEditRef({ DITTOFS_DOCS_VERSION: "v0.22" }), "v0.22.0");
  assert.equal(docsEditRef({ DITTOFS_DOCS_EDITREF: "v0.22.2", DITTOFS_DOCS_VERSION: "v0.22" }), "v0.22.2");
  assert.equal(docsGitRef({ DITTOFS_DOCS_REF: "v0.34.0", DITTOFS_DOCS_EDITREF: "develop" }), "v0.34.0");
  assert.equal(docsGitRef({ DITTOFS_DOCS_VERSION: "v0.22" }), "v0.22.0");
  assert.equal(docsGitRef({ DITTOFS_DOCS_REF: "v0.22.2", DITTOFS_DOCS_VERSION: "v0.22" }), "v0.22.2");
  assert.equal(docsGitRef({ DITTOFS_DOCS_REF: "v0.22.2" }), "v0.22.2");
  assert.equal(docsGitRef({ DITTOFS_DOCS_DIR: "/checkout/docs", DITTOFS_DOCS_REF: "ignored" }), "develop");
  assert.equal(docsGitRef({ DITTOFS_DOCS_DIR: "/checkout/docs", DITTOFS_DOCS_EDITREF: "v0.22.2", DITTOFS_DOCS_REF: "ignored", DITTOFS_DOCS_VERSION: "v0.22" }), "v0.22.2");
});

test("sync writes matching edit/fallback refs and copies assets", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dittofs-doc-links-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const project = fileURLToPath(new URL("../", import.meta.url));
  await fs.mkdir(path.join(root, "scripts"));
  for (const script of ["sync-docs.mjs", "doc-links.mjs"]) {
    await fs.copyFile(path.join(project, "scripts", script), path.join(root, "scripts", script));
  }
  await fs.symlink(path.join(project, "node_modules"), path.join(root, "node_modules"), "dir");
  const source = path.join(root, "source");
  await fs.mkdir(path.join(source, "guide"), { recursive: true });
  await fs.mkdir(path.join(source, "assets"));
  await fs.writeFile(path.join(source, "assets", "diagram.png"), "image fixture");
  await fs.writeFile(path.join(source, "guide", "getting-started.md"), '# Start\n\n[run](../../test/run.sh)\n\n![diagram](../assets/diagram.png)\n\n```md\n[example](../../test/run.sh)\n```\n');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("DITTOFS_")));
  execFileSync(process.execPath, [path.join(root, "scripts", "sync-docs.mjs")], {
    env: { ...env, DITTOFS_DOCS_DIR: source, DITTOFS_DOCS_EDITREF: "v0.22.0" },
    stdio: "pipe",
  });
  const result = await fs.readFile(path.join(root, "src/content/docs/docs/getting-started/getting-started.md"), "utf8");
  assert.match(result, /editUrl: "https:\/\/github.com\/marmos91\/dittofs\/edit\/v0\.22\.0\/docs\/guide\/getting-started\.md"/);
  assert.match(result, /\[run\]\(https:\/\/github.com\/marmos91\/dittofs\/blob\/v0\.22\.0\/test\/run\.sh\)/);
  assert.ok(result.includes("```md\n[example](../../test/run.sh)\n```"));
  assert.equal(await fs.readFile(path.join(root, "public/docs-assets/diagram.png"), "utf8"), "image fixture");
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, "src/data/latest-docs.json"), "utf8")), { ref: "v0.22.0" });

  // Exercise the release workflow through a real local tag, not just the ref
  // selector. Latest is read from the tag and remains editable on develop.
  const repo = path.join(root, "repo");
  await fs.mkdir(repo);
  await fs.cp(source, path.join(repo, "docs"), { recursive: true });
  const git = (...args) => execFileSync("git", args, { cwd: repo, stdio: "pipe" });
  git("init", "--quiet");
  git("add", "docs");
  git("-c", "user.name=Docs Test", "-c", "user.email=docs@example.invalid", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "Fixture docs");
  git("tag", "v0.34.0");
  execFileSync(process.execPath, [path.join(root, "scripts/sync-docs.mjs")], {
    env: { ...env, DITTOFS_REPO_DIR: repo, DITTOFS_DOCS_REF: "v0.34.0" }, stdio: "pipe",
  });
  const stable = await fs.readFile(path.join(root, "src/content/docs/docs/getting-started/getting-started.md"), "utf8");
  assert.ok(stable.includes(`${GITHUB_REPO}/edit/develop/docs/guide/getting-started.md`));
  assert.ok(stable.includes(`${GITHUB_REPO}/blob/v0.34.0/test/run.sh`));
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, "src/data/latest-docs.json"), "utf8")), { ref: "v0.34.0" });

  // Legacy snapshots use a flat source layout and only map pages that exist.
  const legacy = path.join(root, "legacy");
  await fs.mkdir(legacy);
  await fs.writeFile(path.join(legacy, "NFS.md"), "# NFS\n\n[CLI](CLI.md#usage) [SMB](SMB.md) [repo](../README.md)\n");
  await fs.writeFile(path.join(legacy, "CLI.md"), "# CLI\n\n## Usage\n");
  execFileSync(process.execPath, [path.join(root, "scripts/sync-docs.mjs")], {
    env: { ...env, DITTOFS_DOCS_DIR: legacy, DITTOFS_DOCS_VERSION: "v0.1" }, stdio: "pipe",
  });
  const snapshot = await fs.readFile(path.join(root, "src/content/docs/v0.1/docs/connect/nfs.md"), "utf8");
  assert.ok(snapshot.includes(`${GITHUB_REPO}/edit/v0.1.0/docs/NFS.md`));
  assert.ok(snapshot.includes("[CLI](/v0.1/docs/getting-started/cli#usage)"));
  assert.ok(snapshot.includes(`[SMB](${GITHUB_REPO}/blob/v0.1.0/docs/SMB.md)`));
  assert.ok(snapshot.includes(`[repo](${GITHUB_REPO}/blob/v0.1.0/README.md)`));
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, "src/data/latest-docs.json"), "utf8")), { ref: "v0.34.0" });

});

test("published conformance and operator links target the matching repository version", async () => {
  const content = new URL("../src/content/docs/", import.meta.url);
  const { ref: latestRef } = JSON.parse(await fs.readFile(new URL("../src/data/latest-docs.json", import.meta.url), "utf8"));
  const latest = await fs.readFile(new URL("docs/contributing/testing.md", content), "utf8");
  assert.ok(latest.includes(`](${GITHUB_REPO}/blob/${latestRef}/test/conformance/suites.json)`));
  assert.ok(latest.includes(`](${GITHUB_REPO}/blob/${latestRef}/test/conformance/run.sh)`));
  const release = await fs.readFile(new URL("v0.22/docs/contributing/testing.md", content), "utf8");
  assert.ok(release.includes(`](${GITHUB_REPO}/blob/v0.22.0/test/smb-conformance/smbtorture/KNOWN_FAILURES.md)`));
  for (const [prefix, ref] of [["docs", latestRef], ["v0.22/docs", "v0.22.0"]]) {
    const install = await fs.readFile(new URL(`${prefix}/getting-started/install.md`, content), "utf8");
    assert.ok(install.includes(`](${GITHUB_REPO}/tree/${ref}/k8s/dittofs-operator/)`));
  }
});
