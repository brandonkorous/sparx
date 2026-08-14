import { ConsoleEntry } from '../console-entry';

// Every address in the console, rendered by the same shell as `/`.
//
// A catch-all rather than a route per surface, because none of the surfaces is a
// PAGE — the address names a pane that opens on top of whatever the person
// already has arranged, and the resolution happens in the browser against the
// surface registry. This file's only jobs are to exist, so the address is
// reachable at all, and to carry the address through the sign-in hop.
//
// Next resolves a static segment before a dynamic one, so everything that is
// genuinely its own route still wins: /auth/callback, /sign-out, /popout, and
// everything under /api. Those are not screens in this app's sense — two are
// redirects and one is an empty themed document for a torn-off pane.
//
// An address the registry does not know is NOT a 404. It renders the console and
// arrives on the unresolved-link pane, which can say what was wrong with the
// link and leave the person inside their workspace with their layout intact —
// a better answer for someone who mistyped, or who clicked a link a mail client
// mangled, than a dead-end error page.

export const dynamic = 'force-dynamic';

export default async function ConsoleAddressPage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { path } = await params;
  const query = await searchParams;

  // Rebuilt rather than read off a header: `params.path` is already decoded, and
  // this string becomes a redirect destination, so it has to be a well-formed,
  // encoded, same-origin path. Building it from the matched route is what
  // guarantees that.
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) for (const entry of value) search.append(key, entry);
    else search.set(key, value);
  }
  const serialized = search.toString();
  const address = `/${path.map(encodeURIComponent).join('/')}${serialized ? `?${serialized}` : ''}`;

  return <ConsoleEntry address={address} />;
}
