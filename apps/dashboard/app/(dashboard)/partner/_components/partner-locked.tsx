import Link from 'next/link';
import { Handshake, Lock } from 'lucide-react';
import { Button, Card, Container, EmptyState, ModuleProvider, PageHeader, Stack } from '@sparx/ui';

// The gate a member-only Partner section shows when the tenant hasn't joined yet
// (docs/114 §B.7). A calm "join to unlock" prompt instead of a forbidden error —
// the section nav hides these for non-partners, but a deep link still needs a
// graceful landing. Wrapped in the partner provider so the CTA carries the hue.

export function PartnerLocked({ section }: { section: string }) {
  return (
    <ModuleProvider module="partner">
      <Container size="lg">
        <Stack gap={6} className="py-10">
          <PageHeader
            icon={<Handshake className="h-5 w-5" />}
            title={section}
            description="This section is part of the Sparx Partner Program."
          />
          <Card padding="none">
            <EmptyState
              icon={<Lock className="h-5 w-5" />}
              title="Join the Partner Program to unlock this"
              description="Refer clients, earn commission, host bootcamps, and get listed in the public partner directory. Joining takes under a minute."
              action={
                <Button asChild color="module">
                  <Link href="/partner">Become a partner</Link>
                </Button>
              }
            />
          </Card>
        </Stack>
      </Container>
    </ModuleProvider>
  );
}
