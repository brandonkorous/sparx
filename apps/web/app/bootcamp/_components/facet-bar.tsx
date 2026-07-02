// Bootcamp-directory facet controls (docs/114 §B.6). Pure SSR — each value is a
// toggle LINK, so filtering is a navigation (indexable, shareable URL). Format
// and location are single-select (a bootcamp has one of each); the date range is
// a single-select of presets the page computes into concrete from/to values, so
// the API contract stays `from`/`to` while the UI stays "This month / Next 3
// months". Accent = commerce orange, the bootcamp page's energetic hue.

import type { FacetCount } from '@/lib/partners';
import { FORMAT_LABEL, type BootcampFormat } from '@/lib/bootcamp';

export type BootcampParams = Record<string, string>;

const BASE = '/bootcamp';
const SANS = 'var(--font-sans)';
const ORANGE = 'var(--module-commerce)';

export interface DatePreset {
  key: string;
  label: string;
  from?: string;
  to?: string;
  active: boolean;
}

function href(current: BootcampParams, mutate: (next: BootcampParams) => void): string {
  const next: BootcampParams = { ...current };
  mutate(next);
  delete next.cursor;
  const qs = new URLSearchParams(next).toString();
  return `${BASE}${qs ? `?${qs}#directory` : '#directory'}`;
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
        borderColor: on ? ORANGE : 'var(--color-border-default)',
        backgroundColor: on
          ? 'color-mix(in srgb, var(--module-commerce) 12%, transparent)'
          : 'var(--color-bg-surface)',
        fontFamily: SANS,
        fontSize: '13px',
        fontWeight: on ? 500 : 400,
        color: on ? '#C2410C' : 'var(--color-text-secondary)',
        textDecoration: 'none',
      }}
    >
      {label}
      {typeof count === 'number' ? (
        <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>{count}</span>
      ) : null}
      {on ? <span aria-hidden>×</span> : null}
    </a>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
      <span
        style={{
          fontFamily: SANS,
          fontWeight: 500,
          fontSize: '12px',
          color: 'var(--color-text-tertiary)',
          width: '84px',
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

const FORMAT_ORDER: BootcampFormat[] = ['in_person', 'virtual', 'hybrid', 'async'];

export function BootcampFacetBar({
  facets,
  current,
  datePresets,
}: {
  facets: { format: FacetCount[]; location: FacetCount[] };
  current: BootcampParams;
  datePresets: DatePreset[];
}) {
  const activeFormat = current.format;
  const activeLoc = current.location;
  const anySelected =
    Boolean(activeFormat) || Boolean(activeLoc) || Boolean(current.from) || Boolean(current.q);

  const formatValues = FORMAT_ORDER.filter(
    (f) => facets.format.some((x) => x.value === f) || activeFormat === f
  );
  const formatCount = (f: string) => facets.format.find((x) => x.value === f)?.count;
  const locValues = [...facets.location]
    .filter((f) => f.count > 0 || activeLoc === f.value)
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, 8);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Row label="Format">
        <Chip label="All" on={!activeFormat} target={href(current, (n) => delete n.format)} />
        {formatValues.map((f) => (
          <Chip
            key={f}
            label={FORMAT_LABEL[f]}
            count={formatCount(f)}
            on={activeFormat === f}
            target={href(current, (n) => {
              if (activeFormat === f) delete n.format;
              else n.format = f;
            })}
          />
        ))}
      </Row>

      <Row label="When">
        <Chip
          label="Anytime"
          on={!current.from && !current.to}
          target={href(current, (n) => {
            delete n.from;
            delete n.to;
          })}
        />
        {datePresets.map((p) => (
          <Chip
            key={p.key}
            label={p.label}
            on={p.active}
            target={href(current, (n) => {
              if (p.active) {
                delete n.from;
                delete n.to;
              } else {
                if (p.from) n.from = p.from;
                else delete n.from;
                if (p.to) n.to = p.to;
                else delete n.to;
              }
            })}
          />
        ))}
      </Row>

      {locValues.length > 0 ? (
        <Row label="Where">
          {locValues.map((f) => (
            <Chip
              key={f.value}
              label={f.value}
              count={f.count}
              on={activeLoc === f.value}
              target={href(current, (n) => {
                if (activeLoc === f.value) delete n.location;
                else n.location = f.value;
              })}
            />
          ))}
        </Row>
      ) : null}

      {anySelected ? (
        <a
          href={`${BASE}#directory`}
          style={{
            alignSelf: 'flex-start',
            fontFamily: SANS,
            fontSize: '13px',
            color: 'var(--color-text-tertiary)',
            textDecoration: 'underline',
          }}
        >
          Clear all filters
        </a>
      ) : null}
    </div>
  );
}
