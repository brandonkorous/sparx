import { makeMetadata } from '@/lib/load-module';
import { Nav } from '@/components/marketing/nav';
import { Footer } from '@/components/marketing/footer';
import { EmailPage } from '@/components/marketing/email-page';

export const generateMetadata = makeMetadata('email');

export default function Email() {
  return (
    <>
      <Nav />
      <EmailPage />
      <Footer />
    </>
  );
}
