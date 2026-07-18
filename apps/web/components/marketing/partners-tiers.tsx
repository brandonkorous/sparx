import type { ReactNode } from 'react';
import { Badge } from '@wizeworks/silicaui-react';
import type { PartnerTier } from '@/lib/partners';

/**
 * The partner-tier comparison — the /partners flagship device. A left-anchored
 * matrix (attribute spine × three tier columns) on desktop; the SAME data
 * transposed to three stacked tier panels on tablet/mobile. One source array
 * drives both, so the two representations can never diverge. Not pricing cards,
 * not a $/mo table — a clean capability comparison, Certified column tinted with
 * the platform Ember (it sits top of the directory).
 */

const SANS = 'var(--font-sans)';
const EMBER = 'var(--color-primary)';
const EMBER_TEXT = 'var(--color-primary)';
const EMBER_TINT = 'color-mix(in oklab, var(--color-primary) 15%, var(--color-base-100))';
const BORDER = 'var(--color-base-300)';
const CERT_CELL = 'color-mix(in oklab, var(--color-primary) 5%, var(--color-base-100))';

// The "/ first payment" · "/ ongoing" qualifier next to each commission figure.
const SMALL: React.CSSProperties = {
  fontSize: '15px',
  color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
  fontWeight: 400,
};

type Cell = { text: string; strong?: boolean } | 'dash';

interface TierHead {
  tier: PartnerTier;
  commission: ReactNode;
  note: string;
}

const HEADS: TierHead[] = [
  {
    tier: 'informal',
    commission: (
      <>
        20%<small style={SMALL}> first payment</small>
      </>
    ),
    note: 'No application — sign up and refer.',
  },
  {
    tier: 'registered',
    commission: (
      <>
        30%<small style={SMALL}> first payment</small>
      </>
    ),
    note: 'Application + brief review.',
  },
  {
    tier: 'certified',
    commission: (
      <>
        30%
        <span style={{ color: EMBER_TEXT }}> + 5%</span>
        <small style={SMALL}> ongoing</small>
      </>
    ),
    note: 'Application + certification.',
  },
];

const ROWS: { label: string; cells: [Cell, Cell, Cell] }[] = [
  {
    label: 'Referral commission',
    cells: [
      { text: '20% first payment' },
      { text: '30% first payment' },
      { text: '30% + 5% ongoing', strong: true },
    ],
  },
  {
    label: 'Partner resources & docs',
    cells: [
      { text: 'Included', strong: true },
      { text: 'Included', strong: true },
      { text: 'Included', strong: true },
    ],
  },
  {
    label: 'Directory listing',
    cells: [
      { text: 'Unverified badge' },
      { text: 'Registered badge' },
      { text: 'Top of directory', strong: true },
    ],
  },
  {
    label: 'Priority support',
    cells: [
      'dash',
      { text: 'Priority channel', strong: true },
      { text: 'Dedicated manager', strong: true },
    ],
  },
  {
    label: 'Host bootcamps',
    cells: ['dash', { text: 'Unpublished only' }, { text: 'Publish publicly', strong: true }],
  },
  {
    label: 'Co-marketing & early access',
    cells: ['dash', 'dash', { text: 'Featured + early modules', strong: true }],
  },
];

function TierBadge({ tier }: { tier: PartnerTier }) {
  const label = tier[0]!.toUpperCase() + tier.slice(1);
  const color = tier === 'certified' ? 'primary' : tier === 'registered' ? 'info' : 'neutral';
  return (
    <Badge color={color} variant="soft" size="md">
      {label}
    </Badge>
  );
}

function Commission({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        marginTop: '14px',
        fontFamily: SANS,
        fontWeight: 500,
        fontSize: '32px',
        letterSpacing: '-0.03em',
        color: 'var(--color-base-content)',
      }}
    >
      {children}
    </div>
  );
}

