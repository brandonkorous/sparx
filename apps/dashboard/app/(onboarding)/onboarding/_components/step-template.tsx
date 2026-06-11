'use client';

import * as React from 'react';
import { Badge, Button, Input, Text, WizardStep, cn } from '@sparx/ui';
import { ArrowRight, Check, Lock, PencilRuler, Search } from 'lucide-react';
import { selectTemplateAction, startFromScratchAction } from '../_lib/actions';
import { MODULE_BY_KEY, TEMPLATE_CAP_KEYS } from '../_lib/modules';
import type { BlueprintVertical, WizardBlueprint } from '../_lib/types';
import type { StepNav } from './onboarding-wizard';

// Step 2 — Template. A gallery of complete, themed blueprints, FILTERED to the
// modules the tenant turned on: a template only shows if every module it needs is
// switched on (strict subset). This scales to hundreds of blueprints — the module
// pick is the first, biggest cut. Chips let the tenant narrow further or widen
// back; search trims by name. Picking one installs a whole site as a draft and
// advances to Workspace. "Start from scratch" is the quiet escape hatch.

const VERTICAL_LABEL: Record<BlueprintVertical, string> = {
  retail: 'Store',
  b2b: 'Wholesale',
  content: 'Publication',
  services: 'Services',
};

/** The cap modules a blueprint actually requires — builder is universal and
 *  add-ons (chat) never gate, so only TEMPLATE_CAP_KEYS count. */
function capRequirements(bp: WizardBlueprint): string[] {
  return (bp.requiresModules ?? []).filter((m) => TEMPLATE_CAP_KEYS.includes(m));
}

function contentsLine(bp: WizardBlueprint): string {
  const c = bp.contents;
  const parts: string[] = [];
  if (c.products > 0) parts.push(`${c.products} products`);
  if (c.content > 0) parts.push(`${c.content} pages of content`);
  parts.push(`${c.theme} theme`);
  return parts.join(' · ');
}

export function StepTemplate({
  blueprints,
  preselectKey,
  selectedModules,
  onInstalled,
  nav,
}: {
  blueprints: WizardBlueprint[];
  preselectKey: string | null;
  selectedModules: Record<string, boolean>;
  /** Report the chosen template (or scratch) up so Launch publishes the right
   *  install within this session. `(null, null)` = start-from-scratch. */
  onInstalled: (blueprintKey: string | null, installId: string | null) => void;
  nav: StepNav;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  // Chips the tenant has toggled OFF to narrow the gallery further (a "what if I
  // only had these" lens). Starts empty — all selected modules are in play.
  const [offCaps, setOffCaps] = React.useState<Set<string>>(() => new Set());
  const [, startTransition] = React.useTransition();

  const busy = busyKey !== null;

  // The cap modules the tenant switched on, in canonical order.
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

  // Modules that, if added back, would unlock hidden templates.
  const lockedMods = new Set<string>();
  hidden.forEach((bp) =>
    capRequirements(bp)
      .filter((m) => !activeFilter.has(m))
      .forEach((m) => lockedMods.add(m))
  );

  function choose(key: string) {
    setError(null);
    setBusyKey(key);
    startTransition(async () => {
      const res = await selectTemplateAction(key);
      if (res.ok) {
        onInstalled(key, res.data.installId);
        nav.onNext();
      } else {
        setError(res.error);
        setBusyKey(null);
      }
    });
  }

  function scratch() {
    setError(null);
    setBusyKey('');
    startTransition(async () => {
      const res = await startFromScratchAction();
      if (res.ok) {
        onInstalled(null, null);
        nav.onNext();
      } else {
        setError(res.error);
        setBusyKey(null);
      }
    });
  }

  function toggleCap(key: string) {
    setOffCaps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <WizardStep
      width="wide"
      header={{
        title: 'Pick a starting point',
        supporting:
          'Complete, themed sites — pages, design, products, and copy in place from the first second. Filtered to the modules you chose; search or toggle a module to widen the field.',
      }}
      actions={{ onBack: nav.onBack }}
    >
      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="pl-9"
            aria-label="Search templates"
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
        Showing{' '}
        <span className="font-medium text-[var(--color-text-primary)]">{shown.length}</span> of{' '}
        {blueprints.length} templates that fit your modules
      </Text>

      {error && (
        <Text size="sm" variant="danger" role="alert" aria-live="polite" className="mb-4 block">
          {error}
        </Text>
      )}

      {/* ── Gallery ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((bp) => {
          const preselected = bp.key === preselectKey;
          const installing = busyKey === bp.key;
          const caps = capRequirements(bp);
          return (
            <article
              key={bp.key}
              className={cn(
                'group flex flex-col overflow-hidden rounded-xl border bg-[var(--color-bg-surface)] transition-shadow',
                preselected
                  ? 'border-[var(--module-active)] shadow-md ring-1 ring-[var(--module-active)]'
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
                  {preselected ? (
                    <Badge color="module" variant="solid">
                      <Check className="h-3 w-3" />
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
                <Button
                  color="module"
                  shape="block"
                  onClick={() => choose(bp.key)}
                  disabled={busy}
                  loading={installing}
                  rightIcon={installing ? undefined : <ArrowRight className="h-4 w-4" />}
                  className="mt-2"
                >
                  {installing ? 'Building your site…' : 'Use this template'}
                </Button>
              </div>
            </article>
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
            {hidden.length === 1 ? 'template' : 'templates'} unlock with{' '}
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
      <div className="mt-6 flex items-center justify-between gap-4 border-t border-[var(--color-border-default)] pt-5">
        <Text size="sm" variant="muted">
          Prefer a blank canvas?
        </Text>
        <Button
          variant="outline"
          color="neutral"
          onClick={scratch}
          disabled={busy}
          loading={busyKey === ''}
          leftIcon={<PencilRuler className="h-4 w-4" />}
        >
          Start from scratch
        </Button>
      </div>
    </WizardStep>
  );
}
