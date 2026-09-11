# Convert — Shopify theme

A Dawn-based Shopify theme with a **React-rendered Lookbook** driven by a
`lookbook` metaobject and loaded through the **Storefront API**.

Everything except the Lookbook is stock Dawn. If you are only touching Liquid
elsewhere in the theme, you can ignore the build step entirely — it exists
solely to compile `src/lookbook/` into `assets/lookbook.js`.

---

## Requirements

| Tool | Version used | Notes |
| --- | --- | --- |
| Node | 22.12 | Anything supporting ES2020 output works |
| npm | 10.9 | |
| Shopify CLI | 4.8 | `shopify theme dev` / `theme check` / `theme push` |

The lookbook also needs a **Storefront API public access token** in the theme
settings — see *Storefront API*.

---

## Getting started

```bash
npm install          # once
npm run dev          # esbuild watch — rebuilds assets/lookbook.js on save
shopify theme dev    # in a second terminal: live preview against your store
```

Ship a production bundle before pushing:

```bash
npm run build
shopify theme push
```

`npm run dev` and `npm run build` are **not** interchangeable. `build.mjs` sets
`minify: !watch`, and esbuild derives `process.env.NODE_ENV` from that flag — so
watch mode bundles development React (readable warnings, larger) and `build`
bundles production React. Never push a watch-mode bundle.

---

## How the Lookbook works

Liquid decides **which** looks a section shows; the Storefront API loads
**everything about them**.

```
  metaobject entries
          |
          v
  snippets/lookbook.liquid        <- which entries (ids, in order), settings,
          |                          Storefront API endpoint and token
          |  <script type="application/json" id="LookbookData-{uid}">
          |  <div data-lookbook="LookbookData-{uid}">   <- skeleton placeholders
          v
  src/lookbook/index.jsx          <- loads the first looks, then mounts React
          |
          v
  src/lookbook/storefront.js      <- Storefront API: looks by id, then page by page
          |
          v
  src/lookbook/Lookbook.jsx       <- section header, looks, Show more
          |
          v
  src/lookbook/templates/         <- Default | Full width | Masonry | Masonry+Images
```

From the first paint, the mount point shows skeleton placeholders that Liquid
drew — one per look in the first batch. `index.jsx` fetches those looks by id
(titles, sub headings, descriptions, templates, products and images) with a
`nodes(ids:)` query, which returns them in the order Liquid chose, and only then
mounts React, which replaces the placeholders with the looks in a single render.

Three consequences worth internalising:

- **No token, no lookbook.** Metaobjects cannot be read through the Storefront
  API without one, so without a token the lookbook outputs nothing on the
  storefront and explains why in the theme editor.
- **A malformed payload blanks the whole section** with nothing but a console
  error. JSON validity is the failure mode to guard (see *Invariants*).
- **Money needs formatting in the browser.** Should prices ever be shown, the
  API returns an amount and a currency code; format them with
  `Intl.NumberFormat` in the visitor's locale, not by hand.

---

## Design decisions

- **Shopify-native only.** A metaobject holds the looks, the Storefront API
  delivers them, and sections expose the settings in the theme editor. React is
  compiled into a theme asset; there is no app, app proxy or external service.
- **The Storefront API loads every look; Liquid only chooses which.** Liquid
  keeps that choice because only it can make it: a picked list is a section
  setting, admin order is not an order the API can sort by, and the API has no
  way to ask which looks contain a given product. It writes ids, never content.
- **A skeleton from Liquid, not from React.** Liquid knows how many looks the
  first batch holds, so it draws that many placeholders into the HTML. They are
  on screen from the first paint, before any JavaScript runs, and the markup
  lives in one place.
- **The metaobject is the relationship.** A product page finds its looks from
  the products each look already lists, so there is no second field on the
  product to keep in sync.
- **One loader for every section.** The homepage list, a picked list and a
  product page's matches all load the same way — ids first, in order — so
  there is one code path to test and maintain.
- **One snippet, two sections.** The snippet owns the entry choice and the
  payload; the sections own only their settings. Section schemas cannot share
  settings, so the two are kept identical by hand and checked by `npm test`.

---

## Project layout

