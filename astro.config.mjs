// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import starlightVersions from "starlight-versions";

/*
 * Documentation versions. The latest docs are served at /docs/* (no entry
 * here). Each released snapshot is listed below and served at /<slug>/docs/*
 * (e.g. /v0.22/docs/getting-started). To cut a new version, see
 * scripts/VERSIONING.md. Until the first release snapshot is created this list
 * stays empty — an empty list leaves the site single-version with no switcher.
 */
const DOC_VERSIONS = [
  { slug: "v0.22" },
];

// Canonical site URL. Overridable per-environment (preview deploys, etc.).
const SITE = process.env.PUBLIC_SITE_URL || "https://dittofs.io";

const GTM_ID = process.env.PUBLIC_GTM_ID ?? "";

const GITHUB_REPO = "https://github.com/marmos91/dittofs";

// https://astro.build/config
export default defineConfig({
  site: SITE,
  integrations: [
    react(),
    starlight({
      title: "DittoFS",
      description:
        "Modular virtual filesystem in Go. NFS and SMB in userspace, with pluggable storage.",
      logo: {
        // light theme -> black-ink wordmark; dark theme -> white-ink wordmark.
        light: "./src/assets/logo-dark.svg",
        dark: "./src/assets/logo-light.svg",
        replacesTitle: true,
      },
      favicon: "/favicon.svg",
      social: [
        { icon: "github", label: "GitHub", href: GITHUB_REPO },
      ],
      // Docs live under src/content/docs/docs/** so they serve at /docs/*,
      // leaving the site root for the marketing landing page (src/pages/index.astro).
      // Per-page "Edit" links point at the real source in the main repo and are
      // set via each page's `editUrl` frontmatter by scripts/sync-docs.mjs.
      editLink: {
        baseUrl: `${GITHUB_REPO}/edit/develop/docs/`,
      },
      head: GTM_ID
        ? [
            {
              tag: "script",
              content: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`,
            },
          ]
        : [],
      customCss: ["./src/styles/starlight.css"],
      // The versions plugin requires at least one version; until the first
      // release snapshot is cut, DOC_VERSIONS is empty and we omit the plugin
      // (the site stays single-version, no switcher). Add a slug to
      // DOC_VERSIONS to enable it. See scripts/VERSIONING.md.
      plugins:
        DOC_VERSIONS.length > 0
          ? [starlightVersions({ versions: DOC_VERSIONS })]
          : [],
      sidebar: [
        { label: "Getting Started", items: [{ autogenerate: { directory: "docs/getting-started" } }] },
        { label: "Connect Clients", items: [{ autogenerate: { directory: "docs/connect" } }] },
        { label: "Features & Operations", items: [{ autogenerate: { directory: "docs/operations" } }] },
        { label: "Contributing", items: [{ autogenerate: { directory: "docs/contributing" } }] },
        { label: "Product", items: [{ autogenerate: { directory: "docs/product" } }] },
      ],
    }),
  ],
});
