import { makeMetadata } from '@/lib/load-module';
import { Nav } from '@/components/marketing/nav';
import { Footer } from '@/components/marketing/footer';
import { CmsPage } from '@/components/marketing/cms-page';

export const generateMetadata = makeMetadata('cms');

export default function Cms() {
  return (
    <>
      <Nav />
      <CmsPage />
      <Footer />
    </>
  );
}
