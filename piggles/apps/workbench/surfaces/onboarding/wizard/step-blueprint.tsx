'use client';

// Step 2 — Blueprint (the work pane). A gallery of complete, themed starting points,
// the story's match first. Clicking one SELECTS it into the setup card (select-then-confirm);
// the card's "Use this blueprint" installs it. "Start from scratch" is the blank
// path. The install itself is the orchestrator's commit — this body only chooses.

import { useState } from 'react';
import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  SearchInput,
  Switch,
  Text,
} from '@wizeworks/silicaui-react';
import { faPencilRuler } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { WizardBlueprint } from '../../../lib/onboarding/types';
import { BlueprintCard, VERTICAL_LABEL } from './blueprint-card';

/** The sentinel the orchestrator reads as "blank canvas, no blueprint". */
export const SCRATCH = 'scratch';

// There is deliberately NO golden-blueprint constant here. This file used to
// export `GOLDEN_BLUEPRINT_KEY = 'sparx'`, and both entry points defaulted to it,
// so a Piggles business was born selling sparx mugs on its own homepage even
// after the provisioner had been taught the difference (issue 091). Which
// blueprint a brand starts from is a BRAND fact resolved from
// `<BRAND>_GOLDEN_BLUEPRINT`; the console reads it as `goldenKey` off
// `/v1/tenant/onboarding` rather than naming anybody's.

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
  /** The starting point the story matched, drawn first; null when none. */
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

  // The story's match first, keyed on the recommendation (never the click), so the
  // selection is on screen rather than 22,000px down (sparx persona issue 008).
  const matched = blueprints.filter(matchesQ);
  const shown = [
    ...matched.filter((bp) => bp.key === recommendedKey),
    ...matched.filter((bp) => bp.key !== recommendedKey),
  ];

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

      {/* Above the gallery: below 190 cards nobody found them (sparx persona issue
          015). Examples only when a design is chosen; the blank path brings none. */}
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
          <Icon glyph={faPencilRuler} className="text-module size-5 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium">Start from a blank canvas</p>
            <p className="text-sm">Design every page yourself, from a blank canvas.</p>
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
