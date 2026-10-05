import { getCollection } from "astro:content";
import { ALL_VERSIONS_PATH } from "../../integrations/all-versions-page.mjs";

async function loadRoutes() {
  const entries = await getCollection("docs", ({ data }) => !data.draft || import.meta.env.MODE !== "production");
  // This injected Starlight page is not a content-collection entry.
  return new Set([
    ...entries.map(({ id }) => `/${id.replace(/\/$/, "")}`),
    ALL_VERSIONS_PATH.replace(/\/$/, ""),
  ]);
}

let buildRoutes: ReturnType<typeof loadRoutes> | undefined;

export function getDocsRoutes() {
  // Build all archives against one inventory; dev reloads must see edits.
  return import.meta.env.PROD ? (buildRoutes ??= loadRoutes()) : loadRoutes();
}
