/*
 * Render tests for the lookbook payload.
 *
 * Both lookbook sections are rendered through liquidjs with Shopify's filters
 * stubbed, and the JSON payload the React renderer receives is parsed and
 * checked. Liquid decides which looks a section shows — their ids, in order —
 * and passes on what the renderer needs to load them through the Storefront
 * API. The loading itself is covered by storefront.test.mjs.
 *
 * This covers what neither `npm run build` nor `shopify theme check` can see: a
 * malformed payload, which blanks the section with only a console error, and
 * the rules for which looks each section lists.
 *
 * liquidjs is close to Shopify's Liquid but not identical. It unescapes string
 * literals, so the closing-script guard in snippets/lookbook.liquid is a no-op
 * here and is not covered (see Invariants in the README).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';

const THEME = fileURLToPath(new URL('..', import.meta.url));
const RELATED = 'sections/lookbook-related.liquid';
const HOME = 'sections/lookbook.liquid';
const PICKER_SETTINGS = ['entry_source', 'entries'];
const TOKEN = 'public-token';

const read = (file) => fs.readFileSync(path.join(THEME, file), 'utf8');

// Shopify's JSON templates and locale files open with a /* ... */ notice, which JSON.parse rejects.
const readJson = (file) => JSON.parse(read(file).replace(/^\uFEFF?\s*\/\*[\s\S]*?\*\//, ''));

// ------------------------------------------------------------------ Liquid

const engine = new Liquid({
  root: [path.join(THEME, 'snippets')],
  partials: [path.join(THEME, 'snippets')],
  extname: '.liquid',
});

// Shopify's `json` prints nil as null; liquidjs's built-in would print nothing.
engine.registerFilter('json', (value) => JSON.stringify(value === undefined ? null : value));
engine.registerFilter('asset_url', (file) => `/cdn/assets/${file}`);
engine.registerFilter('stylesheet_tag', (url) => `<link rel="stylesheet" href="${url}">`);

// Reads the real default locale file, so a key missing from it fails the payload tests. Like
// Shopify's, it HTML-escapes the translation: "Couldn't" reaches the payload as "Couldn&#39;t".
const translations = readJson('locales/en.default.json');
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
engine.registerFilter('t', (key) => {
  const translation = key.split('.').reduce((node, part) => node?.[part], translations);
  return translation === undefined
    ? `translation missing: ${key}`
    : translation.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
});

// ------------------------------------------------------------------ Fixtures

const makeProduct = (id, { collections = [] } = {}) => ({
  id,
  title: `Product ${id}`,
  collections: collections.map((handle) => ({ handle })),
});

const products = {
  1: makeProduct(1, { collections: ['summer'] }),
  2: makeProduct(2),
  3: makeProduct(3),
  4: makeProduct(4, { collections: ['summer'] }),
  5: makeProduct(5),
  6: makeProduct(6),
  7: makeProduct(7),
};

const summer = { handle: 'summer', products: [products[1], products[4]] };

// Liquid's metaobject id is a plain number; the payload turns it into a Storefront API GID.
const makeLook = (id, { picked, legacyKey = false, source, collection } = {}) => ({
  system: { id },
  title: { value: `Look ${id}` },
  products_source: { value: source },
  collection: { value: collection },
  [legacyKey ? 'top_3_field' : 'select_products']: { value: picked },
});

/*
 * Product 1 is in looks 1, 2 and 3 (look 3 through its collection); product 3
 * in looks 2 and 4; product 4 only through look 3's collection; product 6 only
 * in the last look. Products 5 and 7 are in none.
 */
const looks = {
  1: makeLook(1, { picked: [products[1], products[2]] }),
  2: makeLook(2, { picked: [products[3], products[1]], legacyKey: true }),
  3: makeLook(3, { source: 'From collection', collection: summer, picked: [products[7]] }),
  4: makeLook(4, { picked: [products[2], products[3]] }),
  // Set to Collection with none picked: it has no products, so it features none.
  5: makeLook(5, { source: 'Collection', picked: [products[7]] }),
  6: makeLook(6, { picked: [products[6]] }),
};

const allLooks = Object.values(looks);

// ------------------------------------------------------------------ Helpers

const SCHEMA = /{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/;

const schemaOf = (file) => JSON.parse(read(file).match(SCHEMA)[1]);

const settingDefaults = (file) =>
  Object.fromEntries(
    schemaOf(file)
      .settings.filter((setting) => setting.id)
      .map((setting) => [setting.id, setting.default]),
  );

// liquidjs has no {% schema %} or {% style %} tags; swap them for what Shopify outputs.
const templateSource = (file) =>
  read(file)
    .replace(SCHEMA, '')
    .replace(/{%-?\s*style\s*-?%}/g, '<style>')
    .replace(/{%-?\s*endstyle\s*-?%}/g, '</style>');

async function renderSection(
  file,
  { settings = {}, product, entries = allLooks, designMode = false, storefrontToken = TOKEN } = {},
) {
  const html = await engine.parseAndRender(
    templateSource(file),
    { section: { id: 'template--1__lookbook', settings: { ...settingDefaults(file), ...settings } }, product },
    {
      globals: {
        settings: { storefront_api_token: storefrontToken },
        shop: { permanent_domain: 'example.myshopify.com', metaobjects: { lookbook: { values: entries } } },
        localization: { country: { iso_code: 'FR' } },
        request: { design_mode: designMode, locale: { iso_code: 'pt-BR' } },
        routes: { root_url: '/fr' },
      },
    },
  );
  const script = html.match(/<script type="application\/json" id="LookbookData-[^"]+">([\s\S]*?)<\/script>/);

  // JSON.parse throws on a malformed payload — the failure these tests exist for.
  return { html, payload: script ? JSON.parse(script[1]) : null };
}

const lookIds = (payload) => payload.source.entryIds.map((id) => Number(id.split('/').pop()));

// ------------------------------------------------------------------ Tests

describe('Related lookbook section', () => {
  test('has the Lookbook settings, less the entry picker', () => {
    const home = schemaOf(HOME).settings.filter((setting) => !PICKER_SETTINGS.includes(setting.id));
    const [intro, ...related] = schemaOf(RELATED).settings;

    // Maximum entries to show is the same control in the same place; only its
    // default and help text differ.
    const comparable = (settings) =>
      settings.map((setting) => {
        if (setting.id !== 'entries_limit') return setting;
        const { default: _default, info: _info, ...control } = setting;
        return control;
      });

    assert.equal(intro.type, 'paragraph');
    assert.deepEqual(comparable(related), comparable(home));
  });

  test('has no lookbook picker', () => {
    const settings = schemaOf(RELATED).settings;

    assert.ok(!settings.some((setting) => setting.type.includes('metaobject')));
    assert.ok(!settings.some((setting) => PICKER_SETTINGS.includes(setting.id)));
  });

  test('defaults Maximum entries to show to 2', () => {
    const limit = schemaOf(RELATED).settings.find((setting) => setting.id === 'entries_limit');

    assert.equal(limit.default, 2);
  });

  test('is the only lookbook section allowed on product templates', () => {
    assert.deepEqual(schemaOf(RELATED).enabled_on, { templates: ['product'] });
    assert.ok(schemaOf(HOME).disabled_on.templates.includes('product'));
  });

  test('is on the product template by default', () => {
    const template = readJson('templates/product.json');
    const key = Object.keys(template.sections).find((id) => template.sections[id].type === 'lookbook-related');

    assert.ok(key, 'no lookbook-related section in product.json');
    assert.ok(template.order.includes(key), 'lookbook-related is not in the section order');
  });
});

describe('Which looks the Lookbook section lists', () => {
  test('lists every entry as a Storefront API id, in admin order', async () => {
    const { payload } = await renderSection(HOME);

    assert.deepEqual(payload.source.entryIds, [1, 2, 3, 4, 5, 6].map((id) => `gid://shopify/Metaobject/${id}`));
    assert.equal(payload.source.continuePaging, false);
  });

  test('loads Maximum entries to show at first and leaves the rest to Show more', async () => {
    const { payload } = await renderSection(HOME, { settings: { entries_limit: 2 } });

    assert.deepEqual(lookIds(payload), [1, 2, 3, 4, 5, 6]);
    assert.equal(payload.source.pageSize, 2);
  });

  test('keeps the order of picked entries and loads them all at once', async () => {
    const { payload } = await renderSection(HOME, {
      settings: { entry_source: 'selected', entries: [looks[4], looks[2]], entries_limit: 1 },
    });

    assert.deepEqual(lookIds(payload), [4, 2]);
    assert.equal(payload.source.pageSize, 2);
  });

  test('carries on through the API past the 50 entries Liquid can list', async () => {
    const fifty = Array.from({ length: 50 }, (_, index) => makeLook(index + 1, { picked: [] }));
    const { payload } = await renderSection(HOME, { entries: fifty });

    assert.equal(payload.source.entryIds.length, 50);
    assert.equal(payload.source.continuePaging, true);
  });
});

describe('Which looks the Related lookbook lists on a product page', () => {
  test('lists the first two looks featuring the product by default, in admin order', async () => {
    const { payload } = await renderSection(RELATED, { product: products[1] });

    assert.deepEqual(lookIds(payload), [1, 2]);
    assert.equal(payload.source.pageSize, 2);
    assert.equal(payload.source.continuePaging, false);
  });

  test('keeps admin order when the first entry does not match', async () => {
    const { payload } = await renderSection(RELATED, {
      product: products[1],
      entries: [looks[6], looks[3], looks[2], looks[1]],
    });

    assert.deepEqual(lookIds(payload), [3, 2]);
  });

  test('lists as many looks as Maximum entries to show allows', async () => {
    const listed = async (entries_limit) =>
      lookIds((await renderSection(RELATED, { product: products[1], settings: { entries_limit } })).payload);

    assert.deepEqual(await listed(1), [1]);
    assert.deepEqual(await listed(3), [1, 2, 3]);
    assert.deepEqual(await listed(12), [1, 2, 3]);
  });

  test('skips looks that do not feature the product', async () => {
    const { payload } = await renderSection(RELATED, { product: products[3] });

    assert.deepEqual(lookIds(payload), [2, 4]);
  });

  test("matches a collection look through the product's collections", async () => {
    const { payload } = await renderSection(RELATED, { product: products[4] });

    assert.deepEqual(lookIds(payload), [3]);
  });

  test('matches when only the last look features the product', async () => {
    const { payload } = await renderSection(RELATED, { product: products[6] });

    assert.deepEqual(lookIds(payload), [6]);
  });

  test('ignores picked products on a look that pulls from a collection', async () => {
    const { html } = await renderSection(RELATED, { product: products[7] });

    assert.equal(html.trim(), '');
  });

  test('outputs nothing when no look features the product', async () => {
    const { html } = await renderSection(RELATED, { product: products[5] });

    assert.equal(html.trim(), '');
  });

  test('explains an empty result in the theme editor', async () => {
    const { html, payload } = await renderSection(RELATED, { product: products[5], designMode: true });

    assert.equal(payload, null);
    assert.match(html, /No look features this product yet/);
  });
});

describe('Storefront API payload', () => {
  test('carries what the renderer needs to load the looks', async () => {
    const { payload } = await renderSection(HOME, { storefrontToken: ` ${TOKEN} ` });

    assert.deepEqual(payload.source.storefront, {
      endpoint: 'https://example.myshopify.com/api/2026-07/graphql.json',
      token: TOKEN,
      country: 'FR',
      language: 'pt-BR',
      rootUrl: '/fr',
    });
    assert.equal(payload.source.productsLimit, 12);
    assert.deepEqual(payload.labels, {
      loadMore: 'Show more',
      loading: 'Loading...',
      // Escaped by `t`, exactly as Shopify writes them; Lookbook.jsx unescapes them.
      loadMoreError: 'Couldn&#39;t load more. Please try again.',
      loadError: 'Couldn&#39;t load the lookbook. Please try again.',
    });
  });

  test('holds no look content: titles, products and images come from the API', async () => {
    const { html, payload } = await renderSection(HOME);

    assert.equal('entries' in payload, false);
    assert.doesNotMatch(html, /Look 1|Product 1/);
  });

  test('passes section settings through', async () => {
    const { payload } = await renderSection(RELATED, {
      product: products[1],
      settings: {
        products_limit: 1,
        show_sub_heading: false,
        show_description: false,
        product_cta_label: '',
        heading: 'Shop <em>the</em> look',
      },
    });

    assert.equal(payload.source.productsLimit, 1);
    assert.equal(payload.showSubHeading, false);
    assert.equal(payload.showDescription, false);
    assert.equal(payload.productCtaLabel, '');
    assert.equal(payload.heading, 'Shop <em>the</em> look');
  });

  test('uses the same section-level defaults as the Lookbook section', async () => {
    const related = await renderSection(RELATED, { product: products[1] });
    const home = await renderSection(HOME);
    const { source: _relatedSource, ...relatedDefaults } = related.payload;
    const { source: _homeSource, ...homeDefaults } = home.payload;

    assert.deepEqual(relatedDefaults, homeDefaults);
  });
});

describe('Without a token or entries', () => {
  test('outputs nothing without a Storefront API token', async () => {
    const home = await renderSection(HOME, { storefrontToken: '' });
    const related = await renderSection(RELATED, { product: products[1], storefrontToken: '' });

    assert.equal(home.html.trim(), '');
    assert.equal(related.html.trim(), '');
  });

  test('asks for a token in the theme editor', async () => {
    const { html } = await renderSection(HOME, { storefrontToken: '', designMode: true });

    assert.match(html, /Add a Storefront API token/);
  });

  test('outputs nothing without entries, and explains why in the theme editor', async () => {
    const live = await renderSection(HOME, { entries: [] });
    const editor = await renderSection(HOME, { entries: [], designMode: true });

    assert.equal(live.html.trim(), '');
    assert.match(editor.html, /No lookbook entries found/);
  });

  test('flags a collection look with no collection in the theme editor', async () => {
    const { html } = await renderSection(HOME, { designMode: true });

    assert.match(html, /set to Collection but has no collection picked/);
  });
});

describe('Skeleton', () => {
  const placeholderLooks = (html) =>
    (html.match(/class="lookbook__entry lookbook__skeleton page-width" aria-hidden="true"/g) || []).length;

  test('draws one placeholder per look in the first batch', async () => {
    assert.equal(placeholderLooks((await renderSection(HOME)).html), 6);
    assert.equal(placeholderLooks((await renderSection(HOME, { settings: { entries_limit: 2 } })).html), 2);
    assert.equal(placeholderLooks((await renderSection(RELATED, { product: products[1] })).html), 2);
  });

  test('draws at most six placeholders, however long the list', async () => {
    const twelve = Array.from({ length: 12 }, (_, index) => makeLook(index + 1, { picked: [] }));
    const { html } = await renderSection(HOME, { settings: { entry_source: 'selected', entries: twelve } });

    assert.equal(placeholderLooks(html), 6);
  });

  test('sits inside the mount point and announces that the lookbook is loading', async () => {
    const { html } = await renderSection(HOME);

    assert.ok(html.indexOf('data-lookbook=') < html.indexOf('lookbook--skeleton'));
    assert.match(html, /class="visually-hidden" role="status">Loading\.\.\.<\/p>/);
  });

  test('draws a heading placeholder only when the section has a heading', async () => {
    const withHeading = await renderSection(HOME);
    const withoutHeading = await renderSection(HOME, { settings: { heading: '' } });

    assert.match(withHeading.html, /lookbook__skeleton-bar--heading/);
    assert.doesNotMatch(withoutHeading.html, /lookbook__skeleton-bar--heading/);
  });
});
