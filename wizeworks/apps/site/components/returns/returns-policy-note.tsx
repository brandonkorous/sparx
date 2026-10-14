'use client';

// "Our returns policy explains what we can take back and how long you have.",
// linked to the page this shop actually published (sparx persona issue 210). Draws
// nothing when the shop has published no returns or refund policy, rather than a
// link to a page that does not exist.

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useCustomer } from '@/components/customer-provider';
import { getLegalLinks } from '@/lib/customer-client';
import { returnsPolicyLink } from '@/lib/policy-link';

export function ReturnsPolicyNote({ className }: { className?: string }) {
  const { tenantSlug, propertySlug } = useCustomer();
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getLegalLinks(tenantSlug, propertySlug).then(
      (links) => active && setHref(returnsPolicyLink(links))
    );
    return () => {
      active = false;
    };
  }, [tenantSlug, propertySlug]);

  if (href === null) return null;
  return (
    <p className={className}>
      Our{' '}
      <Link href={href} className="link">
        returns policy
      </Link>{' '}
      explains what we can take back and how long you have.
    </p>
  );
}
