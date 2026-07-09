import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Badge, Button, Card, CardActions, CardBody, CardTitle } from '@wizeworks/silicaui-react';
import { ModuleProvider } from '@sparx/ui';
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
      <Card className="bg-module bg-soft flex h-full flex-col">
        <CardBody className="flex h-full flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span aria-hidden className="text-module">
                <Icon className="h-4 w-4" />
              </span>
              <CardTitle>{title}</CardTitle>
            </div>
            <Badge color="module" variant="soft">
              Available
            </Badge>
          </div>
          <p className="text-base-content/70 flex-1 text-sm">{pitch}</p>
          <CardActions className="justify-start">
            {canActivate ? (
              <Button
                color="module"
                variant="solid"
                size="sm"
                iconStart={<Plus className="h-3.5 w-3.5" />}
                render={<Link href="/settings/modules" />}
              >
                Turn on {title}
              </Button>
            ) : (
              <p className="text-base-content/70 text-sm">Ask an owner to turn on {title}.</p>
            )}
          </CardActions>
        </CardBody>
      </Card>
    </ModuleProvider>
  );
}
