// Partner-directory facet controls (docs/114 §B.6). Pure SSR: each facet value
// is a toggle LINK carrying its count, so filtering is a navigation (indexable,
// shareable URL) — no client state. Tier is single-select (a partner has one
// tier); specialty is multi-select (OR within the key); Remote is a boolean
// toggle. Location is a free field handled by the search form on the page.
//
// Rebuilt for three reasons.
//
// 1. It shipped "Certified1", "B2B1", "E-commerce1", "SEO1" and "All tiers×".
//    `{label}{<span>{count}</span>}` are two adjacent JSX expressions with
//    nothing between them, so the count fused to the word on every chip on the
//    page. Each chip's text is one interpolated string now.
// 2. Selection was inverted. `variant={on ? 'soft' : 'outline'}` made the ACTIVE
//    filter the palest thing in the row while the untouched ones were outlined —
//    the same bug the partner apply form had. Selection is the filled shape
//    (RULE #4), and `soft` measures ~2:1 on these hues regardless.
// 3. Three labelled rows stacked vertically spent ~200px of page on seven chips,
//    sitting above a result grid that is currently shorter than its own
//    controls. It is one wrapping row now, with the group names inline.

import { Text } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import type { FacetCount, PartnerTier } from '@/lib/partners';
import { specialty } from './specialties';

export type DirectoryParams = Record<string, string>;

const BASE = '/partners/directory';

const TIER_LABEL: Record<string, string> = {
  certified: 'Certified',
  registered: 'Registered',
  informal: 'Informal',
};
// Certified first, then registered, then informal — the directory's own order.
const TIER_ORDER: PartnerTier[] = ['certified', 'registered', 'informal'];

function parseList(value: string | undefined): string[] {
  return value ? value.split(',').filter(Boolean) : [];
}

function href(current: DirectoryParams, mutate: (next: DirectoryParams) => void): string {
  const next: DirectoryParams = { ...current };
  mutate(next);
  delete next.cursor;
  const qs = new URLSearchParams(next).toString();
  return `${BASE}${qs ? `?${qs}` : ''}`;
}

function Chip({
  label,
  count,
  on,
  color,
  target,
  dismissible = true,
}: {
  label: string;
  count?: number;
  on: boolean;
  /** The hue this value carries when SELECTED. Unselected chips stay outlined. */
  color?: string;
  target: string;
  /** False for a chip that CLEARS rather than adds — "All" is the absence of a
   *  tier filter, so an × on it offered to remove something that is not there. */
  dismissible?: boolean;
}) {
  // One string, so a count can never fuse to its label again.
  const text = typeof count === 'number' ? `${label} · ${count}` : label;
  return (
    <a
      href={target}
      // `aria-current`, not `aria-pressed`: these are LINKS (each filter is a
      // navigation to a shareable URL), and `aria-pressed` is only valid on
      // something with the button role.
      aria-current={on ? true : undefined}
      className={buttonClasses({
        size: 'sm',
        ...(on
          ? { color: color ?? 'primary', variant: 'solid' as const }
          : { variant: 'outline' as const }),
        className: 'rounded-full no-underline',
      })}
    >
      {on && dismissible ? `${text} ×` : text}
    </a>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text as="span" className="text-md mr-1 font-medium">
      {children}
    </Text>
  );
}

/** A rule between two filter axes on one row — structural, not decoration: it is
 *  the only thing telling "Certified" apart from "E-commerce". */
function Divider() {
  return <span aria-hidden className="bg-base-300 mx-1 hidden h-6 w-px sm:block" />;
}

export function PartnerFacetBar({
  facets,
  current,
}: {
  facets: { tier: FacetCount[]; specialty: FacetCount[] };
  current: DirectoryParams;
}) {
  const activeTier = current.tier;
  const selectedSpec = parseList(current.specialty);
  const remoteOn = current.remote === 'true';
  const anySelected =
    Boolean(activeTier) ||
    selectedSpec.length > 0 ||
    remoteOn ||
    Boolean(current.location) ||
    Boolean(current.q);

  const tierValues = TIER_ORDER.filter(
    (t) => facets.tier.some((f) => f.value === t) || activeTier === t
  );
  const tierCount = (t: string) => facets.tier.find((f) => f.value === t)?.count;
  const specValues = [...facets.specialty]
    .filter((f) => f.count > 0 || selectedSpec.includes(f.value))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
      <GroupLabel>Tier</GroupLabel>
      <Chip
        label="All"
        on={!activeTier}
        dismissible={false}
        target={href(current, (n) => delete n.tier)}
      />
      {tierValues.map((t) => (
        <Chip
          key={t}
          label={TIER_LABEL[t] ?? t}
          count={tierCount(t)}
          on={activeTier === t}
          target={href(current, (n) => {
            if (activeTier === t) delete n.tier;
            else n.tier = t;
          })}
        />
      ))}

      {specValues.length > 0 ? (
        <>
          <Divider />
          <GroupLabel>Does</GroupLabel>
          {specValues.map((f) => {
            const on = selectedSpec.includes(f.value);
            const s = specialty(f.value);
            const nextList = on
              ? selectedSpec.filter((v) => v !== f.value)
              : [...selectedSpec, f.value];
            return (
              <Chip
                key={f.value}
                label={s.label}
                count={f.count}
                color={s.color}
                on={on}
                target={href(current, (n) => {
                  if (nextList.length) n.specialty = nextList.join(',');
                  else delete n.specialty;
                })}
              />
            );
          })}
        </>
      ) : null}

      <Divider />
      <Chip
        label="Works remotely"
        on={remoteOn}
        target={href(current, (n) => {
          if (remoteOn) delete n.remote;
          else n.remote = 'true';
        })}
      />

      {anySelected ? (
        <a href={BASE} className="text-md text-primary ml-1 font-medium no-underline">
          Clear all
        </a>
      ) : null}
    </div>
  );
}
