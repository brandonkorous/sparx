// Templates — the blueprint marketplace (docs/54). Browse one-click templates
// that provision a whole themed site (brand + theme, products, content, pages,
// emails, components) onto the ACTIVE property as drafts; install, then go live.
//
// Platform-level (not a module), so no ModuleGate — it pins beside SEO/Settings.

import { LayoutTemplate } from 'lucide-react';
import { requireSession } from '@sparx/auth';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Container,
  Grid,
  PageHeader,
  Stack,
  Text,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { TemplateCardActions } from './_components/template-card-actions';

export const dynamic = 'force-dynamic';

interface BlueprintCard {
  key: string;
  version: string;
  name: string;
  summary: string;
  vertical: string;
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
  install: { id: string; status: string } | null;
}

export default async function TemplatesPage() {
  const session = await requireSession();
  const canInstall = session.user.role === 'owner' || session.user.role === 'admin';
  const { blueprints } = await api.get<{ blueprints: BlueprintCard[]; property_id: string }>(
    '/v1/blueprints'
  );

  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<LayoutTemplate className="h-5 w-5" />}
          title="Templates"
          description="Install a ready-made, fully themed starting point — site layout, pages, products, content, and emails — onto your active site. Everything installs as drafts you can review, customize, and then take live."
        />

        {blueprints.length === 0 ? (
          <Card>
            <CardContent>
              <Text variant="muted">No templates are available yet.</Text>
            </CardContent>
          </Card>
        ) : (
          <Grid minItemWidth="20rem" gap={4}>
            {blueprints.map((bp) => (
              <Card key={bp.key} variant="module">
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
                    <TemplateCardActions
                      blueprintKey={bp.key}
                      blueprintName={bp.name}
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
  );
}
