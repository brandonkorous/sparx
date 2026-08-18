import { makeMetadata } from '@/lib/load-module';
import { CrmPage } from '@/components/marketing/crm-page';

export const generateMetadata = makeMetadata('crm');

export default function Crm() {
  return <CrmPage />;
}
