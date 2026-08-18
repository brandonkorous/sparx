import { makeMetadata } from '@/lib/load-module';
import { StaffPage } from '@/components/marketing/staff-page';

export const generateMetadata = makeMetadata('staff');

export default function Staff() {
  return <StaffPage />;
}
