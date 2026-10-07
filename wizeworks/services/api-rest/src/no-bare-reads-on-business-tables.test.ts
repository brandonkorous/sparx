// A business's rows are read inside withTenant, never with the bare client.
//
// api-rest connects as `sparx_app`, which row-level security filters. Every table
// that carries `tenant_id` has a policy `tenant_id = current_tenant_id()`, and with
// no tenant set that matches NOTHING. The read succeeds and comes back empty: no
// error, no log, and a screen that draws "nothing here" as if it were true.
//
// MEASURED 2026-10-06 on Gillett Diesel: the public fitment drill answered [] for
// every shop, so "Fits your vehicle" offered a Year box and never a make (sparx
// persona issue 125). Reading on, the same shape had: the "extra sites need the
// Builder module" check counting 0 sites so it never fired, GET /v1/users always
// empty, chat notifications choosing no recipients, and the builder's live
// connection unable to find its person or site.
//
// This reads every source file and fails on `prisma.<model>.` for a model that has
// a `tenantId` field, unless the line is listed below with the reason it is safe.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = dirname(fileURLToPath(import.meta.url));
const SCHEMA = join(SRC, '..', '..', '..', 'packages', 'db', 'prisma', 'schema');

/** Models whose table carries `tenant_id` but has no row-level security, each with why. */
const UNPROTECTED: Record<string, string> = {
  domain:
    'domains has no RLS by design: the host router reads it to FIND the tenant, before any tenant is known.',
};

/**
 * Models whose table has an `*_operator_read` policy (`current_tenant_id() IS
 * NULL`): with no tenant set, a READ sees every row, so the query's own tenantId
 * filter scopes it. Measured as `sparx_app`. Writes still need a tenant.
 */
const OPERATOR_READ = new Set([
  'user',
  'member',
  'property',
  'apiKey',
  'memberModuleAccess',
  'memberPropertyAccess',
]);
const READ_OPS = /^(find\w*|count|aggregate|groupBy)$/;

/** `file:model` pairs that are safe, each with why. Keep this short. */
const SAFE: Record<string, string> = {};

/** The source with comments blanked out, line breaks kept, so a note that names
 *  `prisma.user` is not read as a call and line numbers stay right. */
function withoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(
      /(^|[^:\\])\/\/.*$/gm,
      (line, lead: string) => lead + ' '.repeat(line.length - lead.length)
    );
}

function files(dir: string, pick: (name: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...files(full, pick));
    else if (pick(entry)) out.push(full);
  }
  return out;
}

/** Client property names (`fitmentNode`) of models that carry `tenantId`. */
function businessModels(): Set<string> {
  const out = new Set<string>();
  for (const file of files(SCHEMA, (name) => name.endsWith('.prisma'))) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
      const [, name = '', body = ''] = match;
      if (/^\s+tenantId\s/m.test(body)) out.add(name.charAt(0).toLowerCase() + name.slice(1));
    }
  }
  return out;
}

describe('api-rest', () => {
  it('reads business tables only inside withTenant', () => {
    const models = businessModels();
    // A schema read that finds nothing would pass every file below.
    expect(models.size).toBeGreaterThan(150);
    expect(models.has('fitmentNode')).toBe(true);

    const sources = files(SRC, (name) => name.endsWith('.ts') && !name.includes('.test.'));
    expect(sources.length).toBeGreaterThan(200);

    const found: string[] = [];
    for (const file of sources) {
      const text = withoutComments(readFileSync(file, 'utf8'));
      const rel = relative(SRC, file).split(sep).join('/');
      for (const match of text.matchAll(/\bprisma\s*\.\s*([a-z]\w*)\s*\.\s*(\w+)/g)) {
        const model = match[1] ?? '';
        const op = match[2] ?? '';
        if (!models.has(model) || model in UNPROTECTED) continue;
        if (OPERATOR_READ.has(model) && READ_OPS.test(op)) continue;
        const key = `${rel}:${model}`;
        if (key in SAFE) continue;
        const line = text.slice(0, match.index).split('\n').length;
        found.push(`${rel}:${line} prisma.${model}`);
      }
    }
    expect(found).toEqual([]);
  });

  it('lists only lines that still exist', () => {
    for (const key of Object.keys(SAFE)) {
      const [rel = '', model = ''] = key.split(':');
      const text = readFileSync(join(SRC, rel), 'utf8');
      expect(text, key).toMatch(new RegExp(`\\bprisma\\s*\\.\\s*${model}\\s*\\.`));
    }
  });
});
