import { makeMetadata } from '@/lib/load-module';
import { SocialPage } from '@/components/marketing/social-page';

export const generateMetadata = makeMetadata('social');

export default function Social() {
  return <SocialPage />;
}
