import { Clock, Handshake } from 'lucide-react';
import { Card, Container, EmptyState, ModuleProvider, PageHeader, Stack } from '@sparx/ui';

// Shown at /partner when the tenant has submitted a partner application that's
// awaiting staff review (docs/114 §B.2). There is no portal yet — approval by the
// Sparx team is what provisions the partner row; until then this is the whole
// surface, so an applicant always knows where they stand.
export function PartnerApplicationPending({ tier }: { tier?: string }) {
  const tierLabel = tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : null;
  return (
    <ModuleProvider module="partner">
      <Container size="lg">
        <Stack gap={6} className="py-10">
          <PageHeader
            icon={<Handshake className="h-5 w-5" />}
            title="Application in review"
            description="Thanks for applying to the Sparx Partner Program."
          />
          <Card padding="none">
            <EmptyState
              icon={<Clock className="h-5 w-5" />}
              title="We’re reviewing your application"
              description={`Our team reviews every application to keep the partner directory high-quality${
                tierLabel ? ` — you applied for the ${tierLabel} tier` : ''
              }. You’ll hear back within 3 business days, and your portal unlocks the moment you’re approved.`}
            />
          </Card>
        </Stack>
      </Container>
    </ModuleProvider>
  );
}
