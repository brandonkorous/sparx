import { makeMetadata } from '@/lib/load-module';
import { FinancePage } from '@/components/marketing/finance-page';

export const generateMetadata = makeMetadata('finance');

export default function Finance() {
  return <FinancePage />;
}
