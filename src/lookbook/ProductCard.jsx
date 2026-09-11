/*
 * One product card: the image, with the title and button over it.
 * Used by Default, Full width and Masonry. Each template passes its own `sizes`.
 */

export default function ProductCard({
  product,
  sizes = '(min-width: 750px) 25vw, 50vw',
  ctaLabel,
}) {
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
              // A span, not a link: the whole card is already a link.
              <span className="lookbook__product-cta">{ctaLabel}</span>
            )}
          </div>
        </div>
      </a>
    </li>
  );
}
