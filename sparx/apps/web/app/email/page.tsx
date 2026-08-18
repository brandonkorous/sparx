import { makeMetadata } from '@/lib/load-module';
import { EmailPage } from '@/components/marketing/email-page';

export const generateMetadata = makeMetadata('email');

export default function Email() {
  return <EmailPage />;
}
