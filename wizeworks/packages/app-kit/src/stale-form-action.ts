// A FORM POSTED FROM AN OLDER BUILD, answered with the page instead of a 500.
//
// A server-action form carries its action's id in hidden fields
// (`$ACTION_ID_<id>`, or `$ACTION_REF_n` with a `{"id":"<id>",…}` descriptor).
// When the browser has not hydrated yet, or has no JavaScript, the form posts
// as a plain multipart POST, and Next.js looks the id up in the CURRENT build.
// An id from the build before a deploy is not there, and Next throws "Failed to
// find Server Action" and answers 500 — its own source marks that branch as a
// TODO. The fetch path (a hydrated page, `next-action` header) already answers
// 404 and reloads, so only this one shape ever reaches the error page.
//
// Two callers send it: a visitor whose page was open across a deploy, and a bot
// replaying a form it scraped earlier. On 2026-10-20 a scanner did the second
// eight times to getpiggles.com/signup and logged eight server errors.
//
// The answer is 303 back to the same address: the browser loads the page from
// the build that is running now, with a form whose id exists. The visitor sees
// a fresh form instead of an error; the bot gets a redirect, not a 500.
//
// The Location must be ABSOLUTE. Next's proxy adapter parses it with
// `new NextURL(location)` and no base, so a bare path throws "Invalid URL" and
// the post 500s anyway — which is what the first version of this did to every
// stale post it caught (getpiggles.com/signup, 2026-10-21). The adapter turns a
// same-origin absolute address back into a path before the browser sees it.
//
// ── WHAT IT TRUSTS ─────────────────────────────────────────────────────────
//
// The set of ids comes from `.next/server/server-reference-manifest.json`, the
// file Next itself reads for the same lookup. Only the KEYS are used. Any
// failure to read it — a dev server, a changed format — means "do not judge":
// the request goes on to Next exactly as before. Nothing here can turn a post
// Next would accept into a redirect, because an id this file lists is passed
// through.
//
// Only posts that NAME an action are judged. A multipart POST with no action
// field may be an upload to a route handler, which the proxy cannot tell from a
// page, so it is never touched.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ACTION_ID_FIELD = '$ACTION_ID_';
const ACTION_REF_FIELD = '$ACTION_REF_';
const ACTION_FIELD = '$ACTION_';
const DESCRIPTOR_ID = /^\{"id":"([^"]+)"/;
/** The largest body judged. The signup form that 500ed was 1,489 bytes. */
const MAX_FORM_BYTES = 256 * 1024;

/** The ids of the server actions in this build, or null when unknown. */
export type ActionIds = ReadonlySet<string> | null;

/** Read the running build's action ids. `distDir` is the app's `.next`; the
 *  standalone server chdirs to the app, so the default finds it in production. */
export function readActionIds(distDir: string = join(process.cwd(), '.next')): ActionIds {
  try {
    const raw = readFileSync(join(distDir, 'server', 'server-reference-manifest.json'), 'utf8');
    const manifest = JSON.parse(raw) as { node?: unknown };
    if (!manifest.node || typeof manifest.node !== 'object') return null;
    return new Set(Object.keys(manifest.node));
  } catch {
    return null;
  }
}

let running: ActionIds | undefined;

/** This server's action ids, read once on the first post that needs them.
 *
 *  Null outside production: `next dev` rewrites the manifest as actions are
 *  added, so a copy read once would call a brand-new action stale. Lazy rather
 *  than at import, so `next build` loading the proxy reads nothing. */
export function runningActionIds(): ActionIds {
  if (process.env.NODE_ENV !== 'production') return null;
  if (running === undefined) running = readActionIds();
  return running;
}

/** Every action id a no-JavaScript form post names. Empty when it names none. */
export function postedActionIds(form: FormData): string[] {
  const ids: string[] = [];
  for (const key of form.keys()) {
    if (key.startsWith(ACTION_ID_FIELD)) {
      ids.push(key.slice(ACTION_ID_FIELD.length));
    } else if (key.startsWith(ACTION_REF_FIELD)) {
      const descriptor = form.get(`${ACTION_FIELD}${key.slice(ACTION_REF_FIELD.length)}:0`);
      const id = typeof descriptor === 'string' ? DESCRIPTOR_ID.exec(descriptor)?.[1] : undefined;
      // A ref with no readable descriptor names an action nobody can find.
      ids.push(id ?? '');
    }
  }
  return ids;
}

/**
 * The 303 for a form post naming an action this build does not have, or null
 * to let the request through.
 *
 * Cheap for everything else: a GET, a hydrated action call (`next-action`
 * header) and a non-multipart body return before the body is read.
 */
export async function staleFormActionRedirect(
  req: Request,
  known: ActionIds
): Promise<Response | null> {
  if (!known || req.method !== 'POST' || req.headers.has('next-action')) return null;
  if (!(req.headers.get('content-type') ?? '').startsWith('multipart/form-data')) return null;
  // An upload to a route handler is multipart too, and reading it here would hold
  // the whole file in memory a second time. A form is small; anything larger, or
  // of unknown size, is left to Next.
  const size = Number(req.headers.get('content-length') ?? NaN);
  if (!(size <= MAX_FORM_BYTES)) return null;

  let form: FormData;
  try {
    form = await req.clone().formData();
  } catch {
    return null;
  }
  const ids = postedActionIds(form);
  if (ids.length === 0 || ids.every((id) => known.has(id))) return null;

  const url = new URL(req.url);
  url.hash = '';
  return new Response(null, {
    status: 303,
    headers: { location: url.href, 'cache-control': 'no-store' },
  });
}
