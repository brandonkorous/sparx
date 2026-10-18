// No site on this host, no account area: a 404, like every other route here.
//
// The root layout renders <CustomerProvider> only when a site resolves, and the
// signed-in pages under (authed) are client components that call useCustomer()
// in their layout. On a host with no site (a scanner on a bare zone host, a
// domain whose site was removed) they threw "useCustomer must be used within
// <CustomerProvider>" and the visitor got a 500 instead of the 404 the home
// page, sign-in and checkout already answer (WizeLens, 2026-10-18).
//
// One guard here covers every account route, including the ones added later.
// resolveSite() is request-cached, so the pages that also check pay nothing.

import { notFound } from 'next/navigation';

import { resolveSite } from '@/lib/site-context';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  if (!(await resolveSite())) notFound();
  return children;
}
