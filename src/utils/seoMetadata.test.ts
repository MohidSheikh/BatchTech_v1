import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CANONICAL_ORIGIN,
  buildRobotsTxt,
  buildSitemapXml,
  injectSeoOrigin,
  resolveCanonicalBaseUrl,
} from './seoMetadata';

test('resolveCanonicalBaseUrl normalizes trailing slashes and ignores invalid URLs', () => {
  assert.equal(
    resolveCanonicalBaseUrl('https://batchtech.example.com/some/path?x=1'),
    'https://batchtech.example.com'
  );
  assert.equal(
    resolveCanonicalBaseUrl('not-a-url', 'http://localhost:3000/'),
    'http://localhost:3000'
  );
  assert.equal(resolveCanonicalBaseUrl('', ''), DEFAULT_CANONICAL_ORIGIN);
});

test('buildRobotsTxt includes crawl allowance and absolute sitemap URL', () => {
  const txt = buildRobotsTxt('https://batchtech.example.com');
  assert.match(txt, /User-agent: \*/);
  assert.match(txt, /Allow: \//);
  assert.match(txt, /Sitemap: https:\/\/batchtech\.example\.com\/sitemap\.xml/);
});

test('buildSitemapXml emits valid XML urlset with loc and lastmod', () => {
  const xml = buildSitemapXml('https://batchtech.example.com', '2026-11-14');
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<loc>https:\/\/batchtech\.example\.com\/<\/loc>/);
  assert.match(xml, /<lastmod>2026-11-14<\/lastmod>/);
});

test('injectSeoOrigin replaces default canonical placeholder across meta and JSON-LD', () => {
  const sample = `<link rel="canonical" href="${DEFAULT_CANONICAL_ORIGIN}/" /><meta property="og:image" content="${DEFAULT_CANONICAL_ORIGIN}/assets/images/og-cover.jpg" />`;
  const updated = injectSeoOrigin(sample, 'http://localhost:3000');
  assert.equal(
    updated,
    '<link rel="canonical" href="http://localhost:3000/" /><meta property="og:image" content="http://localhost:3000/assets/images/og-cover.jpg" />'
  );
});
