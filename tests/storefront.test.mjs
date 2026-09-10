/*
 * Unit tests for src/lookbook/storefront.js — the Storefront API half of
 * "Load more looks".
 *
 * No network: API responses are written by hand in the shape the query in
 * storefront.js asks for, and the pager is given a fake page fetcher.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  API_PAGE_SIZE,
  LOOKBOOK_QUERY,
  createLookbookPager,
  fetchLookbookPage,
  imagesPerProduct,
  languageCode,
  numericId,
  toEntry,
} from '../src/lookbook/storefront.js';

const config = {
  endpoint: 'https://example.myshopify.com/api/2026-07/graphql.json',
  token: 'public-token',
  country: 'FR',
  language: 'pt-BR',
  rootUrl: '/fr',
  pageSize: 2,
  productsLimit: 12,
};

// ------------------------------------------------------------------ API shapes

const apiImage = (name) => ({
  altText: null,
  width: 1000,
  height: 1250,
  src300: `https://cdn.example/${name}_300.jpg`,
  src500: `https://cdn.example/${name}_500.jpg`,
  src800: `https://cdn.example/${name}_800.jpg`,
  src1200: `https://cdn.example/${name}_1200.jpg`,
});

const apiProduct = (id, imageCount = 3) => ({
  id: `gid://shopify/Product/${id}`,
  title: `Product ${id}`,
  handle: `product-${id}`,
  images: { nodes: Array.from({ length: imageCount }, (_, index) => apiImage(`p${id}-${index + 1}`)) },
});

const apiLook = (id, { template = 'Default', source, picked = [], legacy = [], collection, description } = {}) => ({
  id: `gid://shopify/Metaobject/${id}`,
  title: { value: `Look ${id}` },
  subHeading: { value: `Sub heading ${id}` },
  description: { value: description ?? JSON.stringify({ type: 'root', children: [] }) },
  template: { value: template },
  productsSource: source === undefined ? null : { value: source },
  products: { references: { nodes: picked } },
  productsLegacy: { references: { nodes: legacy } },
  // `collection` is a list of products, or undefined for a look with no collection picked.
  collection: collection === undefined ? null : { reference: { products: { nodes: collection } } },
});

const ids = (entries) => entries.map((entry) => numericId(entry.id));

// ------------------------------------------------------------------ Tests

describe('toEntry', () => {
  test('produces the entry shape the Liquid payload uses', () => {
    const entry = toEntry(apiLook(1, { template: 'Masonry', picked: [apiProduct(7)] }), config);

    assert.deepEqual(entry, {
      id: 'gid://shopify/Metaobject/1',
      title: 'Look 1',
      subHeading: 'Sub heading 1',
      descriptionTree: { type: 'root', children: [] },
      descriptionHtml: '',
      template: 'Masonry',
      products: [
        {
          id: 7,
          title: 'Product 7',
          url: '/fr/products/product-7',
          images: [
            {
              src: 'https://cdn.example/p7-1_500.jpg',
              srcset:
                'https://cdn.example/p7-1_300.jpg 300w, https://cdn.example/p7-1_500.jpg 500w, ' +
                'https://cdn.example/p7-1_800.jpg 800w, https://cdn.example/p7-1_1200.jpg 1200w',
              alt: 'Product 7',
              width: 1000,
              height: 1250,
            },
          ],
        },
      ],
    });
  });

  test('sends three images per product only to Masonry - Product Images', () => {
    const images = (template) =>
      toEntry(apiLook(1, { template, picked: [apiProduct(7)] }), config).products[0].images.length;

    assert.equal(images('Masonry - Product Images'), 3);
    assert.equal(images('Masonry'), 1);
    assert.equal(images('Full Width'), 1);
  });

  test('falls back to the legacy picked products field', () => {
    const entry = toEntry(apiLook(1, { legacy: [apiProduct(8)] }), config);

    assert.deepEqual(
      entry.products.map((product) => product.id),
      [8],
    );
  });

  test('takes products from the collection when Products Source says so', () => {
    const entry = toEntry(
      apiLook(1, { source: 'From collection', picked: [apiProduct(7)], collection: [apiProduct(9)] }),
      config,
    );

    assert.deepEqual(
      entry.products.map((product) => product.id),
      [9],
    );
  });

  test('gives a Collection look with no collection no products, not its picked list', () => {
    const entry = toEntry(apiLook(1, { source: 'Collection', picked: [apiProduct(7)] }), config);

    assert.deepEqual(entry.products, []);
  });

  test('drops references the token cannot read', () => {
    const entry = toEntry(apiLook(1, { picked: [{}, apiProduct(7)] }), config);

    assert.deepEqual(
      entry.products.map((product) => product.id),
      [7],
    );
  });

  test('caps products at productsLimit', () => {
    const picked = [1, 2, 3, 4].map((id) => apiProduct(id));
    const entry = toEntry(apiLook(1, { picked }), { ...config, productsLimit: 2 });

    assert.equal(entry.products.length, 2);
  });

  test('keeps a look whose rich text will not parse, without a description', () => {
    const entry = toEntry(apiLook(1, { description: 'not json' }), config);

    assert.equal(entry.descriptionTree, null);
    assert.equal(entry.title, 'Look 1');
  });

  test('links from the storefront root when there is no market prefix', () => {
    const entry = toEntry(apiLook(1, { picked: [apiProduct(7)] }), { ...config, rootUrl: '/' });

    assert.equal(entry.products[0].url, '/products/product-7');
  });
});

describe('helpers', () => {
  test('numericId reads the same id from a GID and from Liquid', () => {
    assert.equal(numericId('gid://shopify/Metaobject/123'), '123');
    assert.equal(numericId(123), '123');
  });

  test("languageCode turns Shopify locales into the API's LanguageCode", () => {
    assert.equal(languageCode('en'), 'EN');
    assert.equal(languageCode('pt-BR'), 'PT_BR');
    assert.equal(languageCode(undefined), null);
  });

  test('imagesPerProduct matches the template choice loosely, like the Liquid gate', () => {
    assert.equal(imagesPerProduct('masonry_product_images'), 3);
    assert.equal(imagesPerProduct('Masonry'), 1);
    assert.equal(imagesPerProduct(''), 1);
  });
});

describe('fetchLookbookPage', () => {
  const respond = (body, { ok = true, status = 200 } = {}) => async () => ({ ok, status, json: async () => body });

  test('posts the query with the token and the visitor context', async () => {
    const metaobjects = { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };
    let request;
    const fetchImpl = async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200, json: async () => ({ data: { metaobjects } }) };
    };

    const page = await fetchLookbookPage(config, 'cursor-1', fetchImpl);
    const body = JSON.parse(request.options.body);

    assert.equal(page, metaobjects);
    assert.equal(request.url, config.endpoint);
    assert.equal(request.options.headers['X-Shopify-Storefront-Access-Token'], 'public-token');
    assert.equal(body.query, LOOKBOOK_QUERY);
    assert.deepEqual(body.variables, {
      first: API_PAGE_SIZE,
      after: 'cursor-1',
      productsLimit: 12,
      country: 'FR',
      language: 'PT_BR',
    });
  });

  test('throws on a GraphQL error', async () => {
    const fetchImpl = respond({ errors: [{ message: 'Access denied for metaobjects field.' }] });

    await assert.rejects(fetchLookbookPage(config, null, fetchImpl), /Access denied/);
  });

  test('throws on an HTTP error', async () => {
    const fetchImpl = respond({}, { ok: false, status: 401 });

    await assert.rejects(fetchLookbookPage(config, null, fetchImpl), /401/);
  });
});

describe('createLookbookPager', () => {
  const page = (lookIds, { hasNextPage = false, endCursor = null } = {}) => ({
    nodes: lookIds.map((id) => apiLook(id)),
    pageInfo: { hasNextPage, endCursor },
  });

  test('skips looks Liquid already rendered and hands out pageSize at a time', async () => {
    const pages = [page([1, 2, 3], { hasNextPage: true, endCursor: 'c1' }), page([4, 5])];
    const cursors = [];
    const fetchPage = async (_config, after) => {
      cursors.push(after);
      return pages.shift();
    };

    // Liquid ids are plain numbers; the API's are GIDs.
    const pager = createLookbookPager(config, [2], fetchPage);

    const first = await pager.next();
    assert.deepEqual(ids(first.entries), ['1', '3']);
    assert.equal(first.hasMore, true);

    const second = await pager.next();
    assert.deepEqual(ids(second.entries), ['4', '5']);
    assert.equal(second.hasMore, false);

    assert.deepEqual(cursors, [null, 'c1']);
  });

  test('keeps looks beyond the batch for the next click instead of dropping them', async () => {
    let calls = 0;
    const fetchPage = async () => {
      calls += 1;
      return page([1, 2, 3, 4, 5]);
    };
    const pager = createLookbookPager(config, [], fetchPage);

    assert.deepEqual(ids((await pager.next()).entries), ['1', '2']);
    assert.deepEqual(ids((await pager.next()).entries), ['3', '4']);

    const last = await pager.next();
    assert.deepEqual(ids(last.entries), ['5']);
    assert.equal(last.hasMore, false);
    assert.equal(calls, 1);
  });

  test('retries from the same cursor after a failed request', async () => {
    const cursors = [];
    let failNext = true;
    const fetchPage = async (_config, after) => {
      cursors.push(after);
      if (failNext) {
        failNext = false;
        throw new Error('network down');
      }
      return page([1, 2]);
    };
    const pager = createLookbookPager(config, [], fetchPage);

    await assert.rejects(pager.next(), /network down/);
    assert.deepEqual(ids((await pager.next()).entries), ['1', '2']);
    assert.deepEqual(cursors, [null, null]);
  });
});
