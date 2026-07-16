'use client';

import { Badge } from '@wizeworks/silicaui-react';
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
    <div className="flex flex-col gap-3">
      {vendors.map((v) => (
        <button
          key={v.slug}
          type="button"
          onClick={() => onSelect(v)}
          className="group border-base-300 hover:border-module hover:bg-base-200 flex items-center gap-4 rounded-lg border p-4 text-left transition-colors"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-row flex-wrap items-center gap-2">
              <p className="text-base font-medium">{v.label}</p>
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
            </div>
            <p className="text-base-content text-sm">{v.tagline}</p>
          </div>
          <ChevronRight className="text-base-content h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </button>
      ))}
    </div>
  );
}
