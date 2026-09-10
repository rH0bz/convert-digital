/*
 * One product tile, shared by Default, Full width and Masonry, so a change to
 * how a product reads applies to all three at once. Masonry - Product Images
 * draws a group of images per product and has its own markup.
 *
 * The card is the image: the title and the call to action sit over it rather
 * than below, so the whole tile is media and the layouts stay on a clean grid.
 * Price and availability are deliberately not shown, and are not in the
 * payload either — see snippets/lookbook.liquid before adding them.
 *
 * `sizes` differs per template — a one-row layout and a masonry grid hand the
 * browser very different widths — so each template passes its own rather than
 * this file guessing.
 */

export default function ProductCard({
  product,
  sizes = '(min-width: 750px) 25vw, 50vw',
  ctaLabel,
}) {
  /*
   * `images` is always an array, even for the templates that draw one picture —
   * the payload normalises that so every template reads a product the same way.
   */
  const { title, url, images = [] } = product;
  const image = images[0];

  return (
    <li className="lookbook__product">
      <a className="lookbook__product-link" href={url}>
        <div className="lookbook__product-media">
          {image ? (
            <img
              src={image.src}
              srcSet={image.srcset}
              sizes={sizes}
              alt={image.alt}
              width={image.width}
              height={image.height}
              loading="lazy"
            />
          ) : (
            <div className="lookbook__product-media--empty" aria-hidden="true" />
          )}

          <div className="lookbook__product-overlay">
            <h4 className="lookbook__product-title">{title}</h4>

            {ctaLabel && (
              /*
               * A span, not an anchor. The whole card is already a link to the
               * product, and an <a> inside an <a> is invalid HTML that browsers
               * recover from by splitting the outer link. The title supplies the
               * link's accessible name, so nothing is lost by styling this as a
               * button rather than making it one.
               */
              <span className="lookbook__product-cta">{ctaLabel}</span>
            )}
          </div>
        </div>
      </a>
    </li>
  );
}
