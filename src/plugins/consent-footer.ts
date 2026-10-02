import type { StarlightPlugin } from "@astrojs/starlight/types";

// Compose with other footer-independent overrides, including version navigation.
const consentFooter: StarlightPlugin = {
  name: "consent-footer",
  hooks: {
    "config:setup"({ config, updateConfig }) {
      updateConfig({
        components: {
          ...config.components,
          Footer: "./src/components/StarlightFooter.astro",
          EditLink: "./src/components/StarlightEditLink.astro",
        },
      });
    },
  },
};

export default consentFooter;
