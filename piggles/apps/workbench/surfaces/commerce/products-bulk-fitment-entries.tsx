'use client';

// The entries gathered in the bulk "What they fit" dialog, before they are
// applied. Leaving one out edits only this list, so it is a plain dismiss.

import { Badge, Button, Card, Text } from '@wizeworks/silicaui-react';
import { faXmark } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { FitmentDomain } from './products-data';
import type { ChosenRule } from './fitment-choice';
import { rangeLabel, ruleTitle } from './fitment-rule-words';

/** Same entry, same windows: the same rule, listed once. Removing ignores years. */
export function entryKey(rule: ChosenRule, withRanges: boolean): string {
  const ranges = withRanges
    ? rule.ranges.map((r) => `${r.dimensionKey}=${String(r.min)}..${String(r.max)}`).join(',')
    : '';
  return `${rule.domainId}|${rule.nodeId ?? '*'}|${ranges}`;
}

function Entry({
  rule,
  domain,
  onRemove,
}: {
  rule: ChosenRule;
  domain: FitmentDomain | undefined;
  onRemove: () => void;
}) {
  const title = ruleTitle(rule, domain);
  return (
    <li className="border-base-300 flex items-start justify-between gap-2 border-b py-2 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Text className="min-w-0 font-semibold break-words">{title}</Text>
        {rule.ranges.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {rule.ranges.map((range) => (
              <Badge key={range.dimensionKey} color="module" variant="soft" size="sm">
                {rangeLabel(
                  range,
                  domain?.dimensions.find((d) => d.key === range.dimensionKey)
                )}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      <Button
        size="sm"
        variant="ghost"
        shape="square"
        className="shrink-0"
        aria-label={`Leave out ${title}`}
        title={`Leave out ${title}`}
        onClick={onRemove}
      >
        <Icon glyph={faXmark} className="size-4" aria-hidden />
      </Button>
    </li>
  );
}

export function GatheredEntries({
  adding,
  entries,
  domains,
  onRemove,
}: {
  adding: boolean;
  entries: ChosenRule[];
  domains: FitmentDomain[];
  onRemove: (index: number) => void;
}) {
  if (entries.length === 0) {
    return (
      <Text>
        {adding
          ? 'Nothing on the list yet. Find an entry above and press its Add button.'
          : 'Nothing chosen yet. Find an entry above and press its Choose button.'}
      </Text>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <Text className="font-semibold">
        {adding ? 'To add to every chosen product' : 'To take off every chosen product'}
      </Text>
      <Card className="border-base-300 flex flex-col border p-3">
        <ul className="flex flex-col">
          {entries.map((rule, index) => (
            <Entry
              key={entryKey(rule, adding)}
              rule={rule}
              domain={domains.find((candidate) => candidate.id === rule.domainId)}
              onRemove={() => onRemove(index)}
            />
          ))}
        </ul>
      </Card>
    </div>
  );
}
