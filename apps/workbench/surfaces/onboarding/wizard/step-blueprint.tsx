'use client';

// Step 2 — Blueprint (the work pane). A gallery of complete, themed starting points,
// FILTERED to the modules the tenant turned on (only blueprints whose every required
// module is on). Clicking one SELECTS it into the setup card (select-then-confirm);
// the card's "Use this blueprint" installs it. "Start from scratch" is the blank
// path. The install itself is the orchestrator's commit — this body only chooses.

import { useMemo, useState } from 'react';
import { Badge, Button, SearchInput, Text } from '@wizeworks/silicaui-react';
import { Check, PencilRuler } from 'lucide-react';
import type { BlueprintVertical, WizardBlueprint } from '../../../lib/onboarding/types';

/** The sentinel the orchestrator reads as "blank canvas, no blueprint". */
export const SCRATCH = 'scratch';

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
  modules,
  selectedKey,
  onSelect,
  loading,
}: {
  blueprints: WizardBlueprint[];
  modules: Record<string, boolean>;
  /** The selected blueprint key, the SCRATCH sentinel, or null. */
  selectedKey: string | null;
  onSelect: (key: string) => void;
  loading: boolean;
}) {
  const [search, setSearch] = useState('');

  const fits = useMemo(
    () => (bp: WizardBlueprint) => bp.requiresModules.every((m) => modules[m]),
    [modules]
  );

  const q = search.trim().toLowerCase();
  const matchesQ = (bp: WizardBlueprint) =>
    !q ||
    bp.name.toLowerCase().includes(q) ||
    bp.summary.toLowerCase().includes(q) ||
    VERTICAL_LABEL[bp.vertical].toLowerCase().includes(q);

  const queryMatched = blueprints.filter(matchesQ);
  const shown = queryMatched.filter(fits);
  const hiddenByModules = queryMatched.length - shown.length;

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
        <Text className="text-base-content text-sm">
          {shown.length} of {blueprints.length} fit your modules
        </Text>
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
          <Text className="text-base-content max-w-md text-sm">
            {q
              ? `Nothing matches “${search}”. Clear the search to see every starting point that fits your modules.`
              : 'None of our starting points fit the modules you turned on. Start from a blank canvas below, or switch on more modules.'}
          </Text>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {shown.map((bp) => (
            <BlueprintCard
              key={bp.key}
              blueprint={bp}
              selected={bp.key === selectedKey}
              onSelect={() => onSelect(bp.key)}
            />
          ))}
        </div>
      )}

      {hiddenByModules > 0 ? (
        <Text className="text-base-content text-sm">
          {hiddenByModules} more {hiddenByModules === 1 ? 'starting point unlocks' : 'unlock'} when
          you switch on the modules they need — go back to the Modules step to add them.
        </Text>
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
            <p className="text-base-content font-medium">Start from a blank canvas</p>
            <p className="text-base-content text-sm">
              Design every page yourself, or build headless against our API.
            </p>
          </div>
        </div>
        <Button
          variant={selectedKey === SCRATCH ? 'solid' : 'outline'}
          color={selectedKey === SCRATCH ? 'module' : 'neutral'}
          size="sm"
          onClick={() => onSelect(SCRATCH)}
        >
          {selectedKey === SCRATCH ? 'Selected' : 'Start blank'}
        </Button>
      </div>
    </div>
  );
}

function BlueprintCard({
  blueprint: bp,
  selected,
  onSelect,
}: {
  blueprint: WizardBlueprint;
  selected: boolean;
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
        <p className="text-base-content font-medium">{bp.name}</p>
        <p className="text-base-content line-clamp-2 text-sm">{bp.summary}</p>
        <p className="text-base-content mt-1 text-sm">{contentsLine(bp)}</p>
      </div>
    </button>
  );
}
