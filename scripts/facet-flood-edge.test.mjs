// SI-7: the Cloudflare rule blocks facet floods and nothing the web app accepts; module domains hand /market to sparx.works.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const waf = read('terraform/modules/dns/waf.tf');
const expression = JSON.parse(/expression\s*=\s*("(?:[^"\\]|\\.)*")/.exec(waf)[1]);

/** Cloudflare `wildcard`: whole-string glob where * is any run of characters, case-insensitive. */
function wildcard(value, pattern) {
  const re = pattern.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${re}$`, 'is').test(value);
}

/** Evaluates the one rule's shape: a path prefix and any of its query wildcards. */
function blocked(path, query) {
  const prefix = /starts_with\(http\.request\.uri\.path, "([^"]+)"\)/.exec(expression)[1];
  const patterns = [...expression.matchAll(/http\.request\.uri\.query wildcard "([^"]+)"/g)].map((m) => m[1]);
  return path.startsWith(prefix) && patterns.some((p) => wildcard(query, p));
}

test('the rule is the shape this test evaluates', () => {
  assert.match(expression, /^\(starts_with\(http\.request\.uri\.path, "\/market\/"\) and \(.+ or .+\)\)$/);
});

test('floods from the WizeLens traces are blocked, raw or percent-encoded', () => {
  assert.ok(blocked('/market/themes', 'industry=salon,spa,barber,nails,tattoo,fitness&colorFamily=red'));
  assert.ok(blocked('/market/themes', 'industry=salon,spa,barber&colorFamily=red,blue,green'));
  assert.ok(blocked('/market/themes', 'industry=a%2Cb%2Cc%2Cd%2Ce'));
});

test('every query the app accepts (4 selections or fewer) passes', () => {
  assert.ok(!blocked('/market/themes', 'industry=salon,spa,barber,nails'));
  assert.ok(!blocked('/market/themes', 'industry=salon,spa&colorFamily=red,blue'));
  assert.ok(!blocked('/market/themes', 'q=hair'));
  assert.ok(!blocked('/docs', 'a=1,2,3,4,5,6'));
});

test('module marketing domains redirect /market and /partners/directory to sparx.works', () => {
  const caddy = read('k8s/ingress/Caddyfile');
  const block = caddy.slice(caddy.indexOf('://sparxcms.com,'), caddy.indexOf('# ----- Placeholder domains'));
  assert.match(block, /@platform_pages path \/market \/market\/\* \/partners\/directory \/partners\/directory\/\*/);
  assert.match(block, /redir @platform_pages https:\/\/sparx\.works\{uri\} permanent/);
});
