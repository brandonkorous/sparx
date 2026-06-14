import { Settings2 } from 'lucide-react';

import { Badge, Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { ListToolbar } from '../../_components/list-toolbar';
import { getUserPreferences } from '../../_shell/preferences';
import { ConfiguratorList, type ConfigurationTemplateRow } from './_components/configurator-list';

// Configurator — option-matrix-with-rules templates that resolve a
// storefront selection into a ResolvedConfiguration. Per-product
// templates live on the product detail page; this index lists every
// template across products for staff overview + bulk activation.

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ConfiguratorPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const [prefs, templates] = await Promise.all([
    getUserPreferences(),
    api.get<ConfigurationTemplateRow[]>('/v1/commerce/configurator-templates?take=200'),
  ]);

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Settings2 className="h-5 w-5" />}
          title="Configurator"
          badge={<Badge color="module">{templates.length}</Badge>}
          description="Templates drive any configurable product — play structures, beauty gift sets, custom auto parts, configurable dogfood crates. Each template is a set of options + rules + add-ons; the resolver turns a user's selections into a cart line."
        />

        <ListToolbar enableViewToggle searchable={false} />

        {templates.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<Settings2 className="h-5 w-5" />}
              title="No configurators yet"
              description="Open any configurable product (e.g. a play structure or gift-set) and add a configurator template from its detail page."
            />
          </Card>
        ) : (
          <ConfiguratorList templates={templates} view={view} />
        )}
      </Stack>
    </Container>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
