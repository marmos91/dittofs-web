// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import starlightVersions from "starlight-versions";
import consentFooter from "./src/plugins/consent-footer";
import { readFileSync } from "node:fs";
import docsImages from "./integrations/docs-images.mjs";
import allVersionsPage from "./integrations/all-versions-page.mjs";

/*
 * Documentation versions. The latest docs are served at /docs/* (no entry
 * here). Each released snapshot is listed below and served at /<slug>/docs/*
 * (e.g. /v0.22/docs/getting-started). To cut a new version, see
 * scripts/VERSIONING.md. Until the first release snapshot is created this list
 * stays empty — an empty list leaves the site single-version with no switcher.
 */
/** @type {import("starlight-versions").StarlightVersionsUserConfig["versions"]} */
const DOC_VERSIONS = [
  { slug: "v0.34" },
  { slug: "v0.33" },
  { slug: "v0.32" },
  { slug: "v0.31" },
  { slug: "v0.30" },
  { slug: "v0.29" },
  { slug: "v0.28" },
  { slug: "v0.27" },
  { slug: "v0.26" },
  { slug: "v0.25" },
  { slug: "v0.24" },
  { slug: "v0.23" },
  { slug: "v0.22" },
  // Legacy versions have far fewer pages, so the version selector sends them
  // to /<slug>/docs/ instead of the same page (which would often 404).
  { slug: "v0.21", redirect: "root" },
  { slug: "v0.20", redirect: "root" },
  { slug: "v0.19", redirect: "root" },
  { slug: "v0.18", redirect: "root" },
  { slug: "v0.17", redirect: "root" },
  { slug: "v0.16", redirect: "root" },
  { slug: "v0.15", redirect: "root" },
  { slug: "v0.14", redirect: "root" },
  { slug: "v0.13", redirect: "root" },
  { slug: "v0.12", redirect: "root" },
  { slug: "v0.11", redirect: "root" },
  { slug: "v0.10", redirect: "root" },
  { slug: "v0.9", redirect: "root" },
  { slug: "v0.8", redirect: "root" },
  { slug: "v0.7", redirect: "root" },
  { slug: "v0.6", redirect: "root" },
  { slug: "v0.5", redirect: "root" },
  { slug: "v0.4", redirect: "root" },
  { slug: "v0.3", redirect: "root" },
  { slug: "v0.2", redirect: "root" },
  { slug: "v0.1", redirect: "root" },
];

/*
 * Label for the Latest docs. scripts/sync-docs.mjs writes the ref Latest was
 * synced from to src/data/latest-docs.json. A release tag shows its minor
 * ("v0.34.0" -> "Latest (v0.34)"); anything else, or no file, shows "Latest".
 */
function latestDocsLabel() {
  let ref;
  try {
    ({ ref } = JSON.parse(readFileSync("./src/data/latest-docs.json", "utf8")));
  } catch {
    return "Latest";
  }
  const isReleaseTag = /^v\d+\.\d+\.\d+$/.test(ref);
  return isReleaseTag ? `Latest (${ref.split(".").slice(0, 2).join(".")})` : "Latest";
}

// Canonical site URL. Overridable per-environment (preview deploys, etc.).
const SITE = process.env.PUBLIC_SITE_URL || "https://dittofs.io";

const GITHUB_REPO = "https://github.com/marmos91/dittofs";

// https://astro.build/config
export default defineConfig({
  site: SITE,
  integrations: [
    react(),
    docsImages(),
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
      customCss: ["./src/styles/starlight.css"],
      // The versions plugin requires at least one version; until the first
      // release snapshot is cut, DOC_VERSIONS is empty and we omit the plugin
      // (the site stays single-version, no switcher). Add a slug to
      // DOC_VERSIONS to enable it. See scripts/VERSIONING.md.
      plugins: [
        consentFooter,
        ...(DOC_VERSIONS.length > 0
          ? [starlightVersions({
              current: { label: latestDocsLabel() },
              versions: DOC_VERSIONS,
            })]
          : []),
      ],
      components: {
        // Mobile menu: version and theme selectors above the page list.
        Sidebar: "./src/components/docs/Sidebar.astro",
        // Compact version selector (Latest + newest versions + "All versions…").
        // Only when the versions plugin is loaded: the override reads its config.
        ...(DOC_VERSIONS.length > 0
          ? { ThemeSelect: "./src/components/docs/ThemeSelect.astro" }
          : {}),
      },
      sidebar: [
        { label: "Getting Started", items: [{ autogenerate: { directory: "docs/getting-started" } }] },
        { label: "Connect Clients", items: [{ autogenerate: { directory: "docs/connect" } }] },
        { label: "Features & Operations", items: [{ autogenerate: { directory: "docs/operations" } }] },
        { label: "Contributing", items: [{ autogenerate: { directory: "docs/contributing" } }] },
        { label: "Product", items: [{ autogenerate: { directory: "docs/product" } }] },
      ],
    }),
    // "All versions" page linked from the version selector; needs the versions plugin.
    ...(DOC_VERSIONS.length > 0 ? [allVersionsPage()] : []),
  ],
});
