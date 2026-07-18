import { Badge, Card, CardBody, CardTitle, Heading, Text } from '@wizeworks/silicaui-react';

/**
 * The "pain" beat — a sticky headline column paired with a stack of Cards.
 * Same copy as v2; v2 was already nearly pure silicaui (Badge/Card/Heading/
 * Text), so the only changes are dropping the `Container` primitive for a
 * plain Tailwind max-width wrapper and dropping the custom `heading-style.ts`
 * font-size override for a plain `text-*` class on top of `size="display"`.
 */
const PAINS = [
  {
    num: 'Scattered',
    title: 'Your customers live in one app. Their order lives in another.',
    body: 'Every disconnected tool is another place to search, another bill to pay, and another chance for something important to fall through.',
    color: 'error',
  },
  {
    num: 'Complicated',
    title: 'Every new tool solved one problem, and created another.',
    body: 'Evenings go to syncing lists, patching automations, updating stock counts, and figuring out which report is actually telling the truth.',
    color: 'warning',
  },
  {
    num: 'Connected',
    title: "Growth shouldn't make your business more complicated.",
    body: 'One story. One platform. One connected system that grows with you, so you can focus on building your business instead of managing software.',
    color: 'success',
  },
];

export function LandingV3Story() {
  return (
    <section className="px-6 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
          <div className="flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
            <Heading
              level={2}
              size="display"
              className="text-6xl leading-[0.95] tracking-tight sm:text-7xl"
            >
              Your business grew.
              <br />
              So did the mess.
            </Heading>
            <Text variant="lead" className="max-w-xl text-2xl">
              Every new customer brought another tool. Every new tool brought another login. Before
              long, running the business meant managing software instaed of servicng customers.
            </Text>
          </div>

          <div className="flex flex-col gap-4">
            {PAINS.map((p) => (
              <Card key={p.num}>
                <CardBody>
                  <div className="flex flex-col items-start gap-5">
                    <Badge color={p.color} variant="soft" size="lg" className="shrink-0">
                      {p.num}
                    </Badge>
                    <div className="flex flex-col gap-2">
                      <CardTitle className="text-2xl">{p.title}</CardTitle>
                      <Text className="max-w-xl">{p.body}</Text>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
