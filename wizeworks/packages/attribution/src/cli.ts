/**
 * Phase 0 generator (docs/80 §4.4). Validates the launch link set against the
 * controlled vocabulary and writes `docs/launch/utm-links.csv`. A taxonomy
 * warning (unknown source, bad medium, malformed campaign) exits non-zero so
 * CI catches drift.
 *
 *   pnpm --filter @wizeworks/attribution links
 *   # or: node --import tsx wizeworks/packages/attribution/src/cli.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAUNCH_LINKS } from './launch-links';
import { buildLinks, toCsv } from './links';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, '../../../../docs/launch/utm-links.csv');

const { rows, warnings } = buildLinks(LAUNCH_LINKS);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, toCsv(rows), 'utf8');

process.stdout.write(`wrote ${rows.length} UTM links -> ${outPath}\n`);
for (const warning of warnings) process.stderr.write(`warning: ${warning}\n`);
process.exitCode = warnings.length > 0 ? 1 : 0;
