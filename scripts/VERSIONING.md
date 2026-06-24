# Docs versioning

The website serves **two kinds** of docs:

- **Latest** — `dittofs.io/docs/*`, vendored from the `develop` branch of the
  main repo. This is what `scripts/sync-docs.mjs` writes by default, into
  `src/content/docs/docs/**`.
- **Pinned snapshots** — `dittofs.io/<version>/docs/*` (e.g. `/v0.22/docs/...`),
  frozen copies of a released tag's docs. These live under
  `src/content/docs/<version>/**` and are managed by the
  [`starlight-versions`](https://github.com/HiDeoo/starlight-versions) plugin.

A version switcher appears in the Starlight sidebar once at least one version
is configured in `DOC_VERSIONS` (see `astro.config.mjs`).

## How snapshotting works

`starlight-versions` archives the **current** state of `src/content/docs/**`
into a version folder the first time it sees a new `slug` in `DOC_VERSIONS`
that has no content folder yet. The archive runs during `astro build` (or
`astro dev`) and adds the `<version>/…` slug prefix to every page, so the
snapshot routes itself under `/<version>/docs/*`. It also writes a
`src/content/versions/<version>.json` manifest.

Because the plugin **copies the current latest tree verbatim**, the snapshot
inherits whatever was vendored into `/docs` at archive time — including each
page's `editUrl`. So to get a snapshot whose "Edit page" links point at the
release tag, vendor the latest tree from the tag *with editUrls pinned to the
tag* before archiving, then return latest to develop afterwards.

## Snapshot a new release (e.g. cutting `v0.22`)

Run from this repo root. Requires a checkout of the main `dittofs` repo at
`../dittofs` (override with `DITTOFS_REPO_DIR`) whose local refs include the
release tag (`git fetch --tags` first if needed).

```bash
# 1. Vendor the tagged docs into the LATEST tree, pinning editUrls to the tag.
#    DITTOFS_DOCS_REF exports that tag's docs/ via `git archive`;
#    DITTOFS_DOCS_EDITREF makes the per-page "Edit" links point at the tag.
DITTOFS_REPO_DIR=../dittofs \
DITTOFS_DOCS_REF=v0.22.0 \
DITTOFS_DOCS_EDITREF=v0.22.0 \
  npm run sync-docs

# 2. Tell starlight-versions about the new version. Edit astro.config.mjs and
#    add the slug to DOC_VERSIONS (keep newest first):
#      const DOC_VERSIONS = [{ slug: "v0.22" }];

# 3. Materialise the snapshot. The plugin copies the current
#    src/content/docs/** into src/content/docs/v0.22/** and writes
#    src/content/versions/v0.22.json on first run.
npm run build      # (or `npm run dev`, then stop it once it boots)

# 4. Return the LATEST tree to develop so /docs tracks bleeding-edge again
#    (and its editUrls point back at develop).
DITTOFS_REPO_DIR=../dittofs DITTOFS_DOCS_REF=develop npm run sync-docs
#    …or, with a develop checkout on disk:
#    DITTOFS_DOCS_DIR=../dittofs/docs npm run sync-docs

# 5. Build once more and commit the snapshot + manifest + config + latest docs.
npm run build
git add src/content/docs src/content/versions astro.config.mjs public/docs-assets
git commit -S -m "docs: snapshot v0.22"
```

The version slug is `v0.22` (minor-level) by intent: patch releases reuse the
same docs snapshot. Use the bare `vX.Y` form so URLs read `/v0.22/docs/...`;
the matching git tag is `vX.Y.0` (used for `DITTOFS_DOCS_REF` / editUrls).

> Note: until the `docs/overhaul` audience-first layout merges to `develop`,
> vendor "latest" from `DITTOFS_DOCS_REF=docs/overhaul` in step 4 instead of
> `develop`. Once merged, plain `develop` (or the default `../dittofs/docs`)
> is correct.

## MDX compatibility (why sync-docs normalizes content)

The plugin re-parses every snapshotted page through **MDX** (not plain
CommonMark). Several constructs that are legal in the source markdown break the
MDX parser, so `sync-docs.mjs` normalizes them at vendor time (outside code
fences / inline-code spans only):

- GFM autolinks `<https://…/…>` → `[url](url)` (MDX reads the `/` as a tag).
- Angle-bracket placeholders in prose (`<command>`, `<path>`, `<name>`) →
  `&lt;…&gt;` (MDX reads them as JSX tags). Real HTML tags (`<br>`, `<img>`,
  table tags, …) are kept.
- Bare curly braces `{ }` / `${…}` in prose (from embedded CLI `--help` and
  JSON dumps) → `&#123;` / `&#125;` (MDX reads `{…}` as a JS expression).

If a future doc adds another MDX-hostile construct in prose, extend
`normalizeForMdx()` in `sync-docs.mjs` rather than editing the vendored copy.

## sync-docs.mjs source/output knobs

| Env var                 | Effect                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `DITTOFS_DOCS_DIR`      | Use an existing `docs/` checkout as the source.                                         |
| `DITTOFS_DOCS_REF`      | `git archive` this ref's `docs/` from `DITTOFS_REPO_DIR`.                                |
| `DITTOFS_REPO_DIR`      | Main repo checkout (default `../dittofs`).                                               |
| `DITTOFS_DOCS_EDITREF`  | Override the git ref used in per-page `editUrl` links (default: the version tag or `develop`). |
| `DITTOFS_DOCS_VERSION`  | Write into `src/content/docs/<version>/docs/**` directly. Escape hatch only — normal snapshots are created by the plugin (this path does not add the `slug:` frontmatter the plugin needs for routing). |

Default (no env vars): source `../dittofs/docs`, output the latest `/docs` tree
with develop editUrls.
