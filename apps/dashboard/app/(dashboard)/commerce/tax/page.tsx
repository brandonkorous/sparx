import Link from 'next/link';
import { FileBadge, Globe2, Plus, Receipt } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Container,
  EmptyState,
  Heading,
  PageHeader,
  Stack,
  Text,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { ListToolbar } from '../../_components/list-toolbar';
import { getUserPreferences } from '../../_shell/preferences';
import { TaxZonesList, type TaxZoneRow } from './_components/tax-zones-list';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TaxPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const [prefs, zones] = await Promise.all([
    getUserPreferences(),
    api.get<TaxZoneRow[]>('/v1/commerce/tax/zones'),
  ]);

  const activeZones = zones.filter((z) => z.isActive);
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Receipt className="h-5 w-5" />}
          title="Tax"
          badge={
            <Badge color="module">
              {activeZones.length} active zone{activeZones.length === 1 ? '' : 's'}
            </Badge>
          }
          description="Register a tax zone for every jurisdiction where the merchant has nexus. Manual rates below run when no TaxProvider (Stripe Tax, TaxJar, Avalara) is installed; the provider wins as soon as one is connected from Commerce → Providers. B2B exemption certificates attach per customer or per B2B account."
          actions={
            <Button color="module" asChild>
              <Link href="/commerce/tax/zones/new">
                <Plus className="h-4 w-4" />
                Add zone
              </Link>
            </Button>
          }
        />

        <Stack gap={1}>
          <Stack direction="row" align="center" gap={2}>
            <Globe2 className="h-4 w-4" />
            <Heading level={3}>Nexus zones</Heading>
          </Stack>
          <Text size="sm" variant="muted">
            Country-wide or region-narrowed (US-CA, US-OR…). Click a zone to add rates.
          </Text>
        </Stack>

        <ListToolbar enableViewToggle searchable={false} />

        {zones.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<Globe2 className="h-5 w-5" />}
              title="No tax zones yet"
              description="Add a zone for every jurisdiction with nexus."
              action={
                <Button color="module" asChild>
                  <Link href="/commerce/tax/zones/new">Create zone</Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <TaxZonesList zones={zones} view={view} />
        )}

        <Card>
          <CardHeader>
            <Stack gap={1}>
              <Stack direction="row" align="center" gap={2}>
                <FileBadge className="h-4 w-4" />
                <Heading level={3}>Exemption certificates</Heading>
              </Stack>
              <CardDescription>
                Customer- or B2B-account-scoped exemptions are attached from the CRM customer detail
                page; the checkout pipeline reads them automatically.
              </CardDescription>
            </Stack>
          </CardHeader>
          <CardContent>
            <Text size="sm" variant="muted">
              Open a customer (CRM → Customers) or a B2B account (CRM → B2B accounts) and use the
              Tax exemptions panel to upload certificates.
            </Text>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
