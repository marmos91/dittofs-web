import { parseFragment } from "parse5";

const routeKey = (pathname) => pathname.replace(/\/$/, "") || "/";

// Only used on the versions plugin's rendered UI, never on document content.
// A page may exist in one release but not another: keep same-page navigation
// when possible, otherwise offer the target version's documentation index.
export function resolveVersionNavigation(html, routes) {
  const edits = [];
  function walk(node) {
    const name = node.tagName === "a" ? "href" : node.tagName === "option" ? "value" : undefined;
    const attr = node.attrs?.find((attr) => attr.name === name);
    if (attr) {
      const url = new URL(attr.value, "https://dittofs.io");
      const match = url.pathname.match(/^\/(v\d+\.\d+\/)?docs(?:\/|$)/);
      if (attr.value.startsWith("/") && !attr.value.startsWith("//") && match &&
          !routes.has(routeKey(url.pathname))) {
        const fallback = `/${match[1] || ""}docs/`;
        if (routes.has(routeKey(fallback))) {
          const { startOffset, endOffset } = node.sourceCodeLocation.attrs[name];
          edits.push({ startOffset, endOffset, replacement: `${name}="${fallback}"` });
        }
      }
    }
    for (const child of node.childNodes || []) walk(child);
  }
  walk(parseFragment(html, { sourceCodeLocationInfo: true }));
  for (const { startOffset, endOffset, replacement } of edits.sort((a, b) => b.startOffset - a.startOffset)) {
    html = html.slice(0, startOffset) + replacement + html.slice(endOffset);
  }
  return html;
}
