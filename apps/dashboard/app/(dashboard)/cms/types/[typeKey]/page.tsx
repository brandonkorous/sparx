// Per-type entry list — every entry of a given content type, on the standard
// list surface (docs/34 §7): URL-driven search + status filter + Table/Cards
// toggle, cursor "Load more", and rows that open in the user's preferred detail
// surface (drawer / modal / full page) via EntityRowLink. The CMS module gate
// runs in layout.tsx.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Badge,
  Button,
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
import { FileText, Plus } from 'lucide-react';

import { api } from '@/lib/api-rest-client';
import { EntityCreateButton } from '../../../_components/entity-create-button';
import { EntityRowLink } from '../../../_components/entity-row-link';
import { ListToolbar } from '../../../_components/list-toolbar';
import { getUserPreferences } from '../../../_shell/preferences';

export const dynamic = 'force-dynamic';

interface ApiContentType {
  key: string;
  name: string;
  plural_name: string;
  url_pattern: string | null;
  is_singleton: boolean;
  is_built_in: boolean;
  description: string | null;
}

interface ApiEntry {
  id: string;
  slug: string | null;
  status: string;
  body: { title?: string; name?: string } & Record<string, unknown>;
  updated_at: string;
  published_at: string | null;
}

const PAGE_SIZE = 50;

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'archived', label: 'Archived' },
];

function entryTitle(e: ApiEntry): string {
  if (typeof e.body.title === 'string' && e.body.title) return e.body.title;
  if (typeof e.body.name === 'string' && e.body.name) return e.body.name;
  return e.slug ?? '(untitled)';
}

function asString(v: string | string[] | undefined): string | undefined {
  if (typeof v === 'string' && v.length > 0) return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) usp.set(k, v);
  }
  return usp.toString();
}

