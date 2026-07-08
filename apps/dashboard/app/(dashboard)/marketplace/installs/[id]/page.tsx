// "Review & go live" surface (docs/54 §8). After an install, list everything the
// blueprint created — grouped by type, each deep-linking into its editor — built
// from the install row's id-map (GET /v1/blueprints/installs/:id). Go-live + reset
// live here; the marketplace card just links in.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { LayoutTemplate } from 'lucide-react';
import { requireSession } from '@sparx/auth';
import { Badge, Button, Card, CardBody, CardTitle } from 'silicaui-react';
import { PageHeader } from '@sparx/ui';

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
    .get<{
      name: string;
      version: string;
    }>(`/v1/blueprints/${encodeURIComponent(install.blueprint_key)}`)
    .catch(() => null);
  const name = summary?.name ?? install.blueprint_key;
  const isLive = install.status === 'live';
  // Version drift (docs/55 §6): the catalog moved ahead of what's installed → offer
  // a non-destructive Update (it keeps the tenant's edits).
  const latestVersion = summary?.version;
  const updateAvailable = Boolean(latestVersion && latestVersion !== install.blueprint_version);

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
    <div className="mx-auto w-full max-w-screen-lg px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<LayoutTemplate className="h-5 w-5" />}
          title={`Review “${name}”`}
          description={
            isLive
              ? 'This blueprint is live on your site.'
              : 'Everything below installed as drafts — review and customize it, then go live.'
          }
        />

        <div className="flex flex-row flex-wrap items-center gap-3">
          <Badge color={isLive ? 'success' : 'neutral'} variant="soft">
            {isLive ? 'Live' : 'Installed · draft'}
          </Badge>
          <ReviewActions
            installId={install.id}
            blueprintName={name}
            status={install.status}
            canManage={canManage}
          />
          {updateAvailable ? (
            <>
              <Badge color="warning" variant="soft">
                v{latestVersion} available
              </Badge>
              <Button
                color="primary"
                variant="soft"
                render={
                  <Link href={`/marketplace/installs/${install.id}/update`}>Review update</Link>
                }
              />
            </>
          ) : null}
        </div>

        {groups.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-base-content/70">This install recorded no artifacts.</p>
            </CardBody>
          </Card>
        ) : (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(18rem,100%),1fr))' }}
          >
            {groups.map((g) => (
              <Card key={g.title}>
                <CardBody>
                  <div className="flex flex-row items-center justify-between gap-2">
                    <CardTitle>{g.title}</CardTitle>
                    <Badge variant="outline">{g.items.length}</Badge>
                  </div>
                  <div className="flex flex-col gap-1">
                    {g.items.map((item) => (
                      <Link
                        key={item.href + item.label}
                        href={item.href}
                        className="block truncate text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:underline"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
