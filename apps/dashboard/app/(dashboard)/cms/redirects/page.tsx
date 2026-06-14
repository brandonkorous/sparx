// Redirects — a standard Collection/List surface (docs/34 §7). The ListToolbar's
// Table/Cards toggle (honoring the user's defaultListView) flips the existing
// redirects between views; the create form + bulk import + per-row delete live in
// the client RedirectsList (inline CRUD is preserved in both views). No search /
// filters — the endpoint exposes none.

import { Badge, Container, PageHeader, Stack } from '@sparx/ui';
import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { getUserPreferences } from '../../_shell/preferences';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { RedirectsList } from './redirects-list';

export const dynamic = 'force-dynamic';

interface ApiRedirect {
  id: string;
  from_path: string;
  to_path: string;
  status_code: number;
  hit_count: number;
  created_at: string;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RedirectsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);

  const [prefs, { data: redirects, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<ApiRedirect[]>(
      `/v1/redirects?${new URLSearchParams({ take: String(take), skip: String(skip) }).toString()}`
    ),
  ]);
  const total = (meta?.total as number | undefined) ?? redirects.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          title="Redirects"
          badge={<Badge variant="outline">{total}</Badge>}
          description="Forward old URLs to new ones. Loops and chains over 8 hops are rejected at insert."
        />
        <ListToolbar searchable={false} enableViewToggle />
        <RedirectsList rows={redirects} view={view} />
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
