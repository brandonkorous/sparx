import { makeMetadata } from '@/lib/load-module';
import { Nav } from '@/components/marketing/nav';
import { Footer } from '@/components/marketing/footer';
import { DropshipPage } from '@/components/marketing/dropship-page';

export const generateMetadata = makeMetadata('dropship');

export default function Dropship() {
  return (
    <>
      <Nav />
      <DropshipPage />
      <Footer />
    </>
  );
}
