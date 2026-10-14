'use client';

// Several choices from a short list, as toggle chips. Shared by the entry form's
// list, link and author fields.

import { Button } from '@wizeworks/silicaui-react';

export function ChipMultiSelect({
  options,
  selected,
  onChange,
  disabled,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const set = new Set(selected);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const on = set.has(option.value);
        return (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={on ? 'soft' : 'outline'}
            color={on ? 'module' : 'neutral'}
            disabled={disabled}
            aria-pressed={on}
            onClick={() => {
              const next = new Set(set);
              if (on) next.delete(option.value);
              else next.add(option.value);
              onChange([...next]);
            }}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
