/*
 * Render tests for the lookbook payload.
 *
 * Both lookbook sections are rendered through liquidjs with Shopify's filters
 * stubbed, and the JSON payload the React renderer would receive is parsed and
 * checked. This covers what neither `npm run build` nor `shopify theme check`
 * can see: a malformed payload, which blanks the section with only a console
 * error, and the product page rules in sections/lookbook-related.liquid.
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

const read = (file) => fs.readFileSync(path.join(THEME, file), 'utf8');

// ------------------------------------------------------------------ Liquid

const engine = new Liquid({
  root: [path.join(THEME, 'snippets')],
  partials: [path.join(THEME, 'snippets')],
  extname: '.liquid',
});

const keywordArg = (args, key) => args.find((arg) => Array.isArray(arg) && arg[0] === key)?.[1];

// Shopify's `json` prints nil as null; liquidjs's built-in would print nothing.
engine.registerFilter('json', (value) => JSON.stringify(value === undefined ? null : value));
engine.registerFilter('asset_url', (file) => `/cdn/assets/${file}`);
engine.registerFilter('stylesheet_tag', (url) => `<link rel="stylesheet" href="${url}">`);
engine.registerFilter('image_url', (image, ...args) => `${image.src}?width=${keywordArg(args, 'width')}`);
engine.registerFilter('metafield_tag', (field) => (field?.value ? '<p>rich text</p>' : ''));

// ------------------------------------------------------------------ Fixtures

const makeProduct = (id, { images = 1, collections = [] } = {}) => ({
  id,
  // Quotes and markup, so a value that skipped the `json` filter breaks the payload.
  title: `Product "${id}" <b>`,
  url: `/products/p${id}`,
  images: Array.from({ length: images }, (_, index) => ({
    src: `//cdn/p${id}-${index + 1}.jpg`,
    alt: index ? `Alt ${id}-${index + 1}` : '',
    width: 1000,
    height: 1250,
  })),
  collections: collections.map((handle) => ({ handle })),
});

const products = {
  1: makeProduct(1, { images: 3, collections: ['summer'] }),
  2: makeProduct(2, { images: 2 }),
  3: makeProduct(3),
  4: makeProduct(4, { collections: ['summer'] }),
  5: makeProduct(5, { images: 0 }),
  6: makeProduct(6),
  7: makeProduct(7),
};

const summer = { handle: 'summer', products: [products[1], products[4]] };

const makeLook = (id, { template = '', picked, legacyKey = false, source, collection } = {}) => ({
  system: { id: `gid://shopify/Metaobject/${id}` },
  title: { value: `Look ${id}` },
  sub_heading: { value: `Sub heading ${id}` },
  discreption: {
    value: {
      type: 'root',
      children: [{ type: 'paragraph', children: [{ type: 'text', value: `Description ${id}` }] }],
    },
  },
  template: { value: template },
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
  1: makeLook(1, { template: 'Masonry', picked: [products[1], products[2]] }),
  2: makeLook(2, { template: 'Full Width', picked: [products[3], products[1]], legacyKey: true }),
  3: makeLook(3, {
    template: 'Masonry - Product Images',
    source: 'From collection',
    collection: summer,
    picked: [products[7]],
  }),
  4: makeLook(4, { picked: [products[2], products[3]] }),
  // Set to Collection with none picked: it renders no products, so it features none.
  5: makeLook(5, { template: 'Default', source: 'Collection', picked: [products[7]] }),
  6: makeLook(6, { template: 'Masonry', picked: [products[6]] }),
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

async function renderSection(file, { settings = {}, product, entries = allLooks, designMode = false } = {}) {
  const html = await engine.parseAndRender(
    templateSource(file),
    { section: { id: 'template--1__lookbook', settings: { ...settingDefaults(file), ...settings } }, product },
    { globals: { shop: { metaobjects: { lookbook: { values: entries } } }, request: { design_mode: designMode } } },
  );
  const script = html.match(/<script type="application\/json" id="LookbookData-[^"]+">([\s\S]*?)<\/script>/);

  // JSON.parse throws on a malformed payload — the failure these tests exist for.
  return { html, payload: script ? JSON.parse(script[1]) : null };
}

const lookIds = (payload) => payload.entries.map((entry) => Number(entry.id.split('/').pop()));
const productIds = (entry) => entry.products.map((product) => product.id);

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
    const template = JSON.parse(read('templates/product.json').replace(/^\uFEFF?\s*\/\*[\s\S]*?\*\//, ''));
    const key = Object.keys(template.sections).find((id) => template.sections[id].type === 'lookbook-related');

    assert.ok(key, 'no lookbook-related section in product.json');
    assert.ok(template.order.includes(key), 'lookbook-related is not in the section order');
  });
});

describe('Related lookbook on a product page', () => {
  test('shows the first two looks featuring the product by default, in admin order', async () => {
    const { payload } = await renderSection(RELATED, { product: products[1] });

    assert.deepEqual(lookIds(payload), [1, 2]);
  });

  test('keeps admin order when the first entry does not match', async () => {
    const { payload } = await renderSection(RELATED, {
      product: products[1],
      entries: [looks[6], looks[3], looks[2], looks[1]],
    });

    assert.deepEqual(lookIds(payload), [3, 2]);
  });

  test('shows as many looks as Maximum entries to show allows', async () => {
    const shown = async (entries_limit) =>
      lookIds((await renderSection(RELATED, { product: products[1], settings: { entries_limit } })).payload);

    assert.deepEqual(await shown(1), [1]);
    assert.deepEqual(await shown(3), [1, 2, 3]);
    assert.deepEqual(await shown(12), [1, 2, 3]);
  });

  test('draws each look whole, with its own template', async () => {
    const { payload } = await renderSection(RELATED, { product: products[1] });

    assert.deepEqual(payload.entries.map(productIds), [[1, 2], [3, 1]]);
    assert.deepEqual(
      payload.entries.map((entry) => entry.template),
      ['Masonry', 'Full Width'],
    );
  });

  test('skips looks that do not feature the product', async () => {
    const { payload } = await renderSection(RELATED, { product: products[3] });

    assert.deepEqual(lookIds(payload), [2, 4]);
  });

  test("matches a collection look through the product's collections", async () => {
    const { payload } = await renderSection(RELATED, { product: products[4] });
    const [look] = payload.entries;

    assert.deepEqual(lookIds(payload), [3]);
    assert.deepEqual(productIds(look), [1, 4]);
    assert.deepEqual(
      look.products.map((product) => product.images.length),
      [3, 1],
    );
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

  test('passes settings through to the payload', async () => {
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

    assert.deepEqual(payload.entries.map(productIds), [[1], [3]]);
    assert.equal(payload.showSubHeading, false);
    assert.equal(payload.showDescription, false);
    assert.equal(payload.productCtaLabel, '');
    assert.equal(payload.heading, 'Shop <em>the</em> look');
  });

  test('uses the same section-level defaults as the Lookbook section', async () => {
    const related = await renderSection(RELATED, { product: products[1] });
    const home = await renderSection(HOME);
    const { entries: _relatedEntries, ...relatedDefaults } = related.payload;
    const { entries: _homeEntries, ...homeDefaults } = home.payload;

    assert.deepEqual(relatedDefaults, homeDefaults);
  });
});

describe('Lookbook section', () => {
  test('renders every entry in admin order', async () => {
    const { payload } = await renderSection(HOME);

    assert.deepEqual(lookIds(payload), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(payload.entries.map(productIds), [[1, 2], [3, 1], [1, 4], [2, 3], [], [6]]);
  });

  test('keeps the order of picked entries', async () => {
    const { payload } = await renderSection(HOME, {
      settings: { entry_source: 'selected', entries: [looks[4], looks[2]] },
    });

    assert.deepEqual(lookIds(payload), [4, 2]);
  });

  test('applies Maximum entries to show', async () => {
    const { payload } = await renderSection(HOME, { settings: { entries_limit: 3 } });

    assert.deepEqual(lookIds(payload), [1, 2, 3]);
  });

  test('renders no mount point without entries, and explains why in the theme editor', async () => {
    const live = await renderSection(HOME, { entries: [] });
    const editor = await renderSection(HOME, { entries: [], designMode: true });

    assert.equal(live.payload, null);
    assert.doesNotMatch(live.html, /data-lookbook=/);
    assert.match(editor.html, /No lookbook entries found/);
  });

  test('flags a collection look with no collection in the theme editor', async () => {
    const { html } = await renderSection(HOME, { designMode: true });

    assert.match(html, /set to Collection but has no collection picked/);
  });
});
