import assert from "node:assert/strict";
import test from "node:test";
import { ALL_VERSIONS_PATH } from "../integrations/all-versions-page.mjs";
import { resolveVersionNavigation } from "../src/lib/version-navigation.mjs";

const routes = new Set([ALL_VERSIONS_PATH.replace(/\/$/, ""), "/docs", "/docs/getting-started/cli", "/docs/operations/security",
  "/v0.1/docs", "/v0.1/docs/contributing/cache", "/v0.1/docs/operations/security",
  "/v0.34/docs", "/v0.34/docs/getting-started/cli", "/v0.34/docs/operations/security"]);

test("missing version destinations fall back to that release's documentation index", () => {
  const input = '<a href="/docs/contributing/cache/">Latest</a><select><option value="/v0.1/docs/getting-started/cli/">v0.1</option><option value="/v0.34/docs/contributing/cache/">v0.34</option></select>';
  assert.equal(resolveVersionNavigation(input, routes),
    '<a href="/docs/">Latest</a><select><option value="/v0.1/docs/">v0.1</option><option value="/v0.34/docs/">v0.34</option></select>');
});

test("existing latest and archive destinations preserve same-page navigation and native markup", () => {
  const input = '<p class="notice"><a href="/docs/operations/security/">Latest</a></p><starlight-version-select><select><option value="/v0.1/docs/operations/security/" selected>v0.1</option><option value="/v0.34/docs/operations/security/">v0.34</option></select></starlight-version-select><script>customElements.get("starlight-version-select")</script>';
  assert.equal(resolveVersionNavigation(input, routes), input);
});

test("external, non-documentation and unknown-version destinations are not rewritten", () => {
  const input = '<a href="https://example.org/docs/missing">external</a><a href="//example.org/docs/missing">external</a><a href="/pro">Pro</a><a href="/v9.9/docs/missing">unknown</a><option value="dark">Dark</option>';
  assert.equal(resolveVersionNavigation(input, routes), input);
});

test("search notices use the same fallback for entity-encoded unquoted hrefs", () => {
  assert.equal(resolveVersionNavigation('<a href=&#x2F;docs&#x2F;contributing&#x2F;cache&#x2F;>latest version</a>', routes),
    '<a href="/docs/">latest version</a>');
});

test("compact selector retains All versions, native root choices and the visible version", () => {
  const input = `<dfs-version-select><select><option value="/docs/getting-started/cli/">Latest</option><option value="/v0.34/docs/getting-started/cli/" selected>v0.34</option><option value="/v0.1/docs/">v0.1</option><option value="${ALL_VERSIONS_PATH}">All versions…</option></select></dfs-version-select>`;
  assert.equal(resolveVersionNavigation(input, routes), input);
});
