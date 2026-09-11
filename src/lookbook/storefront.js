/*
 * Storefront API client — every look the lookbook shows is loaded here.
 *
 * Liquid (snippets/lookbook.liquid) decides WHICH looks a section shows and in
 * what order, and writes their ids into the payload: the entries a merchant
 * picked, every entry in admin order, or the entries that feature the product
 * on a product page. This module loads everything else about those looks —
 * titles, descriptions, templates, products and images — through the
 * Storefront API, and converts each one into the entry shape the templates
 * draw.
 *
 * Liquid can loop over at most 50 entries of a metaobject definition. When a
 * full list reaches that cap, loading carries on past it through the API's own
 * pagination.
 *
 * Metaobjects cannot be read tokenless. The token comes from the Headless
 * channel, needs the unauthenticated_read_metaobjects and
 * unauthenticated_read_product_listings permissions, and is pasted into
 * Theme settings > Storefront API.
 *
 * Kept free of React and JSX so it runs under `node --test` as it is.
 */

/*
 * Looks per API request. Kept small because every look carries up to three
 * product connections (picked, legacy picked and collection), each with
 * images, and the cost of a query grows with all of them.
 */
export const API_PAGE_SIZE = 6;

// Must match the field keys at the top of snippets/lookbook.liquid.
export const FIELD_KEYS = {
  title: 'title',
  subHeading: 'sub_heading',
  description: 'discreption',
  template: 'template',
  productsSource: 'products_source',
  products: 'select_products',
  productsLegacy: 'top_3_field',
  collection: 'collection',
};

const LOOKBOOK_FRAGMENTS = `
  fragment LookbookEntry on Metaobject {
    id
    title: field(key: "${FIELD_KEYS.title}") { value }
    subHeading: field(key: "${FIELD_KEYS.subHeading}") { value }
    description: field(key: "${FIELD_KEYS.description}") { value }
    template: field(key: "${FIELD_KEYS.template}") { value }
    productsSource: field(key: "${FIELD_KEYS.productsSource}") { value }
    products: field(key: "${FIELD_KEYS.products}") {
      references(first: $productsLimit) { nodes { ...LookProduct } }
    }
    productsLegacy: field(key: "${FIELD_KEYS.productsLegacy}") {
      references(first: $productsLimit) { nodes { ...LookProduct } }
    }
    collection: field(key: "${FIELD_KEYS.collection}") {
      reference {
        ... on Collection {
          products(first: $productsLimit) { nodes { ...LookProduct } }
        }
      }
    }
  }

  fragment LookProduct on Product {
    id
    title
    handle
    images(first: 3) {
      nodes {
        altText
        width
        height
        src300: url(transform: { maxWidth: 300 })
        src500: url(transform: { maxWidth: 500 })
        src800: url(transform: { maxWidth: 800 })
        src1200: url(transform: { maxWidth: 1200 })
      }
    }
  }
`;

/* Specific looks by id, returned in the order the ids are given. How every section first loads. */
export const LOOKBOOK_ENTRIES_QUERY = `
  query LookbookEntries(
    $ids: [ID!]!
    $productsLimit: Int!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    nodes(ids: $ids) {
      ...LookbookEntry
    }
  }
  ${LOOKBOOK_FRAGMENTS}
`;

/* Every look, a page at a time. Only used past the 50 entries Liquid can list. */
export const LOOKBOOK_PAGE_QUERY = `
  query LookbookPage(
    $first: Int!
    $after: String
    $productsLimit: Int!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    metaobjects(type: "lookbook", first: $first, after: $after, sortKey: "id") {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ...LookbookEntry
      }
    }
  }
  ${LOOKBOOK_FRAGMENTS}
`;

/* "gid://shopify/Metaobject/123" and 123 both become "123", so ids from Liquid and the API compare equal. */
export function numericId(id) {
  return String(id ?? '').split('/').pop();
}

/* Shopify locales look like "en" or "pt-BR"; the API's LanguageCode enum reads EN and PT_BR. */
export function languageCode(locale) {
  return locale ? String(locale).toUpperCase().replace('-', '_') : null;
}

/*
 * Only the Masonry - Product Images template draws more than one image per
 * product. Matched loosely on the raw choice value, like the template registry
 * normalises it, so "masonry_product_images" counts too.
 */
export function imagesPerProduct(template) {
  const value = String(template ?? '').toLowerCase().replace(/[-_]/g, ' ');
  return value.includes('product image') ? 3 : 1;
}

/*
 * routes.root_url is "/" or a market or language prefix such as "/fr". Liquid's
 * product.url carries the same prefix, so product links stay in the visitor's
 * market and language.
 */
function productUrl(rootUrl, handle) {
  const root = String(rootUrl ?? '/').replace(/\/$/, '');
  return `${root}/products/${handle}`;
}

