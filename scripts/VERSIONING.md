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
into a version folder the first time it sees a new `slug` in the `DOC_VERSIONS`
list that has no content folder yet. The archive happens when the dev server or
build runs. So the snapshot flow is:

1. Make sure the latest docs are vendored from the tag you are releasing.
2. Add the new version slug to `DOC_VERSIONS`.
3. Run the dev server / build once to materialise the snapshot folder.
4. Re-vendor latest from `develop` so the root docs return to bleeding-edge.

## Snapshot a new release (e.g. cutting `v0.22`)

Run from this repo root. Requires a checkout of the main `dittofs` repo at
`../dittofs` (override with `DITTOFS_REPO_DIR`) whose local refs include the
release tag.

```bash
# 1. Vendor the tagged docs into the LATEST tree (root /docs).
#    DITTOFS_DOCS_REF exports that tag's docs/ via `git archive`.
DITTOFS_DOCS_REF=v0.22.0 npm run sync-docs

# 2. Tell starlight-versions about the new version. Edit astro.config.mjs and
#    add the slug to DOC_VERSIONS (keep newest first):
#      const DOC_VERSIONS = [{ slug: "v0.22" }];

# 3. Materialise the snapshot. The plugin copies the current
#    src/content/docs/** into src/content/docs/v0.22/** on first run.
npm run build      # (or `npm run dev` then stop it once it boots)

# 4. Return the LATEST tree to develop so /docs tracks bleeding-edge again.
DITTOFS_DOCS_DIR=../dittofs/docs npm run sync-docs   # or DITTOFS_DOCS_REF=develop

# 5. Commit: the new src/content/docs/v0.22/** snapshot, the astro.config.mjs
#    DOC_VERSIONS change, and any re-vendored latest docs.
git add src/content/docs astro.config.mjs public/docs-assets
git commit -S -m "docs: snapshot v0.22"
```

The version slug is `v0.22` (minor-level) by intent: patch releases reuse the
same docs snapshot. Use the bare `vX.Y` form so URLs read `/v0.22/docs/...`.

## sync-docs.mjs source/output knobs

| Env var                 | Effect                                                        |
| ----------------------- | ------------------------------------------------------------ |
| `DITTOFS_DOCS_DIR`      | Use an existing `docs/` checkout as the source.              |
| `DITTOFS_DOCS_REF`      | `git archive` this ref's `docs/` from `DITTOFS_REPO_DIR`.    |
| `DITTOFS_REPO_DIR`      | Main repo checkout (default `../dittofs`).                    |
| `DITTOFS_DOCS_VERSION`  | Write into `src/content/docs/<version>/docs/**` (rarely needed — the plugin normally creates snapshots; this is an escape hatch to re-vendor a snapshot in place). |

Default (no env vars): source `../dittofs/docs`, output the latest `/docs` tree.
