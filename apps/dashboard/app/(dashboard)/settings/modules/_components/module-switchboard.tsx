'use client';

// The Settings → Modules switchboard — the same "switch on what you use" UI a
// tenant met on the pricing page and in onboarding (color dot, expandable
// detail, one Switch per module, price, Included/Required locks), but wired to
// the LIVE per-tenant state instead of a client-only demo. Each flip persists
// through `setModuleEnabledAction` (which activates the module, publishes
// `module.activated` on both buses, and revalidates this page); the row reads
// authoritative enabled/lock state from the server, never re-deriving the
// dependency graph itself.
//
// Optimistic-but-honest: a flip shows immediately, then reconciles to the
// server truth when the revalidated props land — so a cascade (enabling B2B
// co-enables Commerce and bundles Invoicing free) repaints all affected rows.
// The toggle action can throw outright (auth expiry, transport failure), so the
// call is wrapped in try/catch and reverts the optimistic state on any failure
// — the same failure mode the CRM audit (F-01) repro'd on prod.

import * as React from 'react';
import { Badge, Switch, Text, cn, toast } from '@sparx/ui';
import { ChevronDown } from 'lucide-react';
import type { ModuleSlug } from '@sparx/auth';

import { SWITCHBOARD_MODULES, type SwitchboardModule } from '@/lib/modules';
import { setModuleEnabledAction, type ModuleState } from '../actions';

type Lock = 'included' | 'required' | null;

