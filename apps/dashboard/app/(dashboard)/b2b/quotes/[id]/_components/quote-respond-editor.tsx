'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Input,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  Textarea,
} from '@sparx/ui';
import { respondToQuote } from '../../_lib/actions';

interface QuoteItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: string | number;
}

interface Props {
  quoteId: string;
  items: QuoteItem[];
}

export function QuoteRespondEditor({ quoteId, items }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.id, String(Number(i.unitPrice))]))
  );
  const [merchantNote, setMerchantNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    try {
      await respondToQuote(
        quoteId,
        items.map((i) => ({
          itemId: i.id,
          unitPriceCents: Math.round(parseFloat(prices[i.id] ?? '0') * 100),
        })),
        merchantNote || undefined
      );
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  const fmt = (n: string | number) =>
    `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  return (
    <Stack gap={4}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>Requested price</TableHead>
            <TableHead>Quoted price ($)</TableHead>
            <TableHead className="text-right">Line total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const rawPrice = parseFloat(prices[item.id] ?? '0') || 0;
            const lineTotal = rawPrice * item.quantity;
            return (
              <TableRow key={item.id}>
                <TableCell>
                  <Text size="sm">{item.name}</Text>
                </TableCell>
                <TableCell>
                  <Text size="sm" variant="muted">
                    {item.sku}
                  </Text>
                </TableCell>
                <TableCell>
                  <Text size="sm">{item.quantity}</Text>
                </TableCell>
                <TableCell>
                  <Text size="sm" variant="muted">
                    {fmt(item.unitPrice)}
                  </Text>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    className="w-28"
                    value={prices[item.id] ?? ''}
                    onChange={(e) => setPrices((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Text size="sm">{fmt(lineTotal)}</Text>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Stack gap={2} className="px-4 pb-4">
        <Text size="sm" variant="muted">
          Note to customer (optional)
        </Text>
        <Textarea
          rows={2}
          placeholder="Any notes or conditions to include with the quoted prices…"
          value={merchantNote}
          onChange={(e) => setMerchantNote(e.target.value)}
          className="max-w-xl"
        />
        <div>
          <Button color="module" disabled={saving} onClick={() => void handleSubmit()}>
            {saving ? 'Sending…' : 'Send quoted prices to customer'}
          </Button>
        </div>
      </Stack>
    </Stack>
  );
}
