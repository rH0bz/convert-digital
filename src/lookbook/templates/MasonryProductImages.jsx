/*
 * Masonry - Product Images template: the Masonry pattern, but each cell shows up
 * to 3 images of one product. See docs/templates-and-styles.md.
 */

import EntryHeader from './EntryHeader.jsx';

// Image size hint per image, matching the Masonry pattern. Images share their cell, so the values are smaller.
function groupSizes(index, count) {
  const isTrailingFull = index === count - 1 && count % 2 === 1;
  if (isTrailingFull) return '(min-width: 750px) 47vw, 50vw';

  const slot = index % 4;
  const isWide = slot === 0 || slot === 3;

  return isWide ? '(min-width: 750px) 31vw, 50vw' : '(min-width: 750px) 16vw, 25vw';
}

function ProductGroup({ product, index, count, ctaLabel }) {
  const { title, url, images = [] } = product;
  const sizes = groupSizes(index, count);

  return (
    <li className="lookbook__product lookbook__group">
      <a className="lookbook__product-link" href={url}>
        {/* data-count lets the CSS lay out 1, 2 or 3 images. */}
        <div className="lookbook__group-images" data-count={images.length}>
          {images.length > 0 ? (
            images.map((image, imageIndex) => (
              <div className="lookbook__group-image" key={image.src ?? imageIndex}>
                <img
                  src={image.src}
                  srcSet={image.srcset}
                  sizes={sizes}
                  alt={image.alt}
                  width={image.width}
                  height={image.height}
                  loading="lazy"
                />
              </div>
            ))
          ) : (
            <div className="lookbook__product-media--empty" aria-hidden="true" />
          )}
        </div>

        <div className="lookbook__product-overlay">
          <h4 className="lookbook__product-title">{title}</h4>

          {ctaLabel && (
            // A span, not a link: the group is already inside a link.
            <span className="lookbook__product-cta">{ctaLabel}</span>
          )}
        </div>
      </a>
    </li>
  );
}

export default function MasonryProductImages({
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
          className="lookbook__products lookbook__products--masonry lookbook__products--groups list-unstyled"
          // Same as MasonryGrid: set --masonry-row-setting so the phone CSS still applies.
          style={
            masonryRowHeight
              ? { '--masonry-row-setting': `${masonryRowHeight}px` }
              : undefined
          }
        >
          {products.map((product, index) => (
            <ProductGroup
              key={product.id}
              product={product}
              index={index}
              count={products.length}
              ctaLabel={productCtaLabel}
            />
          ))}
        </ul>
      )}
    </article>
  );
}
