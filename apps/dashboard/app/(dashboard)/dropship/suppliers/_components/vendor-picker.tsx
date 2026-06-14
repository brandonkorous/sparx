'use client';

import { Badge, Stack, Text } from '@sparx/ui';
import { ChevronRight } from 'lucide-react';
import type { Vendor } from './supplier-form';

interface Props {
  vendors: Vendor[];
  onSelect: (vendor: Vendor) => void;
}

// Step 1 of the connect flow: choose which supplier to connect. Each card
// advertises the vendor's connection method + capabilities so the merchant
// knows what they're getting (a real API integration vs. a manual feed) before
// entering credentials.
export function VendorPicker({ vendors, onSelect }: Props) {
  return (
    <Stack gap={3}>
      {vendors.map((v) => (
        <button
          key={v.slug}
          type="button"
          onClick={() => onSelect(v)}
          className="group flex items-center gap-4 rounded-lg border border-[var(--color-border)] p-4 text-left transition-colors hover:border-[var(--color-module)] hover:bg-[var(--color-muted)]"
        >
          <Stack gap={1} className="min-w-0 flex-1">
            <Stack direction="row" gap={2} className="flex-wrap items-center">
              <Text className="font-medium">{v.label}</Text>
              {v.pod && (
                <Badge color="module" variant="soft" size="sm">
                  Print on demand
                </Badge>
              )}
              <Badge
                color={v.connectionMethod === 'api' ? 'success' : 'neutral'}
                variant="soft"
                size="sm"
              >
                {v.connectionMethod === 'api' ? 'Automated' : 'Manual'}
              </Badge>
            </Stack>
            <Text size="sm" className="text-[var(--color-muted-foreground)]">
              {v.tagline}
            </Text>
          </Stack>
          <ChevronRight className="h-5 w-5 shrink-0 text-[var(--color-muted-foreground)] transition-transform group-hover:translate-x-0.5" />
        </button>
      ))}
    </Stack>
  );
}
