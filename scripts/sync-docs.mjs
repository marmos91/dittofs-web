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
 * Run manually or from the "refresh-docs" GitHub Action:
 *   DITTOFS_DOCS_DIR=/path/to/dittofs/docs npm run sync-docs
 *
 * The build (`astro build`) does NOT run this; the synced markdown is
 * committed so Cloudflare builds stay hermetic.
 */
import { promises as fs, mkdtempSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { docsGitRef, docsEditRef, GITHUB_REPO, rewriteLinksAndAssets } from "./doc-links.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DOCS_REF = process.env.DITTOFS_DOCS_REF || "";
// Ref matching the selected source: used for links to other repo files and,
// for the latest tree, written to LATEST_META so astro.config.mjs can label it.
const SOURCE_REF = docsGitRef();
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
const LATEST_META = path.resolve(ROOT, "src", "data", "latest-docs.json");

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
/*
 * Legacy layout (v0.1 to v0.21): flat docs/UPPERCASE.md files, before the
 * docs/guide + docs/internals split. Used automatically when the source has
 * no guide/ dir. Entries whose file doesn't exist in a given version are
 * skipped, so each version only gets the pages it actually had.
 */
const LEGACY_DOCS = [
  // ---- Getting Started ----
  { src: "DEPLOYMENT.md", group: "getting-started", slug: "install", order: 2,
    title: "Install & Deploy", description: "Deployment options for DittoFS." },
  { src: "CONFIGURATION.md", group: "getting-started", slug: "configuration", order: 3,
    title: "Configuration", description: "Server configuration file and environment variables." },
  { src: "CLI.md", group: "getting-started", slug: "cli", order: 5,
    title: "CLI Reference", description: "Reference for the dfs and dfsctl commands." },

  // ---- Connect Clients ----
  { src: "NFS.md", group: "connect", slug: "nfs", order: 1,
    title: "NFS", description: "Serving NFS and mounting from clients." },
  { src: "SMB.md", group: "connect", slug: "smb", order: 2,
    title: "SMB", description: "Serving SMB and mounting from clients." },
  { src: "AD_LDAP_KERBEROS.md", group: "connect", slug: "identity", order: 4,
    title: "Identity (AD / LDAP / Kerberos)", description: "Directory services and Kerberos." },
  { src: "ACLS.md", group: "connect", slug: "access-control", order: 5,
    title: "Access Control", description: "ACLs and permissions." },

  // ---- Features & Operations ----
  { src: "SNAPSHOTS.md", group: "operations", slug: "snapshots", order: 1,
    title: "Snapshots", description: "Share snapshots." },
  { src: "ENCRYPTION.md", group: "operations", slug: "encryption", order: 3,
    title: "Encryption", description: "Data encryption." },
  { src: "SECURITY.md", group: "operations", slug: "security", order: 4,
    title: "Security", description: "Security model and hardening." },
  { src: "BLOCKSTORE_MIGRATION.md", group: "operations", slug: "block-store-migration", order: 5,
    title: "Block Store Migration", description: "Migrating block store layouts." },
  { src: "BACKUP.md", group: "operations", slug: "backup", order: 6,
    title: "Backup", description: "Backing up DittoFS." },
  { src: "API_AUTHENTICATION.md", group: "operations", slug: "api-authentication", order: 7,
    title: "API Authentication", description: "Control plane API authentication." },
  { src: "TROUBLESHOOTING.md", group: "operations", slug: "troubleshooting", order: 8,
    title: "Troubleshooting", description: "Common issues and fixes." },
  { src: "KNOWN_LIMITATIONS.md", group: "operations", slug: "known-limitations", order: 9,
    title: "Known Limitations", description: "Current limitations." },
  { src: "FAQ.md", group: "operations", slug: "faq", order: 10,
    title: "FAQ", description: "Frequently asked questions." },
  { src: "GLOSSARY.md", group: "operations", slug: "glossary", order: 11,
    title: "Glossary", description: "Terms used in DittoFS." },

  // ---- Contributing ----
  { src: "ARCHITECTURE.md", group: "contributing", slug: "architecture", order: 1,
    title: "Architecture", description: "How the pieces fit together." },
  { src: "NFS_PROTOCOL_GUIDE.md", group: "contributing", slug: "nfs-protocol", order: 2,
    title: "NFS Protocol Internals", description: "NFS implementation details." },
  { src: "SMB_PROTOCOL_GUIDE.md", group: "contributing", slug: "smb-protocol", order: 3,
    title: "SMB Protocol Internals", description: "SMB implementation details." },
  { src: "IMPLEMENTING_STORES.md", group: "contributing", slug: "implementing-stores", order: 4,
    title: "Implementing Stores", description: "Writing a metadata or block store." },
  { src: "CACHE.md", group: "contributing", slug: "cache", order: 5,
    title: "Cache", description: "Cache design." },
  { src: "PAYLOAD.md", group: "contributing", slug: "payload", order: 6,
    title: "Payload", description: "Payload handling." },
  { src: "WINDOWS_TESTING.md", group: "contributing", slug: "testing", order: 7,
    title: "Testing", description: "Windows testing setup." },
  { src: "DEBUGGING.md", group: "contributing", slug: "debugging", order: 8,
    title: "Debugging", description: "Debugging DittoFS." },

  // ---- Product ----
  { src: "PRO.md", group: "product", slug: "pro", order: 1,
    title: "DittoFS Pro", description: "DittoFS Pro." },
];

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
  { src: "guide/persistent-mounts.md", group: "connect", slug: "persistent-mounts", order: 3,
    title: "Mount at Boot",
    description: "Make NFS and SMB mounts survive a reboot with fstab and systemd automount." },
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

// Pick the layout from the source tree: no guide/ dir means the legacy layout.
// Only keep entries whose source file exists in this version.
const IS_LEGACY = !existsSync(path.join(SRC_DIR, "guide"));
const ACTIVE_DOCS = (IS_LEGACY ? LEGACY_DOCS : DOCS).filter((d) =>
  existsSync(path.join(SRC_DIR, d.src)),
);

// Resolve links against the source document, not the website's route layout.
const ROUTE_BY_FILE = new Map(
  ACTIVE_DOCS.map((d) => [
    `docs/${d.src}`.toLowerCase(),
    `${ROUTE_PREFIX}/${d.group}/${d.slug}`,
  ]),
);

function escapeYaml(s) {
  return s.replace(/"/g, '\\"');
}

function stripLeadingH1(md) {
  // Starlight renders the frontmatter title as the page H1; drop a leading
  // markdown H1 so it is not duplicated.
  return md.replace(/^\s*#\s+.+?\r?\n+/, "");
}

// Real HTML tags we keep verbatim (DittoFS docs use small table/markup tags).
const KEEP_HTML_TAGS = new Set([
  "br", "hr", "b", "i", "em", "strong", "sub", "sup", "kbd", "code", "a", "p",
  "table", "thead", "tbody", "tr", "td", "th", "img", "div", "span", "details",
  "summary", "ul", "ol", "li", "blockquote", "pre",
]);

// Astro's plain-markdown build is lenient, but the starlight-versions snapshot
// pipeline re-parses every doc as MDX. Four markdown constructs that are legal
// in CommonMark but blow up MDX must be normalized at vendor time so both the
// latest build and the version snapshots succeed:
//   1. HTML comments <!-- ... -->: MDX only accepts {/* ... */}. They are
//      invisible to readers anyway, so they are dropped.
//   2. GFM autolinks <https://…/…> — MDX reads the `/` as a JSX tag name.
//   3. Angle-bracket placeholders in prose like <command>, <path>, <name> —
//      MDX reads them as JSX and acorn fails on the (empty/invalid) expression.
//   4. Any other "<" in prose that can't start a tag, like "(<1024)" or
//      "<= 1 GiB": MDX reads it as a JSX tag and fails.
// Both are only normalized OUTSIDE fenced code blocks and inline code spans,
// so literal samples stay intact.
function normalizeForMdx(md) {
  let inFence = false;
  let inComment = false;

  return md
    .split("\n")
    .map((line) => {
      // 1. Drop HTML comments (<!-- ... -->), which MDX can't parse.
      //    They may span several lines, so track whether we're inside one.
      if (inComment) {
        const end = line.indexOf("-->");
        if (end === -1) return "";
        inComment = false;
        line = line.slice(end + 3);
      }
      if (!inFence) {
        line = line.replace(/<!--.*?-->/g, "");
        const start = line.indexOf("<!--");
        if (start !== -1) {
          inComment = true;
          line = line.slice(0, start);
        }
      }

      const fenceMatch = line.match(/^\s*(```|~~~)/);
      if (fenceMatch) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;

      // Protect inline code spans (`...`) from rewriting.
      const spans = [];
      let work = line.replace(/`[^`]*`/g, (m) => {
        spans.push(m);
        return ` ${spans.length - 1} `;
      });

      // 2. Autolinks -> explicit markdown links.
      work = work.replace(
        /<((?:https?|mailto):[^ <>]+)>/g,
        (_m, url) => `[${url}](${url})`,
      );

      // 2b. Escape bare curly braces — MDX reads {…} / ${…} as JS expressions
      //     and acorn throws on the embedded CLI --help / JSON dumps.
      work = work.replace(/[{}]/g, (c) => (c === "{" ? "&#123;" : "&#125;"));

      // 3. Escape angle-bracket placeholders that are not real HTML tags.
      work = work.replace(
        /<\/?([A-Za-z][A-Za-z0-9_-]*)(\s[^<>]*)?\/?>/g,
        (m, tag) => {
          if (KEEP_HTML_TAGS.has(tag.toLowerCase())) return m;
          // Render as literal text: <command> -> &lt;command&gt;
          return m.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        },
      );

      // 4. Escape any other "<" that can't start an HTML tag or comment,
      //    e.g. "(<1024)" or "<= 1 GiB". MDX reads "<" as the start of a JSX
      //    tag and fails when the next character can't start a tag name.
      work = work.replace(/<(?![A-Za-z/])/g, "&lt;");

      // Restore inline code spans.
      return work.replace(/ (\d+) /g, (_m, i) => spans[Number(i)]);
    })
    .join("\n");
}

const usedAssets = new Set();

// Register an asset reference (path may be like ../assets/pro/x.png or
// assets/x.png) and return the public URL it should be rewritten to. Assets
// are flattened by their path relative to the docs assets/ dir, so
// ../assets/pro/x.png -> /docs-assets/pro/x.png.
function registerAsset(rel) {
  usedAssets.add(rel);
  return `/docs-assets/${rel}`;
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

  // Clear previously synced pages so a version never inherits pages from
  // another one. Only the group dirs are cleared. Site-native pages (like the
  // docs index) live outside them.
  for (const group of ["getting-started", "connect", "operations", "contributing", "product"]) {
    await fs.rm(path.join(OUT_DIR, group), { recursive: true, force: true });
  }
  if (IS_LEGACY) {
    console.log("Layout:            legacy (flat docs/)");
  }

  console.log(`Syncing docs from: ${SRC_DIR}`);
  console.log(`Writing to:        ${OUT_DIR}`);
  console.log(`Source ref:        ${SOURCE_REF}`);
  if (DOCS_VERSION) console.log(`Version snapshot:  ${DOCS_VERSION}`);
  let written = 0;

  for (const doc of ACTIVE_DOCS) {
    const srcPath = path.join(SRC_DIR, doc.src);
    let raw;
    try {
      raw = await fs.readFile(srcPath, "utf8");
    } catch {
      console.warn(`  ! skipped (not found): ${doc.src}`);
      continue;
    }

    let body = stripLeadingH1(raw);
    body = normalizeForMdx(body);
    body = rewriteLinksAndAssets(body, doc.src, {
      routes: ROUTE_BY_FILE, ref: SOURCE_REF, registerAsset,
    });

    // Point "Edit page" at the real source in the main repo, not this site's
    // vendored copy. Pin snapshots to their tag; latest edits go to develop.
    const editUrl = `${GITHUB_REPO}/edit/${docsEditRef()}/docs/${doc.src}`;

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

  if (!DOCS_VERSION) {
    await fs.mkdir(path.dirname(LATEST_META), { recursive: true });
    await fs.writeFile(
      LATEST_META,
      JSON.stringify({ ref: SOURCE_REF }, null, 2) + "\n",
      "utf8",
    );
    console.log(`  + ${path.relative(ROOT, LATEST_META)}  (ref ${SOURCE_REF})`);
  }

  console.log(
    `\nDone. ${written}/${ACTIVE_DOCS.length} docs synced, ${usedAssets.size} assets copied.`,
  );

  if (TMP_DIR) {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
