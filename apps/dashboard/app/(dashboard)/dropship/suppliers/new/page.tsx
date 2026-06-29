import { api } from '@/lib/api-rest-client';
import { listProperties, type Property } from '@/lib/sites';
import { SupplierForm, type Vendor, type SiteOption } from '../_components/supplier-form';

// Full-page surface for connecting a dropship supplier. The surface-aware
// `SupplierForm` renders the SAME SurfaceFrame here (`presentation="page"`) and
// inside the `@detail` drawer/modal overlay (`presentation="overlay"`). Both feed
// it the connectable vendor catalog + the tenant's sites. No page-level
// Container/PageHeader — the embedded frame supplies the title.

export const dynamic = 'force-dynamic';

export default async function NewSupplierPage() {
  const [vendors, properties] = await Promise.all([
    api.get<Vendor[]>('/v1/dropship/vendors').catch(() => [] as Vendor[]),
    listProperties().catch(() => [] as Property[]),
  ]);
  const sites: SiteOption[] = properties.map((p) => ({
    id: p.id,
    name: p.name,
    isPrimary: p.isPrimary,
  }));
  return <SupplierForm presentation="page" vendors={vendors} sites={sites} />;
}
