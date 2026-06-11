'use client';

import * as React from 'react';
import { Badge, Button, Input, Text, cn } from '@sparx/ui';
import { Check, Lock, PencilRuler, Search } from 'lucide-react';
import { MODULE_BY_KEY, TEMPLATE_CAP_KEYS } from '../_lib/modules';
import type { BlueprintVertical, WizardBlueprint } from '../_lib/types';

// Step 2 — Blueprint (work pane). A gallery of complete, themed blueprints,
// FILTERED to the modules the tenant turned on (strict subset — only blueprints
// whose every required module is on). Clicking one SELECTS it into the setup card
// (select-then-confirm); the card's "Use this blueprint" installs it. Scales to
// hundreds — the module pick is the first, biggest cut.

const VERTICAL_LABEL: Record<BlueprintVertical, string> = {
  retail: 'Store',
  b2b: 'Wholesale',
  content: 'Publication',
  services: 'Services',
};

function capRequirements(bp: WizardBlueprint): string[] {
  return (bp.requiresModules ?? []).filter((m) => TEMPLATE_CAP_KEYS.includes(m));
}

function contentsLine(bp: WizardBlueprint): string {
  const c = bp.contents;
  const parts: string[] = [];
  if (c.products > 0) parts.push(`${c.products} products`);
  if (c.content > 0) parts.push(`${c.content} pages`);
  parts.push(`${c.theme} theme`);
  return parts.join(' · ');
}

