/*
 * Shopify's t filter HTML-escapes translations ("Couldn't" arrives as
 * "Couldn&#39;t"). These helpers undo that so React can show plain text.
 */

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

// One pass only, so "&amp;lt;" becomes "&lt;" and not "<".
export function unescapeTranslation(text) {
  return String(text ?? '').replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity]);
}

export function unescapeTranslations(labels = {}) {
  return Object.fromEntries(
    Object.entries(labels).map(([key, value]) => [key, unescapeTranslation(value)]),
  );
}
