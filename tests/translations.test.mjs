/*
 * Tests for src/lookbook/translations.js: undoing the HTML escaping that
 * Shopify's `t` filter applies to the labels in the payload.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unescapeTranslation, unescapeTranslations } from '../src/lookbook/translations.js';

test("restores the characters Shopify's t filter escapes", () => {
  assert.equal(
    unescapeTranslation('Couldn&#39;t load more. Please try again.'),
    "Couldn't load more. Please try again.",
  );
  assert.equal(unescapeTranslation('&quot;Looks&quot; &amp; more &lt;3 &gt;'), '"Looks" & more <3 >');
});

test('unescapes once, so an escaped entity stays an entity', () => {
  assert.equal(unescapeTranslation('&amp;lt;'), '&lt;');
});

test('leaves other text alone and treats a missing label as empty', () => {
  assert.equal(unescapeTranslation('Réessayer — l’erreur'), 'Réessayer — l’erreur');
  assert.equal(unescapeTranslation(undefined), '');
});

test('unescapes every label in the payload', () => {
  assert.deepEqual(unescapeTranslations({ loadMore: 'Show more', loadError: 'Couldn&#39;t load the lookbook.' }), {
    loadMore: 'Show more',
    loadError: "Couldn't load the lookbook.",
  });
});
