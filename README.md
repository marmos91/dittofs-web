# dittofs-web

Marketing site and documentation for [DittoFS](https://github.com/marmos91/dittofs),
served at **dittofs.io**.

Built with [Astro](https://astro.build) (static), [Starlight](https://starlight.astro.build)
for docs, Tailwind CSS, and deployed on Cloudflare Pages.

## Develop

```bash
npm install
npm run dev            # http://localhost:4321
```

## Docs

The documentation under `/docs` is vendored from the DittoFS repo's `docs/`
directory (the single source of truth) into the Starlight content collection.
It is committed, so the build stays hermetic.

```bash
# Refresh from a local dittofs checkout (sibling dir by default):
DITTOFS_DOCS_DIR=../dittofs/docs npm run sync-docs
```

A scheduled GitHub Action re-runs the sync and opens a PR when the upstream
docs change.

Besides the latest docs at `/docs`, the site can serve pinned release snapshots
at `/<version>/docs/*` (e.g. `/v0.22/docs/...`). Snapshots are driven by the
`DOC_VERSIONS` list in `astro.config.mjs` and archived by `starlight-versions`
during `astro build`. See `scripts/VERSIONING.md` for the full flow — notably
that a snapshot copies the current latest tree verbatim, so vendor the release
tag first if you want `editUrl` pinned to it.

## Build

```bash
npm run build         # -> dist/
npm run preview
npm run check         # astro check (types)
npm run test:docs-images
npm run og            # regenerate the social share image
```

Production builds optimize PNG screenshots under `/docs-assets/` in rendered
documentation, including raw HTML tables and versioned pages. Smaller lossless
WebP copies are written to content-hashed `/_astro/docs-images/` URLs; the original
PNGs and vendored Markdown remain unchanged. Missing dimensions are added when
neither dimension is authored. The first content image stays eager and later
images load lazily, unless the author already set loading behavior. Existing
`picture` and `srcset` markup is preserved. Use `npm run preview` to inspect the
optimized output; the development server serves the original images.

## Deploy (Cloudflare Pages)

- Build command: `npm run build`
- Output directory: `dist`

### Environment variables

See `.env.example`. `PUBLIC_*` vars are public; the rest are server-side
secrets for the contact form, set in the Cloudflare Pages dashboard.

| Variable | Purpose |
| --- | --- |
| `PUBLIC_SITE_URL` | Canonical URL (SEO/OG). |
| `PUBLIC_GTM_ID` | Analytics (GTM). Empty = no cookie banner, no tags. |

The PRO contact form is a HubSpot embed configured in `src/pages/pro.astro`, so
it needs no environment variables.

## Structure

```
src/
  components/        Header, Footer, BrowserFrame, landing/*
  layouts/Base.astro Marketing page shell (meta, analytics, header/footer)
  pages/             index, pro, privacy, cookie-policy, terms, thank-you
  content/docs/      Starlight docs (docs/** vendored from dittofs)
  content/versions/  starlight-versions manifests for pinned snapshots
  lib/               github.ts
  scripts/           diagram-motion.ts (landing diagrams)
  styles/            global.css (tokens), starlight.css
integrations/        docs-images.mjs (build-time screenshot optimization) + test
scripts/             sync-docs.mjs, make-og.mjs, VERSIONING.md
```
