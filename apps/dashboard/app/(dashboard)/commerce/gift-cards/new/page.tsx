import { Container, PageHeader, Stack } from '@sparx/ui';

import { IssueGiftCardForm } from '../_components/issue-gift-card-form';

// Full-page surface for issuing a gift card. The form body lives in the
// surface-aware `IssueGiftCardForm` (§13.1) so the SAME component renders here
// (`surface="page"`) and inside the `@detail` drawer/modal overlay
// (`surface="overlay"`). Gift cards have no detail view, so create stays open
// rather than flowing into a record.

export const dynamic = 'force-dynamic';

export default function NewGiftCardPage() {
  return (
    <Container size="md">
      <Stack gap={6} className="py-10">
        <PageHeader
          title="Issue a gift card"
          description="Codes are auto-generated (16 alphanumeric, hyphen-grouped). Use a custom code only when migrating from a legacy system."
        />
        <IssueGiftCardForm surface="page" />
      </Stack>
    </Container>
  );
}
