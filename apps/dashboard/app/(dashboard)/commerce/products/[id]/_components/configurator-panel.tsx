import Link from 'next/link';
import { ChevronRight, Plus, Settings2 } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  EmptyState,
  Heading,
  Stack,
  Text,
  statusLabel,
  statusTone,
} from '@sparx/ui';

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
      <Card variant="module">
        <CardContent>
          <EmptyState
            icon={<Settings2 className="h-5 w-5" />}
            title="No configuration yet"
            description="Make this a built-to-order product: a configurator template binds options, rules, and add-ons, then resolves a shopper's selections into a cart line."
            action={
              <Button color="module" asChild leftIcon={<Plus className="h-4 w-4" />}>
                <Link href={newHref}>Create configuration</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="module">
      <CardHeader>
        <Stack direction="row" align="start" justify="between" wrap gap={3}>
          <Stack gap={1}>
            <Heading level={3}>Configuration</Heading>
            <CardDescription>
              Templates that resolve options, rules, and add-ons into a cart line for this product.
            </CardDescription>
          </Stack>
          <Button color="module" size="sm" asChild leftIcon={<Plus className="h-4 w-4" />}>
            <Link href={newHref}>New template</Link>
          </Button>
        </Stack>
      </CardHeader>
      <CardContent>
        <Stack gap={2}>
          {templates.map((t) => (
            <Link
              key={t.id}
              href={`/commerce/configurator/${t.id}`}
              className="group flex items-center justify-between gap-3 rounded-md border border-[var(--color-border-default)] px-3 py-2.5 transition-colors hover:border-[var(--module-active)] hover:bg-[var(--color-bg-subtle)]"
            >
              <Stack gap={0} className="min-w-0">
                <Text className="truncate font-medium group-hover:text-[var(--module-active)]">
                  {t.name}
                </Text>
                <Text size="xs" variant="muted">
                  {t.optionCount} option{t.optionCount === 1 ? '' : 's'} · {t.ruleCount} rule
                  {t.ruleCount === 1 ? '' : 's'} · {t.addOnCount} add-on
                  {t.addOnCount === 1 ? '' : 's'}
                </Text>
              </Stack>
              <Stack direction="row" align="center" gap={2} className="shrink-0">
                <Badge color={statusTone(t.status)} variant="soft">
                  {statusLabel(t.status)}
                </Badge>
                <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)]" aria-hidden />
              </Stack>
            </Link>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
