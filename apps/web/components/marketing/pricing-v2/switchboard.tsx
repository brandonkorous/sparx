import { PricingSwitchboard } from '../pricing-switchboard';

/**
 * The interactive centerpiece — reused byte-for-byte (PricingSwitchboard /
 * ModuleToggleCard / StackSummaryCard), placed at beat 3 rather than the top:
 * after the money beat, the reader knows exactly what they're pricing against.
 *
 * It sits on a full-bleed saturated `bg-accent` (violet) island — the same
 * band treatment landing-v3's switchboard uses — so this first big interactive
 * moment carries real visual weight instead of sitting on plain white. The
 * shared component keeps its own dark-ink heading, which reads cleanly on the
 * lighter violet (~6.6:1), and its white toggle cards pop off the band. No
 * `data-theme` scoping is needed: the band is saturated but the component's own
 * light cards + dark heading resolve correctly in the base (light) theme.
 */
export function PricingV2Switchboard() {
  return (
    <section id="switchboard" className="bg-accent m-6 rounded-4xl px-6 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <PricingSwitchboard />
      </div>
    </section>
  );
}