```
config/
  settings_schema.json       Theme settings > Storefront API (the access token)
locales/
  *.json                     sections.lookbook.* — Show more and error text
sections/
  lookbook.liquid            Lookbook section — theme editor settings only
  lookbook-related.liquid    "Related lookbook" — product pages
snippets/
  lookbook.liquid            THE reusable entry point: which entries + payload
  lookbook-skeleton.liquid   Placeholder looks, shown until the looks load
assets/
  section-lookbook.css       All Lookbook CSS, hand-written
  lookbook.js                GENERATED — do not edit, but DO commit it
src/lookbook/
  index.jsx                  Mount layer: loads the first looks, mounts React
  Lookbook.jsx               Section header, looks, Show more
  useLookbookEntries.js      The looks on the page and the Show more state
  storefront.js              Storefront API queries, response mapping, loader
  translations.js            Undoes the HTML escaping Shopify's t filter adds
  ProductCard.jsx            One product tile (image + overlay)
  RichText.jsx               Renders Shopify's rich-text document tree
  templates/
    index.jsx                Registry: choice value -> component
    EntryHeader.jsx          Shared title / sub heading / description
    DefaultRow.jsx           One row, theme container (two up on phones)
    FullWidthRow.jsx         One row, full bleed (two up on phones)
    MasonryGrid.jsx          Masonry rhythm, one image per product
    MasonryProductImages.jsx Masonry rhythm, a group of 3 images per product
tests/
  lookbook.test.mjs          Liquid render tests: which looks, payload, skeleton
  storefront.test.mjs        Storefront API requests, mapping and loader
  translations.test.mjs      Label unescaping
build.mjs                    esbuild config (add an entry point per React section)
```

`assets/lookbook.js` is a build output but **must be committed** — Shopify
serves the theme from `assets/`, and `src/` never reaches the store
(`.shopifyignore` excludes `src/`, `tests/`, `build.mjs`, `package.json`,
`node_modules/`).

---

## Metaobject setup

Definition type handle must be **`lookbook`**, with **Storefronts API access
enabled**, and entries must be **Active** — draft entries are not exposed to the
storefront and will not render.

| Field label | Key | Type |
| --- | --- | --- |
| Title | `title` | Single line text |
| Sub Heading | `sub_heading` | Single line text |
| Discreption | `discreption` | Rich text |
| Template | `template` | Choice list |
| Select Products | `select_products` *(or legacy `top_3_field`)* | Product list |
| Collection | `collection` | Collection |
| Products Source | `products_source` | Choice list |

Keys are declared in two places: at the top of `snippets/lookbook.liquid`, where
Liquid uses them to match looks to a product, and in `FIELD_KEYS` in
`src/lookbook/storefront.js`, where the API query reads them. **Renaming a
field's label in admin does not rename its key** — that is why the products
field is resolved from two candidate keys, and why the misspelling in
`discreption` is load-bearing rather than a typo to fix. If a key is wrong the
theme editor shows a notice naming the keys it looked for.

### Products Source

Matched loosely: any value **containing "collection"** means the entry pulls
from its Collection field. Anything else — including an empty choice — means the
picked product list. Manual is therefore the default, and entries saved before
this field existed keep working.

### Template

Resolved in `src/lookbook/templates/index.jsx`, which normalises the value
(`"Full Width"`, `full-width`, `FULL_WIDTH` all match) and **falls back to
Default** for an empty or unrecognised choice, so a look never drops off the
page. Suggested choice values:

- `Default` — products on one row, theme container; two up, wrapping, on phones
- `Full Width` — one row, full bleed; two up, wrapping, on phones
- `Masonry` — alternating wide/narrow cards at two heights
- `Masonry - Product Images` — same rhythm, but each cell is a group of up to
  3 images from one product

Old spellings stay mapped in `ALIASES` (for example `Fluid Grid` → Masonry),
because renaming a choice in admin does **not** rewrite the value already stored
on each entry.

---

## The two sections

**Lookbook** — pick entries manually or show all Active ones, in the order set
in Settings → Custom data. With **All entries**, **Maximum entries to show**
looks load first and a **Show more** button loads the rest in batches of that
size; a picked list loads everything picked. Each entry uses its own Template.
Not available on product templates, where Related lookbook takes its place.

