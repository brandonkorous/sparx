'use client';

// The company's wholesale group: the same choice the Wholesale customer pane
// offers, writing the one group that prices its orders (sparx persona issue 086).

import { useMemo } from 'react';
import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Select,
} from '@wizeworks/silicaui-react';
import { useTierChoices } from '../b2b/accounts-data';
import { tierChoiceItems } from '../b2b/tier-choices';

/** Mounted only while trade terms show, so groups are never asked for with
 *  wholesale off. `value` is the group id, empty for normal prices. */
export function WholesaleGroupField({
  value,
  currentId,
  currentName,
  removed,
  onChange,
}: {
  value: string;
  currentId: string | null;
  currentName: string | null;
  /** The linked group was removed, so it prices nothing. */
  removed: boolean;
  onChange: (next: string) => void;
}) {
  const tiers = useTierChoices();
  const items = useMemo(
    () =>
      tierChoiceItems(tiers.data?.items, 'No group: normal prices', {
        id: currentId,
        name: currentName,
        removed,
      }),
    [tiers.data, currentId, currentName, removed]
  );
  return (
    <Field>
      <FieldLabel>Wholesale group</FieldLabel>
      <FieldControl
        render={
          <div className="max-w-sm">
            <Select
              color="module"
              aria-label="Wholesale group"
              value={value}
              items={items}
              onValueChange={(next) => {
                onChange((next as string | null) ?? '');
              }}
            />
          </div>
        }
      />
      {tiers.isError ? (
        <FieldStatus status="error">
          Your wholesale groups could not be loaded, so only the one they are in is listed. Nothing
          has changed. Try again in a moment.
        </FieldStatus>
      ) : (
        <FieldDescription>
          A set of businesses you charge the same way, set up under Wholesale groups. Leave it on
          normal prices to charge them the same as everyone else.
        </FieldDescription>
      )}
    </Field>
  );
}
