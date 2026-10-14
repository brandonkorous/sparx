'use client';

// "Their old part": the core deposit now, or the old part first (sparx issue
// 061). Nothing at all on a line that takes no core. Moved out of
// sale-lines.tsx unchanged (sparx persona issue 230).

import { RadioGroup, RadioOption, Text } from '@wizeworks/silicaui-react';

import {
  CORE_CHOICE_LEGEND,
  CORE_FIRST_HINT,
  CORE_FIRST_LABEL,
  CORE_PAY_HINT,
  bringsOldPartFirst,
  coreDepositOnly,
  corePayLabel,
} from './sale-core';
import type { SaleLine } from './sale-data';

function Choice({ value, label, hint }: { value: string; label: string; hint: string }) {
  return (
    <RadioOption value={value} className="items-start py-1">
      <span className="flex flex-col gap-0.5">
        <span className="text-base font-medium">{label}</span>
        <span className="text-sm">{hint}</span>
      </span>
    </RadioOption>
  );
}

export function OldPartChoice({
  line,
  currency,
  onChange,
}: {
  line: SaleLine;
  currency: string;
  onChange: (next: SaleLine) => void;
}) {
  const core = line.core;
  if (!core) return null;

  // One way to buy it is not a choice, so it is a sentence rather than a lone
  // radio button nobody can press away from.
  if (!core.firstOffered) {
    return (
      <Text className="w-full text-sm">
        {coreDepositOnly(core.depositCents, line.quantity, currency)}
      </Text>
    );
  }

  const legendId = `${line.id}-old-part`;
  return (
    <div className="flex w-full flex-col gap-1">
      <Text id={legendId} className="font-medium">
        {CORE_CHOICE_LEGEND}
      </Text>
      <RadioGroup
        color="module"
        aria-labelledby={legendId}
        value={bringsOldPartFirst(line) ? 'first' : 'pay'}
        onValueChange={(value) => {
          onChange({ ...line, coreFirst: value === 'first' });
        }}
      >
        <Choice
          value="pay"
          label={corePayLabel(core.depositCents, line.quantity, currency)}
          hint={CORE_PAY_HINT}
        />
        <Choice value="first" label={CORE_FIRST_LABEL} hint={CORE_FIRST_HINT} />
      </RadioGroup>
    </div>
  );
}
