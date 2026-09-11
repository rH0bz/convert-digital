/*
 * Full width template: like Default, but the look spans the whole screen.
 * .lookbook__entry--full adds the side padding that page-width would give.
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
              // Each card's share of the full screen, or about half on phones.
              sizes={`(min-width: 750px) ${Math.round(100 / products.length)}vw, 45vw`}
            />
          ))}
        </ul>
      )}
    </article>
  );
}
