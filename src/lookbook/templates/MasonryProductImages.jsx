/*
 * Template: Masonry - Product Images
 *
 * The Masonry rhythm, but each cell holds a GROUP rather than a single picture:
 * one product contributes up to three of its own images, arranged in their own
 * small masonry inside the cell. So there are two nested grids —
 *
 *   outer   `.lookbook__products--masonry` — one cell per product, the same
 *           4-card wide/narrow rhythm the plain Masonry template uses. It is
 *           reused rather than reimplemented, so a change to the rhythm applies
 *           to both templates at once.
 *   inner   `.lookbook__group-images` — that product's images inside the cell.
 *
 * The title and button belong to the group, drawn once per product over the
 * whole cluster, not once per image.
 *
 * A product with fewer than three images in Shopify simply renders a smaller
 * group; the inner grid reshapes itself from the `data-count` attribute rather
 * than the missing pictures being invented or the product being dropped.
 *
 * This does not use ProductCard: that component is one image plus an overlay,
 * and a group is a cluster plus one overlay. They share styling hooks
 * (`lookbook__product`, `lookbook__product-link`, `lookbook__product-overlay`)
 * so the two stay visually consistent.
 */

import EntryHeader from './EntryHeader.jsx';

/* Mirrors the outer spans in the stylesheet: slots 0 and 3 are the wide cells. */
function groupSizes(index, count) {
  const isTrailingFull = index === count - 1 && count % 2 === 1;
  if (isTrailingFull) return '(min-width: 750px) 47vw, 50vw';

  const slot = index % 4;
  const isWide = slot === 0 || slot === 3;

  /*
   * Halved against the plain Masonry figures because a cell is split between
   * the images inside it — the largest image in a wide group covers about half
   * the cell, not all of it.
   */
  return isWide ? '(min-width: 750px) 31vw, 50vw' : '(min-width: 750px) 16vw, 25vw';
}

function ProductGroup({ product, index, count, ctaLabel }) {
  const { title, url, images = [] } = product;
  const sizes = groupSizes(index, count);

  return (
    <li className="lookbook__product lookbook__group">
      <a className="lookbook__product-link" href={url}>
        {/*
          data-count drives the inner arrangement from CSS, so the 1-, 2- and
          3-image cases are handled without branching the markup.
        */}
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
            /* A span, not an anchor — the group is already inside a link. */
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
          /* See MasonryGrid.jsx: writing --masonry-row inline would outrank the
             stylesheet's mobile override, so the setting goes to its own
             property and the used value is derived in CSS. */
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
