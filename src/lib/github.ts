// Build-time GitHub repo stats. Fetched once per build/dev process and cached,
// so Header and hero share a single request. Fails soft to null (offline,
// rate-limited, or private repo) — callers hide the count when null.
const REPO = "marmos91/dittofs";

let cached: Promise<number | null> | null = null;

export function getStars(): Promise<number | null> {
  if (!cached) {
    cached = fetch(`https://api.github.com/repos/${REPO}`, {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d && typeof d.stargazers_count === "number" ? d.stargazers_count : null))
      .catch(() => null);
  }
  return cached;
}

export function formatStars(n: number | null): string | null {
  if (n == null) return null;
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

let cachedRelease: Promise<string | null> | null = null;

export function getLatestRelease(): Promise<string | null> {
  if (!cachedRelease) {
    cachedRelease = fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d && typeof d.tag_name === "string" ? d.tag_name : null))
      .catch(() => null);
  }
  return cachedRelease;
}
