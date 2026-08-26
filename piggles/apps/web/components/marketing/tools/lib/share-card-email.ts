import { CARD_LAYOUTS, type CardLayout } from './share-card';
import type { ToolResultLine } from '../tool-result-context';

export interface ShareCardSettings {
  title: string;
  subtitle: string;
  footer: string;
  layout: CardLayout;
  background: string;
  accent: string;
  hasLogo: boolean;
  filename: string;
}

/** The tags that point a shared link at the picture. One source for both the
 *  block on screen and the line in the email — they were separate copies, which
 *  is one edit away from telling somebody two different things. */
export function shareCardMarkup(filename: string): string {
  return [
    `<meta property="og:image" content="https://yoursite.example/${filename}.png">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta name="twitter:card" content="summary_large_image">',
  ].join('\n');
}

/** The picture and any logo in it stay on the visitor's own machine. What
 *  travels is the wording, the settings that made it, and the code that points
 *  at it — the half that gets forwarded to whoever looks after the website. */
export function shareCardLines(s: ShareCardSettings): ToolResultLine[] {
  return [
    { label: 'Headline', value: s.title },
    ...(s.subtitle.trim() ? [{ label: 'Line underneath', value: s.subtitle }] : []),
    ...(s.footer.trim() ? [{ label: 'Business name', value: s.footer }] : []),
    {
      label: 'Arrangement',
      value: CARD_LAYOUTS.find((l) => l.value === s.layout)?.label ?? s.layout,
    },
    { label: 'Background', value: s.background.toUpperCase() },
    { label: 'Accent', value: s.accent.toUpperCase() },
    { label: 'Logo', value: s.hasLogo ? 'Added' : 'None' },
    { label: 'Code to add', value: shareCardMarkup(s.filename) },
  ];
}

export const SHARE_CARD_NOTE =
  'Open the tool again with these to download the picture. Put it on your site, then change the address in the first line to wherever it ended up. Until that address is right, nothing shows.';
