import { makeMetadata } from '@/lib/load-module';
import { Nav } from '@/components/marketing/nav';
import { Footer } from '@/components/marketing/footer';
import { SchedulingPage } from '@/components/marketing/scheduling-page';

export const generateMetadata = makeMetadata('scheduling');

export default function Scheduling() {
  return (
    <>
      <Nav />
      <SchedulingPage />
      <Footer />
    </>
  );
}
