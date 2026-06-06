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

import Link from 'next/link';
import { ArrowRight, LayoutTemplate } from 'lucide-react';
import { requireSession } from '@sparx/auth';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Container,
  Grid,
  ModuleProvider,
  PageHeader,
  Stack,
  Text,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { BlueprintCardActions } from '../../marketplace/_components/blueprint-card-actions';

export const dynamic = 'force-dynamic';

interface BlueprintCard {
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

export default async function BuilderBlueprintsPage() {
  const session = await requireSession();
  const canInstall = session.user.role === 'owner' || session.user.role === 'admin';
  const { blueprints } = await api.get<{ blueprints: BlueprintCard[]; property_id: string }>(
    '/v1/blueprints'
  );
  // Installed-only — the full catalog lives in the Marketplace (/marketplace).
  const installed = blueprints.filter((bp) => bp.install !== null);

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
            <Grid minItemWidth="20rem" gap={4}>
              {installed.map((bp) => (
                <Card key={bp.key} variant="module" className="overflow-hidden">
                  {bp.preview ? (
                    <img
                      src={bp.preview}
                      alt={`${bp.name} preview`}
                      className="aspect-[16/10] w-full border-b border-[var(--color-border)] object-cover object-top"
                    />
                  ) : null}
                  <CardHeader>
                    <Stack direction="row" align="center" gap={2} className="justify-between">
                      <CardTitle>{bp.name}</CardTitle>
                      <Badge variant="soft">{bp.vertical}</Badge>
                    </Stack>
                  </CardHeader>
                  <CardContent>
                    <Stack gap={3}>
                      <Text size="sm" variant="muted">
                        {bp.summary}
                      </Text>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{bp.contents.products} products</Badge>
                        <Badge variant="outline">{bp.contents.content} content</Badge>
                        <Badge variant="outline">{bp.contents.pages} pages</Badge>
                        <Badge variant="outline">{bp.contents.emails} emails</Badge>
                        <Badge variant="outline">{bp.contents.components} components</Badge>
                        <Badge variant="outline">Theme: {bp.contents.theme}</Badge>
                      </div>
                      <BlueprintCardActions
                        blueprintKey={bp.key}
                        blueprintName={bp.name}
                        latestVersion={bp.version}
                        install={bp.install}
                        canInstall={canInstall}
                      />
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Grid>
          )}
        </Stack>
      </Container>
    </ModuleProvider>
  );
}
