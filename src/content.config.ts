import { defineCollection } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { docsVersionsLoader } from "starlight-versions/loader";

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  // Versioned doc snapshots (starlight-versions). Each released version is
  // archived under src/content/docs/<version>/** and served at /<version>/*.
  versions: defineCollection({ loader: docsVersionsLoader() }),
};
