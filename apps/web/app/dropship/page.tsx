import { makeMetadata } from '@/lib/load-module';
import { DropshipPage } from '@/components/marketing/dropship-page';

export const generateMetadata = makeMetadata('dropship');

export default function Dropship() {
  return <DropshipPage />;
}
