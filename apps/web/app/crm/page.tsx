import { makeMetadata } from '@/lib/load-module';
import { Nav } from '@/components/marketing/nav';
import { Footer } from '@/components/marketing/footer';
import { CrmPage } from '@/components/marketing/crm-page';

export const generateMetadata = makeMetadata('crm');

export default function Crm() {
  return (
    <>
      <Nav />
      <CrmPage />
      <Footer />
    </>
  );
}
