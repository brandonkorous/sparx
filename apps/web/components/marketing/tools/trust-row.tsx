import { ShieldCheck, MonitorSmartphone, Gift } from 'lucide-react';

/**
 * The reassurance row shared by the hub and every tool page. The whole pitch of
 * the tools surface is "these don't suck" — and the reason the online ones do is
 * uploads, sign-up walls, and watermarks. This states the opposite, plainly.
 *
 * Class-based per apps/web: the check icons wear `text-success` (the semantic
 * token) and the labels `text-ink-muted` (real ink, never a faded opacity).
 */
const TRUST = [
  { icon: MonitorSmartphone, label: 'Runs in your browser' },
  { icon: ShieldCheck, label: 'Nothing is uploaded' },
  { icon: Gift, label: 'Free — no sign-up' },
] as const;

export function TrustRow({
  className,
  tone = 'default',
}: {
  className?: string;
  /**
   * `oncolor` for the saturated hero bands, where the neutral ink tokens
   * (`text-ink-muted`, `text-success`) resolve against `base-100` and would be
   * unreadable. It inherits the band's `*-content` foreground at FULL strength —
   * hierarchy comes from size, never from fading the copy.
   */
  tone?: 'default' | 'oncolor';
}) {
  const onColor = tone === 'oncolor';
  return (
    <ul
      className={[
        'm-0 mt-1.5 flex list-none flex-wrap items-center gap-x-[18px] gap-y-2.5 p-0',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {TRUST.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-2">
          <item.icon
            size={15}
            strokeWidth={1.7}
            className={onColor ? 'shrink-0' : 'text-success shrink-0'}
          />
          <span
            className={onColor ? 'text-small font-sans' : 'text-caption text-ink-muted font-sans'}
          >
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
