// The hero's "product in use" device — a faithful small business vignette
// (window chrome + AI check-in card) standing in for the mockup's business
// demo card. Split out of hero.tsx so the headline column and the device
// illustration stay independently readable/editable.

/** Window-chrome traffic lights — device mimicry, so they use the fixed Tailwind
 *  palette rather than theme tokens (a real macOS bar doesn't theme-flip). */
const TRAFFIC_LIGHTS = ['bg-red-400', 'bg-amber-400', 'bg-green-500'];

export function BusinessDemoCard() {
  return (
    <div className="relative">
      <div className="bg-base-100 overflow-hidden rounded-[22px] shadow-2xl">
        <div className="border-base-300 flex items-center gap-[7px] border-b px-4 py-[13px]">
          {TRAFFIC_LIGHTS.map((c) => (
            <span key={c} className={`h-2.5 w-2.5 rounded-full ${c}`} />
          ))}
          <span className="text-ink-subtle text-micro ml-auto font-medium">
            Bloom &amp; Co. &middot; sparx Assistant
          </span>
        </div>

        <div className="flex flex-col gap-[22px] p-6">
          <div className="flex items-start justify-between">
            <h3 className="text-base-content text-h4 m-0 font-medium tracking-[-0.02em]">
              Good morning, Jess.
            </h3>
            {/* Status signal — silica's own `soft` wash, not a hand-rolled color-mix. */}
            <span className="bg-success bg-soft text-success text-micro rounded-full px-2.5 py-1.5 font-medium whitespace-nowrap">
              Business online
            </span>
          </div>

          <p className="text-base-content m-0 text-[clamp(20px,2.4vw,26px)] leading-[1.15] font-medium tracking-[-0.02em]">
            &ldquo;What needs my attention today?&rdquo;
          </p>

          <div className="bg-base-200 border-base-300 rounded-2xl border p-[18px]">
            <p className="text-base-content text-small m-0 mb-2 font-medium">
              Three things. I&apos;ve already handled two.
            </p>
            <p className="text-ink-muted text-caption m-0">
              Saturday inventory is running low, a caf&eacute; asked about wholesale pricing, and
              yesterday&apos;s abandoned carts are ready for a follow-up.
            </p>
            <div className="mt-3.5 grid grid-cols-2 gap-2.5">
              <DemoAction label="Review inventory" sub="12 bundles remaining" />
              <DemoAction label="Open wholesale lead" sub="$620 potential order" />
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {/* Legend for the activity feed below — labels a functional group, not
                an eyebrow introducing a heading. */}
            <span className="text-ink-subtle text-micro font-medium tracking-[0.1em] uppercase">
              Handled by sparx
            </span>
            <ActivityRow text="Sent pickup reminders to 14 customers" />
            <ActivityRow text="Published today's availability to your site" />
          </div>
        </div>
      </div>

      <div className="mkt-hide-on-mobile bg-secondary text-secondary-content absolute right-[-28px] bottom-9 w-[150px] rotate-[-4deg] rounded-2xl p-4 shadow-2xl">
        <span className="text-micro block">This week</span>
        <span className="my-0.5 block text-[28px] font-bold tracking-[-0.03em]">+24%</span>
        <span className="text-micro block">online orders</span>
      </div>
    </div>
  );
}

function DemoAction({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="bg-base-100 border-base-300 rounded-[10px] border p-3 text-left">
      <span className="text-base-content text-mini block font-medium">{label}</span>
      <span className="text-ink-subtle text-micro mt-0.5 block">{sub}</span>
    </div>
  );
}

function ActivityRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="bg-primary text-primary-content inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px]">
        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 12L10 17L19 7"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="text-ink-muted text-caption">{text}</span>
    </div>
  );
}
