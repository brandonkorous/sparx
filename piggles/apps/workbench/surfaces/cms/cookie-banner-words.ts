// What visitors will see, in words, for the summary under the cookie choices.
// Describes wizeworks/apps/site/components/consent/consent-manager.tsx as it is.

import type { Tone } from './data';
import { cornerButtonLabel, visitorView, type CookieBannerMode } from './cookie-banner-data';

export interface VisitorViewWords {
  title: string;
  detail: string;
  tone: Tone;
}

/** The site's own visitor counts skip anyone who has turned analytics off
 *  (wizeworks/apps/site/components/site-analytics-beacon.tsx). */
const COUNTING =
  'Anyone who turns analytics off is no longer counted in your site’s visitor numbers.';

const DEAD_LINK =
  ' Visitors are offered a link to your Cookie Policy from there, and it is not published yet, so that link leads to a missing page until you publish it.';

/** One line on what visitors see, and what it means. `policyPublished` decides
 *  whether "nothing" breaks the policy's promise and whether its link works. */
export function visitorViewWords(
  mode: CookieBannerMode,
  kinds: readonly string[],
  policyPublished: boolean
): VisitorViewWords {
  const view = visitorView(mode, kinds);
  if (view === 'nothing') return nothingWords(policyPublished);
  const tail = `${COUNTING}${policyPublished ? '' : DEAD_LINK}`;
  const tone: Tone = !policyPublished ? 'warning' : view === 'banner' ? 'success' : 'info';
  return view === 'button'
    ? { ...buttonWords(mode, tail), tone }
    : { ...bannerWords(mode, tail), tone };
}

function nothingWords(policyPublished: boolean): VisitorViewWords {
  return {
    title: 'Visitors see nothing about cookies',
    detail: policyPublished
      ? 'No banner and no cookie button. Your Cookie Policy tells visitors they can make their choices with one, so pick an approach above to make that true.'
      : 'No banner and no cookie button, so visitors have no way to choose which cookies they allow.',
    tone: policyPublished ? 'warning' : 'info',
  };
}

function buttonWords(mode: CookieBannerMode, tail: string): Omit<VisitorViewWords, 'tone'> {
  const button = cornerButtonLabel(mode);
  return {
    title: `Visitors see a small “${button}” button, but no banner`,
    detail: `You have not ticked any optional kind of cookie, so there is nothing to ask first. The button sits in the bottom-left corner of every page and opens each visitor’s cookie choices. ${tail}`,
  };
}

function bannerWords(mode: CookieBannerMode, tail: string): Omit<VisitorViewWords, 'tone'> {
  const button = cornerButtonLabel(mode);
  const opening =
    mode === 'ccpa'
      ? `A banner at the bottom of the page tells each new visitor that you use cookies, with a “${button}” button to say no.`
      : 'A banner at the bottom of the page asks each new visitor to accept or reject optional cookies.';
  return {
    title:
      mode === 'ccpa'
        ? 'New visitors see a cookie banner they can say no to'
        : 'New visitors see a cookie banner asking first',
    detail: `${opening} Once they answer it goes away, and a small “${button}” button stays in the bottom-left corner so they can change their mind. ${tail}`,
  };
}
