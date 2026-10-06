'use client';

// Apply a markup rule to the catalog: see first, then reprice (sparx persona
// issue 086). It changes live prices in bulk, so the confirm names the count.

import { Badge, Button, Text, useToast } from '@wizeworks/silicaui-react';
import { useState } from 'react';
import { useConfirm } from '../../lib/confirm';
import { formatCentsAmount } from '../../lib/money-format';
import {
  markupRuleErrorMessage,
  useApplyMarkupRule,
  useMarkupPreview,
  type MarkupPreview,
} from './markup-rules-data';
import type { MarkupRuleRow } from './markup-rule-words';

/** How many sample rows the preview lists; the count says the rest. */
const SAMPLE = 5;

function products(n: number): string {
  return n === 1 ? '1 product' : `${String(n)} products`;
}

function PreviewSummary({ preview }: { preview: MarkupPreview }) {
  const sample = preview.lines.filter((line) => !line.unpriceable).slice(0, SAMPLE);
  const money = (cents: number) => formatCentsAmount(cents, 'USD');
  return (
    <div className="flex flex-col gap-2">
      <Text>
        Applying would price {products(preview.pricedVariants)} of the{' '}
        {products(preview.totalVariants)} it covers.
        {preview.unpriceableVariants > 0
          ? ` ${products(preview.unpriceableVariants)} have no cost on record and keep the price they have.`
          : ''}
      </Text>
      <ul className="flex flex-col gap-1">
        {sample.map((line) => (
          <li key={line.variantId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="min-w-0 flex-1 truncate">{line.title ?? line.sku}</span>
            <Text as="span" className="text-sm tabular-nums">
              {money(line.currentPriceCents)} to{' '}
              {line.newPriceCents === null ? 'unchanged' : money(line.newPriceCents)}
            </Text>
            {line.marginPct !== null ? (
              <Badge
                color={line.marginPct < 0 ? 'danger' : line.marginPct < 15 ? 'warning' : 'success'}
                variant="soft"
                size="sm"
              >
                {String(line.marginPct)}% margin
              </Badge>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Confirm, then reprice; says how it went either way. */
function useApply(rule: MarkupRuleRow) {
  const toast = useToast();
  const confirm = useConfirm();
  const apply = useApplyMarkupRule(rule.id);
  const run = async (priced: number) => {
    const ok = await confirm({
      title: `Reprice ${products(priced)} with ${rule.name}?`,
      description:
        'Their prices change to what this rule works out, on your site straight away. Products with no cost on record keep their price. You can change any one afterwards, but there is no undoing the whole batch.',
      confirmLabel: `Reprice ${products(priced)}`,
      cancelLabel: 'Not now',
      color: 'warning',
    });
    if (!ok) return;
    apply.mutate(undefined, {
      onSuccess: (result) => {
        const skipped = `${products(result.skipped)} had no cost and kept their price.`;
        toast.add({
          title: `${products(result.applied)} repriced`,
          ...(result.skipped > 0 ? { description: skipped } : {}),
          type: 'success',
        });
      },
      onError: (error) => {
        const description = markupRuleErrorMessage(error, 'No prices were changed.');
        toast.add({ title: 'Could not apply this rule', description, type: 'error' });
      },
    });
  };
  return { run, pending: apply.isPending };
}

function PreviewBlock({ rule }: { rule: MarkupRuleRow }) {
  const preview = useMarkupPreview(rule.id, true);
  const apply = useApply(rule);
  if (preview.isError) {
    const fallback = 'The preview could not be worked out just now.';
    return <Text className="text-sm">{markupRuleErrorMessage(preview.error, fallback)}</Text>;
  }
  if (preview.isPending) {
    return (
      <Text className="text-sm" role="status">
        Working it out…
      </Text>
    );
  }
  const priced = preview.data.pricedVariants;
  return (
    <>
      <PreviewSummary preview={preview.data} />
      {priced > 0 ? (
        <div>
          <Button
            size="sm"
            color="module"
            loading={apply.pending}
            onClick={() => {
              void apply.run(priced);
            }}
          >
            Reprice {products(priced)}
          </Button>
        </div>
      ) : null}
    </>
  );
}

export function MarkupRuleApply({ rule, dirty }: { rule: MarkupRuleRow; dirty: boolean }) {
  const [asked, setAsked] = useState(false);
  if (dirty) {
    return (
      <Text className="text-sm">
        Save your changes first. Applying uses the rule as it is saved.
      </Text>
    );
  }
  return (
    <div className="border-base-300 flex flex-col gap-3 border-t pt-4">
      <Text className="text-sm">
        Applying puts this rule on every product it covers and reprices them from their cost.
      </Text>
      {asked ? (
        <PreviewBlock rule={rule} />
      ) : (
        <div>
          <Button
            size="sm"
            variant="outline"
            color="module"
            onClick={() => {
              setAsked(true);
            }}
          >
            See what applying would change
          </Button>
        </div>
      )}
    </div>
  );
}
