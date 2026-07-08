import Link from 'next/link';
import { Handshake, Lock } from 'lucide-react';
import { Button, Card, CardBody, EmptyState } from 'silicaui-react';
import { ModuleProvider, PageHeader } from '@sparx/ui';

// The gate a member-only Partner section shows when the tenant hasn't joined yet
// (docs/114 §B.7). A calm "join to unlock" prompt instead of a forbidden error —
// the section nav hides these for non-partners, but a deep link still needs a
// graceful landing. Wrapped in the partner provider so the CTA carries the hue.

export function PartnerLocked({ section }: { section: string }) {
  return (
    <ModuleProvider module="partner">
      <div className="mx-auto w-full max-w-screen-lg px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 py-10">
          <PageHeader
            icon={<Handshake className="h-5 w-5" />}
            title={section}
            description="This section is part of the Sparx Partner Program."
          />
          <Card>
            <CardBody className="p-0">
              <EmptyState
                icon={<Lock className="h-5 w-5" />}
                title="Join the Partner Program to unlock this"
                description="Refer clients, earn commission, host bootcamps, and get listed in the public partner directory. Joining takes under a minute."
                actions={
                  <Button render={<Link href="/partner" />} color="module">
                    Become a partner
                  </Button>
                }
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </ModuleProvider>
  );
}
