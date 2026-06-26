// Marketplace 404. Either the product/merchant/category slug doesn't exist or
// the page was never published. Framed by the root layout's header + footer.

import Link from 'next/link';
import { Button, Heading, Text } from '@sparx/ui';

export default function NotFound() {
  return (
    <section className="mx-container flex flex-col items-center justify-center gap-5 py-24 text-center">
      <Text
        as="span"
        className="text-7xl font-semibold tracking-tight"
        style={{ color: 'var(--sparx-primary)' }}
      >
        404
      </Text>
      <Heading level={1}>We couldn’t find that page</Heading>
      <Text variant="muted" size="md" className="max-w-md">
        The product, shop, or category you’re looking for may have moved or sold out. Try browsing
        the full marketplace instead.
      </Text>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild color="primary" variant="solid">
          <Link href="/">Back to home</Link>
        </Button>
        <Button asChild color="neutral" variant="soft">
          <Link href="/products">Browse all products</Link>
        </Button>
      </div>
    </section>
  );
}
