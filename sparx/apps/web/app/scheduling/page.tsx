import { makeMetadata } from '@/lib/load-module';
import { SchedulingPage } from '@/components/marketing/scheduling-page';

export const generateMetadata = makeMetadata('scheduling');

export default function Scheduling() {
  return <SchedulingPage />;
}
