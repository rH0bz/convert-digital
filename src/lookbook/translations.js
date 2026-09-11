/*
 * Shopify's `t` filter HTML-escapes a translation unless its key ends in
 * `_html`, so "Couldn't" arrives in the payload as "Couldn&#39;t". React renders
 * strings as text, which would show the entity literally, so the escaping is
 * undone here, once. Rendering the labels as HTML instead would trade a
 * cosmetic bug for an injection point.
 *
 * Only the five characters Liquid's escape produces are handled, in a single
 * pass, so "&amp;lt;" correctly becomes "&lt;" rather than "<".
 */

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

export function unescapeTranslation(text) {
  return String(text ?? '').replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity]);
}

export function unescapeTranslations(labels = {}) {
  return Object.fromEntries(
    Object.entries(labels).map(([key, value]) => [key, unescapeTranslation(value)]),
  );
}
