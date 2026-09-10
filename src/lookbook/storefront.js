/*
 * Storefront API client for "Load more looks".
 *
 * The first looks on the page come from Liquid (snippets/lookbook.liquid). This
 * module fetches the rest through the Storefront API and converts each one into
 * the same entry shape the Liquid payload uses, so the templates draw both
 * without knowing where an entry came from.
 *
 * Liquid can loop over at most 50 entries of a metaobject definition; the API
 * pages through all of them, which is why it is used here and only here.
 *
 * Metaobjects cannot be read tokenless. The token comes from the Headless
 * channel, needs the unauthenticated_read_metaobjects and
 * unauthenticated_read_product_listings permissions, and is pasted into
 * Theme settings > Storefront API.
 *
 * Kept free of React and JSX so it runs under `node --test` as it is.
 */

/*
 * Looks requested per API call. Kept small because every look carries up to
 * three product connections (picked, legacy picked and collection), each with
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

export const LOOKBOOK_QUERY = `
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

/* "gid://shopify/Metaobject/123" and 123 both become "123", so ids from Liquid and the API compare equal. */
export function numericId(id) {
  return String(id ?? '').split('/').pop();
}

/* Shopify locales look like "en" or "pt-BR"; the API's LanguageCode enum reads EN and PT_BR. */
export function languageCode(locale) {
  return locale ? String(locale).toUpperCase().replace('-', '_') : null;
}

/*
 * The same loose rule as the Liquid gate in snippets/lookbook.liquid: only the
 * Masonry - Product Images template draws more than one image per product.
 */
export function imagesPerProduct(template) {
  const value = String(template ?? '').toLowerCase().replace(/[-_]/g, ' ');
  return value.includes('product image') ? 3 : 1;
}

/*
 * routes.root_url is "/" or a market or language prefix such as "/fr". Liquid's
 * product.url carries the same prefix, so a look loaded later links to the
 * same page a look rendered by Liquid would.
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

/* One API metaobject in, one payload entry out — the shape snippets/lookbook.liquid writes. */
export function toEntry(node, { rootUrl, productsLimit }) {
  const template = node.template?.value ?? '';
  const source = (node.productsSource?.value ?? '').toLowerCase();

  let products;
  if (source.includes('collection')) {
    // As in Liquid: a Collection look with no collection has no products, never its picked list.
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
    descriptionHtml: '',
    template,
    products: products
      // A reference the token cannot read, such as an unpublished product, arrives empty.
      .filter((product) => product?.handle)
      .slice(0, productsLimit)
      .map((product) => toProduct(product, { rootUrl, imageLimit })),
  };
}

/* Fetches one page of lookbook metaobjects. Throws on an HTTP or GraphQL error. */
export async function fetchLookbookPage(config, after, fetchImpl = fetch) {
  const response = await fetchImpl(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': config.token,
    },
    body: JSON.stringify({
      query: LOOKBOOK_QUERY,
      variables: {
        first: API_PAGE_SIZE,
        after: after ?? null,
        productsLimit: config.productsLimit,
        country: config.country || null,
        language: languageCode(config.language),
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

  return data.metaobjects;
}

/*
 * Hands out looks `config.pageSize` at a time.
 *
 * The API sorts only by id or update time, not by the order set in admin, so
 * its pages do not line up with the looks Liquid already rendered. Those are
 * skipped by id. Looks fetched beyond the current batch wait in a buffer:
 * dropping them would lose them, because the cursor has already moved past.
 */
export function createLookbookPager(config, renderedIds, fetchPage = fetchLookbookPage) {
  const seen = new Set(Array.from(renderedIds, numericId));
  const buffer = [];
  let cursor = null;
  let hasNextPage = true;

  return {
    async next() {
      while (buffer.length < config.pageSize && hasNextPage) {
        const page = await fetchPage(config, cursor);
        cursor = page.pageInfo.endCursor;
        hasNextPage = page.pageInfo.hasNextPage;

        for (const node of page.nodes) {
          const id = numericId(node.id);
          if (seen.has(id)) continue;

          seen.add(id);
          buffer.push(toEntry(node, config));
        }
      }

      return {
        entries: buffer.splice(0, config.pageSize),
        hasMore: buffer.length > 0 || hasNextPage,
      };
    },
  };
}
