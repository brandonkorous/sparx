import { describe, expect, it } from 'vitest';
import { detect, mapManually, readSource, sniffFormat } from './detect';

const SHOPIFY_PRODUCTS = [
    'Handle,Title,Body (HTML),Vendor,Type,Tags,Published,Option1 Name,Option1 Value,Variant SKU,Variant Inventory Qty,Variant Price,Image Src,Status',
    'mug,Mug,<p>A mug</p>,Acme,Drinkware,gift,TRUE,Size,Large,MUG-L,6,12.00,https://cdn/1.jpg,active',
].join('\n');

const HUBSPOT_CONTACTS = [
    'First Name,Last Name,Email,Phone Number,Contact owner,Lead Status,Lifecycle Stage,Create Date',
    'Sam,Quinn,sam@example.com,555-0100,ops@acme.com,NEW,lead,05/27/2026',
].join('\n');

const MAILCHIMP = [
    'Email Address,First Name,Last Name,OPTIN_TIME,CONFIRM_TIME,MEMBER_RATING,TAGS,FAVOURITE_COLOR',
    'sam@example.com,Sam,Quinn,2026-01-02 10:00:00,2026-01-02 10:05:00,4,vip,blue',
].join('\n');

const WXR = `<?xml version="1.0"?>
<rss xmlns:wp="http://wordpress.org/export/1.2/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="y" xmlns:excerpt="x">
<channel><title>Old</title><generator>https://wordpress.org/?v=6.5</generator>
<item><title><![CDATA[Post]]></title><wp:post_name>post</wp:post_name><wp:status>publish</wp:status><wp:post_type>post</wp:post_type><content:encoded><![CDATA[<p>Hi</p>]]></content:encoded></item>
</channel></rss>`;

describe('sniffFormat', () => {
    it('reads the format off the first character, before parsing', () => {
        expect(sniffFormat(SHOPIFY_PRODUCTS)).toBe('csv');
        expect(sniffFormat(WXR)).toBe('xml');
        expect(sniffFormat('{"db":[]}')).toBe('json');
        expect(sniffFormat('﻿Handle,Title\n')).toBe('csv');
    });
});

describe('detect', () => {
    it('identifies a Shopify product export from its columns alone', () => {
        const [best] = detect({ text: SHOPIFY_PRODUCTS });
        expect(best?.vendorSlug).toBe('shopify');
        expect(best?.entity).toBe('products');
        expect(best?.confidence).toBeGreaterThan(0.7);
    });

    it('gains confidence from a matching filename but does not need one', () => {
        const without = detect({ text: SHOPIFY_PRODUCTS })[0]!;
        const with_ = detect({ text: SHOPIFY_PRODUCTS, fileName: 'products_export.csv' })[0]!;
        expect(with_.confidence).toBeGreaterThan(without.confidence);
    });

    it('identifies HubSpot contacts', () => {
        const [best] = detect({ text: HUBSPOT_CONTACTS });
        expect(best?.vendorSlug).toBe('hubspot');
        expect(best?.entity).toBe('customers');
    });

    it('identifies a Mailchimp audience', () => {
        const [best] = detect({ text: MAILCHIMP });
        expect(best?.vendorSlug).toBe('mailchimp');
    });

    it('identifies a WordPress export by its generator, not its filename', () => {
        const [best] = detect({ text: WXR, fileName: 'renamed-by-the-user.xml' });
        expect(best?.vendorSlug).toBe('wordpress');
        expect(best?.yields).toContain('content');
    });

    it('returns nothing for a file it does not know', () => {
        expect(detect({ text: 'color,size\nred,large' })).toEqual([]);
    });

    it('explains itself in plain language', () => {
        const [best] = detect({ text: SHOPIFY_PRODUCTS, fileName: 'products_export.csv' });
        expect(best?.reasons.join(' ')).toContain('Handle');
        expect(best?.reasons.join(' ')).toContain('file name');
    });
});

describe('readSource', () => {
    it('detects, maps and validates in one pass without touching the network', () => {
        const result = readSource({ text: SHOPIFY_PRODUCTS, fileName: 'products_export.csv' });
        expect(result.detected?.vendorSlug).toBe('shopify');
        expect(result.entities).toHaveLength(1);
        const [products] = result.entities;
        expect(products?.entity).toBe('products');
        expect(products?.rows[0]).toMatchObject({ handle: 'mug', sku: 'MUG-L', title: 'Mug' });
        expect(products?.report.blocked).toBe(false);
        expect(products?.report.okCount).toBe(1);
    });

    it('fans a WordPress export out into every entity it carries', () => {
        const result = readSource({ text: WXR });
        expect(result.entities.map((entity) => entity.entity)).toContain('content');
    });

    it('keeps the raw rows and headers for the manual mapper', () => {
        const result = readSource({ text: 'color,size\nred,large' });
        expect(result.detected).toBeNull();
        expect(result.headers).toEqual(['color', 'size']);
        expect(result.raw).toEqual([{ color: 'red', size: 'large' }]);
        expect(result.entities).toEqual([]);
    });

    it('honours an explicitly chosen source over the top candidate', () => {
        // A Square item library is both a product file and a stock file. The tenant gets
        // to say which one they meant.
        const square = [
            'Reference Handle,Item Name,Variation Name,SKU,Price,Current Quantity Main',
            ',Mug,Large,MUG-L,12.00,6',
        ].join('\n');
        const asStock = readSource({ text: square }, 'square.inventory');
        expect(asStock.entities[0]?.entity).toBe('inventory_levels');
        expect(asStock.entities[0]?.rows[0]).toMatchObject({ location: 'Main', quantity: '6' });
    });
});

describe('mapManually', () => {
    it('maps an unrecognised file with the tenant’s own column map', () => {
        const raw = [{ 'Item Name': 'Mug', 'Item Code': 'MUG', 'How Much': '12.00' }];
        const mapped = mapManually('products', raw, {
            'Item Name': 'title',
            'Item Code': 'sku',
            'How Much': 'price',
            Ignored: '',
        });
        expect(mapped.rows[0]).toEqual({ title: 'Mug', sku: 'MUG', price: '12.00' });
        expect(mapped.report.blocked).toBe(false);
    });

    it('still validates what the tenant mapped', () => {
        const mapped = mapManually('products', [{ a: 'Mug' }], { a: 'title' });
        // Mapped a title but no SKU or handle — there is nothing to identify it by.
        expect(mapped.report.issues.some((issue) => issue.code === 'missing_natural_key')).toBe(true);
    });
});
