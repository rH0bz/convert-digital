/*
 * Template: Default
 *
 * From 750px up, products sit on a single row, however many there are — the
 * row divides the width equally rather than wrapping to a second line.
 * Constrained to the theme's normal container via `page-width`.
 *
 * Once the products can no longer hold the minimum card width the row scrolls
 * sideways instead of crushing the cards. Phones are the exception: there the
 * products wrap two up, because a card cut off at the screen edge looks broken.
 * Both behaviours live in `.lookbook__products--row` in
 * assets/section-lookbook.css.
 */

import EntryHeader from './EntryHeader.jsx';
import ProductCard from '../ProductCard.jsx';

export default function DefaultRow({ entry, showSubHeading, showDescription, productCtaLabel }) {
  const { products } = entry;

  return (
    <article className="lookbook__entry page-width">
      <EntryHeader
        entry={entry}
        showSubHeading={showSubHeading}
        showDescription={showDescription}
      />

      {products.length > 0 && (
        <ul className="lookbook__products lookbook__products--row list-unstyled">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              ctaLabel={productCtaLabel}
              /*
               * From 750px every product shares the row, so a card is roughly
               * the container split by the product count; below that the row
               * wraps two up, so a card is about half the screen. Expressed in
               * vw, not `var(--page-width)`: `sizes` is resolved without element
               * style context, so a custom property there never resolves and
               * the whole value falls back to 100vw. Overshooting slightly on
               * viewports wider than the container only costs a larger pick.
               */
              sizes={`(min-width: 750px) ${Math.max(5, Math.round(100 / products.length))}vw, 45vw`}
            />
          ))}
        </ul>
      )}
    </article>
  );
}
