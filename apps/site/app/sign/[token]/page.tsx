// The page a customer signs a quote on (docs/144 §12).
//
// NOT an editable shell, and deliberately so. Every other storefront route is a
// surface a tenant can restyle; this one is a legal act. What the customer sees
// has to be what the signature attests to, and a tenant who could drop a section
// into it could drop one that changes what the total appears to be.
//
// It is also the one storefront page reached ONLY by a link from an email —
// there is no navigation to it, no session, and no way to guess the address. The
// token in the URL is the whole credential.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { resolveSite } from '@/lib/site-context';
import { SigningPanel } from './signing-panel';

// Never prerendered and never cached. A signing page that renders a stale
// "waiting for you" after somebody has already signed invites a second
// signature on a document that is already frozen.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Review and sign',
  // Kept out of every index. A signing link is addressed to one person.
  robots: { index: false, follow: false },
};

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const site = await resolveSite();
  if (!site) notFound();
  const { token } = await params;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <SigningPanel tenantSlug={site.slug} token={token} />
    </div>
  );
}