/* A rich text field's value is its document tree, serialised as JSON. */
function parseRichText(value) {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toProduct(product, { rootUrl, imageLimit }) {
  return {
    id: Number(numericId(product.id)),
    title: product.title,
    url: productUrl(rootUrl, product.handle),
    images: (product.images?.nodes ?? []).slice(0, imageLimit).map((image) => ({
      src: image.src500,
      srcset: `${image.src300} 300w, ${image.src500} 500w, ${image.src800} 800w, ${image.src1200} 1200w`,
      alt: image.altText || product.title || '',
      width: image.width,
      height: image.height,
    })),
  };
}

/* One API metaobject in, one entry out — the shape the templates draw. */
export function toEntry(node, { rootUrl, productsLimit }) {
  const template = node.template?.value ?? '';
  const source = (node.productsSource?.value ?? '').toLowerCase();

  let products;
  if (source.includes('collection')) {
    // A Collection look with no collection has no products, never its picked list.
    products = node.collection?.reference?.products?.nodes ?? [];
  } else {
    const picked = node.products?.references?.nodes ?? [];
    products = picked.length > 0 ? picked : (node.productsLegacy?.references?.nodes ?? []);
  }

  const imageLimit = imagesPerProduct(template);

  return {
    id: node.id,
    title: node.title?.value ?? '',
    subHeading: node.subHeading?.value ?? '',
    descriptionTree: parseRichText(node.description?.value),
    template,
    products: products
      // A reference the token cannot read, such as an unpublished product, arrives empty.
      .filter((product) => product?.handle)
      .slice(0, productsLimit)
      .map((product) => toProduct(product, { rootUrl, imageLimit })),
  };
}

/* One GraphQL request. Throws on an HTTP or GraphQL error. */
async function request(storefront, query, variables, fetchImpl) {
  const response = await fetchImpl(storefront.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': storefront.token,
    },
    body: JSON.stringify({
      query,
      variables: {
        ...variables,
        country: storefront.country || null,
        language: languageCode(storefront.language),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Storefront API responded with HTTP ${response.status}`);
  }

  const { data, errors } = await response.json();
  if (errors?.length) {
    throw new Error(errors.map((error) => error.message).join('; '));
  }

  return data;
}

/*
 * Loads looks by id, in the order given, API_PAGE_SIZE ids per request. An id
 * the token cannot read comes back null and is left out.
 */
export async function fetchLookbookEntries(storefront, ids, productsLimit, fetchImpl = fetch) {
  const chunks = [];
  for (let start = 0; start < ids.length; start += API_PAGE_SIZE) {
    chunks.push(ids.slice(start, start + API_PAGE_SIZE));
  }

  const pages = await Promise.all(
    chunks.map((chunk) => request(storefront, LOOKBOOK_ENTRIES_QUERY, { ids: chunk, productsLimit }, fetchImpl)),
  );

  return pages.flatMap((data) => data.nodes).filter((node) => node?.id);
}

/* One page of every look, after the given cursor. */
export async function fetchLookbookPage(storefront, after, productsLimit, fetchImpl = fetch) {
  const data = await request(
    storefront,
    LOOKBOOK_PAGE_QUERY,
    { first: API_PAGE_SIZE, after: after ?? null, productsLimit },
    fetchImpl,
  );

  return data.metaobjects;
}

/*
 * Hands out looks `source.pageSize` at a time: first the ids Liquid listed, in
 * its order, then — only when `source.continuePaging` says that list hit
 * Liquid's 50-entry cap — the API's own pages, skipping looks already listed.
 *
 * Looks fetched beyond the current batch wait in a buffer: dropping them would
 * lose them, because the cursor has already moved past. Ids leave the queue
 * only once they have loaded, so a failed request is retried on the next call.
 */
export function createLookbookLoader(
  source,
  { fetchEntries = fetchLookbookEntries, fetchPage = fetchLookbookPage } = {},
) {
  const { storefront, productsLimit } = source;
  const pageSize = Math.max(1, source.pageSize || 1);
  const entryConfig = { rootUrl: storefront.rootUrl, productsLimit };

  const queue = [...(source.entryIds ?? [])];
  const seen = new Set(queue.map(numericId));
  const buffer = [];
  let cursor = null;
  let hasNextPage = Boolean(source.continuePaging);

  return {
    async next() {
      while (buffer.length < pageSize && (queue.length > 0 || hasNextPage)) {
        if (queue.length > 0) {
          const ids = queue.slice(0, pageSize - buffer.length);
          buffer.push(...(await fetchEntries(storefront, ids, productsLimit)));
          queue.splice(0, ids.length);
        } else {
          const page = await fetchPage(storefront, cursor, productsLimit);
          cursor = page.pageInfo.endCursor;
          hasNextPage = page.pageInfo.hasNextPage;

          for (const node of page.nodes) {
            const id = numericId(node.id);
            if (seen.has(id)) continue;

            seen.add(id);
            buffer.push(node);
          }
        }
      }

      return {
        entries: buffer.splice(0, pageSize).map((node) => toEntry(node, entryConfig)),
        hasMore: buffer.length > 0 || queue.length > 0 || hasNextPage,
      };
    },
  };
}
