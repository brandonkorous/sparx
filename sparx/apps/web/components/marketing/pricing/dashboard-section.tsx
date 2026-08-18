import { Heading, Text } from '@wizeworks/silicaui-react';
import { WorkbenchFrame } from '../workbench-showcase';

/**
 * "One bill. One login. One place." — the pricing page's one real product-proof
 * beat, and its only imagery moment. Placed right after the switchboard: once
 * the reader has priced their stack, this shows the single workspace every
 * module they switched on actually lives inside — so "one platform, one invoice"
 * is something they can see, not just a claim.
 *
 * `WorkbenchFrame` is the same faithful recreation of the real app shell that
 * landing's "open at once" beat uses — the MDI workbench, every module tiled
 * side by side. Only this shell (indigo `bg-primary` band + headline + lede) is
 * on silicaui.
 */
export function PricingDashboardSection() {
  return (
    <section className="bg-primary text-primary-content m-6 rounded-4xl px-6 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div className="max-w-2xl">
          <Heading
            level={2}
            size="display"
            className="text-6xl leading-[0.95] tracking-tight sm:text-7xl"
          >
            One bill. One login.
            <br />
            One place.
          </Heading>
          <Text variant="lead" className="text-primary-content mt-5 max-w-xl text-2xl">
            Whatever you switch on opens in the same workspace — your site, orders, customers and
            email side by side, no extra seats, no new logins, no tab-hopping. This is the one
            product every module lives inside.
          </Text>
        </div>
        <WorkbenchFrame />
      </div>
    </section>
  );
}
