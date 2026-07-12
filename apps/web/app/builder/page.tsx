import { BuilderPage } from '@/components/marketing/builder-page';
import { makeMetadata } from '@/lib/load-module';

export const generateMetadata = makeMetadata('builder');

export default function Builder() {
  return <BuilderPage />;
}
