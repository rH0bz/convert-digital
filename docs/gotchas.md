# Gotchas

Things in the lookbook code that look odd, or like an easy cleanup, but are
there on purpose. Each one caused a real bug when it was different. Read the
relevant entry before changing the code it describes.

## Liquid

### The closing-script guard is built from two halves

In `snippets/lookbook.liquid`, `script_close` is assembled with `append`. If a
merchant pastes a closing script tag into a heading or description, it's
replaced with an escaped version, so it can't end the JSON script tag early.

- **Don't write the tag in one piece.** Theme Check reads it as the end of the
  `<script>` element, reports a syntax error and stops checking the rest of the
  file.
- **Keep the backslash** in `'<\/scr'`. The escaped form is valid JSON that
  browsers don't treat as a closing tag. Shopify's Liquid keeps the backslash;
  liquidjs (used by the tests) drops it, so the tests can't check this guard.

### Commas between ids are added before each id

On a product page the id loop skips looks that don't match, so `forloop.last`
isn't the last id actually written. The snippet counts the ids it writes and
adds a comma before every id except the first. Switching back to
`unless forloop.last` leaves a trailing comma, which breaks the JSON and blanks
the section.

### `allow_false: true` on checkbox defaults

Without it, `default: true` turns an unchecked setting (`false`) into `true`.

### No default label for `product_cta_label`

Liquid can't tell "empty" from "not set". A default would bring the button back
when a merchant clears the label on purpose.

### Checking metaobject fields with a one-item loop

`.first` returns nothing on `shop.metaobjects.lookbook.values`, so the theme
editor notice uses `for probe_entry in lookbook_entries limit: 1` instead.

### Field keys live in two places

Liquid uses them to match looks to products (`snippets/lookbook.liquid`); the
API query uses `FIELD_KEYS` (`src/lookbook/storefront.js`). Change both together.

- `discreption` is the real key in the metaobject definition, not a typo to fix.
- The products field is read from `select_products`, or `top_3_field` for older
  entries. Renaming a field label in the admin doesn't change its key.

### A look set to Collection with no collection has no products

Liquid never matches it on a product page, and `toEntry` never falls back to its
picked products. Both sides must agree, or a matched look would load empty.

## JavaScript

### React mounts after the first looks load

`createRoot` clears the mount element on its first render. If React mounted
straight away, it would remove the placeholders at once and leave the section
blank while the API request runs. `index.jsx` waits for the first looks so the
placeholders and the looks swap in one render.

### Labels arrive HTML-escaped

Shopify's `t` filter escapes text, so "Couldn't" arrives as `Couldn&#39;t`.
`translations.js` unescapes it before React shows it. Don't render the labels as
HTML instead: that would let injected markup through.

### Three images per product only for Masonry - Product Images

The query asks for three images per product; `imagesPerProduct` keeps one for
every other template, so they don't carry images they never show.

## CSS

### Don't set `--masonry-row` inline

The templates set `--masonry-row-setting` inline, and the CSS derives
`--masonry-row` from it. Inline styles beat media queries, so setting
`--masonry-row` directly would block the smaller phone value.

### No CSS variables in img sizes

The browser reads the `sizes` attribute without any CSS context, so `var(...)`
never resolves and the whole value falls back to `100vw`, downloading oversized
images. Use plain `vw` numbers.

### Don't add Dawn's `title-wrapper-with-link` to the section header

Its `margin` shorthand overrides the auto margins from `page-width`, and the
header ends up against the left edge while the looks stay centred.

## Theme and project

### The two sections have the same settings

Related lookbook's settings match Lookbook's, apart from the entry picker and a
default of 2 for Maximum entries to show. This is a product requirement.
Section schemas can't share settings, so change both files; `npm test` fails if
they drift apart.

### Every locale file needs every key

Theme Check reports an error when a key in `locales/en.default.json` is missing
from another storefront locale file. Add new text to all of them.

### Commit `assets/lookbook.js`, built with `npm run build`

Shopify serves the theme from `assets/`, and `src/` never reaches the store.
`npm run dev` bundles the larger development build of React, so always run
`npm run build` before pushing.

### Only the first 50 metaobject entries in Liquid

Liquid loops over at most 50 entries. Past that, the homepage keeps loading
through the API, but in id order, because the API can't sort by admin order.
Product pages only check the first 50 entries.
