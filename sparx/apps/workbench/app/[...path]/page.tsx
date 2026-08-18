import { WorkbenchEntry } from '../workbench-entry';

// Every address in the workbench, rendered by the same shell as `/`.
//
// A catch-all rather than a route per surface, because there are 233 surfaces
// and none of them is a PAGE — the address names a pane that opens on top of
// whatever the operator already has arranged, and the resolution happens in the
// browser against the surface registry (see lib/workbench/deep-link.ts). This
// file's only jobs are to exist, so the address is reachable at all, and to
// carry the address through sign-in.
//
// Next resolves a static segment before a dynamic one, so everything that is
// genuinely its own page still wins: /sign-in, /sign-up, /popout, /accept-invite,
// /reset-password, the OAuth consent flow and the provider callbacks
// (/social/callback, /seo/search-console/callback, /onboarding/stripe-callback),
// plus every route handler under /api and /health. Those are pages in the real
// sense — they render without a workbench around them.
//
// An address the table does not know is NOT a 404. It renders the workbench and
// arrives on the unresolved-link pane, which can say what was wrong with the
// link and leave the operator inside the app with their layout intact — which is
// a better answer for someone who mistyped, or who clicked a link a mail client
// mangled, than a dead-end error page.

export const dynamic = 'force-dynamic';

export default async function WorkbenchAddressPage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { path } = await params;
  const query = await searchParams;

  // Rebuilt rather than read off a header: `params.path` is already decoded, and
  // this string becomes a `callbackURL`, so it has to be a well-formed, encoded,
  // same-origin path. Building it from the matched route is what guarantees that.
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) for (const entry of value) search.append(key, entry);
    else search.set(key, value);
  }
  const serialized = search.toString();
  const address = `/${path.map(encodeURIComponent).join('/')}${serialized ? `?${serialized}` : ''}`;

  return <WorkbenchEntry address={address} />;
}
