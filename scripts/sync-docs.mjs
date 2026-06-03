#!/usr/bin/env node
/*
 * sync-docs.mjs
 *
 * Vendors the curated, user-facing DittoFS docs from the Go repo into this
 * site's Starlight content collection. The dittofs repo is the single source
 * of truth; this script copies a fixed allowlist, injects Starlight
 * frontmatter, rewrites intra-doc links to /docs/* routes, and relocates
 * referenced images into public/docs-assets/.
 *
 * Run manually or from the scheduled "refresh-docs" GitHub Action:
 *   DITTOFS_DOCS_DIR=/path/to/dittofs/docs npm run sync-docs
 *
 * The build (`astro build`) does NOT run this; the synced markdown is
 * committed so Cloudflare builds stay hermetic.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SRC_DIR =
  process.env.DITTOFS_DOCS_DIR || path.resolve(ROOT, "..", "dittofs", "docs");
const OUT_DIR = path.resolve(ROOT, "src", "content", "docs", "docs");
const ASSET_OUT = path.resolve(ROOT, "public", "docs-assets");

/*
 * Curated allowlist. Each entry maps a source file to a sidebar group, a
 * route slug, and editorial metadata. Repo-internal docs (CONTRIBUTING,
 * RELEASING) are intentionally excluded.
 */
const DOCS = [
  // Overview
  { src: "ARCHITECTURE.md", group: "overview", slug: "architecture", order: 2,
    title: "Architecture",
    description: "How DittoFS is put together: adapters, the runtime control plane, and pluggable stores." },

  // Protocols
  { src: "NFS.md", group: "protocols", slug: "nfs", order: 1,
    title: "NFS",
    description: "Serving NFSv3, NFSv4.0, and NFSv4.1, plus how to mount from Linux and macOS." },
  { src: "SMB.md", group: "protocols", slug: "smb", order: 2,
    title: "SMB",
    description: "SMB2/3 dialects, encryption, signing, leases, durable handles, and client usage." },
  { src: "ACLS.md", group: "protocols", slug: "acls", order: 3,
    title: "Access Control Lists",
    description: "How DittoFS models and enforces ACLs across NFS and SMB." },

  // Storage & Stores
  { src: "IMPLEMENTING_STORES.md", group: "storage", slug: "implementing-stores", order: 1,
    title: "Implementing Stores",
    description: "Contracts for building custom metadata and block stores." },
  { src: "BLOCKSTORE_MIGRATION.md", group: "storage", slug: "blockstore-migration", order: 2,
    title: "Block Store Migration",
    description: "Moving data between block storage backends." },
  { src: "SNAPSHOTS.md", group: "storage", slug: "snapshots", order: 3,
    title: "Snapshots",
    description: "Point-in-time share snapshots, restore runbook, and recovery." },

  // Security
  { src: "SECURITY.md", group: "security", slug: "security", order: 1,
    title: "Security",
    description: "Authentication methods, threat model notes, and best practices." },
  { src: "ENCRYPTION.md", group: "security", slug: "encryption", order: 2,
    title: "Encryption",
    description: "Client-side envelope encryption, key management, and KMIP." },

  // Operations
  { src: "CONFIGURATION.md", group: "operations", slug: "configuration", order: 1,
    title: "Configuration",
    description: "Server configuration, store management, and runtime CLI examples." },
  { src: "TROUBLESHOOTING.md", group: "operations", slug: "troubleshooting", order: 2,
    title: "Troubleshooting",
    description: "Common issues and how to resolve them." },
  { src: "WINDOWS_TESTING.md", group: "operations", slug: "windows-testing", order: 3,
    title: "Windows Clients",
    description: "Notes on Windows client compatibility and testing." },
  { src: "BENCHMARKS.md", group: "operations", slug: "benchmarks", order: 4,
    title: "Benchmarks",
    description: "Performance measurements and methodology." },

  // Reference
  { src: "CLI.md", group: "reference", slug: "cli", order: 1,
    title: "CLI Reference",
    description: "Complete reference for the dfs server and dfsctl client commands." },
  { src: "FAQ.md", group: "reference", slug: "faq", order: 2,
    title: "FAQ",
    description: "Frequently asked questions about features, storage, and protocols." },
];

