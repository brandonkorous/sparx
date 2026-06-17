import { Container, PageHeader, Stack } from '@sparx/ui';

import { AddDomainForm } from '../_components/add-domain-form';

// Full-page surface for adding a sending domain. The form body lives in the
// surface-aware `AddDomainForm` (§13.1) so the SAME component renders here
// (`surface="page"`) and inside a drawer/modal overlay (`surface="overlay"`).
// Sending domains have no detail view, so this is purely the create surface.

export const dynamic = 'force-dynamic';

export default function NewSendingDomainPage() {
  return (
    <Container size="md">
      <Stack gap={6} className="py-10">
        <PageHeader
          title="Add a sending domain"
          description="Enter the domain (or subdomain) you want to send from. Sparx provisions it in Mailgun and shows the exact DNS records to publish."
        />
        <AddDomainForm surface="page" />
      </Stack>
    </Container>
  );
}
