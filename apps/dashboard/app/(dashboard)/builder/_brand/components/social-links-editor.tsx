'use client';

// Per-site social links editor (docs/49 "full per-site brand"). An ordered list
// of { platform, url }; a known platform drives the storefront footer icon,
// "Other" carries a free-text label. Writes to the ACTIVE site (Property
// settings), so switching sites swaps the whole list. Shared by the Site settings
// surface (/builder/site) and the legacy Brand & Theme controls — one source so
// the two never drift.

import * as React from 'react';
import { Button, Input, NativeSelect } from '@sparx/ui';
import { Plus, X } from 'lucide-react';

export interface SocialLink {
  platform: string;
  url: string;
}

// The platforms the storefront footer renders a first-class icon for. Order is
// the add-order preference (the first unused known platform seeds a new row).
export const KNOWN_PLATFORMS = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourbrand' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourbrand' },
  { key: 'x', label: 'X', placeholder: 'https://x.com/yourbrand' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@yourbrand' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourbrand' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/yourbrand' },
  { key: 'pinterest', label: 'Pinterest', placeholder: 'https://pinterest.com/yourbrand' },
  { key: 'threads', label: 'Threads', placeholder: 'https://threads.com/@yourbrand' },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: 'https://wa.me/15551234567' },
  { key: 'bluesky', label: 'Bluesky', placeholder: 'https://bsky.app/profile/you.bsky.social' },
  { key: 'snapchat', label: 'Snapchat', placeholder: 'https://snapchat.com/add/yourbrand' },
] as const;

const OTHER_PLATFORM = '__other__';
const KNOWN_KEYS = new Set<string>(KNOWN_PLATFORMS.map((p) => p.key));

function placeholderFor(platform: string): string {
  return KNOWN_PLATFORMS.find((p) => p.key === platform)?.placeholder ?? 'https://…';
}

export function SocialLinksEditor({
  socials,
  setSocials,
}: {
  socials: SocialLink[];
  setSocials: React.Dispatch<React.SetStateAction<SocialLink[]>>;
}) {
  const usedKnown = new Set(socials.map((r) => r.platform).filter((p) => KNOWN_KEYS.has(p)));

  const addRow = () =>
    setSocials((rows) => {
      const used = new Set(rows.map((r) => r.platform).filter((p) => KNOWN_KEYS.has(p)));
      const next = KNOWN_PLATFORMS.find((p) => !used.has(p.key));
      return [...rows, { platform: next ? next.key : '', url: '' }];
    });
  const removeRow = (index: number) => setSocials((rows) => rows.filter((_, i) => i !== index));
  const patchRow = (index: number, patch: Partial<SocialLink>) =>
    setSocials((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  return (
    <div className="flex flex-col gap-2.5">
      {socials.length === 0 ? (
        <p className="text-base-content text-xs">No links yet.</p>
      ) : (
        socials.map((row, index) => {
          const known = KNOWN_KEYS.has(row.platform);
          const selectValue = known ? row.platform : OTHER_PLATFORM;
          const options = KNOWN_PLATFORMS.filter(
            (p) => p.key === row.platform || !usedKnown.has(p.key)
          );
          return (
            <div
              key={index}
              className="border-base-300 flex flex-col gap-2 rounded-md border p-2.5 sm:flex-row sm:items-start"
            >
              <div className="flex flex-col gap-2 sm:w-36">
                <NativeSelect
                  aria-label="Platform"
                  value={selectValue}
                  onChange={(e) =>
                    patchRow(index, {
                      platform: e.target.value === OTHER_PLATFORM ? '' : e.target.value,
                    })
                  }
                >
                  {options.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                  <option value={OTHER_PLATFORM}>Other…</option>
                </NativeSelect>
                {selectValue === OTHER_PLATFORM ? (
                  <Input
                    aria-label="Custom platform label"
                    value={row.platform}
                    onChange={(e) => patchRow(index, { platform: e.target.value })}
                    placeholder="Label (e.g. Discord)"
                  />
                ) : null}
              </div>
              <Input
                aria-label="Link URL"
                type="url"
                inputMode="url"
                autoComplete="off"
                className="flex-1"
                value={row.url}
                onChange={(e) => patchRow(index, { url: e.target.value })}
                placeholder={placeholderFor(row.platform)}
              />
              <Button
                type="button"
                variant="ghost"
                color="neutral"
                size="sm"
                aria-label="Remove link"
                onClick={() => removeRow(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })
      )}
      <div>
        <Button
          type="button"
          variant="soft"
          color="neutral"
          size="sm"
          leftIcon={<Plus className="h-3.5 w-3.5" />}
          onClick={addRow}
        >
          Add link
        </Button>
      </div>
    </div>
  );
}
