'use client';

// The full-width billing banner beneath the toolbar (docs/17 §6 ladder, rows 2–6).
// Escalates from a dismissible trial heads-up → a persistent trial countdown →
// grace ("paused · site live N more days") → suspended ("site offline"). Only the
// earliest tier is dismissible (until tomorrow); you can't dismiss your site going
// dark. Renders nothing for a paid-active / exempt tenant, or when the heads-up
// tier was dismissed.

import { useState } from 'react';
import { Alert, Button } from '@wizeworks/silicaui-react';
import { X } from 'lucide-react';

import { useWorkbench } from '../../lib/workbench/context';
import { useTenant } from '../../lib/api/shell-data';
import { useBill } from '../../surfaces/finance/bill-data';
import { billingNotice } from '../../lib/billing/notice';
import { dismissBannerUntilTomorrow, isBannerDismissed } from '../../lib/billing/dismissal';

export function BillingBanner() {
  const { data: bill } = useBill();
  const { data: tenant } = useTenant();
  const { controller } = useWorkbench();
  const [dismissed, setDismissed] = useState(false);

  // `useBill` is a client query with no SSR seed, so `bill` is undefined on the
  // server + first paint — the banner (and its localStorage read) only ever run
  // once we're client-side, so there's no hydration mismatch to guard against.
  if (!bill || !tenant) return null;
  const notice = billingNotice(bill.billing);
  if (!notice) return null;
  if (notice.dismissible && (dismissed || isBannerDismissed(tenant.id))) return null;

  return (
    <div className="px-2 pt-2">
      <Alert color={notice.tone} variant="soft">
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
          <div className="min-w-0 flex-1">
            <span className="font-medium">{notice.title}</span>{' '}
            <span className="text-sm">{notice.body}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              color={notice.tone}
              size="xs"
              onClick={() => controller.open('finance.subscription')}
            >
              {notice.ctaLabel}
            </Button>
            {notice.dismissible ? (
              <Button
                variant="ghost"
                color="neutral"
                size="xs"
                shape="square"
                aria-label="Dismiss until tomorrow"
                onClick={() => {
                  dismissBannerUntilTomorrow(tenant.id);
                  setDismissed(true);
                }}
              >
                <X className="size-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        </div>
      </Alert>
    </div>
  );
}
