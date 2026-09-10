/*
 * Template: Masonry
 *
 * Same container width as Default (`page-width`), but instead of one row the
 * products fall into a masonry rhythm: cards alternate wide/narrow and between
 * two heights, repeating every four cards over a 6-column base.
 *
 * The spans themselves live in `.lookbook__products--masonry` in
 * assets/section-lookbook.css as :nth-child rules rather than being computed
 * here, because the rhythm has to change at the mobile breakpoint and an inline
 * style cannot carry a media query. This file only passes down what CSS cannot
 * work out on its own: the row unit, and each card's `sizes` hint.
 *
 * The Template choice this renders was originally worded "Fluid Grid" and is
 * now "Masonry"; the registry still resolves the old wording, so entries saved
 * before the rename keep their layout.
 */

import EntryHeader from './EntryHeader.jsx';
import ProductCard from '../ProductCard.jsx';

/*
 * Roughly how much of the viewport a card covers, so the browser can pick a
 * sensible image. Mirrors the spans in the stylesheet — slots 0 and 3 are the
 * span-4 cards, slots 1 and 2 the span-2 ones — and must be updated alongside
 * them. Overshooting only costs a slightly larger pick; undershooting shows a
 * blurry image, so these round up.
 */
function cardSizes(index, count) {
  // Matches `:last-child:nth-child(odd)`: an odd count widens the final card.
  const isTrailingFull = index === count - 1 && count % 2 === 1;
  if (isTrailingFull) return '(min-width: 750px) 94vw, 50vw';

  const slot = index % 4;
  const isWide = slot === 0 || slot === 3;

  // Mobile is a flat two-up, so the narrow branch applies to every card there.
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
          /*
           * Writes --masonry-row-setting, not --masonry-row: the stylesheet
           * derives the used value from this so its mobile override still
           * applies. An inline --masonry-row would outrank the media query.
           * Left unset when the caller gave no value, so the stylesheet default
           * stands.
           */
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
