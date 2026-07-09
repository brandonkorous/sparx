'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { Button, Card, CardBody, Input, Label } from '@wizeworks/silicaui-react';

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
    <Card>
      <CardBody>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="referral-link">Your referral link</Label>
            <p className="text-base-content/70 text-sm">
              Share this anywhere. When someone signs up through it, they’re credited to you and you
              earn on their first payment.
            </p>
          </div>
          <div className="flex flex-row flex-wrap items-center gap-2">
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
              iconStart={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            >
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
          <p className="text-base-content/70 text-xs">
            Referral code: <span className="font-mono">{referralCode}</span>
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
