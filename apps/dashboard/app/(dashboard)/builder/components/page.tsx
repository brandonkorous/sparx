// /builder/components — the component catalog (docs/51 §4.2, docs/53). The
// standard Collection/List surface (docs/34 §7): URL-driven search + Group / Kind
// / Surface facets + a Table/Cards toggle. Shows SYSTEM components (the in-code
// registry, read-only) and TENANT components (builder_components, badged
// "Custom") side by side. Rows open the component's detail in the user's
// preferred surface via EntityRowLink, where Copy (system) / Delete (custom)
// live. The Builder module gate runs in layout.tsx.

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
import { catalogCount, loadCatalog, type CatalogEntry } from './_lib/catalog';
import { LucideByName } from './_lib/lucide-by-name';
import { NewComponentButton } from './_components/new-component-button';

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

// System icons are a component reference; custom icons are a lucide NAME rendered
// through the client island (DynamicIcon needs a client boundary).
function EntryIcon({ entry, className }: { entry: CatalogEntry; className?: string }) {
  if (typeof entry.icon === 'string')
    return <LucideByName name={entry.icon} className={className} />;
  const Icon = entry.icon;
  return <Icon className={className} aria-hidden />;
}

export default async function BuilderComponentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const group = stringParam(params.group);
  const kind = stringParam(params.kind);
  const surface = stringParam(params.surface);
  const q = stringParam(params.q);

  const [prefs, items, total] = await Promise.all([
    getUserPreferences(),
    loadCatalog({ group, kind, surface, q }),
    catalogCount(),
  ]);
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
          description="The catalog of building blocks you compose pages and layouts from — system primitives and data-aware components, plus the custom components you build. Start a new one, copy a system component, or save a block from the builder."
          actions={<NewComponentButton />}
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
            {items.map((entry) => (
              <Card key={`${entry.provenance}:${entry.id}`} variant="default" padding="md">
                <Stack gap={3}>
                  <Stack direction="row" align="start" justify="between" gap={2}>
                    <Stack direction="row" align="center" gap={2} className="min-w-0">
                      <EntryIcon
                        entry={entry}
                        className="h-5 w-5 shrink-0 text-[var(--module-active)]"
                      />
                      <EntityRowLink
                        href={`/builder/components/${entry.id}`}
                        entityType="builder-component"
                        entityId={entry.id}
                        className="truncate text-sm font-medium hover:text-[var(--module-active)] hover:underline"
                      >
                        {entry.label}
                      </EntityRowLink>
                    </Stack>
                    {entry.provenance === 'custom' ? (
                      <Badge color="module" variant="soft" className="shrink-0 text-xs">
                        Custom
                      </Badge>
                    ) : entry.moduleLabel ? (
                      <Badge color="module" variant="soft" className="shrink-0 text-xs">
                        {entry.moduleLabel}
                      </Badge>
                    ) : null}
                  </Stack>
                  <Text size="sm" variant="muted" className="line-clamp-2">
                    {entry.summary}
                  </Text>
                  <Stack direction="row" align="center" gap={2} wrap>
                    <Badge color="info" variant="soft" size="sm">
                      {entry.groupLabel}
                    </Badge>
                    <Badge color="neutral" variant="soft" size="sm">
                      {entry.kindLabel}
                    </Badge>
                    <Text size="xs" variant="muted">
                      {entry.bindingLabel}
                    </Text>
                  </Stack>
                </Stack>
              </Card>
            ))}
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
                  {items.map((entry) => (
                    <TableRow key={`${entry.provenance}:${entry.id}`}>
                      <TableCell>
                        <Stack direction="row" align="center" gap={3} className="min-w-0">
                          <EntryIcon
                            entry={entry}
                            className="h-4 w-4 shrink-0 text-[var(--module-active)]"
                          />
                          <Stack gap={1} className="min-w-0">
                            <Stack direction="row" align="center" gap={2}>
                              <EntityRowLink
                                href={`/builder/components/${entry.id}`}
                                entityType="builder-component"
                                entityId={entry.id}
                                className="text-sm font-medium hover:text-[var(--module-active)] hover:underline"
                              >
                                {entry.label}
                              </EntityRowLink>
                              {entry.provenance === 'custom' ? (
                                <Badge color="module" variant="soft" className="text-xs">
                                  Custom
                                </Badge>
                              ) : entry.moduleLabel ? (
                                <Badge color="module" variant="soft" className="text-xs">
                                  {entry.moduleLabel}
                                </Badge>
                              ) : null}
                            </Stack>
                            <Text size="xs" variant="muted" className="line-clamp-1">
                              {entry.summary}
                            </Text>
                          </Stack>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Badge color="info" variant="soft" size="sm">
                          {entry.groupLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Text size="sm">{entry.kindLabel}</Text>
                      </TableCell>
                      <TableCell>
                        <Text size="sm" variant="muted">
                          {entry.bindingLabel}
                        </Text>
                      </TableCell>
                      <TableCell>
                        <Text size="sm" variant="muted">
                          {entry.surfaceLabel}
                        </Text>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Container>
  );
}
