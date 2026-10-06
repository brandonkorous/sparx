'use client';

// One starting point in the setup gallery: its preview, what it holds, and
// whether it is selected or the one the story matched.

import { Badge } from '@wizeworks/silicaui-react';
import { faCheck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { BlueprintVertical, WizardBlueprint } from '../../../lib/onboarding/types';

export const VERTICAL_LABEL: Record<BlueprintVertical, string> = {
  retail: 'Shop',
  b2b: 'Wholesale',
  content: 'Publication',
  services: 'Services',
};

function contentsLine(bp: WizardBlueprint): string {
  const c = bp.contents;
  const parts: string[] = [];
  if (c.products > 0) parts.push(`${c.products} products`);
  if (c.pages > 0) parts.push(`${c.pages} pages`);
  else if (c.content > 0) parts.push(`${c.content} pages`);
  parts.push(`${c.theme} theme`);
  return parts.join(' · ');
}

export function BlueprintCard({
  blueprint: bp,
  selected,
  recommended,
  onSelect,
}: {
  blueprint: WizardBlueprint;
  selected: boolean;
  /** The story's match: drawn first, and says so. */
  recommended: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group bg-base-100 flex flex-col overflow-hidden rounded-xl border text-left transition-colors ${
        selected ? 'border-module ring-module ring-1' : 'border-base-300 hover:border-module'
      }`}
    >
      <div className="border-base-300 bg-base-200 relative aspect-[16/10] w-full border-b">
        {bp.preview ? (
          <img
            src={bp.preview}
            alt=""
            className="size-full object-cover object-top"
            loading="lazy"
          />
        ) : null}
        {recommended ? (
          <span className="absolute top-2.5 left-2.5">
            <Badge color="primary" variant="solid" size="sm">
              Fits your story
            </Badge>
          </span>
        ) : null}
        <span className="absolute top-2.5 right-2.5">
          {selected ? (
            <Badge color="module" variant="solid" size="sm">
              <Icon glyph={faCheck} className="size-3" aria-hidden />
              Selected
            </Badge>
          ) : (
            <Badge color="neutral" variant="solid" size="sm">
              {VERTICAL_LABEL[bp.vertical]}
            </Badge>
          )}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="font-medium">{bp.name}</p>
        <p className="line-clamp-2 text-sm">{bp.summary}</p>
        <p className="mt-1 text-sm">{contentsLine(bp)}</p>
      </div>
    </button>
  );
}