export function ModuleSwitchboard({
  states,
  canEdit,
}: {
  states: ModuleState[];
  canEdit: boolean;
}) {
  const stateBySlug = React.useMemo(() => new Map(states.map((s) => [s.slug, s])), [states]);
  const nameOf = React.useMemo(() => new Map(SWITCHBOARD_MODULES.map((m) => [m.key, m.name])), []);

  const [openKey, setOpenKey] = React.useState<string | null>(null);
  // Optimistic desired states keyed by slug, plus an in-flight set. Both clear
  // whenever fresh server props arrive (the action revalidates this path), so
  // the server stays the source of truth and cascades reconcile on their own.
  const [optimistic, setOptimistic] = React.useState<Record<string, boolean>>({});
  const [pending, setPending] = React.useState<Record<string, boolean>>({});
  const [, startTransition] = React.useTransition();

  React.useEffect(() => {
    setOptimistic({});
    setPending({});
  }, [states]);

  function clear(slug: string): void {
    setOptimistic((o) => {
      const next = { ...o };
      delete next[slug];
      return next;
    });
    setPending((p) => {
      const next = { ...p };
      delete next[slug];
      return next;
    });
  }

  function lockOf(slug: ModuleSlug): Lock {
    const st = stateBySlug.get(slug);
    if ((st?.requiredBy.length ?? 0) > 0) return 'required';
    if (st?.source === 'bundled') return 'included';
    return null;
  }

  function lockCaption(slug: ModuleSlug): string | null {
    const st = stateBySlug.get(slug);
    if (!st) return null;
    if (st.requiredBy.length > 0) return `Required by ${joinNames(st.requiredBy, nameOf)}`;
    if (st.source === 'bundled') return `Included with ${joinNames(st.includedBy, nameOf)}`;
    return null;
  }

  function isOn(slug: ModuleSlug): boolean {
    if (slug in optimistic) return optimistic[slug]!;
    return stateBySlug.get(slug)?.enabled ?? false;
  }

  function onToggle(m: SwitchboardModule): void {
    const slug = m.key as ModuleSlug;
    if (!canEdit || lockOf(slug) !== null || pending[slug]) return;
    const next = !isOn(slug);
    setOptimistic((o) => ({ ...o, [slug]: next }));
    setPending((p) => ({ ...p, [slug]: true }));
    startTransition(async () => {
      try {
        const res = await setModuleEnabledAction(slug, next);
        if (res.ok) {
          toast.success(next ? `${m.name} activated` : `${m.name} deactivated`, {
            description: next
              ? 'API surface and dashboard routes are live for this tenant.'
              : 'API surface returns MODULE_DISABLED; consumers stop.',
          });
          // Keep the optimistic state until the revalidated props land (the
          // effect above clears it), so the row doesn't flicker back first.
          return;
        }
        clear(slug); // revert
        toast.error(`Couldn't ${next ? 'activate' : 'deactivate'} ${m.name}`, {
          description: res.error.message,
        });
      } catch (err) {
        clear(slug); // revert — see the F-01 note in the file header
        const message = err instanceof Error ? err.message : String(err);
        toast.error(`Couldn't ${next ? 'activate' : 'deactivate'} ${m.name}`, {
          description: message,
        });
      }
    });
  }

  return (
    <div>
      {SWITCHBOARD_MODULES.map((m, i) => {
        const slug = m.key as ModuleSlug;
        const firstAddon = m.addon && (i === 0 || !SWITCHBOARD_MODULES[i - 1]?.addon);
        return (
          <React.Fragment key={m.key}>
            {firstAddon && (
              <div className="px-1 pt-4 pb-1.5">
                <Text size="xs" variant="muted" weight="medium">
                  Add-ons
                </Text>
              </div>
            )}
            <ModuleRow
              module={m}
              on={isOn(slug)}
              lock={lockOf(slug)}
              caption={lockCaption(slug)}
              open={openKey === m.key}
              isLast={i === SWITCHBOARD_MODULES.length - 1}
              busy={Boolean(pending[slug])}
              canEdit={canEdit}
              onToggle={() => onToggle(m)}
              onExpand={() => setOpenKey((k) => (k === m.key ? null : m.key))}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ModuleRow({
  module: m,
  on,
  lock,
  caption,
  open,
  isLast,
  busy,
  canEdit,
  onToggle,
  onExpand,
}: {
  module: SwitchboardModule;
  on: boolean;
  lock: Lock;
  caption: string | null;
  open: boolean;
  isLast: boolean;
  busy: boolean;
  canEdit: boolean;
  onToggle: () => void;
  onExpand: () => void;
}) {
  return (
    <div className={cn(!isLast && 'border-b border-[var(--color-border-default)]')}>
      <div className="flex items-center gap-4 py-3.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: m.colorVar }} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <button
            type="button"
            onClick={onExpand}
            aria-expanded={open}
            className="flex flex-col gap-0.5 text-left"
          >
            <span className="flex items-center gap-2">
              <Text weight="medium">{m.name}</Text>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-[var(--color-text-tertiary)] transition-transform duration-200',
                  open && 'rotate-180'
                )}
              />
            </span>
            <Text size="xs" variant="muted">
              {m.desc}
            </Text>
          </button>
          {caption && (
            <Badge
              color={lock === 'included' ? 'success' : 'neutral'}
              variant="soft"
              size="sm"
              className="mt-1 self-start"
            >
              {caption}
            </Badge>
          )}
        </div>
        <span
          className={cn(
            'w-16 shrink-0 text-right text-sm',
            lock === 'included'
              ? 'font-medium text-[var(--color-success-text)]'
              : on
                ? 'font-medium text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-tertiary)]'
          )}
        >
          {lock === 'included' ? 'Included' : `+ $${m.price}`}
        </span>
        {/* A bundled capability has nothing to toggle — show just "Included" and
            drop the switch, holding its width so the price column stays aligned. */}
        {lock === 'included' ? (
          <span className="w-9 shrink-0" aria-hidden="true" />
        ) : (
          <Switch
            checked={on}
            onCheckedChange={onToggle}
            disabled={lock !== null || !canEdit || busy}
            color={m.key}
            aria-label={m.name}
          />
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-3.5 pt-0.5 pr-1 pb-5 pl-[26px]">
          <Text size="sm" variant="muted" className="max-w-[560px]">
            {m.long}
          </Text>
          <ul className="flex flex-wrap gap-x-7 gap-y-2.5">
            {m.feats.map((f) => (
              <li key={f} className="flex w-[248px] max-w-full items-center gap-2.5">
                <span
                  className="h-[5px] w-[5px] shrink-0 rounded-full"
                  style={{ background: m.colorVar }}
                />
                <Text size="sm" variant="muted">
                  {f}
                </Text>
              </li>
            ))}
          </ul>
          <Text size="xs" variant="muted">
            Replaces {m.replaces} — about{' '}
            <span className="font-medium text-[var(--color-text-secondary)]">
              ${m.elsewhere}/mo
            </span>{' '}
            bought separately.
          </Text>
        </div>
      )}
    </div>
  );
}

function joinNames(slugs: ModuleSlug[], nameOf: Map<string, string>): string {
  const names = slugs.map((s) => nameOf.get(s) ?? s);
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`;
}
