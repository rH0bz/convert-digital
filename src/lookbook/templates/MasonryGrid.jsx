/*
 * Masonry template: wide and narrow cards in a repeating 4-card pattern.
 * The layout is in CSS (.lookbook__products--masonry); see docs/templates-and-styles.md.
 */

import EntryHeader from './EntryHeader.jsx';
import ProductCard from '../ProductCard.jsx';

// Image size hint per card, matching the CSS pattern: cards 1 and 4 of every 4 are wide.
function cardSizes(index, count) {
  // An odd last card spans the full width.
  const isTrailingFull = index === count - 1 && count % 2 === 1;
  if (isTrailingFull) return '(min-width: 750px) 94vw, 50vw';

  const slot = index % 4;
  const isWide = slot === 0 || slot === 3;

  // On phones every card is half the screen.
  return isWide ? '(min-width: 750px) 62vw, 50vw' : '(min-width: 750px) 32vw, 50vw';
}

export default function MasonryGrid({
  entry,
  showSubHeading,
  showDescription,
  masonryRowHeight,
  productCtaLabel,
}) {
  const { products } = entry;

  return (
    <article className="lookbook__entry page-width">
      <EntryHeader
        entry={entry}
        showSubHeading={showSubHeading}
        showDescription={showDescription}
      />

      {products.length > 0 && (
        <ul
          className="lookbook__products lookbook__products--masonry list-unstyled"
          // Sets --masonry-row-setting, not --masonry-row, so the phone CSS still applies (docs/gotchas.md).
          style={
            masonryRowHeight
              ? { '--masonry-row-setting': `${masonryRowHeight}px` }
              : undefined
          }
        >
          {products.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              ctaLabel={productCtaLabel}
              sizes={cardSizes(index, products.length)}
            />
          ))}
        </ul>
      )}
    </article>
  );
}
