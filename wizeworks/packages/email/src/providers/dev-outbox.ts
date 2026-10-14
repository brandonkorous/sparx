// The dev outbox: every email the console provider "sends" is also written to a
// file, so a person (or a test run driving the screens) can open it and press its
// links.
//
// Dev has no real email. The console provider printed each send to the terminal
// of whichever process sent it, and kept only the LAST one in that process's
// memory. A confirm-your-address link is sent by the event worker, an invite by
// api-rest, a sign-in link by an app's server: three terminals, none of them
// readable from the screen being tested, so a persona could not confirm her own
// address and every flow behind it was untestable (piggles persona issue 980).
//
// Files, not memory, because the senders are separate processes. One folder for
// all of them, at the repo root, found by walking up to `pnpm-workspace.yaml`
// (each service runs from its own directory), or `SPARX_DEV_OUTBOX` when set.
// Never in production: the console provider is dev-only, and this refuses to
// write when NODE_ENV is production as well, or in a test run unless the test
// names a folder. A write that fails never fails the
// send; it is a convenience beside the log line, not part of delivery.
//
// `pnpm dev:mail` (scripts/dev-mail.mjs) lists the newest and prints their links.

// Type-only: the modules themselves load on first write, inside the send, so a
// bundle that imports this package never pulls Node's file system in.
import type * as FsPromises from 'node:fs/promises';
import type * as NodePath from 'node:path';

import type { ConsoleSend } from './console';

/** How many emails the folder keeps. The oldest beyond this are deleted. */
export const DEV_OUTBOX_KEEP = 500;

/** The file name for one send: sortable by time, readable at a glance. */
export function devOutboxFileName(
  send: Pick<ConsoleSend, 'acceptedAt' | 'to' | 'templateId' | 'id'>
): string {
  const when = send.acceptedAt.replace(/[:.]/g, '-');
  const safe = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9@._-]+/g, '-')
      .slice(0, 60);
  return `${when}__${safe(send.to)}__${safe(send.templateId ?? 'email')}__${send.id}`;
}

/** Every web link in an email's text body, in order, once each. */
export function linksIn(text: string): string[] {
  const found = text.match(/https?:\/\/[^\s<>"')\]]+/g) ?? [];
  return [...new Set(found.map((link) => link.replace(/[.,;:]+$/, '')))];
}

let warned = false;

/** Write one send to the outbox. Resolves either way; never throws. */
export async function writeDevOutbox(send: ConsoleSend): Promise<void> {
  if (process.env.NODE_ENV === 'production') return;
  // A test run sends through this provider too, and must not fill the real
  // folder: under test it writes only where a test names a folder.
  if (process.env.NODE_ENV === 'test' && !process.env.SPARX_DEV_OUTBOX) return;
  try {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const dir = process.env.SPARX_DEV_OUTBOX ?? (await repoOutbox(fs, path));
    if (!dir) return;
    await fs.mkdir(dir, { recursive: true });
    const base = path.join(dir, devOutboxFileName(send));
    await fs.writeFile(
      `${base}.json`,
      JSON.stringify({ ...send, links: linksIn(send.text) }, null, 2),
      'utf8'
    );
    await fs.writeFile(`${base}.html`, send.html, 'utf8');
    await prune(fs, path, dir);
  } catch (err) {
    if (!warned) {
      warned = true;
      console.warn('[email/console] could not write the dev outbox:', err);
    }
  }
}

type Fs = typeof FsPromises;
type PathMod = typeof NodePath;

/** `<repo root>/.dev-outbox`, the root being the nearest `pnpm-workspace.yaml`. */
async function repoOutbox(fs: Fs, path: PathMod): Promise<string | null> {
  let dir = process.cwd();
  for (;;) {
    try {
      await fs.access(path.join(dir, 'pnpm-workspace.yaml'));
      return path.join(dir, '.dev-outbox');
    } catch {
      const parent = path.dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }
  }
}

async function prune(fs: Fs, path: PathMod, dir: string): Promise<void> {
  const sends = (await fs.readdir(dir)).filter((name) => name.endsWith('.json')).sort();
  const extra = sends.length - DEV_OUTBOX_KEEP;
  if (extra <= 0) return;
  for (const name of sends.slice(0, extra)) {
    const base = path.join(dir, name.slice(0, -'.json'.length));
    await fs.rm(`${base}.json`, { force: true });
    await fs.rm(`${base}.html`, { force: true });
  }
}