interface PageProps {
  params: Promise<{ typeKey: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TypeListPage({ params, searchParams }: PageProps) {
  const { typeKey } = await params;
  const sp = await searchParams;
  const status = asString(sp.status);
  const q = asString(sp.q);
  const cursor = asString(sp.cursor);
  const viewParam = asString(sp.view);

  let type: ApiContentType;
  try {
    type = await api.get<ApiContentType>(`/v1/content/types/${encodeURIComponent(typeKey)}`);
  } catch {
    notFound();
  }

  const prefsPromise = getUserPreferences();
  const paged = await api.getPaged<ApiEntry[]>(
    `/v1/content/entries?${buildQuery({
      type: typeKey,
      limit: String(PAGE_SIZE),
      ...(status && status !== 'all' ? { status } : {}),
      ...(q ? { q } : {}),
      ...(cursor ? { cursor } : {}),
    })}`
  );
  const entries = paged.data;
  const nextCursor = typeof paged.meta?.next_cursor === 'string' ? paged.meta.next_cursor : null;
  const prefs = await prefsPromise;
  // `?view=` overrides; absent → the user's saved default (docs/34 §7.2).
  const view = (viewParam ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  const lowerName = type.name.toLowerCase();
  const newHref = `/cms/types/${typeKey}/new`;
  // Singletons hold a single entry — hide "New" once one exists.
  const canCreate = !type.is_singleton || entries.length === 0;

  const baseParams: Record<string, string | undefined> = {
    ...(status && status !== 'all' ? { status } : {}),
    ...(q ? { q } : {}),
    ...(viewParam ? { view: viewParam } : {}),
  };
  const nextHref = nextCursor
    ? `/cms/types/${typeKey}?${buildQuery({ ...baseParams, cursor: nextCursor })}`
    : null;
  const isFiltered = Boolean(status && status !== 'all') || Boolean(q);
  const isPaged = Boolean(cursor);

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          className="mb-0"
          icon={<FileText className="h-5 w-5" />}
          title={type.plural_name}
          badge={
            <Badge color={type.is_built_in ? 'outline' : 'module'}>
              {type.is_built_in ? 'built-in' : 'custom'}
            </Badge>
          }
          description={type.description ?? undefined}
          actions={
            canCreate && (
              <EntityCreateButton
                entityType="content-entry"
                newHref={newHref}
                color="module"
                leftIcon={<Plus className="h-4 w-4" />}
              >
                New {lowerName}
              </EntityCreateButton>
            )
          }
        />

        <ListToolbar
          searchPlaceholder="Search by title or slug…"
          filters={[{ key: 'status', label: 'Statuses', options: STATUS_OPTIONS }]}
          enableViewToggle
        />

        {entries.length === 0 ? (
          <Card variant="module" padding="none">
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title={
                isFiltered
                  ? `No ${type.plural_name.toLowerCase()} match your filter`
                  : `No ${type.plural_name.toLowerCase()} yet`
              }
              description={
                isFiltered
                  ? 'Try clearing the filter or searching for a different term.'
                  : `Create your first ${lowerName} to get started.`
              }
              action={
                isFiltered ? (
                  <Button asChild variant="ghost">
                    <Link href={`/cms/types/${typeKey}`}>Clear filters</Link>
                  </Button>
                ) : canCreate ? (
                  <EntityCreateButton
                    entityType="content-entry"
                    newHref={newHref}
                    color="module"
                    leftIcon={<Plus className="h-4 w-4" />}
                  >
                    New {lowerName}
                  </EntityCreateButton>
                ) : undefined
              }
            />
          </Card>
        ) : view === 'card' ? (
          <Grid minItemWidth="18rem" gap={4}>
            {entries.map((e) => (
              <Card key={e.id} variant="module" padding="md">
                <Stack gap={3}>
                  <Stack direction="row" align="start" justify="between" gap={2}>
                    <Stack gap={1} className="min-w-0">
                      <EntityRowLink
                        href={`/cms/types/${typeKey}/${e.id}`}
                        entityType="content-entry"
                        entityId={e.id}
                        className="truncate text-sm font-medium hover:text-[var(--module-active)] hover:underline"
                      >
                        {entryTitle(e)}
                      </EntityRowLink>
                      {e.slug && (
                        <Text size="xs" variant="muted">
                          /{e.slug}
                        </Text>
                      )}
                    </Stack>
                    <Badge
                      color={e.status === 'published' ? 'success' : 'outline'}
                      className="text-xs"
                    >
                      {e.status}
                    </Badge>
                  </Stack>
                  <Text size="xs" variant="muted">
                    {e.status === 'published' && e.published_at
                      ? `Published ${new Date(e.published_at).toLocaleDateString()}`
                      : `Updated ${new Date(e.updated_at).toLocaleDateString()}`}
                  </Text>
                </Stack>
              </Card>
            ))}
          </Grid>
        ) : (
          <Card variant="module" padding="none">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <Stack gap={1}>
                          <EntityRowLink
                            href={`/cms/types/${typeKey}/${e.id}`}
                            entityType="content-entry"
                            entityId={e.id}
                            className="text-sm font-medium hover:text-[var(--module-active)] hover:underline"
                          >
                            {entryTitle(e)}
                          </EntityRowLink>
                          {e.slug && (
                            <Text size="xs" variant="muted">
                              /{e.slug}
                            </Text>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Badge
                          color={e.status === 'published' ? 'success' : 'outline'}
                          className="text-xs"
                        >
                          {e.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Text size="sm" variant="muted">
                          {new Date(e.updated_at).toLocaleDateString()}
                        </Text>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {(nextHref !== null || isPaged) && (
          <Stack direction="row" align="center" justify="between">
            {isPaged ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/cms/types/${typeKey}?${buildQuery(baseParams)}`}>← First page</Link>
              </Button>
            ) : (
              <span />
            )}
            {nextHref ? (
              <Button asChild color="module" variant="outline" size="sm">
                <Link href={nextHref}>Load more →</Link>
              </Button>
            ) : (
              <Text size="xs" variant="muted">
                End of list.
              </Text>
            )}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
