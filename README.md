# Convert — Shopify theme

A Dawn-based Shopify theme with a React-rendered **Lookbook**. Looks are stored in
a `lookbook` metaobject and loaded through the **Storefront API**.

Everything except the Lookbook is stock Dawn. The build step only compiles
`src/lookbook/` into `assets/lookbook.js`.

## Documentation

| Doc | Read it to… |
| --- | --- |
| [How it works](docs/how-it-works.md) | follow a look from the metaobject onto the page |
| [Templates and styles](docs/templates-and-styles.md) | change a layout or add a template |
| [Snippet reference](docs/snippet-reference.md) | render a lookbook somewhere new |
| [Gotchas](docs/gotchas.md) | check before changing code that looks odd |

## Requirements

| Tool | Version used |
| --- | --- |
| Node | 22.12 |
| npm | 10.9 |
| Shopify CLI | 4.8 |

## Getting started

```bash
npm install          # once
npm run dev          # rebuilds assets/lookbook.js on save
shopify theme dev    # in a second terminal: live preview
```

Before pushing:

```bash
npm run build
shopify theme push
```

Don't push a `npm run dev` build: it bundles the larger development version of
React. `assets/lookbook.js` is a build output, but it must be committed because
Shopify serves the theme from `assets/`.

## Setup in Shopify admin

### 1. Lookbook metaobject

Create a metaobject definition with the type handle **`lookbook`**, turn on
**Storefronts** access, and set entries to **Active** (drafts don't show).

| Field | Key | Type |
| --- | --- | --- |
| Title | `title` | Single line text |
| Sub Heading | `sub_heading` | Single line text |
| Discreption | `discreption` | Rich text |
| Template | `template` | Choice list |
| Select Products | `select_products` (older entries: `top_3_field`) | Product list |
| Collection | `collection` | Collection |
| Products Source | `products_source` | Choice list |

- **Products Source:** any value containing "collection" uses the Collection
  field; anything else (or empty) uses the picked products.
- **Template:** `Default`, `Full Width`, `Masonry` or `Masonry - Product Images`.
  Unknown values fall back to Default. See
  [Templates and styles](docs/templates-and-styles.md).
- Field keys are the keys shown in the definition, not the labels. They're set
  in `snippets/lookbook.liquid` and `src/lookbook/storefront.js`.

### 2. Storefront API token

1. In the **Headless** sales channel, create a storefront.
2. In its Storefront API permissions, allow **metaobjects** and **product
   listings**.
3. In the theme editor, paste its **public access token** into
   **Theme settings → Storefront API**. The token is saved per theme, so paste it
   again in any theme this code is pushed to.

A public token is meant to be used in the browser. If looks load without
products, check that the products are available on the Headless channel.

### 3. Add the sections

- **Lookbook**: for the homepage and other pages (not product pages). Choose
  *All entries* or pick entries. With All entries, *Maximum entries to show*
  looks load first and **Show more** loads the rest.
- **Related lookbook**: product pages only, and already on
  `templates/product.json`. Shows the looks that include the product being
  viewed, up to *Maximum entries to show* (default 2). Its other settings match
  the Lookbook section.

Without a token, or with nothing to show, a section outputs nothing on the live
store and shows a notice in the theme editor.

## Project layout

```
config/settings_schema.json     Theme settings > Storefront API (the token)
locales/*.json                  sections.lookbook.* (Show more and error text)
sections/
  lookbook.liquid               Lookbook section settings
  lookbook-related.liquid       Related lookbook (product pages)
snippets/
  lookbook.liquid               Picks the entries and writes the page data
  lookbook-skeleton.liquid      Placeholder looks while loading
assets/
  section-lookbook.css          All lookbook styles
  lookbook.js                   Built from src/ (commit it)
src/lookbook/
  index.jsx                     Loads the first looks and mounts React
  Lookbook.jsx                  Section header, looks, Show more
  useLookbookEntries.js         Looks and Show more state
  storefront.js                 Storefront API requests and loader
  translations.js               Unescapes translated labels
  ProductCard.jsx               One product card
  RichText.jsx                  Rich text field renderer
  templates/                    Default, Full width, Masonry, Masonry - Product Images
tests/                          npm test
docs/                           Detailed documentation
```

`.shopifyignore` keeps `src/`, `tests/`, `docs/` and the build files out of the
theme upload.

## Testing

```bash
npm test               # Liquid and Storefront API tests, no network needed
npm run build          # must succeed
shopify theme check    # lookbook files should have no offenses
```

- `tests/lookbook.test.mjs`: which looks each section lists, the JSON payload
  and the skeleton.
- `tests/storefront.test.mjs`: API requests, mapping and the loader.
- `tests/translations.test.mjs`: label unescaping.

`theme check` also reports 9 warnings in stock Dawn files (Shopify CLI 4.8).
Those aren't part of the lookbook.

## Known limitations

- Looks load after the page, so crawlers that don't run JavaScript only see the
  placeholders.
- No token, or a token without the right permissions, means no looks.
- Liquid lists at most 50 entries. Beyond that, the homepage keeps loading
  through the API in id order, and product pages only check the first 50.
- Placeholders have one general shape, so Masonry looks change height when
  they arrive.
- Between 750px and 990px, Default and Full width stay on one row and can scroll
  sideways with four or more products.
- Theme editor setting labels are English only.
- The two lookbook error messages were translated for this theme, not by
  Shopify. Review them before launching in another language.
