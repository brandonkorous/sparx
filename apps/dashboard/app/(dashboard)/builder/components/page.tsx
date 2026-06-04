// /builder/components — the component catalog (docs/51 §4.2). The standard
// Collection/List surface (docs/34 §7): URL-driven search + Group / Kind /
// Surface facets + a Table/Cards toggle. Rows open the component's reference
// detail in the user's preferred surface via EntityRowLink. The catalog is the
// builder's component registry; tenant-authored components (docs/38/47) will
// land here once their backend exists, so there's no create action yet. The
// Builder module gate runs in layout.tsx.

import { Boxes, Component } from 'lucide-react';

import {
  Badge,
  Card,
  CardContent,
  Container,
  EmptyState,
  Grid,
  PageHeader,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';

import { EntityRowLink } from '../../_components/entity-row-link';
import { ListToolbar } from '../../_components/list-toolbar';
import { getUserPreferences } from '../../_shell/preferences';
import {
  GROUP_LABELS,
  KIND_LABELS,
  MODULE_LABELS,
  boundCardinalities,
  CARDINALITY_LABELS,
  filterComponents,
  listComponents,
  summaryOf,
  surfaceLabel,
  type ComponentDef,
} from './_lib/catalog';

export const dynamic = 'force-dynamic';

const GROUP_OPTIONS = [
  { value: 'layout', label: 'Layout' },
  { value: 'content', label: 'Content & media' },
  { value: 'data', label: 'Data-aware' },
];
const KIND_OPTIONS = [
  { value: 'container', label: 'Container' },
  { value: 'leaf', label: 'Leaf' },
];
const SURFACE_OPTIONS = [
  { value: 'page', label: 'Page' },
  { value: 'site', label: 'Site layout' },
];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}

function bindingSummary(def: ComponentDef): string {
  if (!def.bindable) return 'Static';
  const cards = boundCardinalities(def);
  if (cards.length === 0) return 'Any';
  return cards.map((c) => CARDINALITY_LABELS[c]).join(', ');
}

export default async function BuilderComponentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const group = stringParam(params.group);
  const kind = stringParam(params.kind);
  const surface = stringParam(params.surface);
  const q = stringParam(params.q);

  const [prefs] = await Promise.all([getUserPreferences()]);
  const items = filterComponents({ group, kind, surface, q });
  const total = listComponents().length;
  const isFiltered = Boolean(group ?? kind ?? surface ?? q);
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Component className="h-5 w-5" />}
          title="Components"
          badge={
            <Badge color="module">
              {total} component{total === 1 ? '' : 's'}
            </Badge>
          }
          description="The catalog of building blocks you compose pages and layouts from — layout primitives, content & media, and data-aware components that bind to your modules."
        />

        <ListToolbar
          searchPlaceholder="Search components…"
          filters={[
            { key: 'group', label: 'Groups', options: GROUP_OPTIONS },
            { key: 'kind', label: 'Kinds', options: KIND_OPTIONS },
            { key: 'surface', label: 'Surfaces', options: SURFACE_OPTIONS },
          ]}
          enableViewToggle
        />

        {items.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<Boxes className="h-5 w-5" />}
              title="No components match these filters"
              description={
                isFiltered
                  ? 'Adjust or clear the filters to see the full catalog.'
                  : 'The component catalog is empty.'
              }
            />
          </Card>
        ) : view === 'card' ? (
          <Grid minItemWidth="20rem" gap={4}>
            {items.map((def) => {
              const Icon = def.icon;
              return (
                <Card key={def.type} variant="module" padding="md">
                  <Stack gap={3}>
                    <Stack direction="row" align="start" justify="between" gap={2}>
                      <Stack direction="row" align="center" gap={2} className="min-w-0">
                        <Icon
                          className="h-5 w-5 shrink-0 text-[var(--module-active)]"
                          aria-hidden
                        />
                        <EntityRowLink
                          href={`/builder/components/${def.type}`}
                          entityType="builder-component"
                          entityId={def.type}
                          className="truncate text-sm font-medium hover:text-[var(--module-active)] hover:underline"
                        >
                          {def.label}
                        </EntityRowLink>
                      </Stack>
                      {def.module ? (
                        <Badge color="module" variant="soft" className="shrink-0 text-xs">
                          {MODULE_LABELS[def.module]}
                        </Badge>
                      ) : null}
                    </Stack>
                    <Text size="sm" variant="muted" className="line-clamp-2">
                      {summaryOf(def)}
                    </Text>
                    <Stack direction="row" align="center" gap={2} wrap>
                      <Badge variant="outline" className="text-xs">
                        {GROUP_LABELS[def.group]}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {KIND_LABELS[def.kind]}
                      </Badge>
                      <Text size="xs" variant="muted">
                        {bindingSummary(def)}
                      </Text>
                    </Stack>
                  </Stack>
                </Card>
              );
            })}
          </Grid>
        ) : (
          <Card padding="none">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Binding</TableHead>
                    <TableHead>Surface</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((def) => {
                    const Icon = def.icon;
                    return (
                      <TableRow key={def.type}>
                        <TableCell>
                          <Stack direction="row" align="center" gap={3} className="min-w-0">
                            <Icon
                              className="h-4 w-4 shrink-0 text-[var(--module-active)]"
                              aria-hidden
                            />
                            <Stack gap={1} className="min-w-0">
                              <Stack direction="row" align="center" gap={2}>
                                <EntityRowLink
                                  href={`/builder/components/${def.type}`}
                                  entityType="builder-component"
                                  entityId={def.type}
                                  className="text-sm font-medium hover:text-[var(--module-active)] hover:underline"
                                >
                                  {def.label}
                                </EntityRowLink>
                                {def.module ? (
                                  <Badge color="module" variant="soft" className="text-xs">
                                    {MODULE_LABELS[def.module]}
                                  </Badge>
                                ) : null}
                              </Stack>
                              <Text size="xs" variant="muted" className="line-clamp-1">
                                {summaryOf(def)}
                              </Text>
                            </Stack>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {GROUP_LABELS[def.group]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Text size="sm">{KIND_LABELS[def.kind]}</Text>
                        </TableCell>
                        <TableCell>
                          <Text size="sm" variant="muted">
                            {bindingSummary(def)}
                          </Text>
                        </TableCell>
                        <TableCell>
                          <Text size="sm" variant="muted">
                            {surfaceLabel(def)}
                          </Text>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Container>
  );
}
