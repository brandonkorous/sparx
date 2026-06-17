import { Nav } from '@/components/marketing/nav';
import { Footer } from '@/components/marketing/footer';
import { BuilderPage } from '@/components/marketing/builder-page';
import { makeMetadata } from '@/lib/load-module';

export const generateMetadata = makeMetadata('builder');

export default function Builder() {
  return (
    <>
      <Nav />
      <BuilderPage />
      <Footer />
    </>
  );
}
