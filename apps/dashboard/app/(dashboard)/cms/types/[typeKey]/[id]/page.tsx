import { Container, Stack } from '@sparx/ui';

import { ContentEntryDetailContent } from './_content';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ typeKey: string; id: string }>;
}

// Full-page route wrapper for a content-type entry. The editing UI lives in
// `_content.tsx` so it can also mount inside the dashboard shell's detail panel
// (drawer / modal). The route adds the full-page chrome the panel doesn't:
// the width-constrained Container. `showOpenInFull={false}` because the
// "Open full editor" link would point at this very page.
export default async function EditEntryPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <ContentEntryDetailContent id={id} showOpenInFull={false} />
      </Stack>
    </Container>
  );
}
