// What on her site links to a piece, said before she deletes it or takes it down.
//
// Both questions used to say nothing about links. She deleted a correction note that
// her mill piece linked to, and the mill piece went on sending readers to a page that
// was not there (persona P09). The API finds the links (`/linked-from`); this says what
// they mean in one sentence.

import { api } from '../../lib/api/client';

export interface LinkingThing {
  kind: 'entry' | 'page' | 'layout';
  id: string;
  title: string;
  /** Whether readers can follow the link today. */
  live: boolean;
}

export function fetchLinkedFrom(id: string): Promise<LinkingThing[]> {
  return api
    .get<{ linkedFrom: LinkingThing[] }>(`/v1/content/entries/${id}/linked-from`)
    .then((r) => r.linkedFrom);
}

function named(thing: LinkingThing): string {
  return thing.kind === 'layout' ? 'your site’s header or footer' : `“${thing.title}”`;
}

function list(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * One sentence naming what links here and what happens to those links, or null when
 * nothing does. `action` is what she is about to do.
 */
export function brokenLinksSentence(
  things: readonly LinkingThing[],
  action: 'delete' | 'take down'
): string | null {
  if (things.length === 0) return null;
  const shown = things.slice(0, 3).map(named);
  const more = things.length - shown.length;
  const names = list(more > 0 ? [...shown, `${more} more`] : shown);
  const when = action === 'delete' ? 'After you delete it' : 'While it is down';
  const sentence =
    things.length === 1
      ? `${names} links to this. ${when}, that link will lead readers to a page that is not there.`
      : `${things.length} of your pages link to this: ${names}. ${when}, those links will lead readers to a page that is not there.`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
