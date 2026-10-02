# dittofs-web — AI Agents

Marketing site and documentation for [DittoFS](https://github.com/marmos91/dittofs),
served at **dittofs.io**. Build, dev and docs-sync commands live in `README.md`.

## Git & PRs

Never commit or push to `main` directly. Branch off `main`
(`<type>/<slug>`), push, open a PR with `gh pr create`, and merge through the PR.

Conventional Commits: `<type>(<scope>): <subject>`, subject ≤ 72 chars.
Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
`ci`, `chore`, `revert`.

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
- `graphify-out/` is generated output and is gitignored. Never commit it.
- `dist/` and `.wrangler/` are skipped by graphify's built-in skip list and by
  `.gitignore`; no `.graphifyignore` is needed for them.
- Rebuilding is opt-in per machine: run `graphify update .` after changing code. `graphify hook install` can automate it, but those hooks are untracked local state, so a fresh clone has none. Dirty `graphify-out/` files are expected and are not a reason to skip the graph.
