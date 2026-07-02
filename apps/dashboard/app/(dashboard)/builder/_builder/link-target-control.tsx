'use client';

// The shared LINK-TARGET control (docs/57 §10). The inspector's `linktarget` prop
// control and — via the same component — the NavItem target editor. Two ways to
// set where a link goes:
//   · type/paste an href directly (power users, external URLs), or
//   · "Browse…" → a searchable, module-gated modal of real destinations, pages,
//     products, collections, and content, each resolved to its live storefront
//     href (link-target-actions.ts). Picking one writes the plain href string —
//     backward-compatible with everything that already stores an href.
//
// The Browse affordance is deliberately a full-width button, not a hidden link:
// finding the right target is the whole job, so it can't be a footnote.

import * as React from 'react';
import { Search, Compass } from 'lucide-react';
import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
} from '@sparx/ui';

import {
  searchLinkTargets,
  linkTargetSources,
  type LinkTargetHit,
  type LinkTargetKind,
  type LinkTargetSource,
} from '../_lib/link-target-actions';

/** A tab kind — the server sources plus the always-present freeform escape hatch. */
type TabKind = LinkTargetKind | 'custom';

export function LinkTargetControl({
  value,
  onChange,
  placeholder,
}: {
  value: unknown;
  onChange: (href: string) => void;
  placeholder?: string;
}) {
  const href = typeof value === 'string' ? value : '';
  const [browsing, setBrowsing] = React.useState(false);

  return (
    <div className="bx-linktarget">
      <Input
        value={href}
        placeholder={placeholder ?? '/page or https://…'}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Link target"
      />
      <button type="button" className="bx-linktarget__browse" onClick={() => setBrowsing(true)}>
        <Compass aria-hidden /> Browse pages &amp; content…
      </button>
      {browsing && (
        <BrowseModal
          current={href}
          onPick={(picked) => {
            onChange(picked);
            setBrowsing(false);
          }}
          onClose={() => setBrowsing(false)}
        />
      )}
    </div>
  );
}

// ── The browse modal — tabs (sources) + a debounced search + results ──────────

function BrowseModal({
  current,
  onPick,
  onClose,
}: {
  current: string;
  onPick: (href: string) => void;
  onClose: () => void;
}) {
  const [sources, setSources] = React.useState<LinkTargetSource[]>([]);
  const [kind, setKind] = React.useState<TabKind>('destination');
  const [q, setQ] = React.useState('');
  const [hits, setHits] = React.useState<LinkTargetHit[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [customUrl, setCustomUrl] = React.useState(current);

  // The tenant's available sources (module-gated), loaded once. `custom` is always
  // last — pasting a URL never depends on a module.
  React.useEffect(() => {
    let alive = true;
    linkTargetSources()
      .then((s) => alive && setSources(s))
      .catch(() => alive && setSources([]));
    return () => {
      alive = false;
    };
  }, []);

  // Debounced search whenever the active source or query changes.
  React.useEffect(() => {
    if (kind === 'custom') return;
    let alive = true;
    setLoading(true);
    const timer = setTimeout(() => {
      searchLinkTargets(kind, q)
        .then((r) => alive && (setHits(r), setLoading(false)))
        .catch(() => alive && (setHits([]), setLoading(false)));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [kind, q]);

  const tabs: { kind: TabKind; label: string }[] = [
    ...sources,
    { kind: 'custom', label: 'Custom URL' },
  ];

  return (
    <Modal open onOpenChange={(next) => !next && onClose()}>
      <ModalContent size="xl" mobileSheet aria-describedby={undefined}>
        <ModalHeader>
          <ModalTitle>Link to…</ModalTitle>
          <ModalDescription>
            Search your pages, products, and content — or paste a custom URL.
          </ModalDescription>
        </ModalHeader>

        <div className="bx-linktarget__tabs" role="tablist" aria-label="Link source">
          {tabs.map((t) => (
            <button
              key={t.kind}
              type="button"
              role="tab"
              aria-selected={kind === t.kind}
              className="bx-linktarget__tab"
              onClick={() => {
                setKind(t.kind);
                setQ('');
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {kind === 'custom' ? (
          <div className="bx-linktarget__custom">
            <Input
              value={customUrl}
              placeholder="https://example.com or /a/path"
              onChange={(e) => setCustomUrl(e.target.value)}
              aria-label="Custom URL"
            />
            <Button
              color="primary"
              variant="solid"
              size="sm"
              disabled={!customUrl.trim()}
              onClick={() => onPick(customUrl.trim())}
            >
              Use this URL
            </Button>
          </div>
        ) : (
          <>
            <div className="bx-linktarget__search">
              <Search aria-hidden />
              <input
                className="bx-linktarget__searchinput"
                value={q}
                placeholder="Search…"
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search link targets"
              />
            </div>
            <div className="bx-linktarget__results">
              <ResultList loading={loading} hits={hits} current={current} onPick={onPick} />
            </div>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

// The results list — loading / empty / rows. The current href is marked so re-opening
// the picker shows what's already linked.
function ResultList({
  loading,
  hits,
  current,
  onPick,
}: {
  loading: boolean;
  hits: LinkTargetHit[];
  current: string;
  onPick: (href: string) => void;
}) {
  if (loading) return <p className="bx-linktarget__empty">Searching…</p>;
  if (hits.length === 0)
    return <p className="bx-linktarget__empty">Nothing to link to here yet.</p>;
  return (
    <>
      {hits.map((h) => (
        <button
          key={h.id}
          type="button"
          className={h.href === current ? 'bx-linktarget__hit is-current' : 'bx-linktarget__hit'}
          onClick={() => onPick(h.href)}
        >
          <span className="bx-linktarget__hit-label">{h.label}</span>
          {h.sub && <span className="bx-linktarget__hit-sub">{h.sub}</span>}
        </button>
      ))}
    </>
  );
}
