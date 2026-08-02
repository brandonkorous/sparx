import { permanentRedirect } from 'next/navigation';

/**
 * `/for` on its own is not a page — it is the parent of the industry landing
 * pages, and the index of those already exists at /customers.
 *
 * Two hubs listing the same six industries would be duplicate content competing
 * with each other for the same query, so this is a 308 to the one that is real.
 * The leaf URLs keep the `/for/…` shape because that is what reads correctly in
 * an ad and in a search result; only the bare parent redirects.
 */
export default function ForIndex() {
  permanentRedirect('/customers');
}
