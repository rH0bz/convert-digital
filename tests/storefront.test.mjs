/*
 * Tests for src/lookbook/storefront.js: requests, mapping and the loader.
 * No network: API responses are written by hand and the loader gets fake fetchers.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  API_PAGE_SIZE,
  LOOKBOOK_ENTRIES_QUERY,
  LOOKBOOK_PAGE_QUERY,
  createLookbookLoader,
  fetchLookbookEntries,
  fetchLookbookPage,
  imagesPerProduct,
  languageCode,
  numericId,
  toEntry,
} from '../src/lookbook/storefront.js';

const storefront = {
  endpoint: 'https://example.myshopify.com/api/2026-07/graphql.json',
  token: 'public-token',
  country: 'FR',
  language: 'pt-BR',
  rootUrl: '/fr',
};

const entryConfig = { rootUrl: '/fr', productsLimit: 12 };

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

const gid = (id) => `gid://shopify/Metaobject/${id}`;
const ids = (entries) => entries.map((entry) => numericId(entry.id));

// ------------------------------------------------------------------ Tests

describe('toEntry', () => {
  test('produces the entry shape the templates draw', () => {
    const entry = toEntry(apiLook(1, { template: 'Masonry', picked: [apiProduct(7)] }), entryConfig);

    assert.deepEqual(entry, {
      id: 'gid://shopify/Metaobject/1',
      title: 'Look 1',
      subHeading: 'Sub heading 1',
      descriptionTree: { type: 'root', children: [] },
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
      toEntry(apiLook(1, { template, picked: [apiProduct(7)] }), entryConfig).products[0].images.length;

    assert.equal(images('Masonry - Product Images'), 3);
    assert.equal(images('Masonry'), 1);
    assert.equal(images('Full Width'), 1);
  });

  test('falls back to the legacy picked products field', () => {
    const entry = toEntry(apiLook(1, { legacy: [apiProduct(8)] }), entryConfig);

    assert.deepEqual(
      entry.products.map((product) => product.id),
      [8],
    );
  });

  test('takes products from the collection when Products Source says so', () => {
    const entry = toEntry(
      apiLook(1, { source: 'From collection', picked: [apiProduct(7)], collection: [apiProduct(9)] }),
      entryConfig,
    );

    assert.deepEqual(
      entry.products.map((product) => product.id),
      [9],
    );
  });

  test('gives a Collection look with no collection no products, not its picked list', () => {
    const entry = toEntry(apiLook(1, { source: 'Collection', picked: [apiProduct(7)] }), entryConfig);

    assert.deepEqual(entry.products, []);
  });

  test('drops references the token cannot read', () => {
    const entry = toEntry(apiLook(1, { picked: [{}, apiProduct(7)] }), entryConfig);

    assert.deepEqual(
      entry.products.map((product) => product.id),
      [7],
    );
  });

  test('caps products at productsLimit', () => {
    const picked = [1, 2, 3, 4].map((id) => apiProduct(id));
    const entry = toEntry(apiLook(1, { picked }), { ...entryConfig, productsLimit: 2 });

    assert.equal(entry.products.length, 2);
  });

  test('keeps a look whose rich text will not parse, without a description', () => {
    const entry = toEntry(apiLook(1, { description: 'not json' }), entryConfig);

    assert.equal(entry.descriptionTree, null);
    assert.equal(entry.title, 'Look 1');
  });

  test('links from the storefront root when there is no market prefix', () => {
    const entry = toEntry(apiLook(1, { picked: [apiProduct(7)] }), { ...entryConfig, rootUrl: '/' });

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

  test('imagesPerProduct matches the template choice loosely', () => {
    assert.equal(imagesPerProduct('masonry_product_images'), 3);
    assert.equal(imagesPerProduct('Masonry'), 1);
    assert.equal(imagesPerProduct(''), 1);
  });
});

describe('requests', () => {
  // A fetch that records each request and answers from `respond(body)`.
  const fakeFetch = (respond, { ok = true, status = 200 } = {}) => {
    const calls = [];
    const fetchImpl = async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push({ url, headers: options.headers, body });
      return { ok, status, json: async () => respond(body) };
    };
    return { calls, fetchImpl };
  };

  test('fetchLookbookEntries loads looks by id, in order, a page of ids per request', async () => {
    const entryIds = [1, 2, 3, 4, 5, 6, 7, 8].map(gid);
    const { calls, fetchImpl } = fakeFetch((body) => ({
      data: { nodes: body.variables.ids.map((id) => apiLook(Number(numericId(id)))) },
    }));

    const nodes = await fetchLookbookEntries(storefront, entryIds, 12, fetchImpl);

    assert.deepEqual(ids(nodes), ['1', '2', '3', '4', '5', '6', '7', '8']);
    assert.deepEqual(
      calls.map((call) => call.body.variables.ids.length),
      [API_PAGE_SIZE, entryIds.length - API_PAGE_SIZE],
    );
    assert.equal(calls[0].url, storefront.endpoint);
    assert.equal(calls[0].headers['X-Shopify-Storefront-Access-Token'], 'public-token');
    assert.equal(calls[0].body.query, LOOKBOOK_ENTRIES_QUERY);
    assert.deepEqual(calls[0].body.variables, {
      ids: entryIds.slice(0, API_PAGE_SIZE),
      productsLimit: 12,
      country: 'FR',
      language: 'PT_BR',
    });
  });

  test('fetchLookbookEntries leaves out ids the token cannot read', async () => {
    const { fetchImpl } = fakeFetch(() => ({ data: { nodes: [apiLook(1), null, {}] } }));

    const nodes = await fetchLookbookEntries(storefront, [1, 2, 3].map(gid), 12, fetchImpl);

    assert.deepEqual(ids(nodes), ['1']);
  });

  test('fetchLookbookPage asks for the next page of every look', async () => {
    const metaobjects = { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };
    const { calls, fetchImpl } = fakeFetch(() => ({ data: { metaobjects } }));

    const page = await fetchLookbookPage(storefront, 'cursor-1', 12, fetchImpl);

    assert.equal(page, metaobjects);
    assert.equal(calls[0].body.query, LOOKBOOK_PAGE_QUERY);
    assert.deepEqual(calls[0].body.variables, {
      first: API_PAGE_SIZE,
      after: 'cursor-1',
      productsLimit: 12,
      country: 'FR',
      language: 'PT_BR',
    });
  });

  test('throws on a GraphQL error', async () => {
    const { fetchImpl } = fakeFetch(() => ({ errors: [{ message: 'Access denied for metaobjects field.' }] }));

    await assert.rejects(fetchLookbookEntries(storefront, [gid(1)], 12, fetchImpl), /Access denied/);
  });

  test('throws on an HTTP error', async () => {
    const { fetchImpl } = fakeFetch(() => ({}), { ok: false, status: 401 });

    await assert.rejects(fetchLookbookEntries(storefront, [gid(1)], 12, fetchImpl), /401/);
  });
});

describe('createLookbookLoader', () => {
  const source = (overrides) => ({
    storefront,
    productsLimit: 12,
    entryIds: [],
    pageSize: 2,
    continuePaging: false,
    ...overrides,
  });

  // Loads looks by id, recording each request, leaving out the ids in `unreadable`.
  const byIds = (unreadable = []) => {
    const calls = [];
    const fetchEntries = async (_storefront, entryIds) => {
      calls.push(entryIds.map(numericId));
      return entryIds
        .map((id) => Number(numericId(id)))
        .filter((id) => !unreadable.includes(id))
        .map((id) => apiLook(id));
    };
    return { calls, fetchEntries };
  };

  const page = (lookIds, { hasNextPage = false, endCursor = null } = {}) => ({
    nodes: lookIds.map((id) => apiLook(id)),
    pageInfo: { hasNextPage, endCursor },
  });

  const noPages = async () => {
    throw new Error('should not page through every look');
  };

  test('loads the ids Liquid listed, pageSize at a time, in order', async () => {
    const { calls, fetchEntries } = byIds();
    const loader = createLookbookLoader(source({ entryIds: [1, 2, 3].map(gid) }), { fetchEntries, fetchPage: noPages });

    const first = await loader.next();
    assert.deepEqual(ids(first.entries), ['1', '2']);
    assert.equal(first.hasMore, true);

    const second = await loader.next();
    assert.deepEqual(ids(second.entries), ['3']);
    assert.equal(second.hasMore, false);

    assert.deepEqual(calls, [['1', '2'], ['3']]);
  });

  test('loads a picked list or product page matches in one batch', async () => {
    const { fetchEntries } = byIds();
    const loader = createLookbookLoader(source({ entryIds: [4, 2, 5].map(gid), pageSize: 3 }), {
      fetchEntries,
      fetchPage: noPages,
    });

    const batch = await loader.next();

    assert.deepEqual(ids(batch.entries), ['4', '2', '5']);
    assert.equal(batch.hasMore, false);
  });

  test('fills the batch past ids the token cannot read', async () => {
    const { calls, fetchEntries } = byIds([2]);
    const loader = createLookbookLoader(source({ entryIds: [1, 2, 3].map(gid) }), { fetchEntries, fetchPage: noPages });

    const batch = await loader.next();

    assert.deepEqual(ids(batch.entries), ['1', '3']);
    assert.equal(batch.hasMore, false);
    assert.deepEqual(calls, [['1', '2'], ['3']]);
  });

  test("carries on through the API's pages past Liquid's list, skipping looks already listed", async () => {
    const { fetchEntries } = byIds();
    const pages = [page([2, 3, 4], { hasNextPage: true, endCursor: 'c1' }), page([5])];
    const cursors = [];
    const fetchPage = async (_storefront, after) => {
      cursors.push(after);
      return pages.shift();
    };
    const loader = createLookbookLoader(source({ entryIds: [1, 2].map(gid), continuePaging: true }), {
      fetchEntries,
      fetchPage,
    });

    const first = await loader.next();
    assert.deepEqual(ids(first.entries), ['1', '2']);
    assert.equal(first.hasMore, true);

    assert.deepEqual(ids((await loader.next()).entries), ['3', '4']);

    const last = await loader.next();
    assert.deepEqual(ids(last.entries), ['5']);
    assert.equal(last.hasMore, false);

    assert.deepEqual(cursors, [null, 'c1']);
  });

  test('keeps looks fetched past the batch for the next click instead of dropping them', async () => {
    let requests = 0;
    const fetchPage = async () => {
      requests += 1;
      return page([1, 2, 3, 4, 5]);
    };
    const loader = createLookbookLoader(source({ continuePaging: true }), { fetchEntries: byIds().fetchEntries, fetchPage });

    assert.deepEqual(ids((await loader.next()).entries), ['1', '2']);
    assert.deepEqual(ids((await loader.next()).entries), ['3', '4']);

    const last = await loader.next();
    assert.deepEqual(ids(last.entries), ['5']);
    assert.equal(last.hasMore, false);
    assert.equal(requests, 1);
  });

  test('retries a failed batch with the same ids', async () => {
    const calls = [];
    let failNext = true;
    const fetchEntries = async (_storefront, entryIds) => {
      calls.push(entryIds.map(numericId));
      if (failNext) {
        failNext = false;
        throw new Error('network down');
      }
      return entryIds.map((id) => apiLook(Number(numericId(id))));
    };
    const loader = createLookbookLoader(source({ entryIds: [1, 2].map(gid) }), { fetchEntries, fetchPage: noPages });

    await assert.rejects(loader.next(), /network down/);
    assert.deepEqual(ids((await loader.next()).entries), ['1', '2']);
    assert.deepEqual(calls, [['1', '2'], ['1', '2']]);
  });

  test('hands out looks already converted for the templates', async () => {
    const fetchEntries = async () => [apiLook(1, { picked: [apiProduct(7)] })];
    const loader = createLookbookLoader(source({ entryIds: [gid(1)] }), { fetchEntries, fetchPage: noPages });

    const [entry] = (await loader.next()).entries;

    assert.equal(entry.title, 'Look 1');
    assert.equal(entry.products[0].url, '/fr/products/product-7');
  });
});
