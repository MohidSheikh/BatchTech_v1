export const DEFAULT_CANONICAL_ORIGIN =
  'https://ais-pre-rfhzid447whdbmhj323t6l-15509197677.asia-southeast1.run.app';

export function resolveCanonicalBaseUrl(
  appUrl?: string,
  requestOrigin?: string
): string {
  const candidates = [appUrl, requestOrigin, DEFAULT_CANONICAL_ORIGIN];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.origin;
      }
    } catch {
      // Ignore malformed candidate and fall through
    }
  }
  return DEFAULT_CANONICAL_ORIGIN;
}

export function buildRobotsTxt(baseUrl: string): string {
  const origin = resolveCanonicalBaseUrl(baseUrl);
  return [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

export function buildSitemapXml(
  baseUrl: string,
  lastModIso = '2026-11-14'
): string {
  const origin = resolveCanonicalBaseUrl(baseUrl);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    `    <loc>${origin}/</loc>`,
    `    <lastmod>${lastModIso}</lastmod>`,
    '    <changefreq>monthly</changefreq>',
    '    <priority>1.0</priority>',
    '  </url>',
    '</urlset>',
    '',
  ].join('\n');
}

export function injectSeoOrigin(html: string, baseUrl: string): string {
  const origin = resolveCanonicalBaseUrl(baseUrl);
  return html.replaceAll(DEFAULT_CANONICAL_ORIGIN, origin);
}
