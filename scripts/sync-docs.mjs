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
 * Source selection (in priority order):
 *   1. DITTOFS_DOCS_DIR=/path/to/checkout/docs  — use an existing checkout.
 *   2. DITTOFS_DOCS_REF=v0.22.0                  — export that git ref's docs
 *      from the repo at DITTOFS_REPO_DIR (default ../dittofs) into a temp dir.
 *   3. fallback: ../dittofs/docs on disk (current working tree).
 *
 * Output selection:
 *   - DITTOFS_DOCS_VERSION=v0.22 writes into the versioned snapshot tree
 *     (src/content/docs/<version>/docs/**) instead of the latest tree. See
 *     scripts/VERSIONING.md for the release-snapshot workflow.
 *
 * Run manually or from the scheduled "refresh-docs" GitHub Action:
 *   DITTOFS_DOCS_DIR=/path/to/dittofs/docs npm run sync-docs
 *
 * The build (`astro build`) does NOT run this; the synced markdown is
 * committed so Cloudflare builds stay hermetic.
 */
import { promises as fs, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DOCS_REF = process.env.DITTOFS_DOCS_REF || "";
const REPO_DIR =
  process.env.DITTOFS_REPO_DIR || path.resolve(ROOT, "..", "dittofs");

/*
 * Resolve the docs source directory. When DITTOFS_DOCS_REF is set, export that
 * git ref's docs/ tree into a temp dir so release snapshots pull a tag's docs
 * rather than the working tree. Otherwise use DITTOFS_DOCS_DIR or the sibling
 * checkout's docs/.
 */
function resolveSrcDir() {
  if (process.env.DITTOFS_DOCS_DIR) {
    return { dir: path.resolve(process.env.DITTOFS_DOCS_DIR), tmp: null };
  }
  if (DOCS_REF) {
    const out = mkdtempSync(path.join(os.tmpdir(), "dittofs-docs-"));
    // `git archive <ref> docs | tar -x` extracts that ref's docs/ tree.
    const archive = execFileSync("git", ["archive", DOCS_REF, "docs"], {
      cwd: REPO_DIR,
      maxBuffer: 256 * 1024 * 1024,
    });
    execFileSync("tar", ["-x", "-C", out], { input: archive });
    return { dir: path.join(out, "docs"), tmp: out };
  }
  return { dir: path.resolve(ROOT, "..", "dittofs", "docs"), tmp: null };
}

const { dir: SRC_DIR, tmp: TMP_DIR } = resolveSrcDir();

// Versioned snapshots live under src/content/docs/<version>/docs/**, served at
// /<version>/docs/*. The latest docs live at src/content/docs/docs/** (/docs/*).
const DOCS_VERSION = process.env.DITTOFS_DOCS_VERSION || "";
const CONTENT_BASE = path.resolve(ROOT, "src", "content", "docs");
const OUT_DIR = DOCS_VERSION
  ? path.join(CONTENT_BASE, DOCS_VERSION, "docs")
  : path.join(CONTENT_BASE, "docs");
const ASSET_OUT = path.resolve(ROOT, "public", "docs-assets");

// Route prefix used when rewriting intra-doc links. Versioned snapshots are
// served under /<version>/docs/*; latest under /docs/*.
const ROUTE_PREFIX = DOCS_VERSION ? `/${DOCS_VERSION}/docs` : "/docs";

/*
 * Curated, audience-first allowlist. Each entry maps a source file (nested
 * path under the repo's docs/ dir) to a sidebar group, a route slug, and
 * editorial metadata. Repo-internal docs (CONTRIBUTING, RELEASING) and the
 * hidden BENCHMARKS page are intentionally excluded.
 *
 * Groups, in sidebar order:
 *   getting-started  Getting Started
 *   connect          Connect Clients
 *   operations       Features & Operations
 *   contributing     Contributing (internals)
 *   product          Product
 */
const DOCS = [
  // ---- Getting Started ----
  { src: "guide/getting-started.md", group: "getting-started", slug: "getting-started", order: 1,
    title: "Getting Started",
    description: "Install DittoFS, start the server, create a share, and mount it." },
  { src: "guide/install.md", group: "getting-started", slug: "install", order: 2,
    title: "Install & Deploy",
    description: "Binaries, Docker, and Kubernetes deployment options for DittoFS." },
  { src: "guide/configuration.md", group: "getting-started", slug: "configuration", order: 3,
    title: "Configuration",
    description: "Server configuration file, environment variables, and runtime CLI examples." },
  { src: "guide/choosing-stores.md", group: "getting-started", slug: "choosing-stores", order: 4,
    title: "Choosing Stores",
    description: "Pick the right metadata and block stores for your workload." },
  { src: "guide/cli.md", group: "getting-started", slug: "cli", order: 5,
    title: "CLI Reference",
    description: "Complete reference for the dfs server and dfsctl client commands." },

  // ---- Connect Clients ----
  { src: "guide/nfs.md", group: "connect", slug: "nfs", order: 1,
    title: "NFS",
    description: "Serving NFSv3/4.0/4.1 and mounting from Linux and macOS." },
  { src: "guide/smb.md", group: "connect", slug: "smb", order: 2,
    title: "SMB",
    description: "SMB2/3 dialects, encryption, signing, leases, durable handles, and client usage." },
  { src: "guide/windows.md", group: "connect", slug: "windows", order: 3,
    title: "Windows Clients",
    description: "Connecting a Windows client to DittoFS over SMB." },
  { src: "guide/identity.md", group: "connect", slug: "identity", order: 4,
    title: "Identity (AD / LDAP / Kerberos)",
    description: "Active Directory, LDAP, Kerberos, and NTLM integration." },
  { src: "guide/access-control.md", group: "connect", slug: "access-control", order: 5,
    title: "Access Control",
    description: "How DittoFS models and enforces permissions and ACLs across NFS and SMB." },
  { src: "guide/smb-acl-fidelity.md", group: "connect", slug: "smb-acl-fidelity", order: 6,
    title: "SMB ACL Fidelity",
    description: "Windows-ACL / security-descriptor fidelity matrix for SMB." },

  // ---- Features & Operations ----
  { src: "guide/snapshots.md", group: "operations", slug: "snapshots", order: 1,
    title: "Snapshots",
    description: "Point-in-time share snapshots, restore runbook, and recovery." },
  { src: "guide/quotas.md", group: "operations", slug: "quotas", order: 2,
    title: "Quotas",
    description: "Per-share byte and inode quotas with soft/hard limits and grace periods." },
  { src: "guide/encryption.md", group: "operations", slug: "encryption", order: 3,
    title: "Encryption",
    description: "Client-side block encryption, key management, and KMIP." },
  { src: "guide/security.md", group: "operations", slug: "security", order: 4,
    title: "Security",
    description: "Authentication methods, threat model notes, and best practices." },
  { src: "guide/block-store-migration.md", group: "operations", slug: "block-store-migration", order: 5,
    title: "Block Store Migration",
    description: "Moving data between block storage backends." },
  { src: "guide/troubleshooting.md", group: "operations", slug: "troubleshooting", order: 6,
    title: "Troubleshooting",
    description: "Common issues and how to resolve them." },
  { src: "guide/faq.md", group: "operations", slug: "faq", order: 7,
    title: "FAQ",
    description: "Frequently asked questions about features, storage, and protocols." },
  { src: "guide/glossary.md", group: "operations", slug: "glossary", order: 8,
    title: "Glossary",
    description: "Definitions of DittoFS terms and concepts." },

  // ---- Contributing (internals) ----
  { src: "internals/architecture.md", group: "contributing", slug: "architecture", order: 1,
    title: "Architecture",
    description: "How DittoFS is put together: adapters, the runtime control plane, and pluggable stores." },
  { src: "internals/nfs-protocol.md", group: "contributing", slug: "nfs-protocol", order: 2,
    title: "NFS Protocol Internals",
    description: "Internal design of the NFS adapter and dispatch path." },
  { src: "internals/smb-protocol.md", group: "contributing", slug: "smb-protocol", order: 3,
    title: "SMB Protocol Internals",
    description: "Internal design of the SMB adapter, sessions, and handlers." },
  { src: "internals/acl-design.md", group: "contributing", slug: "acl-design", order: 4,
    title: "ACL Design",
    description: "Internal model for access-control lists across protocols." },
  { src: "internals/security-model.md", group: "contributing", slug: "security-model", order: 5,
    title: "Security Model",
    description: "Internal authentication, authorization, and squashing model." },
  { src: "internals/encryption-design.md", group: "contributing", slug: "encryption-design", order: 6,
    title: "Encryption Design",
    description: "Internal envelope-encryption and key-management design." },
  { src: "internals/implementing-stores.md", group: "contributing", slug: "implementing-stores", order: 7,
    title: "Implementing Stores",
    description: "Contracts for building custom metadata and block stores." },
  { src: "internals/testing.md", group: "contributing", slug: "testing", order: 8,
    title: "Testing",
    description: "Unit, integration, conformance, and end-to-end testing." },
  { src: "internals/debugging.md", group: "contributing", slug: "debugging", order: 9,
    title: "Debugging Protocol Interop",
    description: "SMB/NFS pcap-diff interop debugging playbook." },

  // ---- Product ----
  { src: "product/pro.md", group: "product", slug: "pro", order: 1,
    title: "DittoFS Pro",
    description: "The DittoFS Pro web dashboard for managing stores, shares, and adapters." },
];

// basename (lowercase) -> /docs route, for intra-doc link rewriting. The new
// docs use RELATIVE links (./configuration.md, ../internals/architecture.md);
// keying by basename makes them resolve regardless of the relative prefix.
// Basenames are unique across the curated set.
const ROUTE_BY_FILE = new Map(
  DOCS.map((d) => [
    path.basename(d.src).toLowerCase(),
    `${ROUTE_PREFIX}/${d.group}/${d.slug}`,
  ]),
);

const GITHUB_REPO = "https://github.com/marmos91/dittofs";
const GITHUB_BLOB = `${GITHUB_REPO}/blob/develop`;

function escapeYaml(s) {
  return s.replace(/"/g, '\\"');
}

function stripLeadingH1(md) {
  // Starlight renders the frontmatter title as the page H1; drop a leading
  // markdown H1 so it is not duplicated.
  return md.replace(/^\s*#\s+.+?\r?\n+/, "");
}

const usedAssets = new Set();

// Register an asset reference (path may be like ../assets/pro/x.png or
// assets/x.png) and return the public URL it should be rewritten to. Assets
// are flattened by their path relative to the docs assets/ dir, so
// ../assets/pro/x.png -> /docs-assets/pro/x.png.
function registerAsset(refPath) {
  const rel = refPath.replace(/^.*?assets\//i, ""); // e.g. "pro/x.png" or "x.png"
  usedAssets.add(rel);
  return `/docs-assets/${rel}`;
}

function rewriteHtmlImages(md) {
  // <img src="../assets/pro/x.png" ...> — rewrite the src to /docs-assets/*.
  return md.replace(
    /(<img\b[^>]*\bsrc=")([^"]+)(")/gi,
    (full, pre, src, post) => {
      const trimmed = src.trim();
      if (/^(https?:|data:|\/)/i.test(trimmed)) return full;
      if (/assets\//i.test(trimmed)) {
        return `${pre}${registerAsset(trimmed)}${post}`;
      }
      return full;
    },
  );
}

// srcDocPath is the doc's path under the repo docs/ dir (e.g. "guide/install.md")
// so relative links resolve against the file's own location.
function rewriteLinksAndAssets(md, srcDocPath) {
  // Dir of the source file under the repo root, e.g. "docs/guide".
  const srcDir = path.posix.join("docs", path.posix.dirname(srcDocPath));

  md = rewriteHtmlImages(md);
  // Markdown links/images: [text](target) — target may have an #anchor.
  return md.replace(
    /(!?)\[([^\]]*)\]\(([^)]+)\)/g,
    (full, bang, text, target) => {
      const trimmed = target.trim();

      // Leave absolute URLs, mailto, and pure anchors untouched.
      if (/^(https?:|mailto:|#)/i.test(trimmed)) return full;

      const [rawPath, anchor] = trimmed.split("#");
      const suffix = anchor ? `#${anchor}` : "";

      // Image / asset reference (markdown image, or any assets/ path).
      if (bang === "!" || /assets\//i.test(rawPath)) {
        return `${bang}[${text}](${registerAsset(rawPath)})`;
      }

      // Markdown link to a .md file.
      if (/\.md$/i.test(rawPath)) {
        const key = path.basename(rawPath).toLowerCase();
        const route = ROUTE_BY_FILE.get(key);
        if (route) return `[${text}](${route}${suffix})`;

        // Not a curated page (e.g. ../../README.md, contributing.md, a
        // KNOWN_FAILURES.md under test/). Resolve the relative path against the
        // source file's directory and link to the GitHub blob at that path.
        const repoRel = path.posix.normalize(
          path.posix.join(srcDir, rawPath),
        );
        return `[${text}](${GITHUB_BLOB}/${repoRel}${suffix})`;
      }

      return full;
    },
  );
}

async function copyAssets() {
  if (usedAssets.size === 0) return;
  for (const rel of usedAssets) {
    const from = path.join(SRC_DIR, "assets", rel);
    const to = path.join(ASSET_OUT, rel);
    try {
      await fs.mkdir(path.dirname(to), { recursive: true });
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
        `  Set DITTOFS_DOCS_DIR to your dittofs/docs checkout (or\n` +
        `  DITTOFS_DOCS_REF=<tag> with DITTOFS_REPO_DIR) and retry.\n`,
    );
    process.exit(1);
  }

  console.log(`Syncing docs from: ${SRC_DIR}`);
  console.log(`Writing to:        ${OUT_DIR}`);
  if (DOCS_VERSION) console.log(`Version snapshot:  ${DOCS_VERSION}`);
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
    body = rewriteLinksAndAssets(body, doc.src);

    // Point "Edit page" at the real source in the main repo, not this site's
    // vendored copy. Pin snapshots to their tag; latest tracks develop.
    const editRef = DOCS_VERSION ? `${DOCS_VERSION}.0` : "develop";
    const editUrl = `${GITHUB_REPO}/edit/${editRef}/docs/${doc.src}`;

    const frontmatter =
      `---\n` +
      `title: "${escapeYaml(doc.title)}"\n` +
      `description: "${escapeYaml(doc.description)}"\n` +
      `editUrl: "${editUrl}"\n` +
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

  if (TMP_DIR) {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
