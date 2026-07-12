import { Badge, Card, CardBody, Text } from '@wizeworks/silicaui-react';

/**
 * The hero's "product in use" device — a small business vignette (window
 * chrome + AI check-in card) standing in for a live product screenshot.
 * Built entirely from silicaui (Card/Badge/Text) + Tailwind utilities and
 * real `--color-*` theme tokens — no inline style objects, no hardcoded hex
 * beyond the three literal macOS traffic-light dots, which depict a real OS
 * convention rather than anything themeable.
 */
export function BusinessDemoCard() {
    return (
        <div className="relative">
            <Card className="overflow-hidden shadow-2xl" data-theme="light">
                <div className="border-base-300 flex items-center gap-1.5 border-b px-4 py-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                    <Text variant="caption" className="ml-auto font-medium">
                        Bloom &amp; Co.
                    </Text>
                </div>

                <CardBody className="gap-5">
                    <div className="flex items-start justify-between gap-3">
                        <Text as="h3" className="text-base-content text-xl font-medium tracking-tight">
                            Good morning, Jess.
                        </Text>
                        <Badge color="success" variant="soft" className="shrink-0">
                            Business online
                        </Badge>
                    </div>

                    <Text className="text-base-content text-2xl leading-tight font-medium tracking-tight">
                        &ldquo;What needs my attention today?&rdquo;
                    </Text>

                    <div className="bg-base-200 border-base-300 rounded-box border p-4.5">
                        <Text className="text-base-content mb-2 font-medium">
                            Three things. I&apos;ve already handled two.
                        </Text>
                        <Text variant="caption" className="leading-relaxed">
                            Saturday inventory is running low, a caf&eacute; asked about wholesale pricing, and
                            yesterday&apos;s abandoned carts are ready for a follow-up.
                        </Text>
                        <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                            <DemoAction label="Review inventory" sub="12 bundles remaining" />
                            <DemoAction label="Open wholesale lead" sub="$620 potential order" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2.5">
                        <Text variant="caption">Handled by sparx</Text>
                        <ActivityRow text="Sent pickup reminders to 14 customers" />
                        <ActivityRow text="Published today's availability to your site" />
                    </div>
                </CardBody>
            </Card>

            <Card className="bg-secondary text-secondary-content absolute -right-7 bottom-9 hidden w-[150px] rotate-[-4deg] shadow-2xl sm:block">
                <CardBody className="gap-0.5 p-4">
                    <span className="text-sm opacity-85">This week</span>
                    <span className="text-[28px] leading-none font-bold tracking-tight">+24%</span>
                    <span className="text-sm opacity-85">online orders</span>
                </CardBody>
            </Card>
        </div>
    );
}

function DemoAction({ label, sub }: { label: string; sub: string }) {
    return (
        <div className="bg-base-100 border-base-300 rounded-field border p-3 text-left">
            <Text as="span" className="text-base-content block text-sm font-medium">
                {label}
            </Text>
            <Text as="span" variant="caption" className="mt-0.5 block">
                {sub}
            </Text>
        </div>
    );
}

function ActivityRow({ text }: { text: string }) {
    return (
        <div className="flex items-center gap-2.5">
            <span className="bg-primary flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md">
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                        d="M5 12L10 17L19 7"
                        stroke="var(--color-primary-content)"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </span>
            <Text variant="caption">{text}</Text>
        </div>
    );
}
