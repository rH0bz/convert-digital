/*
 * Default template: products on one row inside the page width.
 * The row scrolls if it overflows; on phones products wrap into two columns.
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
              // Each card's share of the row, or about half the screen on phones.
              // Plain vw only: CSS variables don't work in sizes (docs/gotchas.md).
              sizes={`(min-width: 750px) ${Math.max(5, Math.round(100 / products.length))}vw, 45vw`}
            />
          ))}
        </ul>
      )}
    </article>
  );
}
