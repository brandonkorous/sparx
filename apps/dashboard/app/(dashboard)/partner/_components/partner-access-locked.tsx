import Link from 'next/link';
import { Handshake, Lock } from 'lucide-react';
import { Button, Card, CardBody, EmptyState } from 'silicaui-react';
import { ModuleProvider, PageHeader } from '@sparx/ui';

// Shown when the tenant IS a Sparx partner but the current user's role can't
// operate the practice (docs/114 §B.7). Distinct from PartnerLocked (the "this org
// hasn't joined the program" prompt): here the program exists, the user just isn't
// on the access list. Owner, admin, and the delegated Partner role operate it;
// everyone else gets this calm explainer instead of a forbidden error or a page
// that half-loads and then 403s on its data fetch.
export function PartnerAccessLocked({ section = 'Partner Portal' }: { section?: string }) {
  return (
    <ModuleProvider module="partner">
      <div className="mx-auto w-full max-w-screen-lg px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 py-10">
          <PageHeader
            icon={<Handshake className="h-5 w-5" />}
            title={section}
            description="This workspace is a Sparx partner."
          />
          <Card>
            <CardBody className="p-0">
              <EmptyState
                icon={<Lock className="h-5 w-5" />}
                title="You don’t have access to the Partner Portal"
                description="Referrals, commissions, payouts, and bootcamps are managed by owners, admins, and teammates with the Partner role. Ask an owner or admin to grant you the Partner role in Settings → Team."
                actions={
                  <Button render={<Link href="/" />} color="module" variant="soft">
                    Back to dashboard
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
