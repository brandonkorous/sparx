// How the API's router reads an address (sparx persona issue 213).
//
// The router refuses any path part longer than `maxParamLength`, and answers that
// the ROUTE does not exist. Its default is 100, and a product's address is up to 127
// letters (`commerce_products.handle`, VarChar(127); a category's and a market
// listing's too). Gillett had 44 products past 100, every one a page that said "We
// couldn't find that page" to a customer who had just found it in search.
//
// 127 letters × 12: the most one letter takes once encoded for an address (a
// four-byte character is %XX four times). The limit exists to bound what the router
// will hold for one part, not to refuse a record the database can store.

export const ROUTER_OPTIONS = { maxParamLength: 127 * 12 };
