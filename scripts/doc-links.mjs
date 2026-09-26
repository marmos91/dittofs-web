import path from "node:path";
import { fromMarkdown } from "mdast-util-from-markdown";
import { parse, postprocess, preprocess } from "micromark";

export const GITHUB_REPO = "https://github.com/marmos91/dittofs";

// A checkout directory takes precedence over an archive ref as the source.
export function docsGitRef(env = process.env) {
  return env.DITTOFS_DOCS_EDITREF ||
    (!env.DITTOFS_DOCS_DIR && env.DITTOFS_DOCS_REF) ||
    (env.DITTOFS_DOCS_VERSION ? `${env.DITTOFS_DOCS_VERSION}.0` : "develop");
}

// Preserve Markdown formatting by editing only destination token ranges. The
// tokenizer handles nested labels, backticks, escapes, angle brackets and titles.
function destinationRanges(md) {
  const ranges = new Map();
  const parents = [];
  const events = postprocess(parse().document().write(preprocess()(md, undefined, true)));
  for (const [phase, token] of events) {
    if (["link", "image", "definition"].includes(token.type)) {
      if (phase === "enter") parents.push(token);
      else parents.pop();
    } else if (phase === "enter" &&
      ["resourceDestinationString", "definitionDestinationString"].includes(token.type)) {
      ranges.set(parents.at(-1).start.offset, [token.start.offset, token.end.offset]);
    }
  }
  return ranges;
}

export function rewriteLinksAndAssets(md, srcDocPath, {
  routes = new Map(),
  ref = "develop",
  registerAsset = (asset) => `/docs-assets/${asset}`,
} = {}) {
  const srcDir = path.posix.join("docs", path.posix.dirname(srcDocPath));
  const edits = [];
  const ranges = destinationRanges(md);
  const tree = fromMarkdown(md);
  const imageReferences = new Set();
  function collectImages(node) {
    if (node.type === "imageReference") imageReferences.add(node.identifier);
    for (const child of node.children || []) collectImages(child);
  }
  collectImages(tree);

  function rewrite(target, image = false) {
    // Includes site-root URLs, protocol-relative URLs and all URI schemes.
    if (/^(?:[a-z][a-z\d+.-]*:|\/|#|\?)/i.test(target) || !target) return target;
    const suffixAt = target.search(/[?#]/);
    const rawPath = suffixAt < 0 ? target : target.slice(0, suffixAt);
    const suffix = suffixAt < 0 ? "" : target.slice(suffixAt);
    if (image || /(?:^|\/)assets\//i.test(rawPath)) {
      return registerAsset(rawPath.replace(/^.*?assets\//i, "")) + suffix;
    }
    const repoPath = path.posix.normalize(path.posix.join(srcDir, rawPath));
    const route = routes.get(repoPath.toLowerCase());
    if (route) return route + suffix;
    const directory = rawPath.endsWith("/") || /(?:^|\/)\.{1,2}$/.test(rawPath);
    return `${GITHUB_REPO}/${directory ? "tree" : "blob"}/${ref}/${repoPath}${suffix}`;
  }

  function walk(node) {
    if (["link", "image", "definition"].includes(node.type)) {
      const rewritten = rewrite(node.url, node.type === "image" ||
        (node.type === "definition" && imageReferences.has(node.identifier)));
      if (rewritten !== node.url) {
        const [start, end] = ranges.get(node.position.start.offset);
        const value = rewritten.replace(/[\\()<>\s]/g, (char) =>
          `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
        edits.push({ start, end, value });
      }
    } else if (node.type === "html") {
      // HTML nodes exclude inline/fenced/indented code examples.
      const html = node.value.replace(
        /(<img\b[^>]*\bsrc=)(["'])(.*?)\2/gi,
        (full, prefix, quote, src) => {
          if (!/(?:^|\/)assets\//i.test(src)) return full;
          return prefix + quote + rewrite(src, true) + quote;
        },
      );
      if (html !== node.value) {
        edits.push({ start: node.position.start.offset, end: node.position.end.offset, value: html });
      }
    }
    for (const child of node.children || []) walk(child);
  }

  walk(tree);
  for (const { start, end, value } of edits.sort((a, b) => b.start - a.start)) {
    md = md.slice(0, start) + value + md.slice(end);
  }
  return md;
}
