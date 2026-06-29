import Link from 'next/link';
import { Plus } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  ModuleProvider,
  Stack,
  Text,
} from '@sparx/ui';
import type { ModuleSlug } from '@sparx/auth';

import { moduleCatalog } from '@/components/module-catalog';

// Finance hub upsell (docs/109 §4) — Finance doubles as the platform's highest-intent
// upsell surface. It's the one screen every tenant opens to look at money, so when a
// way to *get paid* is switched off, the "You get paid" group invites turning it on
// instead of leaving a blank column. A content-only publisher's "You get paid" group
// becomes a tasteful row of what they could switch on; a commerce shop sees at most a
// trailing card or two ("you could also sell wholesale").
//
// Each card wears its TARGET module's hue via a nested <ModuleProvider> (color-follows-
// functionality: a Commerce pitch is orange, Invoicing lime, B2B slate) so it reads as
// "this other capability," visually distinct from the green finance signal cards beside
// it. Honest to "modules, not plans": the CTA activates a MODULE at /settings/modules,
// never a tier — and the hub only renders a card for a module that is genuinely OFF
// (isModuleEnabled false), never one that's on-but-quiet, so it never nags.

// The money-in modules, in display order. Each is a distinct way revenue reaches the
// tenant; `pitch` frames that specific inflow in money terms.
export const MONEY_IN_UPSELLS: { module: ModuleSlug; pitch: string }[] = [
  {
    module: 'commerce',
    pitch:
      'Take card payments at checkout — a product catalog, cart, and Stripe-powered payments on your site.',
  },
  {
    module: 'invoicing',
    pitch:
      'Bill customers line by line — estimates, work orders, and invoices with deposits, payments, and AR aging.',
  },
  {
    module: 'b2b',
    pitch:
      'Sell wholesale on net terms — company accounts, custom price lists, quotes, and Net 30/60 invoicing.',
  },
];

export function FinanceUpsellCard({
  module,
  pitch,
  canActivate,
}: {
  module: ModuleSlug;
  pitch: string;
  canActivate: boolean;
}) {
  const { Icon, title } = moduleCatalog[module];
  return (
    <ModuleProvider module={module} className="h-full">
      <Card variant="module" className="flex h-full flex-col">
        <CardHeader>
          <Stack direction="row" align="center" gap={2} className="justify-between">
            <Stack direction="row" align="center" gap={2}>
              <span aria-hidden className="text-[var(--module-active)]">
                <Icon className="h-4 w-4" />
              </span>
              <CardTitle>{title}</CardTitle>
            </Stack>
            <Badge color="module" variant="soft">
              Available
            </Badge>
          </Stack>
        </CardHeader>
        <CardContent className="flex-1">
          <Text size="sm" variant="muted">
            {pitch}
          </Text>
        </CardContent>
        <CardFooter>
          {canActivate ? (
            <Button color="module" variant="solid" size="sm" asChild>
              <Link href="/settings/modules">
                <Plus className="mr-1 h-3.5 w-3.5" />
                Turn on {title}
              </Link>
            </Button>
          ) : (
            <Text size="sm" variant="muted">
              Ask an owner to turn on {title}.
            </Text>
          )}
        </CardFooter>
      </Card>
    </ModuleProvider>
  );
}
