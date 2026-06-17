import { makeMetadata } from '@/lib/load-module';
import { Nav } from '@/components/marketing/nav';
import { Footer } from '@/components/marketing/footer';
import { B2bPage } from '@/components/marketing/b2b-page';

export const generateMetadata = makeMetadata('b2b');

export default function B2b() {
  return (
    <>
      <Nav />
      <B2bPage />
      <Footer />
    </>
  );
}
