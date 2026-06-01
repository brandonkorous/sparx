'use client';

// The `Layout: [▾]` picker (docs/36 §6, P-C). Mounted in the Commerce product /
// CMS entry editors via LayoutAssignmentSection. Picking "Default layout" clears
// the per-item override (the item falls back to the per-target default → the
// `default` layout); picking a named layout pins this item to it. Writes go
// through the Site-Builder-owned assignment API; the server component re-fetches
// on router.refresh().

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Text } from '@sparx/ui';
import { assignLayout, unassignLayout } from '../_lib/actions';

export interface LayoutOption {
  id: string;
  name: string;
}

// Radix Select forbids an empty string value, so the "no override" choice uses a
// sentinel (mirrors the brand feel-pickers' INHERIT sentinel).
const DEFAULT_VALUE = '__default__';

export function LayoutAssignmentPicker({
  targetId,
  itemRef,
  layouts,
  assignedLayoutId,
  note,
}: {
  targetId: string;
  itemRef: string;
  layouts: LayoutOption[];
  assignedLayoutId: string | null;
  note?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const value = assignedLayoutId ?? DEFAULT_VALUE;

  const onChange = (next: string) => {
    setError(null);
    startTransition(async () => {
      const res =
        next === DEFAULT_VALUE
          ? await unassignLayout(targetId, itemRef)
          : await assignLayout(targetId, itemRef, next);
      if (!res.ok) setError(res.error ?? 'Could not update the layout.');
      else router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Select value={value} onValueChange={onChange} disabled={pending}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT_VALUE}>Default layout</SelectItem>
          {layouts.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              {l.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {note ? (
        <Text size="xs" variant="muted">
          {note}
        </Text>
      ) : null}
      {error ? (
        <Text size="xs" className="text-[var(--color-text-danger)]">
          {error}
        </Text>
      ) : null}
    </div>
  );
}
