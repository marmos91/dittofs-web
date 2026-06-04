// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";

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
      sidebar: [
        { label: "Overview", items: [{ autogenerate: { directory: "docs/overview" } }] },
        { label: "Protocols", items: [{ autogenerate: { directory: "docs/protocols" } }] },
        { label: "Storage & Stores", items: [{ autogenerate: { directory: "docs/storage" } }] },
        { label: "Security", items: [{ autogenerate: { directory: "docs/security" } }] },
        { label: "Operations", items: [{ autogenerate: { directory: "docs/operations" } }] },
        { label: "Reference", items: [{ autogenerate: { directory: "docs/reference" } }] },
      ],
    }),
  ],
});
