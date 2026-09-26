import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "parse5";

const routeKey = (pathname) => pathname.replace(/\/$/, "") || "/";
const isDocRoute = (pathname) => pathname.split("/").includes("docs");

export async function findBrokenDocLinks(directory, site = "https://dittofs.io") {
  const pages = new Map();
  const files = await fs.readdir(directory, { recursive: true });
  for (const file of files.filter((file) => file.endsWith(".html"))) {
    const route = "/" + file.split(path.sep).join("/").replace(/index\.html$/, "");
    if (!isDocRoute(route)) continue;
    const ids = new Set();
    const links = [];
    function walk(node) {
      const attrs = Object.fromEntries((node.attrs || []).map(({ name, value }) => [name, value]));
      if (attrs.id) ids.add(attrs.id);
      if (node.tagName === "a" && attrs.href) links.push(attrs.href);
      for (const child of node.childNodes || []) walk(child);
    }
    walk(parse(await fs.readFile(path.join(directory, file), "utf8")));
    pages.set(routeKey(route), { route, ids, links });
  }
  if (pages.size === 0) throw new Error("No built documentation pages found. Run npm run build first.");

  const broken = [];
  const origin = new URL(site).origin;
  for (const { route, links } of pages.values()) {
    for (const href of links) {
      const target = new URL(href, new URL(route, site));
      if (target.origin !== origin || !isDocRoute(target.pathname)) continue;
      const page = pages.get(routeKey(target.pathname));
      if (!page) {
        broken.push({ page: route, href, reason: "missing page" });
      } else if (target.hash && !page.ids.has(decodeURIComponent(target.hash.slice(1)))) {
        broken.push({ page: route, href, reason: "missing heading" });
      }
    }
  }
  return broken;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const broken = await findBrokenDocLinks(path.resolve("dist"), process.env.PUBLIC_SITE_URL);
  for (const { page, href, reason } of broken) console.error(`${page}: ${href} (${reason})`);
  if (broken.length) process.exitCode = 1;
  else console.log("All internal documentation links resolve to built pages and headings.");
}
