// A page's title, once, however the business wrote it.
//
// The rule lives in @wizeworks/builder-schemas (`served-title.ts`), so the SEO
// page check and the console's title boxes measure the title the site serves
// (sparx persona issue 134). Kept here so the site's pages import it by the name
// they always have.

export { metadataTitle, namesTheSite, servedTitle, socialTitle } from '@wizeworks/builder-schemas';