// filename (lowercase) -> /docs route, for intra-doc link rewriting.
const ROUTE_BY_FILE = new Map(
  DOCS.map((d) => [d.src.toLowerCase(), `/docs/${d.group}/${d.slug}`]),
);

const GITHUB_BLOB = "https://github.com/marmos91/dittofs/blob/develop/docs";

function escapeYaml(s) {
  return s.replace(/"/g, '\\"');
}

function stripLeadingH1(md) {
  // Starlight renders the frontmatter title as the page H1; drop a leading
  // markdown H1 so it is not duplicated.
  return md.replace(/^\s*#\s+.+?\r?\n+/, "");
}

const usedAssets = new Set();

function rewriteLinksAndAssets(md) {
  // Markdown links/images: [text](target) — target may have an #anchor.
  return md.replace(
    /(!?)\[([^\]]*)\]\(([^)]+)\)/g,
    (full, bang, text, target) => {
      const trimmed = target.trim();

      // Leave absolute URLs, mailto, and pure anchors untouched.
      if (/^(https?:|mailto:|#)/i.test(trimmed)) return full;

      const [rawPath, anchor] = trimmed.split("#");
      const cleaned = rawPath.replace(/^\.\//, "");

      // Image / asset reference (assets/foo.png).
      if (bang === "!" || /^assets\//i.test(cleaned)) {
        const fileName = path.basename(cleaned);
        usedAssets.add(cleaned.replace(/^.*assets\//i, ""));
        return `${bang}[${text}](/docs-assets/${fileName})`;
      }

      // Intra-doc markdown link to another curated page.
      if (/\.md$/i.test(cleaned)) {
        const key = path.basename(cleaned).toLowerCase();
        const route = ROUTE_BY_FILE.get(key);
        const suffix = anchor ? `#${anchor}` : "";
        if (route) return `[${text}](${route}${suffix})`;
        // Not curated -> link out to the source on GitHub.
        return `[${text}](${GITHUB_BLOB}/${path.basename(cleaned)}${suffix})`;
      }

      return full;
    },
  );
}

async function copyAssets() {
  if (usedAssets.size === 0) return;
  await fs.mkdir(ASSET_OUT, { recursive: true });
  for (const rel of usedAssets) {
    const from = path.join(SRC_DIR, "assets", rel);
    const to = path.join(ASSET_OUT, path.basename(rel));
    try {
      await fs.copyFile(from, to);
    } catch (err) {
      console.warn(`  ! asset missing, skipped: assets/${rel} (${err.code})`);
    }
  }
}

async function main() {
  try {
    await fs.access(SRC_DIR);
  } catch {
    console.error(
      `\n  Source docs not found at: ${SRC_DIR}\n` +
        `  Set DITTOFS_DOCS_DIR to your dittofs/docs checkout and retry.\n`,
    );
    process.exit(1);
  }

  console.log(`Syncing docs from: ${SRC_DIR}`);
  let written = 0;

  for (const doc of DOCS) {
    const srcPath = path.join(SRC_DIR, doc.src);
    let raw;
    try {
      raw = await fs.readFile(srcPath, "utf8");
    } catch {
      console.warn(`  ! skipped (not found): ${doc.src}`);
      continue;
    }

    let body = stripLeadingH1(raw);
    body = rewriteLinksAndAssets(body);

    const frontmatter =
      `---\n` +
      `title: "${escapeYaml(doc.title)}"\n` +
      `description: "${escapeYaml(doc.description)}"\n` +
      `sidebar:\n  order: ${doc.order}\n` +
      `# Synced from dittofs/docs/${doc.src} — do not edit here.\n` +
      `---\n\n`;

    const outPath = path.join(OUT_DIR, doc.group, `${doc.slug}.md`);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, frontmatter + body, "utf8");
    written += 1;
    console.log(`  + ${doc.group}/${doc.slug}.md  (${doc.src})`);
  }

  await copyAssets();

  console.log(
    `\nDone. ${written}/${DOCS.length} docs synced, ${usedAssets.size} assets copied.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
