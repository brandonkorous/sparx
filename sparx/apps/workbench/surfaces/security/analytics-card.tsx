'use client';

// Whether we may see how you use sparx — the answer, and the way to change it.
//
// ── WHY IT IS ON THE SECURITY PANE ──────────────────────────────────────────
//
// This pane is already the answer to "what does sparx know about me and who can
// get at it": the password, the second factor, the devices signed in, the record
// of what has been done. What is being measured about how you work belongs in
// exactly that column, not buried in a settings tree where nobody would look for
// it.
//
// ── WHY A CARD AND NOT A TOGGLE ─────────────────────────────────────────────
//
// A switch has two positions and this has three. "Never asked" is a real state
// with no switch position — a toggle would have to render it as off, which is
// indistinguishable from a refusal and is the exact collapse the record's shape
// exists to prevent. So the card says which of the three it is, in words, and
// offers the move that changes it.
//
// The date is shown because consent that cannot be dated cannot be evidenced,
// and "when did I agree to this" is the first thing anyone asks.

import { Badge, Button, Text } from '@wizeworks/silicaui-react';
import { useQueryClient } from '@wizeworks/query';
import { useToast } from '@wizeworks/silicaui-react';
import { useState } from 'react';
import { FormSection } from '../../components/form-section';
import { InlineWaiting } from '../../components/inline-waiting';
import { PREFERENCES_KEY, useConsent } from '../../lib/consent';

function answeredOn(at: string): string | null {
  if (!at) return null;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function AnalyticsCard() {
  const consent = useConsent();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const set = async (analytics: boolean) => {
    setSaving(true);
    try {
      const response = await fetch('/api/consent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ analytics }),
      });
      if (!response.ok) throw new Error(String(response.status));
      await queryClient.invalidateQueries({ queryKey: PREFERENCES_KEY });
      toast.add({
        title: analytics ? 'Thank you — that helps' : 'Analytics is off',
        description: analytics
          ? 'It takes effect the next time this page loads.'
          : 'Nothing more will be collected. Anything already collected stays until it ages out.',
        type: 'success',
      });
    } catch {
      toast.add({
        title: 'That did not save',
        description: 'Your answer was not recorded. Nothing changed either way.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSection
      title="Product analytics"
      description="Which screens get opened and how long things take to load — never sold, never used for advertising, and not how we bill you."
    >
      {consent === undefined ? (
        <InlineWaiting label="Reading your answer…" />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            {/* Three states, three badges, three different colors — a grey pill
                for all of them would be the failure this card was built around
                (DESIGN.md RULE #4). "Not answered" is a WARNING because it is
                something outstanding, not a settled preference. */}
            {consent === null ? (
              <Badge color="warning" variant="soft" size="lg">
                Not answered yet
              </Badge>
            ) : (
              <Badge color={consent.analytics ? 'success' : 'info'} variant="soft" size="lg">
                {consent.analytics ? 'Helping us improve' : 'Analytics off'}
              </Badge>
            )}
            <Text>
              {consent === null
                ? 'Nothing is being collected until you answer.'
                : (() => {
                    const on = answeredOn(consent.at);
                    return consent.analytics
                      ? `You said yes${on ? ` on ${on}` : ''}.`
                      : `You said no${on ? ` on ${on}` : ''}. Nothing is being collected.`;
                  })()}
            </Text>
          </div>

          {/* Both answers stay reachable in every state, so this is never a
              one-way door — the card that only offers "turn off" makes turning
              back on a support ticket. */}
          <div className="flex gap-2">
            <Button
              color="primary"
              variant={consent?.analytics === true ? 'soft' : 'solid'}
              disabled={saving || consent?.analytics === true}
              onClick={() => void set(true)}
            >
              Yes, that is fine
            </Button>
            <Button
              variant="outline"
              disabled={saving || consent?.analytics === false}
              onClick={() => void set(false)}
            >
              No thanks
            </Button>
          </div>
        </div>
      )}
    </FormSection>
  );
}
