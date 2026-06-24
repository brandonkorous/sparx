import { notFound, redirect } from 'next/navigation';

import type { ProviderKind, ProviderMetadata } from '@sparx/commerce-schemas';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import { ensureProvidersRegistered } from '../../../../../lib/providers-bootstrap';

import { InstallProviderForm } from './_components/install-provider-form';

// Catalog-driven deep link: requires `?slug=&kind=` to know WHICH provider to
// install, then builds its fields from that provider's JSON config schema. This
// is why the install surface is full-page only and is NOT wired into the generic
// drawer/modal "New" overlay — a generic create overlay carries no provider
// context. The embedded SurfaceFrame inside InstallProviderForm supplies the
// title + chrome, so this route just resolves metadata and renders the form.

export const dynamic = 'force-dynamic';

const KIND_VALUES = new Set([
  'payment',
  'tax',
  'shipping',
  'subscription_billing',
  'dropship',
  'identity',
]);

export default async function InstallProviderPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; kind?: string }>;
}) {
  ensureProvidersRegistered();

  const { slug, kind } = await searchParams;
  if (!slug || !kind) redirect('/commerce/providers');
  if (!KIND_VALUES.has(kind)) redirect('/commerce/providers');

  let metadata: ProviderMetadata | null;
  try {
    metadata = await api.get<ProviderMetadata | null>(
      `/v1/commerce/providers/metadata/${encodeURIComponent(slug)}`
    );
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }
  if (!metadata) notFound();
  if (!metadata.kinds.includes(kind as ProviderKind)) redirect('/commerce/providers');

  return (
    <InstallProviderForm
      providerSlug={metadata.slug}
      kind={kind as ProviderKind}
      displayName={metadata.displayName}
      configSchemaJson={metadata.configSchemaJson}
      sandboxAvailable={metadata.sandboxAvailable}
      webhookPathTemplate={metadata.webhookPathTemplate}
    />
  );
}
