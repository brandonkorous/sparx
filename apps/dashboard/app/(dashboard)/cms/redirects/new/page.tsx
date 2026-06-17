import { Container, PageHeader, Stack } from '@sparx/ui';

import { RedirectCreateForm } from '../_components/redirect-create-form';

// Full-page surface for creating a redirect. The form body lives in the
// surface-aware `RedirectCreateForm` (§13.1) so the SAME component renders
// here (`surface="page"`) and inside the `@detail` drawer/modal overlay
// (`surface="overlay"`). Redirects have no detail view, so the form stays
// open on success rather than flowing into a record.

export const dynamic = 'force-dynamic';

export default function NewRedirectPage() {
  return (
    <Container size="md">
      <Stack gap={6} className="py-10">
        <PageHeader
          title="Add redirect"
          description="Paths must begin with a slash. Same-path or loop targets are rejected."
        />
        <RedirectCreateForm surface="page" />
      </Stack>
    </Container>
  );
}
