# How the lookbook works

How a look gets from the `lookbook` metaobject onto the page. For setup, see the
[README](../README.md).

## The short version

1. **Liquid** picks which lookbook entries to show. It writes their ids into the
   page, together with the section settings and the Storefront API details.
2. **The browser** loads those looks (titles, descriptions, products, images)
   through the **Storefront API**.
3. **React** draws each look with the template chosen on its entry.

```
metaobject entries
      |
      v
snippets/lookbook.liquid ---- writes ids + settings as JSON, plus placeholder looks
      |
      v
src/lookbook/index.jsx ------ reads the JSON, loads the first looks, mounts React
      |
      v
src/lookbook/storefront.js -- Storefront API requests; turns results into entries
      |
      v
src/lookbook/Lookbook.jsx --- section header, looks, Show more button
      |
      v
src/lookbook/templates/ ----- Default | Full width | Masonry | Masonry - Product Images
```

## Why Liquid still picks the entries

The Storefront API can load a look, but it can't answer three questions that
Liquid can:

- **Which entries did the merchant pick?** A picked list is a section setting,
  and only Liquid can read section settings.
- **What order are they in?** The API sorts metaobjects by id or last update,
  not by the order set in the admin.
- **Which looks include this product?** The API has no filter for that, so on a
  product page Liquid checks each look.

So Liquid outputs ids only. Everything about the looks comes from the API.

## What Liquid writes into the page

`snippets/lookbook.liquid` outputs a `<script type="application/json">` with:

| Field | What it is |
| --- | --- |
| `heading`, `headingSize`, `subHeading`, `description` | Section header settings |
| `showSubHeading`, `showDescription`, `masonryRowHeight`, `productCtaLabel` | Display settings for the templates |
| `source.storefront` | API endpoint, public token, visitor country and language, and the store's root URL for product links |
| `source.entryIds` | The looks to show, as metaobject ids (`gid://shopify/Metaobject/…`), in order |
| `source.pageSize` | How many looks load per batch |
| `source.productsLimit` | Maximum products per look |
| `source.continuePaging` | `true` when the list hit Liquid's 50-entry limit, so Show more keeps paging through the API |
| `labels` | Button and error text, from the `t` filter |

Next to it is `<div data-lookbook>`, which already holds the placeholder looks.

## Loading, step by step

1. **Placeholders show first.** `snippets/lookbook-skeleton.liquid` draws one
   placeholder per look in the first batch (up to 6), so the section has its
   shape before any JavaScript runs.
2. **The first looks load.** `index.jsx` reads the JSON and asks the loader
   (`createLookbookLoader` in `storefront.js`) for the first batch. The loader
   requests the looks by id with a `nodes(ids:)` query, which keeps Liquid's
   order.
3. **React mounts.** Only once the looks have arrived does React render,
   replacing the placeholders in one go. Why it waits:
   [gotchas](gotchas.md#react-mounts-after-the-first-looks-load).
4. **Show more loads the next batch.** Each click asks the loader for another
   batch. When Liquid's ids run out and `continuePaging` is on, the loader pages
   through the API's `metaobjects` list and skips looks already shown.

If a request fails, the section shows an error message (first batch) or offers
Show more again (later batches).

### Batch sizes

| Section | First batch | Show more |
| --- | --- | --- |
| Lookbook, All entries | Maximum entries to show | Loads the rest in batches of that size |
| Lookbook, Selected entries | Everything picked | Not shown |
| Related lookbook (product page) | All matches, up to Maximum entries to show | Not shown |

## Product pages

`sections/lookbook-related.liquid` passes the current product to the snippet as
`containing_product`, and the snippet keeps only the looks that include it:

- **Looks with picked products** match when the product is in the picked list.
- **Looks that pull from a collection** match when the product is in that
  collection. Liquid checks the product's own collections rather than the
  collection's products, which stays correct for collections over 50 products.
- **A look set to Collection with no collection chosen** has no products, so it
  never matches.

## When nothing is shown

Both sections output nothing (no wrapper, no script) when:

- there is no Storefront API token in the theme settings,
- there are no lookbook entries to show, or
- on a product page, no look includes the product.

In the theme editor, a notice explains which case it is.

## Theme editor

The theme editor re-renders a section each time a setting changes. `index.jsx`
listens for `shopify:section:load` and `shopify:section:unload`, so the lookbook
remounts cleanly instead of going blank or mounting twice.

## Text and translations

The button and error text live in `locales/*.json` under `sections.lookbook`.
Shopify's `t` filter HTML-escapes it, so `translations.js` unescapes it before
React displays it.

## Storefront API details

- **Version:** set once as `storefront_api_version` in
  `snippets/lookbook.liquid`. Shopify supports each version for about a year.
- **Token permissions:** `unauthenticated_read_metaobjects` and
  `unauthenticated_read_product_listings`.
- **Looks without products:** check that the products are available on the
  Headless channel.
- **Query cost:** looks are requested 6 at a time (`API_PAGE_SIZE`), because
  each look brings its products and images with it.

## Design decisions

- **Shopify-native only.** Metaobjects, Liquid, the Storefront API and theme
  sections. React is compiled into a theme asset; no app or external server.
- **Placeholders come from Liquid, not React.** Liquid already knows how many
  looks the first batch has, so the placeholders are in the HTML and visible
  before any JavaScript runs.
- **One loader for every section.** The homepage list, a picked list and a
  product page's matches all load the same way (ids first), so there is one
  code path to test.
- **One snippet, two sections.** The snippet does the work; the sections only
  hold settings.
