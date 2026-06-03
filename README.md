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

## Build

```bash
npm run build         # -> dist/
npm run preview
npm run og            # regenerate the social share image
```

## Deploy (Cloudflare Pages)

- Build command: `npm run build`
- Output directory: `dist`

### Environment variables

See `.env.example`. `PUBLIC_*` vars are public; the rest are server-side
secrets for the contact form, set in the Cloudflare Pages dashboard.

| Variable | Purpose |
| --- | --- |
| `PUBLIC_SITE_URL` | Canonical URL (SEO/OG). |
| `PUBLIC_GTM_ID` / `PUBLIC_FB_PIXEL_ID` | Analytics. Empty = no cookie banner, no tags. |

The PRO contact form is a HubSpot embed configured in `src/pages/pro.astro`, so
it needs no environment variables.

## Structure

```
src/
  components/        Header, Footer, BrowserFrame, landing/*
  layouts/Base.astro Marketing page shell (meta, analytics, header/footer)
  pages/             index, pro, privacy, cookie-policy, terms
  content/docs/      Starlight docs (docs/** vendored from dittofs)
  styles/            global.css (tokens), starlight.css
scripts/             sync-docs.mjs, make-og.mjs
```
