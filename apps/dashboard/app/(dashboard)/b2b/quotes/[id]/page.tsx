import { Container, Stack } from '@sparx/ui';
import { B2bQuoteDetailContent } from './_content';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function B2bQuoteDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <Container size="xl">
      <Stack gap={6} className="py-8">
        <B2bQuoteDetailContent id={id} />
      </Stack>
    </Container>
  );
}
