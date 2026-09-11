# Templates and styles

Each lookbook entry chooses a **Template** in the metaobject. The template
decides how that look's products are laid out. All styles are in
`assets/section-lookbook.css`.

## Choosing a template

`src/lookbook/templates/index.jsx` turns an entry's Template value into a
component:

- The value is normalised, so `Full Width`, `full-width` and `FULL_WIDTH` all
  work.
- Old names keep working through `ALIASES` (for example `Fluid Grid` becomes
  Masonry). Renaming a choice in the admin doesn't update entries already saved.
- An empty or unknown value falls back to **Default**, so a look never
  disappears.

Suggested choice values: `Default`, `Full Width`, `Masonry`,
`Masonry - Product Images`.

## The templates

### Default

Products on one row inside the normal page width. If they don't fit, the row
scrolls sideways instead of squashing the cards. On phones the products wrap
into two columns.

### Full width

Same as Default, but the look spans the whole screen. It skips `page-width`, and
`.lookbook__entry--full` adds the same side padding instead. This is why each
template sets its own width rather than the section wrapper.

### Masonry

Cards alternate between wide and narrow, and between two heights, in a pattern
that repeats every 4 cards on a 6-column grid:

```
row A   [ card 1: 4 columns ][ card 2: 2 columns ]   3 rows tall
row B   [ card 3: 2 columns ][ card 4: 4 columns ]   4 rows tall
```

- Each pair fills all 6 columns, so there are no gaps.
- With an odd number of products, the last card spans the full width.
- `grid-auto-flow: dense` isn't used, so cards keep the merchant's order.
- Heights come from the **Masonry row height** setting. On phones the grid has
  two columns and uses 75% of that height.

### Masonry - Product Images

The same Masonry pattern, but each cell shows **up to 3 images of one product**:

- 3 images: one tall image beside two stacked ones. In the narrow cells on
  desktop they stack instead: one large image above two small ones.
- Fewer images: the group shrinks to fit. The count is passed as `data-count`
  so the CSS can handle it.
- On phones there is one product group per row.
- The product title and button appear once, over the whole group.

## Product cards

- The title and button sit over the image and are always visible, because touch
  screens have no hover.
- The button is a `<span>`, not a link: the whole card is already a link, and a
  link inside a link is invalid HTML.
- Overlay text is always white, because it sits on a dark gradient over the
  image rather than on the section background.

## Image sizes

Each template gives the browser a `sizes` hint so it downloads an image of a
suitable size:

| Template | Desktop | Phone |
| --- | --- | --- |
| Default | 100vw ÷ number of products (at least 5vw) | 45vw |
| Full width | 100vw ÷ number of products | 45vw |
| Masonry | 62vw wide cards, 32vw narrow, 94vw for a full-width last card | 50vw |
| Masonry - Product Images | 31vw wide cells, 16vw narrow, 47vw for a full-width last cell | 50vw, or 25vw for narrow cells |

Use `vw` numbers only. CSS variables don't work in `sizes`
([gotchas](gotchas.md#no-css-variables-in-img-sizes)).

## Skeleton

The placeholder looks (`snippets/lookbook-skeleton.liquid`) show a title bar, a
line of text and a row of 4 cards (2 on phones) with a light shimmer. The
shimmer is off for visitors who prefer reduced motion. Placeholders are hidden
from screen readers, which hear a hidden "Loading..." status instead.

## Adding a template

1. Create the component in `src/lookbook/templates/`. It renders the whole look:
   `EntryHeader`, the products, and its own width (`page-width` or not).
2. Add it to `TEMPLATES` in `src/lookbook/templates/index.jsx`.
3. Add the choice to the Template field in the metaobject definition.
4. If it shows more than one image per product, update `imagesPerProduct` in
   `src/lookbook/storefront.js`.
5. Run `npm run build`.

Put responsive rules in CSS (keyed off a class or `data-` attribute), not in
inline styles: inline styles can't use media queries.
