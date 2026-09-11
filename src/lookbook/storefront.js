/*
 * Storefront API client. Loads looks by id (titles, products, images) and turns
 * each result into the entry shape the templates use.
 * How it works: docs/how-it-works.md
 */

// Looks per request. Kept small because each look also pulls its products and images.
export const API_PAGE_SIZE = 6;

// Metaobject field keys. Keep in sync with snippets/lookbook.liquid.
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

// Looks by id, returned in the same order. Used for the first load.
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

// Every look, page by page. Only used past the 50 entries Liquid can list.
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

// "gid://shopify/Metaobject/123" and 123 both become "123", so ids can be compared.
export function numericId(id) {
  return String(id ?? '').split('/').pop();
}

// "pt-BR" becomes "PT_BR", the API's language code format.
export function languageCode(locale) {
  return locale ? String(locale).toUpperCase().replace('-', '_') : null;
}

// Only "Masonry - Product Images" shows more than one image per product.
export function imagesPerProduct(template) {
  const value = String(template ?? '').toLowerCase().replace(/[-_]/g, ' ');
  return value.includes('product image') ? 3 : 1;
}

// Keeps the visitor's market or language prefix, e.g. "/fr/products/handle".
function productUrl(rootUrl, handle) {
  const root = String(rootUrl ?? '/').replace(/\/$/, '');
  return `${root}/products/${handle}`;
}

// Rich text arrives as a JSON string.
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

// Turns one API metaobject into an entry for the templates.
export function toEntry(node, { rootUrl, productsLimit }) {
  const template = node.template?.value ?? '';
  const source = (node.productsSource?.value ?? '').toLowerCase();

  let products;
  if (source.includes('collection')) {
    // No collection chosen means no products, not the picked list.
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
      // Products the token can't read (e.g. unpublished) come back empty.
      .filter((product) => product?.handle)
      .slice(0, productsLimit)
      .map((product) => toProduct(product, { rootUrl, imageLimit })),
  };
}

// Sends one GraphQL request. Throws on an HTTP or GraphQL error.
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

// Loads looks by id, API_PAGE_SIZE ids per request. Ids the token can't read are skipped.
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

// Loads the next page of all looks.
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
 * Hands out looks in batches of source.pageSize: first the ids from Liquid, then,
 * if continuePaging is on, the API's own pages (skipping looks already shown).
 * Call next() again to retry after a failed request.
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
          // Ids leave the queue only after they load, so a failed request is retried.
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
