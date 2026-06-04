// Unified content list — every content-type ENTRY in one place (docs/51:
// content items are entries of a content type; the schemas/models live at
// /cms/types). Standard list surface (docs/34 §7): URL-driven search + Type
// and Status facets + Table/Cards toggle + cursor "Load more". Rows open in the
// user's preferred detail surface via EntityRowLink — `page` entries keep their
// bespoke editor (/cms/[id]); every other type opens the generic content-entry
// editor. The CMS module gate runs in layout.tsx.
//
// Replaces the old /cms/pages list, which was this exact surface hardcoded to a
// single type. A content type links to its items as /cms/content?type=<key>.

import Link from 'next/link';
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
import { FileText } from 'lucide-react';

import { api } from '@/lib/api-rest-client';
import { EntityRowLink } from '../../_components/entity-row-link';
import { ListToolbar } from '../../_components/list-toolbar';
import { getUserPreferences } from '../../_shell/preferences';
import { ContentNewButton } from './content-new-button';

export const dynamic = 'force-dynamic';

interface ApiContentType {
  key: string;
  name: string;
  plural_name: string;
  is_built_in: boolean;
}

interface ApiEntry {
  id: string;
  type_key: string;
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

// Page entries keep the bespoke editor; every other type uses the generic one.
function entryHref(e: ApiEntry): string {
  return e.type_key === 'page' ? `/cms/${e.id}` : `/cms/types/${e.type_key}/${e.id}`;
}
function rowEntityType(e: ApiEntry): string {
  return e.type_key === 'page' ? 'page' : 'content-entry';
}
// The content-entry detail token carries the type key so the drawer chrome can
// rebuild the full-page href (/cms/types/<typeKey>/<id>). Page uses a bare id.
function rowEntityId(e: ApiEntry): string {
  return e.type_key === 'page' ? e.id : `${e.type_key}:${e.id}`;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ContentListPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const type = asString(sp.type);
  const status = asString(sp.status);
  const q = asString(sp.q);
  const cursor = asString(sp.cursor);
  const viewParam = asString(sp.view);

  const prefsPromise = getUserPreferences();
  const typesPromise = api.get<ApiContentType[]>('/v1/content/types');
  const paged = await api.getPaged<ApiEntry[]>(
    `/v1/content/entries?${buildQuery({
      limit: String(PAGE_SIZE),
      ...(type && type !== 'all' ? { type } : {}),
      ...(status && status !== 'all' ? { status } : {}),
      ...(q ? { q } : {}),
      ...(cursor ? { cursor } : {}),
    })}`
  );
  const entries = paged.data;
  const nextCursor = typeof paged.meta?.next_cursor === 'string' ? paged.meta.next_cursor : null;
  const types = await typesPromise;
  const prefs = await prefsPromise;
  // `?view=` overrides; absent → the user's saved default (docs/34 §7.2).
  const view = (viewParam ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  const typeName = new Map(types.map((t) => [t.key, t.name]));
  const TYPE_OPTIONS = types.map((t) => ({ value: t.key, label: t.plural_name }));
  const NEW_TYPES = types.map((t) => ({ key: t.key, name: t.name }));
  // When a single type is selected every row shares it, so the Type column is
  // redundant noise — hide it.
  const showType = !(type && type !== 'all');

  const baseParams: Record<string, string | undefined> = {
    ...(type && type !== 'all' ? { type } : {}),
    ...(status && status !== 'all' ? { status } : {}),
    ...(q ? { q } : {}),
    ...(viewParam ? { view: viewParam } : {}),
  };
  const nextHref = nextCursor
    ? `/cms/content?${buildQuery({ ...baseParams, cursor: nextCursor })}`
    : null;
  const isFiltered = Boolean(type && type !== 'all') || Boolean(status && status !== 'all') || Boolean(q);
  const isPaged = Boolean(cursor);

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          className="mb-0"
          icon={<FileText className="h-5 w-5" />}
          title="Content"
          badge={<Badge variant="outline">{entries.length}</Badge>}
          description="Every page, post, and entry across your content types."
          actions={<ContentNewButton types={NEW_TYPES} activeType={type && type !== 'all' ? type : undefined} />}
        />

        <ListToolbar
          searchPlaceholder="Search by title or slug…"
          filters={[
            { key: 'type', label: 'Types', options: TYPE_OPTIONS },
            { key: 'status', label: 'Statuses', options: STATUS_OPTIONS },
          ]}
          enableViewToggle
        />

        {entries.length === 0 ? (
          <Card variant="module" padding="none">
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title={isFiltered ? 'No content matches your filter' : 'No content yet'}
              description={
                isFiltered
                  ? 'Try clearing the filter or searching for a different term.'
                  : 'Create your first page or post to get started.'
              }
              action={
                isFiltered ? (
                  <Button asChild variant="ghost">
                    <Link href="/cms/content">Clear filters</Link>
                  </Button>
                ) : (
                  <ContentNewButton
                    types={NEW_TYPES}
                    activeType={type && type !== 'all' ? type : undefined}
                  />
                )
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
                        href={entryHref(e)}
                        entityType={rowEntityType(e)}
                        entityId={rowEntityId(e)}
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
                    <Badge color={e.status === 'published' ? 'success' : 'outline'} className="text-xs">
                      {e.status}
                    </Badge>
                  </Stack>
                  <Stack direction="row" align="center" justify="between" gap={2}>
                    {showType && (
                      <Badge color="module" variant="soft" className="text-xs">
                        {typeName.get(e.type_key) ?? e.type_key}
                      </Badge>
                    )}
                    <Text size="xs" variant="muted">
                      {e.status === 'published' && e.published_at
                        ? `Published ${new Date(e.published_at).toLocaleDateString()}`
                        : `Updated ${new Date(e.updated_at).toLocaleDateString()}`}
                    </Text>
                  </Stack>
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
                    {showType && <TableHead>Type</TableHead>}
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
                            href={entryHref(e)}
                            entityType={rowEntityType(e)}
                            entityId={rowEntityId(e)}
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
                      {showType && (
                        <TableCell>
                          <Badge color="module" variant="soft" className="text-xs">
                            {typeName.get(e.type_key) ?? e.type_key}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge color={e.status === 'published' ? 'success' : 'outline'} className="text-xs">
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
                <Link href={`/cms/content?${buildQuery(baseParams)}`}>← First page</Link>
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
