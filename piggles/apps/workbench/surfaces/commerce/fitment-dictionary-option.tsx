'use client';

// One ready-made compatibility list in the picker: what it holds, and Install.

import { Badge, Button, Heading, Text } from '@wizeworks/silicaui-react';
import { faCheck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { resolveFitmentIcon } from './fitment-icons';
import type { FitmentDictionaryOption } from './fitment-data';

function OptionSummary({ option }: { option: FitmentDictionaryOption }) {
  if (option.summary.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 pt-0.5">
      {option.summary.map((chip, index) => (
        <Badge
          key={index}
          {...(chip.tone === 'module' ? { color: 'module' as const } : {})}
          variant="soft"
          size="sm"
        >
          {chip.label}
        </Badge>
      ))}
    </div>
  );
}

export function FitmentDictionaryOptionRow({
  option,
  installing,
  disabled,
  onInstall,
}: {
  option: FitmentDictionaryOption;
  installing: boolean;
  disabled: boolean;
  onInstall: () => void;
}) {
  return (
    // `flex-wrap` needs a FLOOR to wrap against, so the words get `min-w-48` and
    // Install drops underneath instead of crushing them when docked narrow (issue 806).
    <li className="border-base-300 flex flex-wrap items-start gap-3 rounded border p-3">
      <Icon glyph={resolveFitmentIcon(option.iconKey)} className="size-6 shrink-0" aria-hidden />
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <Heading level={3} className="text-base font-semibold">
          {option.name}
        </Heading>
        <Text className="text-sm">{option.description}</Text>
        <OptionSummary option={option} />
      </div>
      <div className="ms-auto shrink-0 self-center">
        {option.installed ? (
          <Badge color="success" variant="soft" size="sm">
            <Icon glyph={faCheck} className="size-3.5" aria-hidden />
            Installed
          </Badge>
        ) : (
          <Button
            size="sm"
            color="module"
            loading={installing}
            disabled={disabled}
            onClick={onInstall}
          >
            Install
          </Button>
        )}
      </div>
    </li>
  );
}
