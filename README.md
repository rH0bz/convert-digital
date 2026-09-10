# Convert — Shopify theme

A Dawn-based Shopify theme with a **React-rendered Lookbook** driven by a
`lookbook` metaobject.

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

The first looks need no client-side fetching. Liquid writes the lookbook data
into a JSON script tag as the page renders, and React draws the markup from it
once `lookbook.js` loads. The data arrives with the HTML — no API request and no
access token — but the lookbook itself appears after the script runs rather
than in the initial HTML. Further looks can be fetched on demand through the
Storefront API (see *Load more*).

```
  metaobject entries
          |
          v
  snippets/lookbook.liquid        <- field keys, product resolution, payload
          |
          |  <script type="application/json" id="LookbookData-{uid}">
          |  <div data-lookbook="LookbookData-{uid}">
          v
  src/lookbook/index.jsx          <- finds those pairs, mounts React
          |
          v
  src/lookbook/Lookbook.jsx       <- section header, one template per entry,
          |                          Load more button
          v
  src/lookbook/templates/         <- Default | Full width | Masonry | Masonry+Images
```

Two consequences worth internalising:

- **Prices and any money value must be formatted in Liquid.** The shop's
  currency format is not reachable from JavaScript.
- **A malformed payload blanks the whole section** with nothing but a console
  error. JSON validity is the failure mode to guard (see *Invariants*).

---

## Design decisions

- **Shopify-native only.** A metaobject holds the looks, Liquid and the
  Storefront API read them, and sections expose the settings in the theme
  editor. React is compiled into a theme asset; there is no app, app proxy or
  external service.
- **Liquid first, the Storefront API on demand.** Liquid reads the metaobjects
  during the page render, gated by the **Storefronts** access setting on the
  definition, so the first looks need no token and no extra request. Liquid can
  only loop over 50 entries, though, so the Load more button fetches further
  looks through the Storefront API — the one place it does something Liquid
  cannot. Product pages stay on Liquid: the API has no way to ask which looks
  contain a given product.
- **The metaobject is the relationship.** A product page finds its looks from
  the products each look already lists, so there is no second field on the
  product to keep in sync.
- **One payload shape, two sources.** `snippets/lookbook.liquid` and
  `src/lookbook/storefront.js` both produce the same entry shape, so the
  templates never know whether a look came from Liquid or the API.
- **One snippet, two sections.** The snippet owns the field keys and the
  payload; the sections own only their settings. Section schemas cannot share
  settings, so the two are kept identical by hand and checked by `npm test`.

---

## Project layout

```
config/
  settings_schema.json       Theme settings > Storefront API (the access token)
locales/
  *.json                     sections.lookbook.* — Load more button text
sections/
  lookbook.liquid            Lookbook section — theme editor settings only
  lookbook-related.liquid    "Related lookbook" — product pages
snippets/
  lookbook.liquid            THE reusable entry point: field keys + payload
assets/
  section-lookbook.css       All Lookbook CSS, hand-written
  lookbook.js                GENERATED — do not edit, but DO commit it
src/lookbook/
  index.jsx                  Mount layer + theme-editor re-render handling
  Lookbook.jsx               Section header, entries, Load more button
  storefront.js              Storefront API query, response mapping, pager
  useLoadMore.js             State behind the Load more button
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
  lookbook.test.mjs          Liquid render tests for the payload
  storefront.test.mjs        Storefront API mapping and pager tests
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

Keys are declared once for Liquid, at the top of `snippets/lookbook.liquid`, and
once for the Storefront API, in `FIELD_KEYS` in `src/lookbook/storefront.js`.
**Renaming a field's label in admin does not rename its key** — that is why the
products field is resolved from two candidate keys, and why the misspelling in
`discreption` is load-bearing rather than a typo to fix. If a key is wrong the
section renders empty text and the theme editor shows a notice naming the keys
it looked for.

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
in Settings → Custom data. Each entry uses its own Template. Not available on
product templates, where Related lookbook takes its place.

**Related lookbook** (product templates only; on `product.json` by default) —
shows the looks that feature the product being viewed, up to **Maximum entries
to show** (default **2**). A product in more looks than that shows the first
ones, in admin order. The metaobject *is* the relationship, so there is no entry
picker: add a product to a look and it appears here. Collection-sourced looks
are matched through `product.collections` rather than by scanning the
collection, which stays correct past the 50 products Liquid returns. Each look
is drawn whole, with its own Template, exactly as the Lookbook section draws it.
Every other setting is identical to Lookbook's (see *Invariants*).

When no look matches, the section outputs **nothing** — no padded wrapper and no
`lookbook.js` — so it is safe to leave on the product template for every
product. In the theme editor it shows a notice explaining why instead.

---

## Load more (Storefront API)

The Lookbook section shows a **Show more** button under its looks when:

- a public access token is saved in **Theme settings → Storefront API**,
- Entries to show is **All entries** (a picked list is already complete), and
- more entries exist than **Maximum entries to show** lets the section render.

Each click fetches the next batch — the same size as Maximum entries to show —
through the Storefront API and draws it with the same templates. Product pages
never show the button.

### Setup

1. In the **Headless** sales channel, create a storefront.
2. In its Storefront API permissions, allow **metaobjects**
   (`unauthenticated_read_metaobjects`) and **product listings**
   (`unauthenticated_read_product_listings`).
3. Paste its **public access token** into the theme editor under
   **Theme settings → Storefront API**.

A public token is made to be used in the browser: it can only read what its
permissions allow. It lives in the store's theme settings, not in this
repository. Metaobjects cannot be read through the Storefront API without one.

If looks load but arrive without products, check that those products are
available on the Headless channel.

### How it fits together

`snippets/lookbook.liquid` adds a `loadMore` object to the payload: the endpoint
(`https://{shop}.myshopify.com/api/2026-07/graphql.json`), the token, the
visitor's country and language (sent with `@inContext`), the store's root URL
for product links, and the batch size. It is `null` whenever the button does
not apply. `src/lookbook/storefront.js` runs the query, maps each metaobject into
the entry shape Liquid writes, and pages through the results;
`src/lookbook/useLoadMore.js` holds the state behind the button.

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
4. `npm run build`.

