// "Review & go live" surface (docs/54 §8). After an install, list everything the
// blueprint created — grouped by type, each deep-linking into its editor — built
// from the install row's id-map (GET /v1/blueprints/installs/:id). Go-live + reset
// live here; the marketplace card just links in.

import { notFound } from 'next/navigation';
import Link from 'next/link';
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
import { ReviewActions } from './_components/review-actions';

export const dynamic = 'force-dynamic';

interface InstallDetail {
  id: string;
  blueprint_key: string;
  blueprint_version: string;
  status: string;
  counts: Record<string, number>;
  artifacts: {
    pages: { name: string; id: string; recordType: string | null; slug: string | null }[];
    products: { handle: string; id: string }[];
    content: { typeKey: string; slug: string | null; id: string }[];
    emails: { name: string; id: string }[];
    components: { key: string; id: string }[];
    categories: Record<string, string>;
    collections: Record<string, string>;
    theme: { id: string; name: string } | null;
    layoutId: string | null;
  };
}

interface ReviewGroup {
  title: string;
  items: { label: string; href: string }[];
}

export default async function InstallReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const canManage = session.user.role === 'owner' || session.user.role === 'admin';

  const install = await api
    .get<InstallDetail>(`/v1/blueprints/installs/${encodeURIComponent(id)}`)
    .catch(() => null);
  if (!install) notFound();
  const summary = await api
    .get<{ name: string }>(`/v1/blueprints/${encodeURIComponent(install.blueprint_key)}`)
    .catch(() => null);
  const name = summary?.name ?? install.blueprint_key;
  const isLive = install.status === 'live';

  const a = install.artifacts;
  // Deep-link each artifact into its editor. Per-id routes where they exist
  // (products/collections/content/pages); section index otherwise.
  const groups: ReviewGroup[] = [
    {
      title: 'Pages',
      items: a.pages.map((p) => ({ label: p.name, href: `/builder/studio?page=${p.id}` })),
    },
    {
      title: 'Products',
      items: a.products.map((p) => ({ label: p.handle, href: `/commerce/products/${p.id}` })),
    },
    {
      title: 'Content',
      items: a.content.map((c) => ({
        label: c.slug ?? c.typeKey,
        href: `/cms/types/${c.typeKey}/${c.id}`,
      })),
    },
    {
      title: 'Collections',
      items: Object.entries(a.collections).map(([handle, cid]) => ({
        label: handle,
        href: `/commerce/collections/${cid}`,
      })),
    },
    {
      title: 'Categories',
      items: Object.keys(a.categories).map((handle) => ({
        label: handle,
        href: `/commerce/categories`,
      })),
    },
    { title: 'Emails', items: a.emails.map((e) => ({ label: e.name, href: `/builder/email` })) },
    {
      title: 'Components',
      items: a.components.map((c) => ({ label: c.key, href: `/builder/components` })),
    },
    {
      title: 'Theme',
      items: a.theme ? [{ label: a.theme.name, href: '/builder/studio?zone=theme' }] : [],
    },
    {
      title: 'Layout',
      items: a.layoutId ? [{ label: 'Site layout', href: '/builder/studio?zone=layout' }] : [],
    },
  ].filter((g) => g.items.length > 0);

  return (
    <Container size="lg">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<LayoutTemplate className="h-5 w-5" />}
          title={`Review “${name}”`}
          description={
            isLive
              ? 'This blueprint is live on your site.'
              : 'Everything below installed as drafts — review and customize it, then go live.'
          }
        />

        <Stack direction="row" gap={3} align="center" className="flex-wrap">
          <Badge color={isLive ? 'success' : 'neutral'} variant="soft">
            {isLive ? 'Live' : 'Installed · draft'}
          </Badge>
          <ReviewActions
            installId={install.id}
            blueprintName={name}
            status={install.status}
            canManage={canManage}
          />
        </Stack>

        {groups.length === 0 ? (
          <Card>
            <CardContent>
              <Text variant="muted">This install recorded no artifacts.</Text>
            </CardContent>
          </Card>
        ) : (
          <Grid minItemWidth="18rem" gap={4}>
            {groups.map((g) => (
              <Card key={g.title}>
                <CardHeader>
                  <Stack direction="row" align="center" gap={2} className="justify-between">
                    <CardTitle>{g.title}</CardTitle>
                    <Badge variant="outline">{g.items.length}</Badge>
                  </Stack>
                </CardHeader>
                <CardContent>
                  <Stack gap={1}>
                    {g.items.map((item) => (
                      <Link
                        key={item.href + item.label}
                        href={item.href}
                        className="block truncate text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:underline"
                      >
                        {item.label}
                      </Link>
                    ))}
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
