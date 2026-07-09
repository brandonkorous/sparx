'use client';

// The Add palette — opinionated composites and raw primitives in ONE palette,
// grouped Layout / Content & media / From your modules. Module-supplied
// components are tagged and color-coded; a component appears here because its
// module is on. Clicking drops it inside the current target container.

import * as React from 'react';
import { Layers } from 'lucide-react';
import { DynamicIcon, type IconName } from 'lucide-react/dynamic';
import { cn, Input } from '@sparx/ui';
import {
  catalogGroupsForSurface,
  CATALOG_CATEGORY_LABELS,
  customType,
  type ArchetypeDto,
  type ComponentDto,
  type PlatformCatalogEntry,
} from '@sparx/builder-schemas';

import {
  paletteForSurface,
  type ComponentDef,
  type EditorSurface,
  type PaletteGroup,
} from './registry';
import { moduleColor } from './binding-catalog';
import { MODULES } from './sample';

// The PRIMITIVES — the in-code building blocks. The composed component catalog
// (docs/98 §5) renders ABOVE these; these are the raw containers + atoms + raw
// elements you assemble or drop beneath a stamped component.
const GROUPS: { group: PaletteGroup; label: string }[] = [
  { group: 'layout', label: 'Containers' },
  { group: 'content', label: 'Content & media' },
  { group: 'data', label: 'From your modules' },
  // Raw HTML elements (docs/98 Pillar 1) — every whitelisted tag, fully classable.
  { group: 'elements', label: 'HTML elements' },
];

function Tile({ def, onAdd }: { def: ComponentDef; onAdd: (type: string) => void }) {
  const Icon = def.icon;
  const color = def.module ? moduleColor(def.module) : undefined;
  return (
    <button type="button" className="bx-tile" onClick={() => onAdd(def.type)}>
      {def.module ? (
        <span className="bx-tile__mod" style={{ background: color }}>
          {def.module.toUpperCase()}
        </span>
      ) : null}
      <Icon className="bx-tile__icon" aria-hidden />
      <span className="bx-tile__name">{def.label}</span>
      {def.composition === 'composite' ? (
        <span
          className="bx-tile__kind"
          title="Composite — built from other components"
          aria-label="Composite component"
        >
          <Layers aria-hidden />
        </span>
      ) : null}
    </button>
  );
}

// A tenant component tile (docs/53 P-B). Its icon is a lucide NAME (stored as a
// string), rendered via the lazy DynamicIcon; clicking drops a `custom:<key>`
// placement pinned to the component's latest version.
function CustomTile({ comp, onAdd }: { comp: ComponentDto; onAdd: (type: string) => void }) {
  return (
    <button
      type="button"
      className="bx-tile bx-tile--custom"
      onClick={() => onAdd(customType(comp.key))}
    >
      <span className="bx-tile__mod" style={{ background: 'var(--color-module)' }}>
        YOURS
      </span>
      <DynamicIcon name={comp.icon as IconName} className="bx-tile__icon" aria-hidden />
      <span className="bx-tile__name">{comp.name}</span>
    </button>
  );
}

// A brand-section archetype tile (docs/61 §6). Clicking STAMPS a forked copy of
// the archetype's tree into the current target — a one-time copy, not a `custom:`
// reference. Its icon is a lucide NAME (stored as a string), rendered lazily.
function ArchetypeTile({
  archetype,
  onStamp,
}: {
  archetype: ArchetypeDto;
  onStamp: (tree: ArchetypeDto['tree']) => void;
}) {
  return (
    <button
      type="button"
      className="bx-tile bx-tile--archetype"
      onClick={() => onStamp(archetype.tree)}
      title={archetype.description ?? undefined}
    >
      <span className="bx-tile__mod" style={{ background: 'var(--color-module)' }}>
        SECTION
      </span>
      <DynamicIcon name={archetype.icon as IconName} className="bx-tile__icon" aria-hidden />
      <span className="bx-tile__name">{archetype.name}</span>
    </button>
  );
}

// A platform catalog component tile (docs/98 §5). The catalog is the daisyUI-grade
// library rebuilt in our tokens — every entry a composed node tree. Clicking
// STAMPS a forked copy (fresh ids) into the current target, exactly like an
// archetype: the dropped nodes are ordinary, fully-editable nodes. Its icon is a
// lucide NAME rendered lazily; the Layers glyph marks it as a composite.
function CatalogTile({
  entry,
  onStamp,
}: {
  entry: PlatformCatalogEntry;
  onStamp: (tree: PlatformCatalogEntry['tree']) => void;
}) {
  return (
    <button
      type="button"
      className="bx-tile bx-tile--catalog"
      onClick={() => onStamp(entry.tree)}
      title={entry.description}
    >
      <DynamicIcon name={entry.icon as IconName} className="bx-tile__icon" aria-hidden />
      <span className="bx-tile__name">{entry.name}</span>
      <span className="bx-tile__kind" title="Component — a composed, editable block" aria-hidden>
        <Layers />
      </span>
    </button>
  );
}

/** Build a search predicate from the query — every whitespace-separated term must
 *  appear in the combined searchable text (name/label, tags, description). */
function matcher(query: string): {
  searching: boolean;
  hit: (...parts: (string | string[] | null | undefined)[]) => boolean;
} {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const hit = (...parts: (string | string[] | null | undefined)[]): boolean => {
    if (terms.length === 0) return true;
    const hay = parts
      .flat()
      .filter((s): s is string => typeof s === 'string')
      .join(' ')
      .toLowerCase();
    return terms.every((t) => hay.includes(t));
  };
  return { searching: terms.length > 0, hit };
}

