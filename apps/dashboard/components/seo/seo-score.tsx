'use client';

// SEO scorecard UI (docs/50 §7.2) — three views over ONE data source:
//   · <SeoScoreChip>     the universal atom: a score ring + grade. Self-fetches
//                        live in an editor; in a list it renders a stored score
//                        and lazily fetches detail on first hover.
//   · the hover popover  on hover/focus of the chip, a compact <SeoReport>.
//   · <SeoReport>        the full card (header + category bars + fix-first + all
//                        checks). Reused by the popover and the dedicated surface.
// One `useSeoAudit` hook backs all of it, so no surface re-implements scoring UI.

import * as React from 'react';
import Link from 'next/link';

import { Button } from '@wizeworks/silicaui-react';
import { Popover, PopoverTrigger, PopoverContent } from '@sparx/ui';
import type {
  CategoryScore,
  CheckResult,
  CheckStatus,
  EntityType,
  Grade,
  Scorecard,
} from '@sparx/seo-audit';

import { getSeoAudit } from './actions';

const GRADE: Record<Grade, { label: string; color: string }> = {
  excellent: { label: 'Excellent', color: '#10b981' },
  good: { label: 'Good', color: '#14b8a6' },
  'needs-work': { label: 'Needs work', color: '#f59e0b' },
  poor: { label: 'Poor', color: '#ef4444' },
};

const STATUS: Record<CheckStatus, { color: string; glyph: string }> = {
  pass: { color: '#10b981', glyph: '✓' },
  warn: { color: '#f59e0b', glyph: '!' },
  fail: { color: '#ef4444', glyph: '✕' },
  info: { color: '#a1a1aa', glyph: 'i' },
};

const NEUTRAL = '#a1a1aa';
const TRACK = '#e5e5e5';

// ── Data hook ────────────────────────────────────────────────────────────────

export function useSeoAudit(type: EntityType, id: string, enabled: boolean) {
  const [card, setCard] = React.useState<Scorecard | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const seq = React.useRef(0);
  const loadedFor = React.useRef<string | null>(null);

  const load = React.useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    const res = await getSeoAudit(type, id);
    if (mine !== seq.current) return; // a newer request superseded this one
    if (res.ok && res.data) setCard(res.data);
    else setError(res.error ?? 'Audit failed.');
    setLoading(false);
  }, [type, id]);

  // Reset when the audited entity changes so a stale score never shows.
  React.useEffect(() => {
    setCard(null);
    loadedFor.current = null;
  }, [type, id]);

  // Fetch once per entity when enabled (mount in an editor; first hover in a list).
  React.useEffect(() => {
    if (!enabled || loadedFor.current === id) return;
    loadedFor.current = id;
    void load();
  }, [enabled, id, load]);

  return { card, loading, error, reload: load };
}

// ── Score ring ───────────────────────────────────────────────────────────────

function Ring({ score, color, size }: { score: number | null; color: string; size: number }) {
  const pct = Math.max(0, Math.min(100, score ?? 0));
  return (
    <span
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'inline-grid',
        placeItems: 'center',
        flexShrink: 0,
        background: `conic-gradient(${color} ${pct}%, ${TRACK} ${pct}% 100%)`,
      }}
    >
      <span
        className="bg-base-100"
        style={{
          position: 'absolute',
          inset: Math.round(size * 0.12),
          borderRadius: '50%',
        }}
      />
      <span
        style={{
          position: 'relative',
          fontSize: Math.round(size * 0.36),
          fontWeight: 500,
          color: score == null ? NEUTRAL : color,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {score ?? '·'}
      </span>
    </span>
  );
}

// ── Plain badge (no popover) ─────────────────────────────────────────────────

// A static score ring with no hover popover — for surfaces that already open the
// full report on click (the /seo overview), where a hover popover would just
// duplicate the row's own detail. Renders the stored score; never fetches.
export function SeoScoreBadge({
  score,
  grade,
  size = 30,
}: {
  score: number | null;
  grade?: Grade | null;
  size?: number;
}) {
  const color = grade ? GRADE[grade].color : NEUTRAL;
  const label =
    score != null
      ? `SEO health ${score} of 100${grade ? ` — ${GRADE[grade].label}` : ''}`
      : 'SEO health';
  return (
    <span aria-label={label} style={{ display: 'inline-flex' }}>
      <Ring score={score} color={color} size={size} />
    </span>
  );
}

// ── The chip + hover popover ─────────────────────────────────────────────────

export function SeoScoreChip({
  type,
  id,
  initialScore,
  initialGrade,
  lazy = false,
  size = 34,
}: {
  type: EntityType;
  id: string;
  /** Stored score for list rows — shown immediately; detail loads on hover. */
  initialScore?: number;
  initialGrade?: Grade;
  /** List mode: don't fetch until the popover first opens. */
  lazy?: boolean;
  size?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const enabled = !lazy || open;
  const { card, loading, error, reload } = useSeoAudit(type, id, enabled);

  const score = card?.score ?? initialScore ?? null;
  const grade = card?.grade ?? initialGrade ?? null;
  const color = grade ? GRADE[grade].color : NEUTRAL;

  // Hover/focus opens; a short close delay lets the pointer travel into the panel.
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const openNow = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const closeSoon = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };
  React.useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  const label =
    score != null
      ? `SEO health ${score} of 100${grade ? ` — ${GRADE[grade].label}` : ''}`
      : 'SEO health';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onMouseEnter={openNow}
          onMouseLeave={closeSoon}
          onFocus={openNow}
          onBlur={closeSoon}
          style={{
            display: 'inline-flex',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            borderRadius: '50%',
          }}
        >
          <Ring score={score} color={color} size={size} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        // This is a hover/focus popover, not a click-dialog. Radix's default is to
        // pull focus into the content on open and shove it back to the trigger on
        // close — which here fires the trigger's onBlur (→ closeSoon) then, on
        // close, its onFocus (→ openNow), oscillating open/closed every ~140ms.
        // Suppressing both auto-focus moves keeps focus on the trigger and stops
        // the flicker; keyboard users still open it via the trigger's onFocus.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onMouseEnter={openNow}
        onMouseLeave={closeSoon}
        style={{ width: 360, padding: 0, maxHeight: '70vh', overflow: 'auto' }}
      >
        <SeoReport card={card} loading={loading} error={error} onReload={() => void reload()} />
      </PopoverContent>
    </Popover>
  );
}

