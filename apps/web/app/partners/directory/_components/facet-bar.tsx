// Partner-directory facet controls (docs/114 §B.6). Pure SSR: each facet value is
// a toggle LINK carrying its count, so filtering is a navigation (indexable,
// shareable URL) — no client state. Tier is single-select (a partner has one
// tier); specialty is multi-select (OR within the key); Remote is a boolean
// toggle. Location is a free field handled by the search form on the page.

import { Heading } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import type { FacetCount, PartnerTier } from '@/lib/partners';

export type DirectoryParams = Record<string, string>;

const BASE = '/partners/directory';

const TIER_LABEL: Record<string, string> = {
  certified: 'Certified',
  registered: 'Registered',
  informal: 'Informal',
};
// Certified first, then registered, then informal — the directory's own order.
const TIER_ORDER: PartnerTier[] = ['certified', 'registered', 'informal'];

const SPECIALTY_LABEL: Record<string, string> = {
  ecommerce: 'E-commerce',
  commerce: 'Commerce',
  b2b: 'B2B',
  crm: 'CRM',
  email: 'Email',
  cms: 'CMS',
  seo: 'SEO',
  design: 'Design',
  migration: 'Migration',
  ai: 'AI',
};

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
  target,
}: {
  label: string;
  count?: number;
  on: boolean;
  target: string;
}) {
  return (
    <a
      href={target}
      className={buttonClasses({
        size: 'sm',
        color: on ? 'primary' : 'neutral',
        variant: on ? 'soft' : 'outline',
        active: on,
        className: 'rounded-full no-underline',
      })}
    >
      {label}
      {typeof count === 'number' ? <span className="font-normal">{count}</span> : null}
      {on ? <span aria-hidden>×</span> : null}
    </a>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Heading level={3} size={6}>
        {label}
      </Heading>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
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
    <div className="flex flex-col gap-[18px]">
      <Row label="Tier">
        <Chip label="All tiers" on={!activeTier} target={href(current, (n) => delete n.tier)} />
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
      </Row>

      {specValues.length > 0 ? (
        <Row label="Specialty">
          {specValues.map((f) => {
            const on = selectedSpec.includes(f.value);
            const nextList = on
              ? selectedSpec.filter((v) => v !== f.value)
              : [...selectedSpec, f.value];
            return (
              <Chip
                key={f.value}
                label={SPECIALTY_LABEL[f.value] ?? f.value}
                count={f.count}
                on={on}
                target={href(current, (n) => {
                  if (nextList.length) n.specialty = nextList.join(',');
                  else delete n.specialty;
                })}
              />
            );
          })}
        </Row>
      ) : null}

      <Row label="Location">
        <Chip
          label="Remote"
          on={remoteOn}
          target={href(current, (n) => {
            if (remoteOn) delete n.remote;
            else n.remote = 'true';
          })}
        />
      </Row>

      {anySelected ? (
        <a href={BASE} className="self-start text-sm underline">
          Clear all filters
        </a>
      ) : null}
    </div>
  );
}
