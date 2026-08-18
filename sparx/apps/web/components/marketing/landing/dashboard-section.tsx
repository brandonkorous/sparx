import { Heading, Text } from '@wizeworks/silicaui-react';
import { WorkbenchFrame } from '../workbench-showcase';

/**
 * "Your whole business, open at once" — the product-proof beat. sparx is a
 * single workspace (the MDI workbench), so the visual is a faithful, CSS-light
 * recreation of the real app shell showing several modules tiled side by side.
 * The frame is a functional UI recreation, not editorial marketing type, so
 * only this shell (band/headline/lede) is rebuilt on silicaui.
 *
 * This REPLACES the retired single-pane dashboard beat, whose "one sidebar, you
 * always know where you are" copy the workbench no longer makes true — you are
 * in several places at once now, and that is the stronger story.
 */
export function LandingDashboardSection() {
  return (
    <section className="bg-primary m-6 rounded-4xl px-6 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto flex max-w-7xl flex-col gap-16">
        <div className="max-w-3xl">
          <Heading
            level={2}
            size="display"
            className="text-primary-content text-6xl leading-[0.95] tracking-tight sm:text-7xl"
          >
            Your whole business, open at once.
          </Heading>
          <Text variant="lead" className="text-primary-content mt-5 text-2xl">
            One login opens one workspace — and inside it your site, orders, customers and messages
            sit side by side, not buried in eight browser tabs. Pull a screen onto a second monitor,
            keep the rest in view. It&rsquo;s every part of sparx, on one pane of glass.
          </Text>
        </div>
        <WorkbenchFrame />
      </div>
    </section>
  );
}
