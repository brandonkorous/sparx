'use client';

// Step 2 — Blueprint (the work pane). A gallery of complete, themed starting points,
// the story's match first. Clicking one SELECTS it into the setup card (select-then-confirm);
// the card's "Use this blueprint" installs it. "Start from scratch" is the blank
// path. The install itself is the orchestrator's commit — this body only chooses.
//
// The starting point the story matched (`recommendedKey`) is drawn FIRST and says
// so. It used to sit in catalog order, 121st of 190 and 22,000px down, so the
// gallery's own selection was invisible (sparx persona issue 008). The order keys
// on the recommendation, never on the click, so a card never jumps when picked.

import { useState } from 'react';
import {
  Badge,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  SearchInput,
  Switch,
  Text,
} from '@wizeworks/silicaui-react';
import { Check, PencilRuler } from 'lucide-react';
import type { BlueprintVertical, WizardBlueprint } from '../../../lib/onboarding/types';

/** The sentinel the orchestrator reads as "blank canvas, no blueprint". */
export const SCRATCH = 'scratch';

/** The platform's default starting point — the golden sparx template. A fresh site
 *  IS this unless the user picks another blueprint or starts blank. */
export const GOLDEN_BLUEPRINT_KEY = 'sparx';

const VERTICAL_LABEL: Record<BlueprintVertical, string> = {
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

export function StepBlueprint({
  blueprints,
  selectedKey,
  recommendedKey,
  onSelect,
  sampleData,
  onSampleData,
  loading,
}: {
  blueprints: WizardBlueprint[];
  /** The selected blueprint key, the SCRATCH sentinel, or null. */
  selectedKey: string | null;
  /** The starting point the owner's story matched, drawn first; null when none. */
  recommendedKey: string | null;
  onSelect: (key: string) => void;
  /** Whether the chosen starting point brings its examples (issue 098). */
  sampleData: boolean;
  onSampleData: (next: boolean) => void;
  loading: boolean;
}) {
  const [search, setSearch] = useState('');

  // Blueprints are NOT filtered by the tenant's active modules: a template's content
  // is independent of which modules are on (a module that's off simply hides its
  // surface, it doesn't make the starting point unusable). Only the text search filters.
  const q = search.trim().toLowerCase();
  const matchesQ = (bp: WizardBlueprint) =>
    !q ||
    bp.name.toLowerCase().includes(q) ||
    bp.summary.toLowerCase().includes(q) ||
    VERTICAL_LABEL[bp.vertical].toLowerCase().includes(q);

  const matched = blueprints.filter(matchesQ);
  const shown = recommendedKey
    ? [
        ...matched.filter((bp) => bp.key === recommendedKey),
        ...matched.filter((bp) => bp.key !== recommendedKey),
      ]
    : matched;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search starting points…"
            aria-label="Search starting points"
          />
        </div>
        <Text className="text-sm">
          {shown.length} of {blueprints.length} starting points
        </Text>
      </div>

      {/* The examples choice (issue 098) and the blank path sit ABOVE the gallery.
          Below 190 cards they were 22,000px down, where nobody would find either
          (sparx persona issue 015). The examples choice shows only when a
          blueprint is chosen: it means nothing on the blank path. */}
      {selectedKey && selectedKey !== SCRATCH ? (
        <div className="border-base-300 bg-base-100 rounded-xl border px-5 py-4">
          <Field>
            <FieldLabel>Bring its examples</FieldLabel>
            <FieldControl
              render={
                <Switch
                  color="module"
                  checked={sampleData}
                  onCheckedChange={onSampleData}
                  aria-label="Bring this starting point's examples"
                />
              }
            />
            <FieldDescription>
              {sampleData
                ? 'Example products, articles and bookings come with it, so every screen has something real on it while you find your way around. Change or delete any of them.'
                : 'Only the pages and the look come in. Nothing arrives that is not yours, and every screen starts empty.'}
            </FieldDescription>
          </Field>
        </div>
      ) : null}

      {/* Start from scratch — the blank path. */}
      <div
        className={`flex items-center justify-between gap-4 rounded-xl border px-5 py-4 ${
          selectedKey === SCRATCH
            ? 'border-module ring-module ring-1'
            : 'border-base-300 bg-base-100'
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <PencilRuler className="text-module size-5 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium">Start from a blank canvas</p>
            <p className="text-sm">
              Design every page yourself, or have a developer build on top of it.
            </p>
          </div>
        </div>
        <Button
          variant={selectedKey === SCRATCH ? 'solid' : 'outline'}
          color={selectedKey === SCRATCH ? 'module' : undefined}
          size="sm"
          onClick={() => onSelect(SCRATCH)}
        >
          {selectedKey === SCRATCH ? 'Selected' : 'Start blank'}
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="border-base-300 bg-base-100 h-64 animate-pulse rounded-xl border"
            />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="border-base-300 bg-base-100 flex flex-col items-center gap-2 rounded-xl border px-6 py-12 text-center">
          <Text className="font-medium">No starting points match</Text>
          <Text className="max-w-md text-sm">
            {q
              ? `Nothing matches “${search}”. Clear the search to see every starting point.`
              : 'No starting points are available yet. Start from a blank canvas above.'}
          </Text>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {shown.map((bp) => (
            <BlueprintCard
              key={bp.key}
              blueprint={bp}
              selected={bp.key === selectedKey}
              recommended={bp.key === recommendedKey}
              onSelect={() => onSelect(bp.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BlueprintCard({
  blueprint: bp,
  selected,
  recommended,
  onSelect,
}: {
  blueprint: WizardBlueprint;
  selected: boolean;
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
              <Check className="size-3" aria-hidden />
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
