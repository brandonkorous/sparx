import Link from 'next/link';
import { ArrowRight, Clock, Handshake } from 'lucide-react';
import { ModuleProvider } from '@sparx/ui';
import { Button, Card, CardBody } from '@wizeworks/silicaui-react';
import { requireSession } from '@sparx/auth';

import { api } from '@/lib/api-rest-client';
import type { PartnerProfile } from '../../../partner/_lib/types';

// A discreet "Become a Sparx Partner" entry at the foot of general settings — the
// in-app path to the partner APPLICATION now that the sidebar tile is
// partners-only (docs/114 §B.7). It never signs anyone up: it links to the
// application (owner/admin only), or shows "in review" once applied. Approval is a
// staff decision. Renders nothing for a member who can't apply or a tenant that's
// already a partner, so it stays out of the way. Neutral card, violet accents.

export async function BecomePartnerCard() {
  const { user } = await requireSession();
  const canApply = user.role === 'owner' || user.role === 'admin';
  if (!canApply) return null;

  const profile = await api.get<PartnerProfile | null>('/v1/partner/profile').catch(() => null);
  if (profile) return null; // already a partner — the portal tile handles this

  const { application } = await api
    .get<{ application: { status: string } | null }>('/v1/partner/application')
    .catch(() => ({ application: null }));
  const pending = application?.status === 'pending';

  return (
    <ModuleProvider module="partner">
      <Card>
        <CardBody>
          <div className="flex flex-row flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-row items-center gap-3">
              <span className="text-module">
                <Handshake className="h-5 w-5" />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="font-medium">Become a Sparx Partner</p>
                <p className="text-base-content text-sm">
                  {pending
                    ? 'Your application is in review — we’ll be in touch within 3 business days.'
                    : 'Refer clients, earn on every account you bring in, and get listed in the partner directory. Apply for review — every partner is vetted.'}
                </p>
              </div>
            </div>
            {pending ? (
              <span className="text-module inline-flex items-center gap-1.5 text-sm">
                <Clock className="h-4 w-4" />
                In review
              </span>
            ) : (
              <Button
                color="module"
                variant="soft"
                size="sm"
                className="self-start"
                render={<Link href="/partner" />}
              >
                Apply
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardBody>
      </Card>
    </ModuleProvider>
  );
}
