import { makeMetadata } from '@/lib/load-module';
import { CommercePage } from '@/components/marketing/commerce-page';

export const generateMetadata = makeMetadata('commerce');

export default function Commerce() {
  return <CommercePage />;
}
