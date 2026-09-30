import { faCheck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PigglesMascot } from '@piggles/mascot/react';
import { APP_BY_ID } from '@piggles/config';
import type { TradePage } from '@/content/trades/types';
import { HeroPanel, HeroPanelBar } from '../hero/panel';

// The fold for /for/<trade>: this trade's workspace as a window, one row per app
// it leans on, each carrying what that app does for THIS trade.

export function TradeFigure({ trade }: { trade: TradePage }) {
  const first = trade.leans[0];
  if (!first) return null;
  return (
    <div className="flex flex-col">
      <HeroPanel>
        <HeroPanelBar app={first} title={`Piggles for ${trade.plural.toLowerCase()}`} />
        <ul className="divide-base-300 grid divide-y">
          {trade.inDepth.map((d) => {
            const app = APP_BY_ID[d.app];
            if (!app) return null;
            return (
              <li key={d.app} data-group={app.group} className="flex items-start gap-3 px-5 py-4">
                <span className="bg-module text-module-content mt-0.5 grid size-5 shrink-0 place-items-center rounded-full">
                  <Icon glyph={faCheck} aria-hidden className="size-2.5" />
                </span>
                <span>
                  <span className="ink-module block text-sm font-bold">{app.label}</span>
                  <span className="block text-base font-semibold">{d.heading}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </HeroPanel>
      {/* Below the window, never over it: laid on top it covered a row of text. */}
      <PigglesMascot pose={trade.pose} size="sm" className="mt-4 self-end max-sm:hidden" />
    </div>
  );
}