function cellContent(cell: Cell): ReactNode {
  if (cell === 'dash')
    return (
      <span style={{ color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)' }}>
        —
      </span>
    );
  return (
    <span
      style={{
        color: cell.strong
          ? EMBER_TEXT
          : 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
      }}
    >
      {cell.text}
    </span>
  );
}

export function PartnerTiers() {
  return (
    <>
      {/* Desktop matrix */}
      <div
        className="mkt-hide-on-tablet"
        style={{
          marginTop: '56px',
          border: `1px solid ${BORDER}`,
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: 'var(--color-base-100)',
        }}
      >
        <div className="mkt-tier-cols">
          <SpineHeadCell />
          {HEADS.map((h) => (
            <HeadCell key={h.tier} head={h} />
          ))}
        </div>
        {ROWS.map((row) => (
          <div
            key={row.label}
            className="mkt-tier-cols"
            style={{ borderTop: `1px solid ${BORDER}` }}
          >
            <BodyCell spine>{row.label}</BodyCell>
            {row.cells.map((cell, i) => (
              <BodyCell key={i} certified={i === 2}>
                {cellContent(cell)}
              </BodyCell>
            ))}
          </div>
        ))}
      </div>

      {/* Tablet/mobile stacked tier panels */}
      <div
        className="mkt-tablet-down-only-flex"
        style={{ flexDirection: 'column', gap: '16px', marginTop: '48px' }}
      >
        {HEADS.map((h, ti) => (
          <TierPanel key={h.tier} head={h} tierIndex={ti} />
        ))}
      </div>
    </>
  );
}

function SpineHeadCell() {
  return (
    <div style={{ padding: '30px 26px', display: 'flex', alignItems: 'flex-end' }}>
      <span
        style={{
          fontFamily: SANS,
          fontSize: '13px',
          color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
        }}
      >
        What each tier unlocks
      </span>
    </div>
  );
}

function HeadCell({ head }: { head: TierHead }) {
  const certified = head.tier === 'certified';
  return (
    <div
      style={{
        padding: '30px 26px',
        borderLeft: `1px solid ${BORDER}`,
        backgroundColor: certified ? EMBER_TINT : undefined,
      }}
    >
      <TierBadge tier={head.tier} />
      <Commission>{head.commission}</Commission>
      <p
        style={{
          margin: '6px 0 0',
          fontFamily: SANS,
          fontSize: '13px',
          color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
        }}
      >
        {head.note}
      </p>
    </div>
  );
}

function BodyCell({
  children,
  spine,
  certified,
}: {
  children: ReactNode;
  spine?: boolean;
  certified?: boolean;
}) {
  return (
    <div
      style={{
        padding: '18px 26px',
        borderLeft: spine ? undefined : `1px solid ${BORDER}`,
        backgroundColor: certified ? CERT_CELL : undefined,
        display: 'flex',
        alignItems: 'center',
        fontFamily: SANS,
        fontSize: '14px',
        fontWeight: spine ? 500 : 400,
        color: spine ? 'var(--color-base-content)' : undefined,
      }}
    >
      {children}
    </div>
  );
}

function TierPanel({ head, tierIndex }: { head: TierHead; tierIndex: number }) {
  const certified = head.tier === 'certified';
  const unlocks = ROWS.filter((r) => r.cells[tierIndex] !== 'dash');
  return (
    <div
      style={{
        border: `1px solid ${certified ? EMBER : BORDER}`,
        borderRadius: '16px',
        overflow: 'hidden',
        backgroundColor: 'var(--color-base-100)',
      }}
    >
      <div
        style={{
          padding: '24px',
          borderBottom: `1px solid ${BORDER}`,
          backgroundColor: certified ? EMBER_TINT : undefined,
        }}
      >
        <TierBadge tier={head.tier} />
        <Commission>{head.commission}</Commission>
        <p
          style={{
            margin: '6px 0 0',
            fontFamily: SANS,
            fontSize: '13px',
            color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
          }}
        >
          {head.note}
        </p>
      </div>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {unlocks.map((r) => {
          const cell = r.cells[tierIndex];
          const detail = cell && cell !== 'dash' ? cell.text : '';
          return (
            <li
              key={r.label}
              style={{
                display: 'flex',
                gap: '10px',
                fontFamily: SANS,
                fontSize: '14px',
                lineHeight: '20px',
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              }}
            >
              <span style={{ color: EMBER, flexShrink: 0 }}>✓</span>
              <span>
                <span style={{ color: 'var(--color-base-content)' }}>{r.label}</span>
                {detail ? ` — ${detail}` : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
