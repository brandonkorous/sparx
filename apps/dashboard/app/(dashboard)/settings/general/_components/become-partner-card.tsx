import Link from 'next/link';
import { ArrowRight, Clock, Handshake } from 'lucide-react';
import { Button, Card, ModuleProvider, Stack, Text } from '@sparx/ui';
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
      <Card variant="default" padding="lg">
        <Stack direction="row" align="center" justify="between" gap={4} className="flex-wrap">
          <Stack direction="row" align="center" gap={3} className="min-w-0">
            <span className="text-[var(--module-active)]">
              <Handshake className="h-5 w-5" />
            </span>
            <Stack gap={1} className="min-w-0">
              <Text weight="medium">Become a Sparx Partner</Text>
              <Text size="sm" variant="muted">
                {pending
                  ? 'Your application is in review — we’ll be in touch within 3 business days.'
                  : 'Refer clients, earn on every account you bring in, and get listed in the partner directory. Apply for review — every partner is vetted.'}
              </Text>
            </Stack>
          </Stack>
          {pending ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-[var(--module-active-text)]">
              <Clock className="h-4 w-4" />
              In review
            </span>
          ) : (
            <Button asChild color="module" variant="soft" size="sm" className="self-start">
              <Link href="/partner">
                Apply
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </Stack>
      </Card>
    </ModuleProvider>
  );
}