**Related lookbook** (product templates only; on `product.json` by default) —
shows the looks that feature the product being viewed, up to **Maximum entries
to show** (default **2**). A product in more looks than that shows the first
ones, in admin order. The metaobject *is* the relationship, so there is no entry
picker: add a product to a look and it appears here. Collection-sourced looks
are matched through `product.collections` rather than by scanning the
collection, which stays correct past the 50 products Liquid returns. Each look
is drawn whole, with its own Template, exactly as the Lookbook section draws it.
Every other setting is identical to Lookbook's (see *Invariants*).

Both sections output **nothing** — no padded wrapper and no `lookbook.js` — when
there is nothing to load: no token, no entries, or no look featuring the
product. In the theme editor they show a notice explaining why instead.

---

## Storefront API

### Setup

1. In the **Headless** sales channel, create a storefront.
2. In its Storefront API permissions, allow **metaobjects**
   (`unauthenticated_read_metaobjects`) and **product listings**
   (`unauthenticated_read_product_listings`).
3. Paste its **public access token** into the theme editor under
   **Theme settings → Storefront API**. The token is saved per theme, so paste
   it again in any theme this code is pushed to.

A public token is made to be used in the browser: it can only read what its
permissions allow. It lives in the store's theme settings, not in this
repository.

If looks load but arrive without products, check that those products are
available on the Headless channel.

### How loading works

`snippets/lookbook.liquid` writes a `source` object into the payload:

| Field | Meaning |
| --- | --- |
| `storefront` | Endpoint (`https://{shop}.myshopify.com/api/2026-07/graphql.json`), token, the visitor's country and language (sent with `@inContext`), and the root URL for product links |
| `entryIds` | The looks to show, as metaobject GIDs, in order |
| `pageSize` | How many load at a time: Maximum entries to show for All entries, everything for a picked list or a product page |
| `productsLimit` | Maximum products per look |
| `continuePaging` | `true` when All entries reached Liquid's 50-entry cap — Show more then carries on through the API's own `metaobjects` pages, skipping looks already shown |

`createLookbookLoader` in `src/lookbook/storefront.js` hands out one batch per
call: ids first, then pages. `index.jsx` asks it for the first batch before
mounting React, and `useLookbookEntries.js` asks for one more per Show more
click.

Shopify supports each Storefront API version for about a year. The version is
set once, as `storefront_api_version` in `snippets/lookbook.liquid`.

---

## Rendering a lookbook somewhere else

The section is a thin wrapper; the snippet is the reusable unit.

```liquid
{% render 'lookbook', uid: 'home-lookbook', heading: 'Shop the look' %}
```

`uid` is **required when two lookbooks share a page** — matching ids make both
mount the same payload. Every parameter is documented in the snippet's header
comment; that block is the API reference, kept next to the code so it cannot
drift.

---

## Adding a template

1. Write the component in `src/lookbook/templates/`. It owns the **whole
   entry** — header, product arrangement *and* container width. Width lives in
   the template, not the section wrapper, because Full width has to escape the
   container its neighbours sit in.
2. Add one line to `TEMPLATES` in `templates/index.jsx`.
3. Add the choice to the metaobject definition in admin.
4. If it draws more than one image per product, update `imagesPerProduct` in
   `storefront.js`.
5. `npm run build`.

Add responsive arrangement in CSS keyed off a class or `data-` attribute rather
than computing it in JS — an inline style cannot carry a media query.

---

## Known limitations

- **The looks are not in the initial HTML.** Only their placeholders are. The
  looks arrive from the Storefront API after `lookbook.js` runs, so crawlers
  that do not run JavaScript do not see them.
- **The lookbook needs a token.** Without one, or with one missing a
  permission, no look is shown.
- **Liquid lists at most 50 entries.** Past that, All entries carries on through
  the API in ID order rather than admin order, and product pages only consider
  the first 50 entries.
- **The skeleton is a general shape.** It shows a title, a line of text and a
  row of cards per look, whatever template the look turns out to use, so a
  Masonry look settles into a different height when it arrives.
- **Tablets keep the single row.** Between 750px and 990px, Default and Full
  width stay on one row, so a look with four or more products can scroll
  sideways.
