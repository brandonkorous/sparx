import * as React from 'react';
import Link from 'next/link';
import { Award, Check } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Container,
  Grid,
  Heading,
  ModuleProvider,
  PageHeader,
  Stack,
  Text,
  statusLabel,
  statusTone,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { OverviewCard } from '../../_components/overview-bits';
import type { PartnerProfile } from '../_lib/types';
import { TIER_ORDER, TIERS, nextTier } from '../_lib/tiers';
import { TierApply } from './_components/tier-apply';

// Partner Portal — Tier (docs/114 §B.1/§B.4). Where the partner is today and what
// the next tier unlocks, plus the apply-for-next CTA. Not member-gated: a
// prospective partner sees the ladder + a join pointer instead of the apply flow.

export const dynamic = 'force-dynamic';

export default async function PartnerTierPage() {
  const profile = await api.get<PartnerProfile | null>('/v1/partner/profile').catch(() => null);
  const currentTier = profile?.tier ?? null;
  const upcoming = currentTier ? nextTier(currentTier) : null;

  return (
    <ModuleProvider module="partner">
      <Container size="xl">
        <Stack gap={8} className="py-10">
          <PageHeader
            icon={<Award className="h-5 w-5" />}
            title="Tier"
            badge={
              profile ? (
                <Badge color={statusTone(profile.status)} variant="soft">
                  {statusLabel(profile.status)}
                </Badge>
              ) : undefined
            }
            description="Every tier earns more and unlocks more. Here’s where you stand and what it takes to move up."
          />

          <Grid cols={1} mdCols={3} gap={4}>
            {TIER_ORDER.map((t) => {
              const meta = TIERS[t];
              const isCurrent = currentTier === t;
              const passed =
                currentTier != null && TIER_ORDER.indexOf(t) < TIER_ORDER.indexOf(currentTier);
              return (
                <Card key={t} variant={isCurrent ? 'module' : 'default'} padding="lg">
                  <Stack gap={3}>
                    <Stack direction="row" align="center" justify="between" gap={2}>
                      <Text size="lg" weight="medium">
                        {meta.label}
                      </Text>
                      {isCurrent ? (
                        <Badge color="module" variant="soft">
                          Your tier
                        </Badge>
                      ) : passed ? (
                        <Badge color={statusTone('active')} variant="soft">
                          Unlocked
                        </Badge>
                      ) : null}
                    </Stack>
                    <Text size="sm" className="text-[var(--module-active-text)]">
                      {meta.commission}
                    </Text>
                    <ul className="flex flex-col gap-2">
                      {meta.unlocks.map((u) => (
                        <li key={u} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--module-active)]" />
                          <Text size="sm">{u}</Text>
                        </li>
                      ))}
                    </ul>
                    <Text size="xs" variant="muted">
                      {meta.howToReach}
                    </Text>
                  </Stack>
                </Card>
              );
            })}
          </Grid>

          {profile ? (
            upcoming ? (
              <OverviewCard
                title={`Advance to ${TIERS[upcoming].label}`}
                icon={<Award className="h-4 w-4" />}
                description={TIERS[upcoming].commission}
              >
                <Stack gap={3}>
                  <Text size="sm" variant="muted">
                    {TIERS[upcoming].howToReach}
                  </Text>
                  <TierApply requestedTier={upcoming} />
                </Stack>
              </OverviewCard>
            ) : (
              <Card variant="default" padding="lg">
                <Stack gap={1}>
                  <Heading level={2}>You’re at the top tier</Heading>
                  <Text size="sm" variant="muted">
                    You earn ongoing commission on managed accounts and can publish bootcamps
                    publicly. Keep growing — the directory rewards active certified partners.
                  </Text>
                </Stack>
              </Card>
            )
          ) : (
            <Card variant="default" padding="lg">
              <Stack gap={3}>
                <Stack gap={1}>
                  <Heading level={2}>Not a partner yet?</Heading>
                  <Text size="sm" variant="muted">
                    Join the program to claim your referral link and start earning. You can apply to
                    move up a tier any time.
                  </Text>
                </Stack>
                <div>
                  <Button asChild color="module">
                    <Link href="/partner">Become a partner</Link>
                  </Button>
                </div>
              </Stack>
            </Card>
          )}
        </Stack>
      </Container>
    </ModuleProvider>
  );
}
