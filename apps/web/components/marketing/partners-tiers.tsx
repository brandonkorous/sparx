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
 *
 * Class-based: the Ember column tint is silica's own `bg-primary bg-soft`
 * treatment and every ink is a real token utility — including the non-strong
 * cells, which used to be a 70%-into-transparent color-mix (faded readable text,
 * banned by RULE #3) and are now `text-ink-muted`.
 */

/** The "/ first payment" · "/ ongoing" qualifier next to each commission figure. */
const SMALL = 'text-body-sm text-ink-muted font-normal';

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
        20%<small className={SMALL}> first payment</small>
      </>
    ),
    note: 'No application — sign up and refer.',
  },
  {
    tier: 'registered',
    commission: (
      <>
        30%<small className={SMALL}> first payment</small>
      </>
    ),
    note: 'Application + brief review.',
  },
  {
    tier: 'certified',
    commission: (
      <>
        30%
        <span className="text-primary"> + 5%</span>
        <small className={SMALL}> ongoing</small>
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
    <div className="text-base-content mt-3.5 text-[32px] font-medium tracking-[-0.03em]">
      {children}
    </div>
  );
}

function cellContent(cell: Cell): ReactNode {
  if (cell === 'dash') return <span className="text-ink-subtle">—</span>;
  return <span className={cell.strong ? 'text-primary' : 'text-ink-muted'}>{cell.text}</span>;
}

export function PartnerTiers() {
  return (
    <>
      {/* Desktop matrix */}
      <div className="mkt-hide-on-tablet border-base-300 bg-base-100 mt-14 overflow-hidden rounded-2xl border">
        <div className="mkt-tier-cols">
          <SpineHeadCell />
          {HEADS.map((h) => (
            <HeadCell key={h.tier} head={h} />
          ))}
        </div>
        {ROWS.map((row) => (
          <div key={row.label} className="mkt-tier-cols border-base-300 border-t">
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
      <div className="mkt-tablet-down-only-flex mt-12 flex-col gap-4">
        {HEADS.map((h, ti) => (
          <TierPanel key={h.tier} head={h} tierIndex={ti} />
        ))}
      </div>
    </>
  );
}

function SpineHeadCell() {
  return (
    <div className="flex items-end px-[26px] py-[30px]">
      <span className="text-ink-subtle text-caption">What each tier unlocks</span>
    </div>
  );
}

function HeadCell({ head }: { head: TierHead }) {
  const certified = head.tier === 'certified';
  return (
    <div
      className={`border-base-300 border-l px-[26px] py-[30px] ${certified ? 'bg-primary bg-soft' : ''}`}
    >
      <TierBadge tier={head.tier} />
      <Commission>{head.commission}</Commission>
      <p className="text-ink-muted text-caption mt-1.5">{head.note}</p>
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
      className={[
        'text-small flex items-center px-[26px] py-[18px]',
        spine ? 'text-base-content font-medium' : 'border-base-300 border-l',
        certified ? 'bg-primary/5' : '',
      ]
        .filter(Boolean)
        .join(' ')}
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
      className={`bg-base-100 overflow-hidden rounded-2xl border ${certified ? 'border-primary' : 'border-base-300'}`}
    >
      <div className={`border-base-300 border-b p-6 ${certified ? 'bg-primary bg-soft' : ''}`}>
        <TierBadge tier={head.tier} />
        <Commission>{head.commission}</Commission>
        <p className="text-ink-muted text-caption mt-1.5">{head.note}</p>
      </div>
      <ul className="flex list-none flex-col gap-3 px-6 py-5">
        {unlocks.map((r) => {
          const cell = r.cells[tierIndex];
          const detail = cell && cell !== 'dash' ? cell.text : '';
          return (
            <li key={r.label} className="text-ink-muted text-small flex gap-2.5">
              <span className="text-primary shrink-0">✓</span>
              <span>
                <span className="text-base-content">{r.label}</span>
                {detail ? ` — ${detail}` : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
