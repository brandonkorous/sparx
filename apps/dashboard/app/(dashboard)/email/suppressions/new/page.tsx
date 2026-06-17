import { Container, PageHeader, Stack } from '@sparx/ui';

import { AddSuppressionForm } from '../_components/add-suppression-form';

// Full-page surface for suppressing addresses. The form body lives in the
// surface-aware `AddSuppressionForm` (§13.1) so the SAME component renders here
// (`surface="page"`) and inside the `@detail` drawer/modal overlay
// (`surface="overlay"`). Suppression has no detail view, so the form stays open
// and refreshes the list on success instead of navigating into a record.

export const dynamic = 'force-dynamic';

export default function NewSuppressionPage() {
  return (
    <Container size="md">
      <Stack gap={6} className="py-10">
        <PageHeader
          title="Suppress an address"
          description="Add one or many addresses to the do-not-send list. Choose whether to block all email or just marketing."
        />
        <AddSuppressionForm surface="page" />
      </Stack>
    </Container>
  );
}
