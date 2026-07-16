'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Button,
  Card,
  CardBody,
  CardTitle,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  NativeSelect,
} from '@wizeworks/silicaui-react';

import { updatePriceListAction } from '../../../pricing-actions';
import type { TargetOption } from '../../_lib/targeting-options';

type TargetType = 'none' | 'b2b_account' | 'segment';

function targetTypeOf(b2bAccountId: string | null, customerSegmentId: string | null): TargetType {
  if (b2bAccountId) return 'b2b_account';
  if (customerSegmentId) return 'segment';
  return 'none';
}

// Targeting narrows which channel-eligible customers see this price list —
// a single B2B account, a customer segment, or neither ("everyone" on the
// channel). Mutually exclusive, enforced both here (only one picker shows at
// a time) and server-side (pricing-service.ts updatePriceList).
export function PriceListTargetingCard({
  priceListId,
  b2bAccountId: initialB2bAccountId,
  customerSegmentId: initialCustomerSegmentId,
  b2bAccounts,
  segments,
}: {
  priceListId: string;
  b2bAccountId: string | null;
  customerSegmentId: string | null;
  b2bAccounts: TargetOption[];
  segments: TargetOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [targetType, setTargetType] = React.useState<TargetType>(() =>
    targetTypeOf(initialB2bAccountId, initialCustomerSegmentId)
  );
  const [b2bAccountId, setB2bAccountId] = React.useState(initialB2bAccountId ?? '');
  const [customerSegmentId, setCustomerSegmentId] = React.useState(initialCustomerSegmentId ?? '');

  const dirty =
    targetType !== targetTypeOf(initialB2bAccountId, initialCustomerSegmentId) ||
    (targetType === 'b2b_account' && b2bAccountId !== (initialB2bAccountId ?? '')) ||
    (targetType === 'segment' && customerSegmentId !== (initialCustomerSegmentId ?? ''));

  const invalid =
    (targetType === 'b2b_account' && b2bAccountId === '') ||
    (targetType === 'segment' && customerSegmentId === '');

  function onSave() {
    setError(null);
    startTransition(async () => {
      const result = await updatePriceListAction(priceListId, {
        b2bAccountId: targetType === 'b2b_account' ? b2bAccountId : null,
        customerSegmentId: targetType === 'segment' ? customerSegmentId : null,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardBody>
        <CardTitle>Targeting</CardTitle>
        <p className="text-base-content -mt-2 text-sm">
          Narrow this list to one B2B account or one customer segment. Leave it on
          &ldquo;everyone&rdquo; to apply to all eligible customers on the selected channel.
        </p>

        <div className="flex flex-row flex-wrap items-end gap-3">
          <Field className="min-w-[14rem] flex-1">
            <FieldLabel>Applies to</FieldLabel>
            <FieldControl
              name="targetType"
              value={targetType}
              onChange={(e) => {
                const next = e.target.value as TargetType;
                setTargetType(next);
                if (next !== 'b2b_account') setB2bAccountId('');
                if (next !== 'segment') setCustomerSegmentId('');
              }}
              render={
                <NativeSelect>
                  <option value="none">Everyone on this channel</option>
                  <option value="b2b_account">One B2B account</option>
                  <option value="segment">One customer segment</option>
                </NativeSelect>
              }
            />
          </Field>
          {targetType === 'b2b_account' && (
            <Field className="min-w-[16rem] flex-1">
              <FieldLabel required>B2B account</FieldLabel>
              <FieldControl
                name="b2bAccountId"
                value={b2bAccountId}
                onChange={(e) => setB2bAccountId(e.target.value)}
                render={
                  <NativeSelect>
                    <option value="">— pick —</option>
                    {b2bAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </NativeSelect>
                }
              />
            </Field>
          )}
          {targetType === 'segment' && (
            <Field className="min-w-[16rem] flex-1">
              <FieldLabel required>Customer segment</FieldLabel>
              <FieldControl
                name="customerSegmentId"
                value={customerSegmentId}
                onChange={(e) => setCustomerSegmentId(e.target.value)}
                render={
                  <NativeSelect>
                    <option value="">— pick —</option>
                    {segments.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </NativeSelect>
                }
              />
            </Field>
          )}
          <Button color="module" size="sm" disabled={pending || !dirty || invalid} onClick={onSave}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </div>
        {error && (
          <FieldStatus
            status="error"
            attached={false}
            role="alert"
            aria-live="polite"
            className="mt-2"
          >
            {error}
          </FieldStatus>
        )}
      </CardBody>
    </Card>
  );
}
