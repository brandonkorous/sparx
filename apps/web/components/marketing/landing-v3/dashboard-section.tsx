import { Heading, Text } from '@wizeworks/silicaui-react';
import { DashboardFrame } from '../dashboard-showcase';

/**
 * "One pane of glass" — the product-proof beat. `DashboardFrame` is a
 * faithful, CSS-only-interactive recreation of the real app shell (not
 * editorial marketing type), so it's reused byte-for-byte; only this shell
 * (backdrop/headline/lede) is rebuilt on silicaui.
 */
export function LandingV3DashboardSection() {
    return (
        <section className="bg-primary m-6 rounded-4xl px-6 py-24 sm:px-8 lg:py-32">
            <div className="mx-auto flex max-w-7xl flex-col gap-16">
                <div className="max-w-3xl">
                    <Heading
                        level={2}
                        size="display"
                        className="text-primary-content text-6xl leading-[0.95] tracking-tight sm:text-7xl"
                    >
                        One pane of glass.
                    </Heading>
                    <Text variant="lead" className="text-primary-content/85 mt-5 text-2xl">
                        sparx is one URL, one login, one sidebar. Each active module gets a colored nav item and
                        a module-tinted card — you always know where you are.
                    </Text>
                </div>
                <DashboardFrame />
            </div>
        </section>
    );
}
