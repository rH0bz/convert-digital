/*
 * Template: Full width
 *
 * Identical row behaviour to Default — one row, however many products — but the
 * entry spans the whole viewport instead of the theme container. It is the
 * absence of `page-width` that does that: the section wrapper no longer
 * constrains its children, so each template declares its own width.
 *
 * `.lookbook__entry--full` keeps the same 1.5rem side gutter `page-width` uses,
 * so a full-width look lines up with the rest of the page at the edges without
 * inheriting the max-width.
 */

import EntryHeader from './EntryHeader.jsx';
import ProductCard from '../ProductCard.jsx';

export default function FullWidthRow({ entry, showSubHeading, showDescription, productCtaLabel }) {
  const { products } = entry;

  return (
    <article className="lookbook__entry lookbook__entry--full">
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
              // Full bleed, so a card is the viewport split by the product count.
              sizes={`(min-width: 750px) ${Math.round(100 / products.length)}vw, 45vw`}
            />
          ))}
        </ul>
      )}
    </article>
  );
}
