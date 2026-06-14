// /builder/blueprints — the Builder's installed-blueprints view (docs/54). Unlike
// the Marketplace (/marketplace), which browses EVERY blueprint (and, soon, other
// categories like integrations), this in-Builder surface lists ONLY the blueprints
// installed on this tenant — each with its status, what it created, and the
// review/go-live/reset controls. A button heads out to the Marketplace to install
// more.
//
// The Builder "Blueprints" sub-nav points here; the Marketplace stays rail-pinned
// and platform-wide (installing a blueprint enables Builder). The builder layout
// is gate-only (no ModuleProvider), so this page supplies its own module color.
//
// A standard Collection/List surface (docs/34 §7): ListToolbar with a Table/Cards
// toggle honoring the user's defaultListView; the card view is preserved as the
// `card` slot and the table mirrors its key fields.

import Link from 'next/link';
import { ArrowRight, LayoutTemplate } from 'lucide-react';
import { requireSession } from '@sparx/auth';
import {
  Button,
  Card,
  CardContent,
  Container,
  ModuleProvider,
  PageHeader,
  Stack,
  Text,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { getUserPreferences } from '../../_shell/preferences';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { BlueprintsList, type BlueprintListItem } from './_components/blueprints-list';

export const dynamic = 'force-dynamic';

interface ApiBlueprintCard {
  key: string;
  version: string;
  name: string;
  summary: string;
  vertical: string;
  preview?: string;
  requiresModules: string[];
  contents: {
    products: number;
    categories: number;
    collections: number;
    content: number;
    pages: number;
    emails: number;
    components: number;
    theme: string;
    hasLayout: boolean;
  };
  install: {
    id: string;
    status: string;
    version: string;
    update_available: boolean;
  } | null;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BuilderBlueprintsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);

  const [session, prefs, catalog] = await Promise.all([
    requireSession(),
    getUserPreferences(),
    api.getPaged<ApiBlueprintCard[]>(
      `/v1/blueprints?${new URLSearchParams({ take: String(take), skip: String(skip) }).toString()}`
    ),
  ]);
  const total = (catalog.meta?.total as number | undefined) ?? catalog.data.length;

  const canInstall = session.user.role === 'owner' || session.user.role === 'admin';
  // Installed-only — the full catalog lives in the Marketplace (/marketplace).
  // /v1/blueprints (the install engine, docs/54) is snake_case; map the install
  // overlay onto the marketplace shape the card actions consume.
  const installed: BlueprintListItem[] = catalog.data
    .filter((bp) => bp.install !== null)
    .map((bp) => ({
      key: bp.key,
      version: bp.version,
      name: bp.name,
      summary: bp.summary,
      vertical: bp.vertical,
      preview: bp.preview,
      contents: bp.contents,
      install: bp.install
        ? {
            id: bp.install.id,
            status: bp.install.status,
            version: bp.install.version,
            updateAvailable: bp.install.update_available,
          }
        : null,
    }));

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  const browseButton = (
    <Button color="module" variant="outline" asChild>
      <Link href="/marketplace">
        Browse the marketplace
        <ArrowRight className="ml-1.5 h-4 w-4" />
      </Link>
    </Button>
  );

  return (
    <ModuleProvider module="builder">
      <Container size="xl">
        <Stack gap={6} className="py-10">
          <PageHeader
            icon={<LayoutTemplate className="h-5 w-5" />}
            title="Blueprints"
            description="The blueprints installed on your site. Review and go live, or reset to start over — and browse the marketplace to install more."
            actions={browseButton}
          />

          <ListToolbar searchable={false} enableViewToggle />

          {installed.length === 0 ? (
            <Card variant="module">
              <CardContent>
                <Stack gap={4} className="items-start py-2">
                  <Text variant="muted">
                    You haven&apos;t installed any blueprints yet. Install one from the marketplace
                    to drop a fully themed starting point — site, pages, products, content, and
                    emails — onto your site as drafts.
                  </Text>
                  <Button color="module" asChild>
                    <Link href="/marketplace">
                      Browse the marketplace
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ) : (
            <BlueprintsList rows={installed} view={view} canInstall={canInstall} />
          )}

          <ListPager total={total} />
        </Stack>
      </Container>
    </ModuleProvider>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
