import { describe, expect, it } from 'vitest';
import { child, childText, children, decodeEntities, metaValue, parseXml } from './xml';

describe('decodeEntities', () => {
  it('resolves the predefined entities', () => {
    expect(decodeEntities('a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;')).toBe(
      'a & b <c> "d" \'e\''
    );
  });

  it('resolves numeric and hex escapes', () => {
    expect(decodeEntities('&#65;&#x42;')).toBe('AB');
  });

  it('leaves an unknown entity alone', () => {
    expect(decodeEntities('&notreal;')).toBe('&notreal;');
  });
});

describe('parseXml', () => {
  it('reads elements, attributes and text', () => {
    const root = parseXml('<rss version="2.0"><channel><title>Blog</title></channel></rss>');
    expect(root?.name).toBe('rss');
    expect(root?.attrs.version).toBe('2.0');
    expect(childText(child(root, 'channel'), 'title')).toBe('Blog');
  });

  it('reads CDATA literally', () => {
    // The `&amp;` must survive: it is inside the post's HTML, and decoding it would
    // break every link with a query string.
    const root = parseXml('<item><body><![CDATA[<a href="/x?a=1&amp;b=2">go</a>]]></body></item>');
    expect(childText(root, 'body')).toBe('<a href="/x?a=1&amp;b=2">go</a>');
  });

  it('decodes entities in plain text but not CDATA', () => {
    const root = parseXml('<a><b>x &amp; y</b></a>');
    expect(childText(root, 'b')).toBe('x & y');
  });

  it('keeps namespace prefixes verbatim', () => {
    const root = parseXml('<item><wp:post_id>42</wp:post_id></item>');
    expect(childText(root, 'wp:post_id')).toBe('42');
  });

  it('handles self-closing elements', () => {
    const root = parseXml('<a><br/><c>x</c></a>');
    expect(root?.children.map((n) => n.name)).toEqual(['br', 'c']);
  });

  it('skips comments, declarations and doctypes', () => {
    const root = parseXml('<?xml version="1.0"?><!-- note --><!DOCTYPE x><a>ok</a>');
    expect(root?.name).toBe('a');
    expect(root?.text).toBe('ok');
  });

  it('survives a stray closing tag', () => {
    const root = parseXml('<a><b>one</b></zz><c>two</c></a>');
    expect(children(root, 'b')).toHaveLength(1);
    expect(childText(root, 'c')).toBe('two');
  });

  it('returns null for empty input', () => {
    expect(parseXml('')).toBeNull();
  });
});

describe('metaValue', () => {
  it('finds a WordPress postmeta pair by key', () => {
    const root = parseXml(
      '<item>' +
        '<wp:postmeta><wp:meta_key>_thumbnail_id</wp:meta_key><wp:meta_value>9</wp:meta_value></wp:postmeta>' +
        '<wp:postmeta><wp:meta_key>_wp_attached_file</wp:meta_key><wp:meta_value>2024/05/x.jpg</wp:meta_value></wp:postmeta>' +
        '</item>'
    );
    expect(metaValue(root!, '_wp_attached_file')).toBe('2024/05/x.jpg');
    expect(metaValue(root!, '_missing')).toBe('');
  });
});
