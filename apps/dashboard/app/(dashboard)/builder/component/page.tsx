import { redirect } from 'next/navigation';

// The component catalog moved to the plural /builder/components (docs/51 §4.2,
// the Collection/List standard). This legacy singular route just forwards there
// so any old links/bookmarks still resolve.
export default function BuilderComponentRedirect() {
  redirect('/builder/components');
}
