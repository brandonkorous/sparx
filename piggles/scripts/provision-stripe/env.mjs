// Where the provisioner reads its plan and its Stripe key from, plus logging.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

export const PLAN_PATH = join(ROOT, 'piggles', 'config', 'billing-plan.json');
export const DRY_RUN = process.argv.includes('--dry-run');

// api-rest's `.env` already holds the key for local dev, so it is read from there
// rather than asking for it in a shell. A real environment variable still wins.
export const ENV_FILE =
  process.env.PIGGLES_ENV_FILE ?? join(ROOT, 'wizeworks', 'services', 'api-rest', '.env');

export const log = (msg) => console.log(msg);
export const money = (cents) => `$${(cents / 100).toFixed(2)}`;

/** Minimal dotenv: `KEY=value`, optional matching quotes, `#` comments. Never
 *  overrides a variable that is already set. */
export function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length > 1) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
