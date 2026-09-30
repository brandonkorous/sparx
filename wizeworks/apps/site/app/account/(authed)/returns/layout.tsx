// Returns on a site that may not offer them.
//
// The account nav hides the link (see `offers` in the authed layout), but a link
// is not a gate: an old bookmark, a search result or a typed URL all reach this
// page without one. The pages under here are client components, so the gate is a
// server layout — the one place above them that can refuse the request before
// anything renders.
//
// See `lib/site-modules.ts` for what each switch owns.

import { notFound } from 'next/navigation';

import { resolveSite } from '@/lib/site-context';
import { siteShowsModule } from '@/lib/site-modules';

export default async function ReturnsGate({ children }: { children: React.ReactNode }) {
  const site = await resolveSite();
  if (!site) notFound();
  if (!siteShowsModule(site, 'commerce')) notFound();
  return children;
}