export function StepBlueprint({
  blueprints,
  selectedModules,
  preselectKey,
  selectedKey,
  onSelect,
}: {
  blueprints: WizardBlueprint[];
  selectedModules: Record<string, boolean>;
  preselectKey: string | null;
  /** Currently selected blueprint key, the `'scratch'` sentinel, or null. */
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const [search, setSearch] = React.useState('');
  const [offCaps, setOffCaps] = React.useState<Set<string>>(() => new Set());

  const selectedCaps = TEMPLATE_CAP_KEYS.filter((k) => selectedModules[k]);
  const activeFilter = new Set(selectedCaps.filter((k) => !offCaps.has(k)));

  const q = search.trim().toLowerCase();
  const matchesQ = (bp: WizardBlueprint) =>
    !q ||
    bp.name.toLowerCase().includes(q) ||
    VERTICAL_LABEL[bp.vertical].toLowerCase().includes(q);
  const fits = (bp: WizardBlueprint) => capRequirements(bp).every((m) => activeFilter.has(m));

  const queryMatched = blueprints.filter(matchesQ);
  const shown = queryMatched.filter(fits);
  const hidden = queryMatched.filter((bp) => !fits(bp));

  const lockedMods = new Set<string>();
  hidden.forEach((bp) =>
    capRequirements(bp)
      .filter((m) => !activeFilter.has(m))
      .forEach((m) => lockedMods.add(m))
  );

  function toggleCap(key: string) {
    setOffCaps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div>
      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search blueprints…"
            className="pl-9"
            aria-label="Search blueprints"
          />
        </div>
        {selectedCaps.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedCaps.map((k) => {
              const isOn = !offCaps.has(k);
              const mod = MODULE_BY_KEY[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleCap(k)}
                  className="cursor-pointer"
                  aria-pressed={isOn}
                >
                  <Badge color={isOn ? k : 'neutral'} variant={isOn ? 'soft' : 'outline'}>
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: isOn ? mod?.colorVar : 'var(--color-border-strong)' }}
                    />
                    {mod?.name ?? k}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Text size="sm" variant="muted" className="mt-4 mb-3.5 block">
        Showing <span className="font-medium text-[var(--color-text-primary)]">{shown.length}</span>{' '}
        of {blueprints.length} blueprints that fit your modules
      </Text>

      {/* ── Gallery ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
        {shown.map((bp) => {
          const isSelected = bp.key === selectedKey;
          const isPreselect = bp.key === preselectKey;
          const caps = capRequirements(bp);
          return (
            <button
              key={bp.key}
              type="button"
              onClick={() => onSelect(bp.key)}
              aria-pressed={isSelected}
              className={cn(
                'group flex flex-col overflow-hidden rounded-xl border bg-[var(--color-bg-surface)] text-left transition-shadow',
                isSelected
                  ? 'border-[var(--module-active)] shadow-md ring-2 ring-[var(--module-active)]'
                  : 'border-[var(--color-border-default)] hover:shadow-md'
              )}
            >
              <div className="relative aspect-[16/10] w-full border-b border-[var(--color-border-default)] bg-[var(--color-bg-subtle)]">
                {bp.preview && (
                  <div
                    className="h-full w-full bg-cover bg-top"
                    style={{ backgroundImage: `url("${bp.preview}")` }}
                  />
                )}
                <span className="absolute top-2.5 right-2.5">
                  {isSelected ? (
                    <Badge color="module" variant="solid">
                      <Check className="h-3 w-3" />
                      Selected
                    </Badge>
                  ) : isPreselect ? (
                    <Badge color="module" variant="soft">
                      Your pick
                    </Badge>
                  ) : (
                    <Badge color="neutral" variant="solid">
                      {VERTICAL_LABEL[bp.vertical]}
                    </Badge>
                  )}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2 p-4">
                <Text weight="medium">{bp.name}</Text>
                <Text size="sm" variant="muted" className="line-clamp-2">
                  {bp.summary}
                </Text>
                <Text size="xs" variant="muted" className="mt-1">
                  {contentsLine(bp)}
                </Text>
                {caps.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {caps.map((m) => (
                      <Badge key={m} color={m} variant="soft" size="sm">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: MODULE_BY_KEY[m]?.colorVar }}
                        />
                        {MODULE_BY_KEY[m]?.name ?? m}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Locked hint ───────────────────────────────────────────────────── */}
      {hidden.length > 0 && lockedMods.size > 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)] px-[18px] py-4">
          <Lock className="h-[18px] w-[18px] shrink-0 text-[var(--color-text-tertiary)]" />
          <Text size="sm" variant="muted">
            <span className="font-medium text-[var(--color-text-primary)]">
              {hidden.length} more
            </span>{' '}
            {hidden.length === 1 ? 'blueprint' : 'blueprints'} unlock with{' '}
            <span className="font-medium text-[var(--color-text-primary)]">
              {[...lockedMods].map((m) => MODULE_BY_KEY[m]?.name ?? m).join(', ')}
            </span>{' '}
            — turn {lockedMods.size === 1 ? 'it' : 'one'} on{' '}
            {selectedCaps.some((k) => lockedMods.has(k)) ? 'in the filter or ' : ''}back on the
            Modules step.
          </Text>
        </div>
      )}

      {/* ── Start from scratch ────────────────────────────────────────────── */}
      <div
        className={cn(
          'mt-6 flex items-center justify-between gap-4 rounded-xl border px-[18px] py-4',
          selectedKey === 'scratch'
            ? 'border-[var(--module-active)] bg-[var(--module-active-tint)] ring-1 ring-[var(--module-active)]'
            : 'border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)]'
        )}
      >
        <div className="flex items-center gap-3">
          <PencilRuler className="h-[18px] w-[18px] shrink-0 text-[var(--color-text-tertiary)]" />
          <Text size="sm" variant="muted">
            Prefer a blank canvas? Use Sparx headless or design it yourself.
          </Text>
        </div>
        <Button
          variant={selectedKey === 'scratch' ? 'solid' : 'outline'}
          color={selectedKey === 'scratch' ? 'module' : 'neutral'}
          size="sm"
          onClick={() => onSelect('scratch')}
        >
          {selectedKey === 'scratch' ? 'Selected' : 'Start from scratch'}
        </Button>
      </div>
    </div>
  );
}
