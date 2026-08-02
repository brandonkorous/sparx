// One bootcamp as a directory card (docs/114 §B.6). Presentational + no client
// state (usable from the SSR directory AND the client load-more island — imports
// only TYPES/helpers). The whole card links to the detail page. Shows the format
// pill, seats-remaining when capped, title, dates + location, and the host
// partner with their tier badge. Accent = the sparx primary brand color.

import { Badge } from '@wizeworks/silicaui-react';
import { TIER_META } from '@/lib/partners';
import {
  bootcampDates,
  bootcampLocation,
  bootcampPrice,
  FORMAT_LABEL,
  seatsLabel,
  type BootcampCard as Card,
} from '@/lib/bootcamp';

export function BootcampDirectoryCard({ bootcamp }: { bootcamp: Card }) {
  const seats = seatsLabel(bootcamp);
  const tier = TIER_META[bootcamp.host.tier];
  const price = bootcampPrice(bootcamp);

  return (
    <a
      href={`/bootcamp/${bootcamp.slug}`}
      className="border-base-300 bg-base-100 flex w-full flex-col gap-3.5 rounded-xl border p-6 text-inherit no-underline"
    >
      <div className="flex items-center justify-between gap-2.5">
        <Badge color="primary" variant="soft" size="sm" className="font-mono">
          {FORMAT_LABEL[bootcamp.format]}
        </Badge>
        {seats ? (
          <span className={seats.full ? 'text-warning text-sm' : 'text-sm'}>{seats.text}</span>
        ) : (
          <span className="text-sm">{price}</span>
        )}
      </div>

      <h3 className="m-0 text-lg font-medium tracking-[-0.015em]">{bootcamp.title}</h3>

      <div className="flex flex-col gap-[5px] text-sm">
        <span>{bootcampDates(bootcamp)}</span>
        <span>{bootcampLocation(bootcamp)}</span>
      </div>

      <div className="border-base-300 mt-auto flex items-center gap-2 border-t pt-3.5 text-sm">
        <Badge color={tier.color} variant="soft" size="sm">
          {tier.label}
        </Badge>
        {bootcamp.host.displayName}
      </div>
    </a>
  );
}
