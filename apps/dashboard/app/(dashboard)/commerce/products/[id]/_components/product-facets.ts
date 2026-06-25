// Open-ended option sets for the product editor's smart lookups, served by
// GET /v1/commerce/products/facets (mirrors ProductFacets in product-service).
// Each set seeds creatable lookups — never constrains what the user can enter.
export interface ProductFacets {
  productTypes: string[];
  vendors: string[];
  tags: string[];
  taxClasses: string[];
}
