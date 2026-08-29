'use client';

// One line of the return request: tick it, say how many, say why.
//
// Split out of the page so each keeps one job — the page owns the request, this
// owns a row. The reason picker only appears once a row is ticked: asking "why
// are you sending this back" about something she has not chosen is noise.

import { Checkbox, NativeSelect } from '@wizeworks/silicaui-react';

import { RETURN_REASONS, type ReturnableLine, type ReturnReasonCode } from '@/lib/customer-client';
import { formatMoney } from '@/lib/format';

export interface LinePick {
  quantity: number;
  reasonCode: ReturnReasonCode | null;
}

export function ReturnLineRow({
  line,
  pick,
  onChange,
}: {
  line: ReturnableLine;
  pick: LinePick;
  onChange: (pick: LinePick) => void;
}) {
  const included = pick.quantity > 0;
  const most = line.returnableQuantity;
  // Paired explicitly rather than by nesting: the name sits two elements deep, so
  // wrapping alone does not give the control an accessible name.
  const checkboxId = `return-line-${line.orderItemId}`;

  return (
    <div className="card border-base-300 flex-col gap-3 border p-4">
      <label className="flex cursor-pointer items-start gap-3" htmlFor={checkboxId}>
        <Checkbox
          id={checkboxId}
          aria-label={`Send back ${line.name}`}
          checked={included}
          onChange={(e) =>
            onChange(
              e.currentTarget.checked
                ? { quantity: 1, reasonCode: pick.reasonCode }
                : { quantity: 0, reasonCode: null }
            )
          }
        />
        <span className="min-w-0 flex-1">
          <span className="text-base-content block font-medium">{line.name}</span>
          <span className="text-base-content block text-sm">
            {formatMoney(line.unitPriceCents, 'USD')} each
            {/* Only worth saying when some of this line is already spoken for —
                otherwise it reads as a limit she has bumped into. */}
            {line.spokenFor > 0
              ? ` · ${most} of ${line.quantity} left to send back`
              : line.quantity > 1
                ? ` · you bought ${line.quantity}`
                : ''}
          </span>
        </span>
      </label>

      {included ? (
        <div className="flex flex-wrap gap-4 pl-8">
          {most > 1 ? (
            <label className="flex flex-col gap-1">
              <span className="text-base-content text-sm font-medium">How many?</span>
              <NativeSelect
                value={String(pick.quantity)}
                onChange={(e) => onChange({ ...pick, quantity: Number(e.currentTarget.value) })}
              >
                {Array.from({ length: most }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </NativeSelect>
            </label>
          ) : null}

          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-base-content text-sm font-medium">
              Why are you sending it back?
            </span>
            <NativeSelect
              value={pick.reasonCode ?? ''}
              onChange={(e) =>
                onChange({
                  ...pick,
                  reasonCode: (e.currentTarget.value || null) as ReturnReasonCode | null,
                })
              }
            >
              <option value="">Choose a reason</option>
              {RETURN_REASONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>
      ) : null}
    </div>
  );
}
