import { redirect } from 'next/navigation';

// /builder → the page editor, the primary Builder surface today. (When the
// module grows an overview/landing, this becomes that instead of a redirect.)
export default function BuilderIndex() {
  redirect('/builder/page');
}