- **Theme editor text is English only.** Section and theme settings use plain
  strings rather than `t:` keys in `locales/*.schema.json`.
- **Some storefront text was translated for this theme.** Show more reuses
  Dawn's own "Show more" in every language; the two error messages were not
  translated by Shopify, so review them before launching in another market.

---

## Invariants

These are the things that look like tidy-ups and are not. Each one was a real
bug.

**Never write a literal closing-script tag inside a Liquid filter argument.**
`snippets/lookbook.liquid` assembles it from two halves. Written out, Theme
Check's HTML parser treats it as closing the `<script>` element, fails with a
`LiquidHTMLSyntaxError`, and then **stops checking the rest of the file** — you
lose all coverage after that line, not just one error.

**The backslash in `<\/script>` must survive to output.** Shopify's Liquid keeps
it because its lexer never unescapes string literals. Do not port that line to a
templating language that *does* unescape (liquidjs) — the two halves collapse to
the same value, `replace` becomes a no-op, and the guard silently disappears.

**Commas in the payload are leading, not trailing.** An entry can be skipped (a
look may not feature the related product), so `forloop.last` marks the last
entry *examined*, not the last *written*; the id loop counts what it emits.
Reintroducing `unless forloop.last` there produces a trailing comma and blanks
the section.

**React mounts only after the first looks load.** `createRoot` clears whatever
is inside the mount point on its first render. Mounting straight away would
wipe the skeleton the moment the script runs and leave the section blank while
the request is out; `index.jsx` waits for the looks so the placeholders and the
looks swap in one render.

**Lookbook and Related lookbook have identical settings.** Apart from the entry
picker, and Maximum entries to show defaulting to 2 on product pages, the two
schemas are copies of each other. That is a product requirement, not duplication
to refactor away — section schemas cannot share settings, so change both
(`npm test` fails if they drift).

**Field keys live in two places.** Liquid matches looks to products with the
keys in `snippets/lookbook.liquid`; the API query reads the keys in
`FIELD_KEYS` in `src/lookbook/storefront.js`. Change one, change the other.

**A Collection look with no collection has no products.** Liquid does not match
it to a product page, and `toEntry` does not fall back to its picked list.
Both sides must agree, or a look matched by Liquid would load empty.

**Every storefront locale file needs the same keys.** Theme Check's
MatchingTranslations reports an error for a key that exists in
`en.default.json` but not in another locale. Add new text to all of them.

**Labels reach the payload HTML-escaped.** Shopify's `t` filter escapes
translations, so "Couldn't" arrives as `Couldn&#39;t`. `Lookbook.jsx` undoes
that with `translations.js` before rendering the labels as text. Rendering
them as HTML instead would open an injection point.

**Never set a used CSS custom property inline from a setting.** Inline styles
outrank media queries. The masonry row height is written to
`--masonry-row-setting` and the used `--masonry-row` is derived from it in CSS,
so the mobile override is still reachable.

**`var()` does not work in an `img` `sizes` attribute.** It is resolved without
element style context, so a custom property there never resolves and the whole
value silently falls back to `100vw`, loading oversized images. Use `vw` maths.

**Only the product-images template gets 3 images per product.** The query asks
for three; `imagesPerProduct` in `storefront.js` keeps one for every other
template, so the rest do not carry images they never draw.

---

## Verifying changes

```bash
npm test                     # Liquid payload tests + Storefront API unit tests
npm run build                # must succeed
shopify theme check          # no lookbook file may appear in the output
```

`npm test` runs three files. `tests/lookbook.test.mjs` renders both sections
through liquidjs with Shopify's filters stubbed and checks what the other two
commands cannot see: a malformed JSON payload, which looks each section lists,
the skeleton, and when nothing is output. It does not cover the closing-script
guard (see *Invariants*). `tests/storefront.test.mjs` checks the requests, the
mapping into the templates' entry shape, and the loader's batching, paging and
retries, with hand-written responses and no network. `tests/translations.test.mjs`
checks the label unescaping.

`theme check` also reports a few warnings in stock Dawn files (9 with Shopify
CLI 4.8). Those are not ours; what matters is that **no lookbook file appears in
the output and the error count is 0**.
