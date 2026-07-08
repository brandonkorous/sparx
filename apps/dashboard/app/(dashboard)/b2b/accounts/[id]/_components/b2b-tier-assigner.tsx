'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Select, SelectItem } from 'silicaui-react';
import { updateAccountTier } from '../../_lib/actions';

interface TierOption {
  id: string;
  name: string;
  discountType: string;
  discountValue: number;
}

interface Props {
  accountId: string;
  currentTierId: string | null;
  tiers: TierOption[];
}

export function B2bTierAssigner({ accountId, currentTierId, tiers }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string>(currentTierId ?? '__none__');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isDirty = selected !== (currentTierId ?? '__none__');

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const { error } = await updateAccountTier(
        accountId,
        selected === '__none__' ? null : selected
      );
      if (error) {
        setSaveError(error);
      } else {
        startTransition(() => router.refresh());
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {saveError && <p className="text-sm text-[var(--color-danger)]">{saveError}</p>}
      <div className="flex flex-row flex-wrap items-center gap-3">
        <Select
          value={selected}
          onValueChange={(v) => setSelected(v as string)}
          className="w-64"
          placeholder="No pricing tier"
          items={{
            __none__: 'No pricing tier (list price)',
            ...Object.fromEntries(tiers.map((t) => [t.id, t.name])),
          }}
        >
          <SelectItem value="__none__">No pricing tier (list price)</SelectItem>
          {tiers.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              <span className="flex flex-row items-center gap-2">
                <span>{t.name}</span>
                <span className="text-base-content/70 text-xs">
                  {t.discountType === 'percentage'
                    ? `${t.discountValue}% off`
                    : `$${(t.discountValue / 100).toFixed(2)} off`}
                </span>
              </span>
            </SelectItem>
          ))}
        </Select>

        {isDirty && (
          <Button
            color="module"
            size="sm"
            disabled={saving || isPending}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        )}
      </div>
    </div>
  );
}
