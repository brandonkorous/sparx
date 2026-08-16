import { faCheck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

/**
 * The confirmation somebody actually receives.
 *
 * Sized to FIT the phone frame — 240×506 of display, and the first version ran
 * 117px past the bottom, which put the one brand-coloured button in the scene
 * off the end of the screen. A preview that gets cut off is worse than no
 * preview: it shows the palette failing at something it was not asked to do.
 */
const DETAILS: [string, string][] = [
  ['When', 'Thursday, 2:30pm'],
  ['Where', '14 Bridge Street'],
  ['Paid', '$45.00 deposit'],
];

export function PhoneScene() {
  return (
    <div className="flex min-h-full flex-col bg-[var(--pal-base-100)] text-[var(--pal-base-content)]">
      <div className="bg-[var(--pal-primary)] px-5 pt-10 pb-6 text-center text-[var(--pal-primary-content)]">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--pal-primary-content)]">
          <Icon glyph={faCheck} aria-hidden className="size-6 text-[var(--pal-primary)]" />
        </span>
        <p className="mt-3 text-xl font-extrabold">You&rsquo;re booked in</p>
        <p className="mt-1 text-sm font-semibold">We&rsquo;ll text you the day before.</p>
      </div>

      <dl className="grow px-5 py-2">
        {DETAILS.map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-3 border-b border-[var(--pal-line)] py-3 last:border-b-0"
          >
            <dt className="text-base font-semibold text-[var(--pal-quiet)]">{label}</dt>
            <dd className="text-base font-bold">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="px-5 pb-6">
        <span className="rounded-selector mb-3 inline-block bg-[var(--pal-accent)] px-3 py-1 text-xs font-bold text-[var(--pal-accent-content)]">
          Free to move up to 24 hours before
        </span>
        <span className="rounded-field block bg-[var(--pal-primary)] py-3 text-center text-base font-bold text-[var(--pal-primary-content)]">
          Add to my calendar
        </span>
      </div>
    </div>
  );
}