// The "+ enable" teaser tiles for modules the tenant hasn't turned on (page editor
// only), shown under the modules group when not searching.
function OffModulesTeaser({ modules }: { modules: { key: string; label: string }[] }) {
  if (modules.length === 0) return null;
  return (
    <div className="bx-tiles">
      {modules.map((m) => (
        <span key={m.key} className={cn('bx-tile', 'bx-tile--off')}>
          <span
            className="bx-tile__mod"
            style={{
              background: 'color-mix(in oklab, var(--color-base-content) 60%, transparent)',
            }}
          >
            {m.label.toUpperCase()}
          </span>
          <span className="bx-tile__name">+ enable</span>
        </span>
      ))}
    </div>
  );
}

export function AddPalette({
  targetName,
  onAdd,
  onStamp,
  surface = 'page',
  customComponents,
  archetypes,
}: {
  targetName: string;
  onAdd: (type: string) => void;
  /** Stamp a brand-section archetype — drops a forked copy (docs/61 §6). */
  onStamp?: (tree: ArchetypeDto['tree']) => void;
  /** Which editor this palette serves — gates which components show (docs/45). */
  surface?: EditorSurface;
  /** The tenant's custom components (docs/53 P-B). Shown under "Your components",
   *  filtered to those available on this surface. */
  customComponents?: ComponentDto[];
  /** Brand-section archetypes (docs/61 §6), filtered to this surface. */
  archetypes?: ArchetypeDto[];
}) {
  // The palette is long (the catalog alone is ~100 entries) — a search makes it
  // usable. One query filters EVERY section by name/label, tags, and description so a
  // user types "product" or "pricing" and sees only what matches, across the catalog,
  // primitives, brand sections, and their own components.
  const [query, setQuery] = React.useState('');
  const { searching, hit } = matcher(query);

  const offModules = MODULES.filter((m) => !m.on);
  const palette = paletteForSurface(surface);
  const mine = (customComponents ?? []).filter(
    (c) => c.surfaces.includes(surface) && hit(c.name, c.description)
  );
  const sections = (archetypes ?? []).filter(
    (a) => a.surfaces.includes(surface) && hit(a.name, a.description)
  );
  // The platform component catalog (docs/98 §5) — the daisyUI-grade library, in our
  // tokens, grouped by category. Stamped (forked) like an archetype, so it needs
  // onStamp; surface-filtered so email/site see only what applies.
  const catalogGroups = (onStamp ? catalogGroupsForSurface(surface) : [])
    .map((g) => ({
      category: g.category,
      entries: g.entries.filter((e) => hit(e.name, e.description, e.tags)),
    }))
    .filter((g) => g.entries.length > 0);
  // The in-code primitives (containers / content / data / raw elements), filtered.
  const primitiveGroups = GROUPS.map(({ group, label }) => ({
    group,
    label,
    defs: palette.filter((d) => d.group === group && hit(d.label, d.type)),
  })).filter((g) => g.defs.length > 0);

  const hasResults =
    catalogGroups.length > 0 ||
    primitiveGroups.length > 0 ||
    sections.length > 0 ||
    mine.length > 0;

  return (
    <div className="bx-palette">
      <p className="bx-pal-target">
        Adds inside <strong>{targetName}</strong>
      </p>

      <div className="bx-pal-search">
        <Input
          size="sm"
          type="search"
          value={query}
          placeholder="Search components…"
          aria-label="Search components"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {searching && !hasResults ? (
        <p className="bx-pal-empty">No components match “{query.trim()}”.</p>
      ) : null}

      {/* Components — the platform catalog (docs/98 §5). The primary library: a
          composed, editable block per tile, grouped by category. Rendered above the
          primitives because assembling from these is the fast path. */}
      {onStamp && catalogGroups.length > 0
        ? catalogGroups.map(({ category, entries }) => (
            <section key={`cat-${category}`} className="bx-pal-group">
              <h4 className="bx-pal-label">{CATALOG_CATEGORY_LABELS[category]}</h4>
              <div className="bx-tiles">
                {entries.map((e) => (
                  <CatalogTile key={e.key} entry={e} onStamp={onStamp} />
                ))}
              </div>
            </section>
          ))
        : null}
      {primitiveGroups.map(({ group, label, defs }) => (
        <section key={group} className="bx-pal-group">
          <h4 className="bx-pal-label">{label}</h4>
          <div className="bx-tiles">
            {defs.map((def) => (
              <Tile key={def.type} def={def} onAdd={onAdd} />
            ))}
          </div>
          {group === 'data' && surface === 'page' && !searching ? (
            <OffModulesTeaser modules={offModules} />
          ) : null}
        </section>
      ))}

      {/* Brand sections (docs/61 §6) — curated, on-brand starting points. Clicking
          STAMPS a forked copy (not a reference), so the dropped section is yours to
          edit freely. */}
      {onStamp && sections.length > 0 ? (
        <section className="bx-pal-group">
          <h4 className="bx-pal-label">Brand sections</h4>
          <div className="bx-tiles">
            {sections.map((a) => (
              <ArchetypeTile key={a.key} archetype={a} onStamp={onStamp} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Tenant components (docs/53). A component you built, dropped as a pinned
          reference — edits to the component update everywhere it's placed. */}
      {mine.length > 0 ? (
        <section className="bx-pal-group">
          <h4 className="bx-pal-label">Your components</h4>
          <div className="bx-tiles">
            {mine.map((comp) => (
              <CustomTile key={comp.key} comp={comp} onAdd={onAdd} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
