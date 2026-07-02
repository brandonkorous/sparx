import * as React from 'react';
import { Check, Handshake } from 'lucide-react';
import { Card, Container, Grid, Heading, ModuleProvider, PageHeader, Stack, Text } from '@sparx/ui';

import { TIER_ORDER, TIERS } from '../_lib/tiers';
import { JoinForm } from './join-form';

// The "Become a Sparx Partner" landing (docs/114 §B.2/D7) — what a tenant that
// hasn't joined sees at /partner. A value-prop hero (the single violet-tinted card
// on this surface, per the one-tint-per-hue rule), the three tiers side by side,
// then the self-serve join form. Wrapped in the partner provider so the chrome +
// primary action carry the program's violet.

export function PartnerJoinLanding() {
  return (
    <ModuleProvider module="partner">
      <Container size="lg">
        <Stack gap={8} className="py-10">
          <PageHeader
            icon={<Handshake className="h-5 w-5" />}
            title="Become a Sparx Partner"
            description="Build your practice on Sparx. Refer clients, earn commission on every account you bring in, host bootcamps, and get listed in the public partner directory."
          />

          {/* The one tinted card on this surface — the value proposition. */}
          <Card variant="module" padding="lg">
            <Stack gap={3}>
              <Heading level={2}>Why partner with Sparx</Heading>
              <Grid cols={1} mdCols={3} gap={4}>
                <ValueProp
                  title="Earn on every referral"
                  body="20–30% of a referred account’s first payment, plus 5% ongoing at the certified tier."
                />
                <ValueProp
                  title="Get discovered"
                  body="A public listing in the sparx.works partner directory, filterable by specialty and location."
                />
                <ValueProp
                  title="Grow your reach"
                  body="Host bootcamps on Sparx and turn every graduate into a lead in your own CRM."
                />
              </Grid>
            </Stack>
          </Card>

          {/* Tier comparison — neutral cards; the tint is spent on the hero above. */}
          <Stack gap={4}>
            <Heading level={2}>Choose where to start</Heading>
            <Grid cols={1} mdCols={3} gap={4}>
              {TIER_ORDER.map((t) => {
                const meta = TIERS[t];
                return (
                  <Card key={t} variant="default" padding="lg">
                    <Stack gap={3}>
                      <Stack gap={1}>
                        <Text size="lg" weight="medium">
                          {meta.label}
                        </Text>
                        <Text size="sm" className="text-[var(--module-active-text)]">
                          {meta.commission}
                        </Text>
                        <Text size="sm" variant="muted">
                          {meta.tagline}
                        </Text>
                      </Stack>
                      <ul className="flex flex-col gap-2">
                        {meta.unlocks.map((u) => (
                          <li key={u} className="flex items-start gap-2">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--module-active)]" />
                            <Text size="sm">{u}</Text>
                          </li>
                        ))}
                      </ul>
                    </Stack>
                  </Card>
                );
              })}
            </Grid>
          </Stack>

          {/* The join form. */}
          <Stack gap={4}>
            <Heading level={2}>Join the program</Heading>
            <JoinForm />
          </Stack>
        </Stack>
      </Container>
    </ModuleProvider>
  );
}

function ValueProp({ title, body }: { title: string; body: string }) {
  return (
    <Stack gap={1}>
      <Text size="sm" weight="medium">
        {title}
      </Text>
      <Text size="sm" variant="muted">
        {body}
      </Text>
    </Stack>
  );
}
