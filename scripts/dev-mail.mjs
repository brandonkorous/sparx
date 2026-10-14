#!/usr/bin/env node
// Read the dev outbox: the emails dev "sent" (piggles persona issue 980).
//
// Dev has no real email. Every send through the console provider is written to
// `.dev-outbox/` at the repo root (`wizeworks/packages/email/src/providers/dev-outbox.ts`),
// whichever process sent it. This lists the newest, newest first, with each one's
// links, so a confirm link, an invite or a password reset can be opened.
//
//   pnpm dev:mail                     the 10 newest
//   pnpm dev:mail rosalind            only those to an address containing "rosalind"
//   pnpm dev:mail rosalind --last     just the newest one's first link, alone on a line
//   pnpm dev:mail --count 30          the 30 newest
//
// The folder is SPARX_DEV_OUTBOX when that is set, as it is for the writer.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.env.SPARX_DEV_OUTBOX ?? path.join(root, '.dev-outbox');

const args = process.argv.slice(2);
const last = args.includes('--last');
const countAt = args.indexOf('--count');
const count = countAt >= 0 ? Math.max(1, Number(args[countAt + 1]) || 10) : 10;
const filter = args
  .filter((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--count')
  .join(' ')
  .toLowerCase();

if (!fs.existsSync(dir)) {
  console.log(`No dev email yet. Nothing has been sent since the outbox began (${dir}).`);
  process.exit(0);
}

const sends = fs
  .readdirSync(dir)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .reverse()
  .map((name) => ({ name, ...JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) }))
  .filter((send) => !filter || String(send.to).toLowerCase().includes(filter));

if (sends.length === 0) {
  console.log(filter ? `No dev email to an address containing "${filter}".` : 'No dev email yet.');
  process.exit(0);
}

if (last) {
  const link = sends[0].links?.[0];
  if (!link) {
    console.error(`The newest email to "${filter || sends[0].to}" has no link.`);
    process.exit(1);
  }
  console.log(link);
  process.exit(0);
}

for (const send of sends.slice(0, count)) {
  const when = new Date(send.acceptedAt).toLocaleString();
  console.log(`\n${when}  ${send.templateId ?? 'email'}  →  ${send.to}`);
  console.log(`  ${send.subject}`);
  console.log(`  from ${send.from}${send.replyTo ? `, replies to ${send.replyTo}` : ''}`);
  // The mail app's own Unsubscribe button reads this header (issue 985).
  if (send.headers?.['List-Unsubscribe']) {
    console.log(`  unsubscribe header: ${send.headers['List-Unsubscribe']}`);
  }
  for (const link of send.links ?? []) console.log(`  ${link}`);
  console.log(`  ${path.join(dir, send.name.replace(/\.json$/, '.html'))}`);
}
