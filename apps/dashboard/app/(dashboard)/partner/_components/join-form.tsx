'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  NativeSelect,
  RadioGroup,
  RadioGroupItem,
  Stack,
  Text,
} from '@sparx/ui';
import { PARTNER_KINDS } from '../_lib/kinds';
import { TIER_ORDER, TIERS } from '../_lib/tiers';
import { applyForPartnerAction } from '../actions';

// The partner application form (docs/114 §B.2). A neutral working-surface card (the
// module tint rides the chrome + the violet button, per color-follows-
// functionality) inside the "Become a partner" landing. EVERY tier is an
// application for staff review — there is NO instant signup. On success we refresh
// so the join surface flips to its "in review" state (the page re-reads the
// application status).

export function JoinForm() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [displayName, setDisplayName] = React.useState('');
  const [requestedTier, setRequestedTier] = React.useState('informal');
  const [kind, setKind] = React.useState('freelance');
  const [error, setError] = React.useState<string | null>(null);

  function submit() {
    setError(null);
    const trimmed = displayName.trim();
    if (!trimmed) {
      setError('Enter the name your practice goes by.');
      return;
    }
    startTransition(async () => {
      const result = await applyForPartnerAction({ displayName: trimmed, requestedTier, kind });
      if (!result.ok) {
        setError(result.error ?? 'Could not submit your application.');
        return;
      }
      // Application submitted — refresh so the surface flips to "in review".
      router.refresh();
    });
  }

  return (
    <Card variant="default">
      <CardContent className="py-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!pending) submit();
          }}
        >
          <Stack gap={5}>
            <Stack gap={2}>
              <Label htmlFor="partner-name">Practice name</Label>
              <Input
                id="partner-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Northwind Studio"
                maxLength={255}
              />
              <Text size="xs" variant="muted">
                How you’ll appear in the public partner directory. You can refine your full listing
                later.
              </Text>
            </Stack>

            <Stack gap={2}>
              <Label htmlFor="partner-kind">What best describes you?</Label>
              <NativeSelect
                id="partner-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                {PARTNER_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </NativeSelect>
            </Stack>

            <Stack gap={2}>
              <Label>Tier you’re applying for</Label>
              <RadioGroup value={requestedTier} onValueChange={setRequestedTier}>
                {TIER_ORDER.map((t) => {
                  const meta = TIERS[t];
                  return (
                    <div
                      key={t}
                      className="flex items-start gap-3 rounded-lg border border-[var(--color-border-default)] p-3"
                    >
                      <RadioGroupItem id={`tier-${t}`} value={t} color="module" className="mt-1" />
                      <Stack gap={0} className="min-w-0">
                        <Label htmlFor={`tier-${t}`}>
                          {meta.label} · {meta.commission}
                        </Label>
                        <Text size="xs" variant="muted">
                          Reviewed before approval — we confirm within 3 business days.
                        </Text>
                      </Stack>
                    </div>
                  );
                })}
              </RadioGroup>
            </Stack>

            <Text size="xs" variant="muted">
              We review every application to keep the partner directory high-quality. You’ll hear
              back within 3 business days — nothing activates until we approve it.
            </Text>

            {error && (
              <Text size="sm" variant="danger" role="alert" aria-live="polite">
                {error}
              </Text>
            )}

            <div>
              <Button type="submit" color="module" loading={pending} disabled={pending}>
                Submit application
              </Button>
            </div>
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}
