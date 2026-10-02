# dittofs-web — AI Agents

Marketing site and documentation for [DittoFS](https://github.com/marmos91/dittofs),
served at **dittofs.io**. Astro (static) + Starlight for docs, Tailwind CSS,
deployed on Cloudflare Pages. See `README.md` for the build and the docs-sync flow.

## Git & PRs

Never commit or push to `main` directly. Branch off `main`
(`<type>/<slug>`), push, open a PR with `gh pr create`, and merge through the PR.

Conventional Commits: `<type>(<scope>): <subject>`, subject ≤ 72 chars.
Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
`ci`, `chore`, `revert`.

## Commands

| Action | Command |
| --- | --- |
| Run | `npm run dev` (http://localhost:4321) |
| Build | `npm run build` |
| Refresh vendored docs | `DITTOFS_DOCS_DIR=../dittofs/docs npm run sync-docs` |

## Knowledge graph

There is a graphify code graph at `graphify-out/`. Route by the *shape* of the
question — the graph answers relationships, `rg` answers locations.

| The question | Use |
| --- | --- |
| Who calls `X`? What breaks if I change it? How do `A` and `B` connect? | `graphify query` / `path` / `explain` |
| Where is the identifier `X`, a string, or a class name? | `rg` directly |
| Exact line numbers, or verbatim source | `read` / `rg` — the graph has no text |

- The graph is **AST-only**: `graphify update .` extracts symbols and edges and
  runs no model. Name a symbol, component or file. A question phrased the way
  you would ask a colleague is matched as bare keywords and comes back as noise;
  if a query returns junk, switch to `rg` rather than re-wording it.
- `.wrangler/` and `dist/` are excluded via `.graphifyignore` — build output and
  tooling scratch, not code.
- The graph rebuilds itself: a `graphify` post-commit hook re-extracts changed
  code files on every commit, and a post-checkout hook does a full rebuild on
  branch switch. You do not need to run `graphify update .` by hand. Dirty
  `graphify-out/` files are expected and are not a reason to skip the graph.
  Run it manually only after a merge the hook could not see, or after deleting
  code (`--force` — a rebuild with fewer nodes is otherwise refused as a safety
  check).
- `graphify-out/` is generated output. Never commit it.
