import { AREA_LABELS, PIGGLES_AREAS, type AreaId, type ComparePage } from '@/content/compare';
import { HeroPanel, HeroPanelBar, HeroRows } from '../hero/panel';
import { OfferBadge } from './offer-badge';

// The fold for /compare/<slug>: the rows where the two genuinely differ, both
// answers side by side. Rows where both say "built in" are left for the full
// table, because a figure of matching badges says nothing.

export function CompareFigure({ page }: { page: ComparePage }) {
  const differ = (Object.keys(PIGGLES_AREAS) as AreaId[])
    // An unconfirmed row is not a difference: it is a fact we do not have.
    .filter(
      (id) =>
        page.areas[id].offer !== 'unconfirmed' && PIGGLES_AREAS[id].offer !== page.areas[id].offer
    )
    .slice(0, 6);
  return (
    <HeroPanel>
      <HeroPanelBar app="home" title={`Piggles and ${page.name}`} note="Where they differ" />
      <div className="border-base-300 grid grid-cols-[1fr_6rem_8.5rem] gap-x-4 border-b px-5 py-2.5 text-sm font-bold">
        <span>What you need</span>
        <span>Piggles</span>
        <span>{page.name}</span>
      </div>
      <HeroRows>
        {differ.map((id) => (
          <div key={id} className="grid grid-cols-[1fr_6rem_8.5rem] items-center gap-x-4 px-5 py-3">
            <b className="text-base font-semibold">{AREA_LABELS[id]}</b>
            <OfferBadge offer={PIGGLES_AREAS[id].offer} />
            <OfferBadge offer={page.areas[id].offer} />
          </div>
        ))}
      </HeroRows>
    </HeroPanel>
  );
}