// ── The report (popover body + dedicated surface) ────────────────────────────

const CATEGORY_ORDER = ['meta', 'index', 'content', 'social'] as const;

export function SeoReport({
  card,
  loading,
  error,
  onReload,
  editHref,
  editLabel,
}: {
  card: Scorecard | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  /** When set, render a link to the entity's editor so the reader can jump to
   *  fix the issues. Omitted in editor-embedded contexts (you're already there). */
  editHref?: string;
  editLabel?: string;
}) {
  if (!card) {
    return (
      <div
        style={{
          padding: 20,
          fontSize: 13,
          color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
        }}
      >
        {error
          ? `Couldn’t run the audit: ${error}`
          : loading
            ? 'Running SEO audit…'
            : 'No audit yet.'}
      </div>
    );
  }

  const g = GRADE[card.grade];
  const cats = [...card.categories].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.key) - CATEGORY_ORDER.indexOf(b.key)
  );

  return (
    <div className="text-base-content" style={{ fontSize: 13 }}>
      {/* Header */}
      <div
        className="border-base-300 border-b"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: 16,
        }}
      >
        <Ring score={card.score} color={g.color} size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: 12,
              fontWeight: 500,
              color: g.color,
              padding: '2px 9px',
              borderRadius: 999,
              background: `color-mix(in srgb, ${g.color} 12%, transparent)`,
            }}
          >
            {g.label}
          </span>
          <div
            style={{
              fontSize: 12,
              color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              marginTop: 4,
            }}
          >
            SEO health · {card.score}/100
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={onReload} disabled={loading}>
          {loading ? 'Running…' : 'Re-run'}
        </Button>
      </div>

      {/* Jump to the entity's editor to actually make the fixes. */}
      {editHref ? (
        <div className="border-base-300 border-b" style={{ padding: '10px 16px' }}>
          <Link
            href={editHref}
            className="text-module"
            style={{
              fontSize: 12,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            {editLabel ?? 'Open editor'} →
          </Link>
        </div>
      ) : null}

      {/* Category bars */}
      <div
        className="border-base-300 border-b"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
          padding: 16,
        }}
      >
        {cats.map((c) => (
          <CategoryBar key={c.key} cat={c} />
        ))}
      </div>

      {/* Fix first */}
      {card.fixFirst ? (
        <div
          className="border-base-300 border-b"
          style={{
            display: 'flex',
            gap: 10,
            padding: '12px 16px',
            background: 'color-mix(in srgb, #f59e0b 10%, transparent)',
            lineHeight: 1.5,
          }}
        >
          <span aria-hidden style={{ color: '#92400e' }}>
            ⚑
          </span>
          <span>
            <strong style={{ fontWeight: 500 }}>Fix first: </strong>
            {card.fixFirst}
          </span>
        </div>
      ) : null}

      {/* Checks grouped by category */}
      <div>
        {cats.map((c) => (
          <CheckGroup
            key={c.key}
            label={c.label}
            checks={card.checks.filter((ch) => ch.category === c.key)}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryBar({ cat }: { cat: CategoryScore }) {
  const pct = cat.max > 0 ? Math.round((cat.earned / cat.max) * 100) : 100;
  const color = pct >= 90 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
          marginBottom: 6,
        }}
      >
        <span>{cat.label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(cat.earned)}/{cat.max}
        </span>
      </div>
      <div className="bg-base-200" style={{ height: 5, borderRadius: 999 }}>
        <span
          style={{
            display: 'block',
            height: '100%',
            width: `${pct}%`,
            borderRadius: 999,
            background: color,
          }}
        />
      </div>
    </div>
  );
}

function CheckGroup({ label, checks }: { label: string; checks: CheckResult[] }) {
  if (checks.length === 0) return null;
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
          padding: '12px 16px 4px',
        }}
      >
        {label}
      </div>
      {checks.map((ch) => (
        <CheckRow key={ch.id} check={ch} />
      ))}
    </div>
  );
}

function CheckRow({ check }: { check: CheckResult }) {
  const s = STATUS[check.status];
  return (
    <div
      className="border-base-300 border-t"
      style={{
        display: 'flex',
        gap: 10,
        padding: '9px 16px',
        alignItems: 'flex-start',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 16,
          height: 16,
          flexShrink: 0,
          marginTop: 1,
          borderRadius: '50%',
          background: s.color,
          color: '#fff',
          fontSize: 10,
          fontWeight: 600,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {s.glyph}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontWeight: 500 }}>{check.label}</span>
          {check.value ? (
            <span
              style={{
                fontSize: 12,
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {check.value}
            </span>
          ) : null}
        </div>
        {check.tip ? (
          <div
            style={{
              fontSize: 12,
              color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              marginTop: 2,
              lineHeight: 1.45,
            }}
          >
            {check.tip}
          </div>
        ) : null}
      </div>
    </div>
  );
}
