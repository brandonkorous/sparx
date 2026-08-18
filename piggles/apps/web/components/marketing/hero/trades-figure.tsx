import Image from 'next/image';

// /who-its-for — four rooms, and none of them look alike.
//
// The page argues that eleven trades are more similar than they look, and it
// opened with a paragraph making that claim. Four photographs make the opposite
// case first, which is the one the reader already believes — a bakery counter, a
// barber's chair, a car on a lift and clay on a wheel have nothing in common —
// and the page then spends itself taking that apart. A hero that agreed with the
// conclusion up front would have nothing left to turn.
//
// ── THE FOUR ARE THE FOUR SHAPES ────────────────────────────────────────────
//
// Chosen to match the page's own ordering note: selling goods, selling time,
// selling a service with parts in it, and selling something made once. Every
// other trade on the page is a variation on one of these, so this is the
// argument's spine rather than four pictures that looked good together.
//
// ── ALT TEXT DESCRIBES THE FRAME ────────────────────────────────────────────
//
// Taken verbatim from the subject column in public/photos/README.md, which
// records what is actually IN each file — the folder exists partly because a
// caption once got written from a filename and shipped describing a photograph
// nobody had opened.
//
// These are the first use of the trade photography anywhere on the site. Ten
// files, 3:2, CC0, sitting in public/photos since the folder was made and
// referenced by nothing.

const TRADES = [
  {
    src: '/photos/bakery.jpg',
    alt: 'Loaves on a bakery counter',
    shows: 'Sells the same forty things every morning',
  },
  {
    src: '/photos/barber.jpg',
    alt: "A barber finishing a client's cut",
    shows: 'Sells Tuesday at half past three',
  },
  {
    src: '/photos/garage.jpg',
    alt: 'A car on a lift above a working bench of tools',
    shows: 'Sells a job, a pile of parts and an invoice',
  },
  {
    src: '/photos/pottery.jpg',
    alt: 'Clay-covered hands shaping a pot on a wheel',
    shows: 'Sells a thing that exists once',
  },
];

export function TradesFigure() {
  return (
    // Not a <HeroPanel>: the photographs ARE the surface here, and putting a
    // white frame with a caption strip around them would leave four small
    // pictures inside a big empty card. The grid rounds and lifts on its own.
    <ul className="rounded-section grid grid-cols-2 gap-1.5 overflow-hidden shadow-xl">
      {TRADES.map((trade) => (
        <li key={trade.src} className="bg-base-100 relative">
          <Image
            src={trade.src}
            alt={trade.alt}
            width={1600}
            height={1067}
            sizes="(min-width: 1024px) 22vw, 45vw"
            className="aspect-[4/3] h-full w-full object-cover"
          />
          {/* A dark theme island rather than a black overlay: the ink resolves
              against the island's own palette, so the caption is correct without
              a color being named or an opacity being guessed at. */}
          <p
            data-theme="dark"
            className="bg-base-300/85 text-base-content absolute inset-x-0 bottom-0 px-3 py-2 text-sm font-semibold text-balance"
          >
            {trade.shows}
          </p>
        </li>
      ))}
    </ul>
  );
}
