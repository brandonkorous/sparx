// What the domain step's pieces share: one priced search result, and how a price reads.

/** One priced availability result from POST /v1/domains/search. */
export interface DomainSuggestion {
  domain: string;
  tld: string;
  available: boolean;
  exact: boolean;
  displayPrice: number;
  renewalDisplayPrice: number;
}

export function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
