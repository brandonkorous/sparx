/**
 * A shop, wearing the palette.
 *
 * Colours are painted from the role variables the scene wrapper sets, never from
 * a token — the whole point is that these are the visitor's colours, and no
 * token will ever know what they are.
 */

const NAV = ['Shop', 'About', 'Stockists'];

const ITEMS = [
  { name: 'Sourdough loaf', price: '$7.50', tag: 'Fresh today' },
  { name: 'Cinnamon buns, six', price: '$14.00', tag: null },
  { name: 'Rye & caraway', price: '$8.25', tag: 'Two left' },
];

function ShopHeader() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-[var(--pal-line)] px-6 py-4">
      <div className="flex items-center gap-2">
        <span className="size-6 rounded-full bg-[var(--pal-primary)]" />
        <span className="text-lg font-extrabold">Hearth &amp; Crumb</span>
      </div>
      <nav className="flex items-center gap-5 text-sm font-semibold max-sm:hidden">
        {NAV.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </nav>
      <span className="rounded-field bg-[var(--pal-primary)] px-4 py-2 text-sm font-bold text-[var(--pal-primary-content)]">
        Basket · 2
      </span>
    </header>
  );
}

function ShopHero() {
  return (
    <div className="grid items-center gap-6 px-6 py-10 sm:grid-cols-[1.2fr_1fr]">
      <div>
        <h3 className="text-3xl leading-tight font-extrabold text-balance sm:text-4xl">
          Baked before you were awake.
        </h3>
        <p className="mt-3 text-base text-[var(--pal-quiet)]">
          Collection from seven, delivery across town until two.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <span className="rounded-field bg-[var(--pal-primary)] px-5 py-3 text-base font-bold text-[var(--pal-primary-content)]">
            Order for tomorrow
          </span>
          {/* The second button is `secondary`, not an outline — it is the one
              place on a page where that role has an obvious job. */}
          <span className="rounded-field bg-[var(--pal-secondary)] px-5 py-3 text-base font-bold text-[var(--pal-secondary-content)]">
            See the menu
          </span>
        </div>
      </div>
      <div className="rounded-box flex h-40 items-end bg-[var(--pal-accent)] p-4">
        <span className="rounded-selector bg-[var(--pal-accent-content)] px-3 py-1 text-xs font-bold text-[var(--pal-accent)]">
          This week
        </span>
      </div>
    </div>
  );
}

export function ShopScene() {
  return (
    <div className="bg-[var(--pal-base-100)] text-[var(--pal-base-content)]">
      <ShopHeader />
      <ShopHero />
      <div className="grid gap-4 px-6 pb-8 sm:grid-cols-3">
        {ITEMS.map((item) => (
          <div key={item.name} className="rounded-box border border-[var(--pal-line)] p-4">
            <div className="rounded-field mb-3 h-16 bg-[var(--pal-line)]" />
            <p className="text-base font-bold">{item.name}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-base font-extrabold">{item.price}</span>
              {item.tag ? (
                <span className="rounded-selector bg-[var(--pal-accent)] px-2 py-1 text-xs font-bold text-[var(--pal-accent-content)]">
                  {item.tag}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
