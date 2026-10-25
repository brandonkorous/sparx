import { marketingUrl } from '@piggles/config';
import { resolveHeaderNotice } from '@piggles/config/pricing';
import { HeaderNotice } from '@piggles/ui';

// The bar above every page, streamed in its own <Suspense> so no page waits on api-rest for it.
export async function HeaderNoticeSlot() {
  const notice = await resolveHeaderNotice('account', marketingUrl('pricing#founding'));
  return <HeaderNotice notice={notice} />;
}
