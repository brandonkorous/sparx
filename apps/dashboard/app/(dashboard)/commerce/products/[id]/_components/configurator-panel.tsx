import Link from 'next/link';
import { ChevronRight, Plus, Settings2 } from 'lucide-react';

import { Badge, Button, Card, CardBody, EmptyState } from 'silicaui-react';
import { statusLabel, statusTone } from '@sparx/ui';

export interface ConfiguratorTemplateRow {
  id: string;
  name: string;
  status: string;
  optionCount: number;
  ruleCount: number;
  addOnCount: number;
  updatedAt: string;
}

// The product's Configurator tab — the live per-product view of the configurator
// module (docs/09). Templates resolve a shopper's option/rule/add-on selections
// into a cart line; they are bound to this product, so they're surfaced here with
// a create path that pre-binds the product, plus a link into the full editor.
export function ConfiguratorPanel({
  productId,
  templates,
}: {
  productId: string;
  templates: ConfiguratorTemplateRow[];
}) {
  const newHref = `/commerce/configurator/new?product=${productId}`;

  if (templates.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState
            icon={<Settings2 className="h-5 w-5" />}
            title="No configuration yet"
            description="Make this a built-to-order product: a configurator template binds options, rules, and add-ons, then resolves a shopper's selections into a cart line."
            actions={
              <Button
                color="module"
                render={<Link href={newHref} />}
                iconStart={<Plus className="h-4 w-4" />}
              >
                Create configuration
              </Button>
            }
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <div className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Configuration</h3>
            <p className="opacity-70">
              Templates that resolve options, rules, and add-ons into a cart line for this product.
            </p>
          </div>
          <Button
            color="module"
            size="sm"
            render={<Link href={newHref} />}
            iconStart={<Plus className="h-4 w-4" />}
          >
            New template
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {templates.map((t) => (
            <Link
              key={t.id}
              href={`/commerce/configurator/${t.id}`}
              className="group flex items-center justify-between gap-3 rounded-md border border-[var(--color-border-default)] px-3 py-2.5 transition-colors hover:border-[var(--module-active)] hover:bg-[var(--color-bg-subtle)]"
            >
              <div className="flex min-w-0 flex-col gap-0">
                <p className="truncate font-medium group-hover:text-[var(--module-active)]">
                  {t.name}
                </p>
                <p className="text-base-content/70 text-xs">
                  {t.optionCount} option{t.optionCount === 1 ? '' : 's'} · {t.ruleCount} rule
                  {t.ruleCount === 1 ? '' : 's'} · {t.addOnCount} add-on
                  {t.addOnCount === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex shrink-0 flex-row items-center gap-2">
                <Badge color={statusTone(t.status)} variant="soft">
                  {statusLabel(t.status)}
                </Badge>
                <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)]" aria-hidden />
              </div>
            </Link>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
