'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Button,
  Stack,
  Text,
} from '@sparx/ui';
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

  const isDirty = selected !== (currentTierId ?? '__none__');

  async function handleSave() {
    setSaving(true);
    try {
      await updateAccountTier(accountId, selected === '__none__' ? null : selected);
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack direction="row" align="center" gap={3} wrap>
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="No pricing tier" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">No pricing tier (list price)</SelectItem>
          {tiers.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              <Stack direction="row" align="center" gap={2}>
                <span>{t.name}</span>
                <Text size="xs" variant="muted">
                  {t.discountType === 'percentage'
                    ? `${t.discountValue}% off`
                    : `$${(t.discountValue / 100).toFixed(2)} off`}
                </Text>
              </Stack>
            </SelectItem>
          ))}
        </SelectContent>
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
    </Stack>
  );
}
