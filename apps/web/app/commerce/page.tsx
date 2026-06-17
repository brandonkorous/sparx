import { makeMetadata } from '@/lib/load-module';
import { Nav } from '@/components/marketing/nav';
import { Footer } from '@/components/marketing/footer';
import { CommercePage } from '@/components/marketing/commerce-page';

export const generateMetadata = makeMetadata('commerce');

export default function Commerce() {
  return (
    <>
      <Nav />
      <CommercePage />
      <Footer />
    </>
  );
}
