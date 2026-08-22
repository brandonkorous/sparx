import Link from 'next/link';
import { Section } from '@piggles/ui';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { PRICE_LABEL } from '@piggles/config/pricing';
import type { PigglesTool } from './registry';
import { toolAppLabel } from './registry';

/**
 * The close: what carries on where the tool stops.
 *
 * ── WHY THIS IS ONE SENTENCE AND TWO BUTTONS ────────────────────────────────
 *
 * The pitch already happened — it is the photograph band above, where the
 * headline and the argument sit next to a picture of somebody doing the work.
 * Repeating it here in a card with an icon was the earlier version, and it made
 * the same point twice in two visual registers, which is how a page starts
 * reading as padding.
 *
 * So this is the fact and the door: it is included, here is where to look. One
 * line, set large, because it is the single most persuasive thing on the page
 * and it was previously the small print under a paragraph.
 *
 * ── AND WHY THE FACT IS THE HEADLINE ────────────────────────────────────────
 *
 * Every equivalent block on a competitor's free tool says "upgrade to unlock".
 * Piggles has no upgrade — one plan, every app in it (CLAUDE.md RULE #2) — and
 *"this is included" is a stronger sentence than "this is available". Setting it
 * at heading scale rather than burying it is the whole design of this block.
 */
export function ToolLadder({ tool }: { tool: PigglesTool }) {
  const label = toolAppLabel(tool);

  return (
    <Section>
      <div className="grid items-end gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
        <h2 className="text-3xl leading-tight font-extrabold text-balance sm:text-4xl lg:text-5xl">
          {label} is not an add-on and not an upgrade. It is{' '}
          <span className="">one of fifteen apps</span> in the same {PRICE_LABEL} a month.
        </h2>

        <div className="flex flex-wrap gap-3 lg:justify-end">
          <Link
            className={buttonClasses({ color: 'module', size: 'lg' })}
            href={`/apps/${tool.app}`}
          >
            {`See what ${label} does`}
          </Link>
          <Link
            className={buttonClasses({ color: 'neutral', variant: 'outline', size: 'lg' })}
            href="/apps"
          >
            All fifteen
          </Link>
        </div>
      </div>
    </Section>
  );
}
