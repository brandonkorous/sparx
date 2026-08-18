// The storefront half of the `cms.article-body` pinned core (docs/122): the routed
// CMS entry's rich text, serialized to sanitized HTML.
//
// It is a host core rather than a bound node because a post body is a DOCUMENT, not a
// string — `{type:'doc',content:[…]}` with headings, lists, quotes, callouts, code and
// embeds inside it. silica's value binding fills text and `src`; handed a doc it would
// stringify the object. So this walks the doc through the same `renderDocToHtml` the
// no-template fallback (`PageView`) uses, meaning an authored blog template and the bare
// fallback typeset a post identically — the template only changes what SURROUNDS it.
//
// `.sparx-content` is the shared prose stylesheet (wizeworks/apps/site/app/globals.css); it, not
// this component, owns how a paragraph or a blockquote inside the body looks.

import { renderDocToHtml } from '@wizeworks/cms-editor';

export interface ArticleBodyProps {
  /** The entry's rich-text doc, as stored. Null/absent renders nothing — an entry
   *  with an empty body should leave a gap in the template, not an error. */
  doc?: unknown;
  className?: string;
}

export function ArticleBody({ doc, className }: ArticleBodyProps) {
  if (!doc) return null;
  const html = renderDocToHtml(doc);
  if (!html) return null;
  // The HTML goes on the `.sparx-content` element ITSELF, not a wrapper div: the prose
  // stylesheet reaches its blocks with direct-child selectors (`.sparx-content > :first-child`),
  // which a wrapper would break — the first paragraph would keep a top margin it should drop.
  return (
    <article
      className={className ? `sparx-content ${className}` : 'sparx-content'}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
