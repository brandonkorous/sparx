import { makeMetadata } from '@/lib/load-module';
import { CmsPage } from '@/components/marketing/cms-page';

export const generateMetadata = makeMetadata('cms');

export default function Cms() {
  return <CmsPage />;
}
