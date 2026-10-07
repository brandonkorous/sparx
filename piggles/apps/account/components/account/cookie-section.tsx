import Link from 'next/link';
import { Badge } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { marketingUrl, PRODUCT } from '@piggles/config';
import type { readConsent } from '@/lib/consent';

type Consent = Awaited<ReturnType<typeof readConsent>>;

/** The analytics answer, as a fact. "Not asked yet" is its own state, never "no". */
function sentence(consent: Consent): string {
  if (consent === null) {
    return `Whether ${PRODUCT.name} may see which screens you use. Nothing is being counted until you say so.`;
  }
  return consent.analytics
    ? `${PRODUCT.name} counts which screens get used inside your workspace, so we can fix what is confusing. Never sold, never advertising, and never anything you have stored.`
    : `${PRODUCT.name} is counting nothing. The only cookies left are the ones that keep you signed in.`;
}

export function CookieSection({ consent }: { consent: Consent }) {
  return (
    <div className="border-base-300 mt-10 border-t pt-8">
      <h2 className="text-xl font-bold">Cookie choices</h2>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {consent === null ? (
          <Badge color="warning" variant="soft" size="lg">
            Not asked yet
          </Badge>
        ) : (
          <Badge color={consent.analytics ? 'success' : 'neutral'} variant="soft" size="lg">
            {consent.analytics ? 'Helping us improve' : 'Analytics off'}
          </Badge>
        )}
        <Link
          className={buttonClasses({ color: 'neutral', variant: 'outline' })}
          href="/cookie-choices"
        >
          {consent === null ? 'Answer it' : 'Change this'}
        </Link>
      </div>
      <p className="mt-3 max-w-prose text-base">
        {sentence(consent)}{' '}
        <a
          className="font-semibold underline"
          href={marketingUrl('cookies')}
          target="_blank"
          rel="noreferrer"
        >
          Every cookie we set
        </a>
        .
      </p>
    </div>
  );
}
