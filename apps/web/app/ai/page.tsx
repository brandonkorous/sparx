import { makeMetadata } from '@/lib/load-module';
import { Nav } from '@/components/marketing/nav';
import { Footer } from '@/components/marketing/footer';
import { AiPage } from '@/components/marketing/ai-page';

export const generateMetadata = makeMetadata('ai');

export default function Ai() {
  return (
    <>
      <Nav />
      <AiPage />
      <Footer />
    </>
  );
}
