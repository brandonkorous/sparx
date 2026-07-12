import { makeMetadata } from '@/lib/load-module';
import { AiPage } from '@/components/marketing/ai-page';

export const generateMetadata = makeMetadata('ai');

export default function Ai() {
  return <AiPage />;
}
