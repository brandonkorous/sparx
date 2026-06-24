import { Plus, Settings2 } from 'lucide-react';

import { Badge, Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
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
  const { skip, take } = parsePageParams(params);

  const [prefs, { data: templates, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<ConfigurationTemplateRow[]>(
      `/v1/commerce/configurator-templates?${new URLSearchParams({
        take: String(take),
        skip: String(skip),
      }).toString()}`
    ),
  ]);
  const total = (meta?.total as number | undefined) ?? templates.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Settings2 className="h-5 w-5" />}
          title="Configurator"
          badge={<Badge color="module">{total}</Badge>}
          description="Templates drive any configurable product — play structures, beauty gift sets, custom auto parts, configurable dogfood crates. Each template is a set of options + rules + add-ons; the resolver turns a user's selections into a cart line."
          actions={
            <EntityCreateButton
              entityType="configurator-template"
              newHref="/commerce/configurator/new"
              color="module"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New template
            </EntityCreateButton>
          }
        />

        <ListToolbar enableViewToggle searchable={false} />

        {templates.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<Settings2 className="h-5 w-5" />}
              title="No configurators yet"
              description="Open any configurable product (e.g. a play structure or gift-set) and add a configurator template from its detail page."
              action={
                <EntityCreateButton
                  entityType="configurator-template"
                  newHref="/commerce/configurator/new"
                  color="module"
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  New template
                </EntityCreateButton>
              }
            />
          </Card>
        ) : (
          <ConfiguratorList templates={templates} view={view} />
        )}

        <ListPager total={total} />
      </Stack>
    </Container>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
