'use client';

// One search result on the domain step: an available domain to add, or a taken one.

import { Badge, Button } from '@wizeworks/silicaui-react';
import { faCheck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { type DomainSuggestion, money } from './domain-shared';

export function DomainRow({
  suggestion,
  featured = false,
  onBuy,
}: {
  suggestion: DomainSuggestion;
  featured?: boolean;
  onBuy: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 ${
        featured ? 'border-module ring-module ring-1' : 'border-base-300 bg-base-100'
      }`}
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{suggestion.domain}</p>
        <span className="mt-0.5 flex items-center gap-1.5">
          <Icon glyph={faCheck} className="text-success size-3.5" aria-hidden />
          <span className="text-success text-sm">
            {featured ? 'Available · best match' : 'Available'}
          </span>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <p className="text-sm">
            <span className="font-medium">{money(suggestion.displayPrice)}</span>/yr
          </p>
          {suggestion.renewalDisplayPrice > suggestion.displayPrice ? (
            <p className="text-sm">then {money(suggestion.renewalDisplayPrice)}/yr</p>
          ) : null}
        </div>
        <Button
          color={featured ? 'module' : 'neutral'}
          variant={featured ? 'solid' : 'outline'}
          size="sm"
          onClick={onBuy}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

export function TakenRow({ domain, lead = false }: { domain: string; lead?: boolean }) {
  return (
    <div className="border-base-300 bg-base-200 flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5">
      <div className="min-w-0">
        <p className="truncate font-medium">{domain}</p>
        {lead ? (
          <p className="mt-0.5 text-sm">Already registered. Here are close ones you can grab.</p>
        ) : null}
      </div>
      <Badge color="neutral" variant="soft" size="sm">
        Taken
      </Badge>
    </div>
  );
}
