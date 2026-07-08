import * as React from 'react';
import Link from 'next/link';
import { Award, Check } from 'lucide-react';
import { Badge, Button, Card, CardBody } from 'silicaui-react';
import { ModuleProvider, PageHeader, statusLabel, statusTone } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { OverviewCard } from '../../_components/overview-bits';
import { getPartnerAccess } from '../_lib/access';
import type { PartnerProfile } from '../_lib/types';
import { TIER_ORDER, TIERS, nextTier } from '../_lib/tiers';
import { TierApply } from './_components/tier-apply';

// Partner Portal — Tier (docs/114 §B.1/§B.4). Where the partner is today and what
// the next tier unlocks, plus the apply-for-next CTA. Not member-gated: a
// prospective partner sees the ladder + a join pointer instead of the apply flow.

export const dynamic = 'force-dynamic';

export default async function PartnerTierPage() {
  const [{ canOperate }, profile] = await Promise.all([
    getPartnerAccess(),
    api.get<PartnerProfile | null>('/v1/partner/profile').catch(() => null),
  ]);
  const currentTier = profile?.tier ?? null;
  const upcoming = currentTier ? nextTier(currentTier) : null;

  return (
    <ModuleProvider module="partner">
      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 py-10">
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {TIER_ORDER.map((t) => {
              const meta = TIERS[t];
              const isCurrent = currentTier === t;
              const passed =
                currentTier != null && TIER_ORDER.indexOf(t) < TIER_ORDER.indexOf(currentTier);
              return (
                <Card key={t} className={isCurrent ? 'bg-module bg-soft' : undefined}>
                  <CardBody>
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-row items-center justify-between gap-2">
                        <p className="text-lg font-medium">{meta.label}</p>
                        {isCurrent ? (
                          <Badge color="module" variant="soft">
                            Your tier
                          </Badge>
                        ) : passed ? (
                          <Badge color={statusTone('active')} variant="soft">
                            Unlocked
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-[var(--module-active-text)]">{meta.commission}</p>
                      <ul className="flex flex-col gap-2">
                        {meta.unlocks.map((u) => (
                          <li key={u} className="flex items-start gap-2">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--module-active)]" />
                            <p className="text-sm">{u}</p>
                          </li>
                        ))}
                      </ul>
                      <p className="text-base-content/70 text-xs">{meta.howToReach}</p>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>

          {profile ? (
            upcoming ? (
              <OverviewCard
                title={`Advance to ${TIERS[upcoming].label}`}
                icon={<Award className="h-4 w-4" />}
                description={TIERS[upcoming].commission}
              >
                <div className="flex flex-col gap-3">
                  <p className="text-base-content/70 text-sm">{TIERS[upcoming].howToReach}</p>
                  {canOperate ? (
                    <TierApply requestedTier={upcoming} />
                  ) : (
                    <p className="text-base-content/70 text-sm">
                      Ask an owner or admin to apply for the next tier.
                    </p>
                  )}
                </div>
              </OverviewCard>
            ) : (
              <Card>
                <CardBody>
                  <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-semibold tracking-tight">
                      You’re at the top tier
                    </h2>
                    <p className="text-base-content/70 text-sm">
                      You earn ongoing commission on managed accounts and can publish bootcamps
                      publicly. Keep growing — the directory rewards active certified partners.
                    </p>
                  </div>
                </CardBody>
              </Card>
            )
          ) : (
            <Card>
              <CardBody>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-semibold tracking-tight">Not a partner yet?</h2>
                    <p className="text-base-content/70 text-sm">
                      Join the program to claim your referral link and start earning. You can apply
                      to move up a tier any time.
                    </p>
                  </div>
                  <div>
                    <Button render={<Link href="/partner" />} color="module">
                      Become a partner
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </ModuleProvider>
  );
}