Add responsive arrangement in CSS keyed off a class or `data-` attribute rather
than computing it in JS — an inline style cannot carry a media query.

---

## Known limitations

- **Liquid sees the first 50 lookbook entries.** Liquid loops over at most 50
  entries of a metaobject definition. Load more reaches the rest on the
  Lookbook section, but product pages and the first render only consider the
  first 50, in admin order.
- **Load more follows API order.** The Storefront API sorts metaobjects only by
  ID or update time, not by the order set in admin. Looks added by Load more
  follow ID order; looks already on the page are skipped.
- **Tablets keep the single row.** Between 750px and 990px, Default and Full
  width stay on one row, so a look with four or more products can scroll
  sideways.
- **Theme editor text is English only.** Section and theme settings use plain
  strings rather than `t:` keys in `locales/*.schema.json`.
- **The Load more error message was translated for this theme.** The button
  reuses Dawn's own "Show more" in every language; the error message's
  translations were not written by Shopify, so review them before launching in
  another market.

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

**Commas in the payload are leading, not trailing.** Entries can be skipped (a
look may not feature the related product), so `forloop.last` marks the last
entry *examined*, not the last *written*; the entries loop counts what it emits.
Reintroducing `unless forloop.last` there produces a trailing comma and blanks
the section. Products are never skipped, so their loop uses `limit:` with
`unless forloop.first` — add a reason to skip one and it must count too.

**Lookbook and Related lookbook have identical settings.** Apart from the entry
picker, and Maximum entries to show defaulting to 2 on product pages, the two
schemas are copies of each other. That is a product requirement, not duplication
to refactor away — section schemas cannot share settings, so change both
(`npm test` fails if they drift).

**The Storefront API mapping must produce the Liquid payload's shape.**
`toEntry` in `src/lookbook/storefront.js` mirrors what `snippets/lookbook.liquid`
writes for each entry, including the rule that a Collection look with no
collection has no products and the gate that sends three images per product
only to Masonry - Product Images. Change one, change the other.

**Every storefront locale file needs the same keys.** Theme Check's
MatchingTranslations reports an error for a key that exists in
`en.default.json` but not in another locale. Add new text to all of them.

**Never set a used CSS custom property inline from a setting.** Inline styles
outrank media queries. The masonry row height is written to
`--masonry-row-setting` and the used `--masonry-row` is derived from it in CSS,
so the mobile override is still reachable.

**`var()` does not work in an `img` `sizes` attribute.** It is resolved without
element style context, so a custom property there never resolves and the whole
value silently falls back to `100vw`, loading oversized images. Use `vw` maths.

**Only the product-images template ships 3 images per product.** The Liquid gate
matches the raw template choice loosely; guessing low is safe because a group
just shrinks. Removing the gate roughly doubles the payload for every other
template.

---

## Verifying changes

```bash
npm test                     # payload render tests + Storefront API unit tests
npm run build                # must succeed
shopify theme check          # no lookbook file may appear in the output
```

`npm test` runs two files. `tests/lookbook.test.mjs` covers what the other two
commands cannot see: a malformed JSON payload, which blanks the section with
only a console error, the product page rules and when Load more is offered. It
renders through liquidjs with Shopify's filters stubbed, so it does not cover
the closing-script guard (see *Invariants*). `tests/storefront.test.mjs` checks
the Storefront API mapping and the Load more pager with hand-written responses,
without any network.

`theme check` also reports a few warnings in stock Dawn files (9 with Shopify
CLI 4.8). Those are not ours; what matters is that **no lookbook file appears in
the output and the error count is 0**.
