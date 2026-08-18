import { makeMetadata } from '@/lib/load-module';
import { B2bPage } from '@/components/marketing/b2b-page';

export const generateMetadata = makeMetadata('b2b');

export default function B2b() {
  return <B2bPage />;
}
