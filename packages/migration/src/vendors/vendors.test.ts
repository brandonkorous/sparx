import { describe, expect, it } from 'vitest';
import { parseCsv } from '../parse/csv';
import { parseWxr } from '../parse/wxr';
import { VENDORS, allSources } from './index';
import { shopifyInternals } from './shopify';
import { woocommerceInternals } from './woocommerce';
import { wixInternals } from './wix';
import { magentoInternals } from './magento';
import { squareInternals } from './square';
import { etsyInternals } from './etsy';
import { hubspotInternals } from './hubspot';
import { bigcommerceInternals } from './bigcommerce';
import { ghostInternals } from './ghost';

const rows = (csv: string) => parseCsv(csv).rows;

describe('the roster itself', () => {
  it('has unique vendor slugs and unique source ids', () => {
    const slugs = VENDORS.map((vendor) => vendor.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const ids = allSources().map((entry) => entry.source.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every source a mapper', () => {
    for (const { vendor, source } of allSources()) {
      const mappable =
        typeof source.map === 'function' ||
        typeof source.mapText === 'function' ||
        typeof source.mapAll === 'function';
      expect(mappable, `${vendor.slug}/${source.id} has no mapper`).toBe(true);
    }
  });

  it('tells the tenant where to find every file', () => {
    for (const { source } of allSources()) {
      expect(source.where.length, `${source.id} has no instructions`).toBeGreaterThan(5);
      expect(source.file.length).toBeGreaterThan(2);
    }
  });
});

describe('shopify products', () => {
  // The real shape: one product, two variants, three images, spread over four rows
  // with almost every column blank after the first.
  const csv = [
    'Handle,Title,Body (HTML),Vendor,Type,Tags,Published,Option1 Name,Option1 Value,Variant SKU,Variant Grams,Variant Inventory Tracker,Variant Inventory Qty,Variant Price,Variant Compare At Price,Image Src,Image Position,SEO Title,Status,Cost per item,Variant Weight Unit',
    'blue-tee,Blue Tee,"<p>Soft, and blue.</p>",Acme,Shirts,"new,summer",TRUE,Size,Small,TEE-S,200,shopify,12,19.99,24.99,https://cdn/1.jpg,1,Blue Tee | Acme,active,7.50,g',
    'blue-tee,,,,,,,,Medium,TEE-M,220,shopify,4,21.99,,https://cdn/2.jpg,2,,,8.00,g',
    'blue-tee,,,,,,,,,,,,,,,https://cdn/3.jpg,3,,,,',
  ].join('\n');

  const mapped = shopifyInternals.mapProducts(rows(csv));

  it('produces one row per variant, not per file row', () => {
    expect(mapped).toHaveLength(2);
    expect(mapped.map((row) => row.sku)).toEqual(['TEE-S', 'TEE-M']);
  });

  it('carries the product fields from the first row onto every variant', () => {
    expect(mapped[1]!.title).toBe('Blue Tee');
    expect(mapped[1]!.vendor).toBe('Acme');
    expect(mapped[1]!.status).toBe('active');
    expect(mapped[1]!.option1_name).toBe('Size');
    expect(mapped[1]!.option1_value).toBe('Medium');
  });

  it('re-gathers the gallery from the image-only continuation rows', () => {
    expect(mapped[0]!.images).toBe('https://cdn/1.jpg, https://cdn/2.jpg, https://cdn/3.jpg');
    // Only once — repeating it per variant would upload the gallery twice.
    expect(mapped[1]!.images).toBeUndefined();
  });

  it('keeps the HTML body intact through its embedded comma and tags', () => {
    expect(mapped[0]!.description).toBe('<p>Soft, and blue.</p>');
  });

  it('reads cost and stock', () => {
    expect(mapped[0]!.cost_per_item).toBe('7.50');
    expect(mapped[0]!.quantity).toBe('12');
    expect(mapped[0]!.track_inventory).toBe('true');
  });

  it('converts weights out of the unit column', () => {
    const kg = shopifyInternals.mapProducts(
      rows(
        'Handle,Title,Variant SKU,Variant Price,Variant Grams,Variant Weight Unit\nx,X,X-1,5,2,kg'
      )
    );
    expect(kg[0]!.weight_grams).toBe('2000');
  });

  it('defaults an unknown status to draft rather than publishing the catalogue', () => {
    const odd = shopifyInternals.mapProducts(
      rows('Handle,Title,Variant SKU,Variant Price,Status\nx,X,X-1,5,something-else')
    );
    expect(odd[0]!.status).toBe('draft');
  });
});

describe('shopify inventory', () => {
  it('unpivots one column per location into one row per location', () => {
    const csv = [
      'Handle,Title,Option1 Name,Option1 Value,SKU,HS Code,COO,Main Warehouse,Front Shop',
      'blue-tee,Blue Tee,Size,Small,TEE-S,6109,US,12,3',
      'blue-tee,Blue Tee,Size,Medium,TEE-M,6109,US,4,not stocked',
    ].join('\n');
    const mapped = shopifyInternals.mapInventory(rows(csv));
    expect(mapped).toEqual([
      { sku: 'TEE-S', location: 'Main Warehouse', quantity: '12' },
      { sku: 'TEE-S', location: 'Front Shop', quantity: '3' },
      { sku: 'TEE-M', location: 'Main Warehouse', quantity: '4' },
    ]);
  });

  it('reads the newer tall format too', () => {
    const csv = 'Handle,SKU,Location,On hand,Available,Incoming\nx,X-1,Depot,9,7,2';
    expect(shopifyInternals.mapInventory(rows(csv))[0]).toEqual({
      sku: 'X-1',
      location: 'Depot',
      quantity: '9',
      available: '7',
      incoming: '2',
    });
  });
});

describe('shopify orders and discounts', () => {
  it('puts the order totals on the first line only', () => {
    const csv = [
      'Name,Email,Financial Status,Currency,Total,Created at,Lineitem quantity,Lineitem name,Lineitem price,Lineitem sku',
      '#1001,sam@example.com,paid,USD,41.98,2026-05-27 10:00:00,1,Blue Tee,19.99,TEE-S',
      '#1001,,,,,,1,Red Tee,21.99,TEE-M',
    ].join('\n');
    const mapped = shopifyInternals.mapOrders(rows(csv));
    expect(mapped).toHaveLength(2);
    expect(mapped[0]!.total).toBe('41.98');
    expect(mapped[1]!.total).toBeUndefined();
    expect(mapped[1]!.line_sku).toBe('TEE-M');
  });

  it('reads a percentage discount as a percentage, not as cents', () => {
    // Shopify writes 15% off as -0.15. Importing that as a fixed amount would give
    // every customer 15 cents off instead of 15 percent.
    const csv =
      'Name,Type,Value,Value Type,Minimum Requirement Type,Status\nSUMMER,Percentage,-0.15,percentage,none,active';
    const mapped = shopifyInternals.mapDiscounts(rows(csv));
    expect(mapped[0]!.type).toBe('percentage');
    expect(mapped[0]!.value).toBe('15');
  });
});

describe('woocommerce', () => {
  const csv = [
    'ID,Type,SKU,Name,Published,Description,Regular price,Sale price,Stock,Parent,Attribute 1 name,Attribute 1 value(s),Images,Weight (kg),Tax status,Categories',
    '10,variable,TEE,Blue Tee,1,A tee,,,,,Size,"Small, Medium",https://cdn/a.jpg,0.2,taxable,Clothing > Tees',
    '11,variation,TEE-S,Blue Tee - Small,1,,20.00,15.00,5,id:10,Size,Small,,0.2,taxable,',
    '12,variation,TEE-M,Blue Tee - Medium,1,,22.00,,3,id:10,Size,Medium,,0.2,taxable,',
  ].join('\n');
  const mapped = woocommerceInternals.mapProducts(rows(csv));

  it('resolves variations back to their parent', () => {
    expect(mapped).toHaveLength(2);
    expect(mapped.every((row) => row.handle === 'TEE')).toBe(true);
    expect(mapped[0]!.title).toBe('Blue Tee');
  });

  it('reads a sale price as the price and the regular price as the compare-at', () => {
    expect(mapped[0]!.price).toBe('15.00');
    expect(mapped[0]!.compare_at_price).toBe('20.00');
    // No sale on the second: regular price is simply the price.
    expect(mapped[1]!.price).toBe('22.00');
    expect(mapped[1]!.compare_at_price).toBeUndefined();
  });

  it('takes the option value from the variation, not the parent list', () => {
    expect(mapped[0]!.option1_value).toBe('Small');
    expect(mapped[1]!.option1_value).toBe('Medium');
  });

  it('reads both spellings of the parent pointer', () => {
    expect(woocommerceInternals.parentRef('id: 42')).toEqual({ id: '42' });
    expect(woocommerceInternals.parentRef('TEE')).toEqual({ sku: 'TEE' });
    expect(woocommerceInternals.parentRef('')).toEqual({});
  });

  it('keeps an orphaned variation rather than dropping it', () => {
    const orphan = woocommerceInternals.mapProducts(
      rows('ID,Type,SKU,Name,Regular price,Parent\n9,variation,X-1,Lonely,5.00,id:999')
    );
    expect(orphan).toHaveLength(1);
    expect(orphan[0]!.sku).toBe('X-1');
  });
});

describe('wix', () => {
  const csv = [
    'handleId,fieldType,name,description,productImageUrl,sku,price,visible,inventory,surcharge,productOptionName1,productOptionDescription1',
    'tee,Product,Blue Tee,A tee,https://cdn/a.jpg;https://cdn/b.jpg,TEE,20,true,10,,Size,',
    'tee,Variant,,,,TEE-S,,,4,,,Small',
    'tee,Variant,,,,TEE-L,,,2,4,,Large',
  ].join('\n');
  const mapped = wixInternals.mapProducts(rows(csv));

  it('splits the semicolon-separated gallery', () => {
    expect(mapped[0]!.images).toBe('https://cdn/a.jpg, https://cdn/b.jpg');
  });

  it('adds the surcharge to the parent price instead of importing the variant free', () => {
    expect(mapped[0]!.price).toBe('20');
    expect(mapped[1]!.price).toBe('24');
  });
});

describe('adobe commerce', () => {
  it('unpacks configurable_variations into real variants', () => {
    const csv = [
      'sku,store_view_code,attribute_set_code,product_type,name,price,qty,url_key,configurable_variations,categories,product_online',
      'TEE,,Default,configurable,Blue Tee,20,0,blue-tee,"sku=TEE-S,size=Small|sku=TEE-M,size=Medium",Default Category/Tees,1',
      'TEE-S,,Default,simple,Blue Tee Small,20,5,,,Default Category/Tees,1',
      'TEE-M,,Default,simple,Blue Tee Medium,22,3,,,Default Category/Tees,1',
    ].join('\n');
    const mapped = magentoInternals.mapProducts(rows(csv));
    expect(mapped).toHaveLength(2);
    expect(mapped.map((row) => row.sku)).toEqual(['TEE-S', 'TEE-M']);
    expect(mapped[0]!.option1_name).toBe('size');
    expect(mapped[0]!.option1_value).toBe('Small');
    // Price and stock come from the child row, the name from the parent.
    expect(mapped[1]!.price).toBe('22');
    expect(mapped[1]!.quantity).toBe('3');
    expect(mapped[1]!.title).toBe('Blue Tee');
    expect(mapped[0]!.collections).toBe('Tees');
  });

  it('skips per-store-view override rows', () => {
    const csv = [
      'sku,store_view_code,attribute_set_code,product_type,name,price,qty',
      'MUG,,Default,simple,Mug,10,4',
      'MUG,fr,Default,simple,Tasse,10,4',
    ].join('\n');
    expect(magentoInternals.mapProducts(rows(csv))).toHaveLength(1);
  });
});

describe('square', () => {
  const csv = [
    'Reference Handle,Item Name,Variation Name,Description,SKU,Price,Default Unit Cost,Current Quantity Downtown,Current Quantity Airport,Reporting Category,Stockable',
    ',Blue Tee,Small,A tee,TEE-S,20.00,7.00,12,3,Apparel,Y',
    ',Blue Tee,Medium,,TEE-M,20.00,7.00,4,0,Apparel,Y',
  ].join('\n');

  it('groups POS items by name when the handle is blank', () => {
    const mapped = squareInternals.mapProducts(rows(csv));
    expect(mapped).toHaveLength(2);
    expect(new Set(mapped.map((row) => row.handle)).size).toBe(1);
    expect(mapped[0]!.option1_value).toBe('Small');
  });

  it('unpivots stock into one row per shop', () => {
    const mapped = squareInternals.mapInventory(rows(csv));
    expect(mapped).toHaveLength(4);
    expect(mapped[0]).toMatchObject({ sku: 'TEE-S', location: 'Downtown', quantity: '12' });
    expect(mapped[1]).toMatchObject({ sku: 'TEE-S', location: 'Airport', quantity: '3' });
    expect(mapped[3]).toMatchObject({ sku: 'TEE-M', location: 'Airport', quantity: '0' });
  });

  it('reads the location off the column name', () => {
    expect(squareInternals.locationFrom('Current Quantity Back Room', 'Current Quantity')).toBe(
      'Back Room'
    );
    expect(squareInternals.locationFrom('Price', 'Current Quantity')).toBeNull();
  });
});

describe('etsy', () => {
  const csv = [
    'TITLE,DESCRIPTION,PRICE,CURRENCY_CODE,QUANTITY,TAGS,SKU,IMAGE1,IMAGE2,VARIATION 1 TYPE,VARIATION 1 NAME,VARIATION 1 VALUES',
    'Hand Mug,A mug,24.00,USD,7,"pottery,gift",MUG,https://i/1.jpg,https://i/2.jpg,Custom,Colour,"Blue,Green"',
  ].join('\n');
  const mapped = etsyInternals.mapListings(rows(csv));

  it('expands the declared variation values into variants', () => {
    expect(mapped).toHaveLength(2);
    expect(mapped.map((row) => row.option1_value)).toEqual(['Blue', 'Green']);
    expect(mapped.map((row) => row.sku)).toEqual(['MUG-BLUE', 'MUG-GREEN']);
  });

  it('does not multiply the listing quantity across variants', () => {
    expect(mapped[0]!.quantity).toBe('7');
    expect(mapped[1]!.quantity).toBeUndefined();
  });

  it('rebuilds a buyer list from the orders file', () => {
    const orders = [
      'Order ID,Sale Date,Buyer,Item Name,Quantity,Price,Ship Name,Ship City,Ship Zipcode,SKU',
      '2001,2026-05-01,samq,Hand Mug,1,24.00,Sam Quinn,Leeds,LS1,MUG',
      '2001,2026-05-01,samq,Coaster,2,8.00,Sam Quinn,Leeds,LS1,CST',
      '2002,2026-05-02,alexr,Hand Mug,1,24.00,Alex Ray,Bath,BA1,MUG',
    ].join('\n');
    const buyers = etsyInternals.mapBuyers(rows(orders));
    expect(buyers).toHaveLength(2);
    expect(buyers[0]!.name).toBe('Sam Quinn');
    expect(buyers[0]!.city).toBe('Leeds');
  });
});

describe('bigcommerce', () => {
  it('skips rule rows and keeps SKU rows as variants', () => {
    const csv = [
      'Item Type,Product ID,Product Name,Product Code/SKU,Price,Current Stock Level,Product Visible?,Category,Brand Name,Track Inventory',
      'Product,55,Blue Tee,TEE,20.00,0,Yes,Home/Tees;Home/Sale,Acme,by option',
      'SKU,,,TEE-S,20.00,5,,,,',
      'Rule,,,,,,,,,',
    ].join('\n');
    const mapped = bigcommerceInternals.mapProducts(rows(csv));
    expect(mapped).toHaveLength(1);
    expect(mapped[0]!.sku).toBe('TEE-S');
    expect(mapped[0]!.vendor).toBe('Acme');
    expect(mapped[0]!.collections).toBe('Tees, Sale');
  });
});

describe('hubspot', () => {
  it('reads won and lost out of the stage name', () => {
    const csv = [
      'Deal Name,Deal Stage,Pipeline,Amount,Close Date,Deal owner,Associated Company',
      'Acme renewal,Closed Won,Sales,5000,12/25/2026,sam@example.com,Acme',
      'Beta pilot,Closed Lost,Sales,2000,11/01/2026,sam@example.com,Beta',
      'Gamma trial,Decision Maker Bought-In,Sales,3000,01/15/2027,sam@example.com,Gamma',
    ].join('\n');
    const mapped = hubspotInternals.mapDeals(rows(csv));
    expect(mapped.map((row) => row.status)).toEqual(['won', 'lost', 'open']);
  });

  it('reads contacts under either header spelling', () => {
    const a = hubspotInternals.mapContacts(
      rows('Email,First Name,Lifecycle Stage\nsam@x.com,Sam,lead')
    );
    const b = hubspotInternals.mapContacts(
      rows('Email Address,First Name,Lifecycle Stage\nsam@x.com,Sam,lead')
    );
    expect(a[0]!.email).toBe('sam@x.com');
    expect(b[0]!.email).toBe('sam@x.com');
  });
});

describe('ghost', () => {
  it('walks the tag join table so taxonomy survives', () => {
    const json = JSON.stringify({
      db: [
        {
          data: {
            posts: [
              {
                id: 'p1',
                title: 'Hello',
                slug: 'hello',
                html: '<p>Hi</p>',
                status: 'published',
                published_at: '2026-05-27T10:00:00.000Z',
                author_id: 'u1',
              },
            ],
            tags: [{ id: 't1', name: 'Notes', slug: 'notes' }],
            posts_tags: [{ post_id: 'p1', tag_id: 't1' }],
            users: [{ id: 'u1', name: 'Sam Quinn' }],
          },
        },
      ],
    });
    const out = ghostInternals.ghostEntities(json);
    expect(out.content?.[0]).toMatchObject({
      title: 'Hello',
      slug: 'hello',
      tags: 'Notes',
      author: 'Sam Quinn',
      status: 'published',
    });
    expect(out.categories?.[0]!.name).toBe('Notes');
  });

  it('returns nothing rather than throwing on a broken file', () => {
    expect(ghostInternals.ghostEntities('not json at all')).toEqual({});
  });
});

describe('wxr', () => {
  const xml = `<?xml version="1.0"?>
<rss xmlns:wp="http://wordpress.org/export/1.2/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:excerpt="x" xmlns:dc="y">
<channel>
  <title>Old Site</title>
  <wp:base_site_url>https://old.example.com</wp:base_site_url>
  <wp:category><wp:cat_name><![CDATA[News]]></wp:cat_name><wp:category_nicename>news</wp:category_nicename></wp:category>
  <item>
    <title><![CDATA[Hello world]]></title>
    <link>https://old.example.com/2024/05/hello-world/</link>
    <dc:creator><![CDATA[sam]]></dc:creator>
    <content:encoded><![CDATA[<p>Body with an &amp; in it</p>]]></content:encoded>
    <wp:post_id>7</wp:post_id>
    <wp:post_date_gmt>2024-05-27 10:00:00</wp:post_date_gmt>
    <wp:post_name>hello-world</wp:post_name>
    <wp:status>publish</wp:status>
    <wp:post_type>post</wp:post_type>
    <category domain="category" nicename="news"><![CDATA[News]]></category>
    <category domain="post_tag" nicename="intro"><![CDATA[intro]]></category>
    <wp:postmeta><wp:meta_key>_yoast_wpseo_title</wp:meta_key><wp:meta_value><![CDATA[Hello — Old Site]]></wp:meta_value></wp:postmeta>
  </item>
  <item>
    <title><![CDATA[Draft thing]]></title>
    <wp:post_name>draft-thing</wp:post_name>
    <wp:status>trash</wp:status>
    <wp:post_type>post</wp:post_type>
  </item>
  <item>
    <title><![CDATA[A revision]]></title>
    <wp:status>inherit</wp:status>
    <wp:post_type>revision</wp:post_type>
  </item>
  <item>
    <title><![CDATA[photo.jpg]]></title>
    <wp:attachment_url>https://old.example.com/wp-content/uploads/photo.jpg</wp:attachment_url>
    <wp:status>inherit</wp:status>
    <wp:post_type>attachment</wp:post_type>
  </item>
</channel>
</rss>`;

  const document = parseWxr(xml);

  it('takes published posts and leaves trash and revisions behind', () => {
    expect(document.content).toHaveLength(1);
    expect(document.content[0]!.title).toBe('Hello world');
    expect(document.content[0]!.status).toBe('published');
  });

  it('keeps HTML entities inside the body untouched', () => {
    expect(document.content[0]!.body).toBe('<p>Body with an &amp; in it</p>');
  });

  it('separates categories from tags by their domain attribute', () => {
    expect(document.content[0]!.categories).toBe('News');
    expect(document.content[0]!.tags).toBe('intro');
  });

  it('rescues the SEO title a plugin owned', () => {
    expect(document.content[0]!.seo_title).toBe('Hello — Old Site');
  });

  it('builds a redirect from the old dated permalink to the new slug', () => {
    expect(document.redirects[0]).toEqual({
      from: '/2024/05/hello-world/',
      to: '/hello-world',
      status_code: '301',
    });
  });

  it('takes the media library but not the revision attachment status', () => {
    expect(document.media).toHaveLength(1);
    expect(document.media[0]!.filename).toBe('photo.jpg');
  });

  it('takes the category list off the channel', () => {
    expect(document.categories).toEqual([
      { name: 'News', slug: 'news', parent: '', description: '' },
    ]);
  });
});
