import { Badge, Card, CardBody, CardTitle, Heading, Text } from '@wizeworks/silicaui-react';

/**
 * The "pain" beat — a sticky headline column paired with a stack of Cards.
 * Pure silicaui (Badge/Card/Heading/Text) in a plain Tailwind max-width
 * wrapper, with `size="display"` plus a `text-*` class carrying the headline
 * scale.
 */
/**
 * The arc, as three cards: Scattered → Complicated → Connected, colored
 * error → warning → success. The color IS the argument — it is what makes the
 * three read as a progression rather than three parallel complaints — so the
 * chip stays. What moved is WHERE: it used to sit above the card title, which
 * is the eyebrow slot, and a badge in the eyebrow slot is the same
 * anti-pattern wearing a component. It now trails the copy as a verdict on the
 * card, which is what a badge is actually for: state on a thing.
 */
const PAINS = [
  {
    state: 'Scattered',
    title: 'Your customers live in one app. Their order lives in another.',
    body: 'Every disconnected tool is another place to search, another bill to pay, and another chance for something important to fall through.',
    color: 'error',
  },
  {
    state: 'Complicated',
    title: 'Every new tool solved one problem, and created another.',
    body: 'Evenings go to syncing lists, patching automations, updating stock counts, and figuring out which report is actually telling the truth.',
    color: 'warning',
  },
  {
    state: 'Connected',
    title: "Growth shouldn't make your business more complicated.",
    body: 'One story. One platform. One connected system that grows with you, so you can focus on building your business instead of managing software.',
    color: 'success',
  },
] as const;

export function LandingStory() {
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
              long, running the business meant managing software instead of serving customers.
            </Text>
          </div>

          <div className="flex flex-col gap-4">
            {PAINS.map((p) => (
              <Card key={p.state}>
                <CardBody>
                  <div className="flex flex-col items-start gap-5">
                    <div className="flex flex-col gap-2">
                      <CardTitle className="text-2xl">{p.title}</CardTitle>
                      <Text className="max-w-xl">{p.body}</Text>
                    </div>
                    <Badge color={p.color} variant="soft" size="lg" className="shrink-0">
                      {p.state}
                    </Badge>
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
