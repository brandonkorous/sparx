// The per-component action for a marketplace card/detail (docs/60 §10/§12,
// docs/66 MP-Ph2). The marketplace is DISCOVERY; the builder's component catalog
// (/builder/components/<type>) owns management + the "Copy to my components" flow
// that clones a system component into a tenant BuilderComponent (docs/53). So
// "Add" hands off there. The slug IS the builder component `type`, so the deep
// link resolves directly. Navigation only (the builder page enforces module +
// role gating), so no client state and no owner/admin pre-check here.

import Link from 'next/link';
import { Button } from '@sparx/ui';

export function ComponentCardActions({ componentSlug }: { componentSlug: string }) {
  return (
    <Button color="primary" asChild>
      <Link href={`/builder/components/${encodeURIComponent(componentSlug)}`}>
        Add to my components
      </Link>
    </Button>
  );
}
