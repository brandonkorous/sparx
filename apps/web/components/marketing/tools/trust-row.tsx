import { ShieldCheck, MonitorSmartphone, Gift } from 'lucide-react';

/**
 * The reassurance row shared by the hub and every tool page. The whole pitch of
 * the tools surface is "these don't suck" — and the reason the online ones do is
 * uploads, sign-up walls, and watermarks. This states the opposite, plainly.
 */
const TRUST = [
  { icon: MonitorSmartphone, label: 'Runs in your browser' },
  { icon: ShieldCheck, label: 'Nothing is uploaded' },
  { icon: Gift, label: 'Free — no sign-up' },
] as const;

export function TrustRow({ style }: { style?: React.CSSProperties }) {
  return (
    <ul
      className="mkt-cluster"
      style={{ gap: '10px 18px', listStyle: 'none', margin: '6px 0 0', padding: 0, ...style }}
    >
      {TRUST.map((item) => (
        <li key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <item.icon size={15} strokeWidth={1.7} style={{ color: 'var(--color-success)' }} />
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
            }}
          >
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
