'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { Button, Card, CardContent, Input, Label, Stack, Text } from '@sparx/ui';

// The referral link card (docs/114 §B.7). A read-only field with the partner's
// shareable link + a copy button. The link is the canonical `?ref=CODE` capture
// the attribution layer reads (docs/114 §B.3). Neutral card — this is a partner
// working surface, so the hue rides the copy button, not a wash.

export function ReferralLinkCard({ referralCode }: { referralCode: string }) {
  const link = `https://sparx.works/?ref=${referralCode}`;
  const [copied, setCopied] = React.useState(false);

  const copy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (permissions / insecure context) — the field is still
      // selectable, so the user can copy manually.
    }
  }, [link]);

  return (
    <Card variant="default">
      <CardContent className="py-6">
        <Stack gap={3}>
          <Stack gap={1}>
            <Label htmlFor="referral-link">Your referral link</Label>
            <Text size="sm" variant="muted">
              Share this anywhere. When someone signs up through it, they’re credited to you and you
              earn on their first payment.
            </Text>
          </Stack>
          <Stack direction="row" gap={2} align="center" wrap>
            <Input
              id="referral-link"
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-[16rem] flex-1 font-mono text-sm"
            />
            <Button
              type="button"
              color="module"
              variant="soft"
              onClick={copy}
              leftIcon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            >
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </Stack>
          <Text size="xs" variant="muted">
            Referral code: <span className="font-mono">{referralCode}</span>
          </Text>
        </Stack>
      </CardContent>
    </Card>
  );
}
