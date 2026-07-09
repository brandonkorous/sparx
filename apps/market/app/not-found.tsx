// Marketplace 404. Either the product/merchant/category slug doesn't exist or
// the page was never published. Framed by the root layout's header + footer.

import Link from 'next/link';
import { Button, Heading, Text } from '@wizeworks/silicaui-react';

import { Container } from '@/components/ui/layout';

export default function NotFound() {
  return (
    <Container
      as="section"
      className="flex flex-col items-center justify-center gap-5 py-24 text-center"
    >
      <Text as="span" className="text-primary text-7xl font-semibold tracking-tight">
        404
      </Text>
      <Heading level={1}>We couldn’t find that page</Heading>
      <Text className="text-base-content/70 max-w-md">
        The product, shop, or category you’re looking for may have moved or sold out. Try browsing
        the full marketplace instead.
      </Text>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button render={<Link href="/" />} color="primary" variant="solid">
          Back to home
        </Button>
        <Button render={<Link href="/products" />} color="neutral" variant="soft">
          Browse all products
        </Button>
      </div>
    </Container>
  );
}
