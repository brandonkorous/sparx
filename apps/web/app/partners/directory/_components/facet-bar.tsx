// Partner-directory facet controls (docs/114 §B.6). Pure SSR: each facet value is
// a toggle LINK carrying its count, so filtering is a navigation (indexable,
// shareable URL) — no client state. Tier is single-select (a partner has one
// tier); specialty is multi-select (OR within the key); Remote is a boolean
// toggle. Location is a free field handled by the search form on the page.

import type { FacetCount, PartnerTier } from '@/lib/partners';

export type DirectoryParams = Record<string, string>;

const BASE = '/partners/directory';
const SANS = 'var(--font-sans)';
const EMBER = 'var(--color-primary)';

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
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 12px',
        borderRadius: '9999px',
        border: '1px solid',
        borderColor: on ? EMBER : 'var(--color-base-300)',
        backgroundColor: on
          ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
          : 'var(--color-base-100)',
        fontFamily: SANS,
        fontSize: '13px',
        fontWeight: on ? 500 : 400,
        color: on
          ? 'var(--color-primary)'
          : 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
        textDecoration: 'none',
      }}
    >
      {label}
      {typeof count === 'number' ? (
        <span
          style={{
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            fontWeight: 400,
          }}
        >
          {count}
        </span>
      ) : null}
      {on ? <span aria-hidden>×</span> : null}
    </a>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <span
        style={{
          fontFamily: SANS,
          fontWeight: 500,
          fontSize: '12px',
          color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
        }}
      >
        {label}
      </span>
      <div className="mkt-cluster" style={{ gap: '8px' }}>
        {children}
      </div>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
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
        <a
          href={BASE}
          style={{
            alignSelf: 'flex-start',
            fontFamily: SANS,
            fontSize: '13px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            textDecoration: 'underline',
          }}
        >
          Clear all filters
        </a>
      ) : null}
    </div>
  );
}
