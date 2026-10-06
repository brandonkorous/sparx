'use client';

// What the line editor says under the numbers: where a trade price came from
// (issue 077), and the margin as you price (sparx persona issue 086).

import { Alert, Badge, Text } from '@wizeworks/silicaui-react';
import { MarginBadge } from './margin-badge';
import type { TradeAccount } from './trade-price';
import type { useLineForm } from './use-line-form';

type Form = ReturnType<typeof useLineForm>;

/** One message at a time, in wholesale's hue: that module's rule set the price. */
function PriceSource({ form, tradeAccount }: { form: Form; tradeAccount: TradeAccount | null }) {
  if (form.pricingLookup && tradeAccount) {
    return (
      <Text className="text-sm" role="status">
        {`Looking up ${tradeAccount.name}'s price…`}
      </Text>
    );
  }
  if (form.priceWarning) {
    return (
      <Alert color="warning" variant="soft">
        {form.priceWarning}
      </Alert>
    );
  }
  if (!form.priceNote) return null;
  return (
    <div>
      <Badge color="module-b2b" variant="soft">
        {form.priceNote}
      </Badge>
    </div>
  );
}

/** On every line with a cost, not only a markup line. Never shown to them. */
function MarginNote({ form, currency }: { form: Form; currency: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-live="polite">
      {form.margin ? (
        <MarginBadge margin={form.margin} currency={currency} />
      ) : form.cost.trim() === '' ? (
        <Text className="text-sm">Add what this cost you to see your margin.</Text>
      ) : null}
    </div>
  );
}

export function LineEditorNotes({
  form,
  tradeAccount,
  currency,
}: {
  form: Form;
  tradeAccount: TradeAccount | null;
  currency: string;
}) {
  return (
    <>
      <PriceSource form={form} tradeAccount={tradeAccount} />
      <MarginNote form={form} currency={currency} />
    </>
  );
}
